// partner-alerts : alertes du Programme partenaire.
//  1) ADMINISTRATEUR : un push sur ton téléphone quand un partenaire demande à être activé ou demande un retrait.
//  2) PARTENAIRES (option, éteinte par défaut) : « Nouvelle personne inscrite via ton lien » et « Un de tes filleuls vient de s'abonner : +1 $ ».
// Appelée toutes les 5 minutes par la planification (cron) de Supabase, jamais par le navigateur : elle exige l'en-tête x-cron-secret.
// Fichier autonome (à coller tel quel dans l'éditeur du tableau de bord Supabase ; désactive « Verify JWT »).
// Secrets attendus (déjà présents pour les autres notifications) : VAPID_PRIVATE_KEY, CRON_SECRET. Facultatifs : VAPID_SUBJECT, SITE_URL.
// Aucune donnée personnelle dans les journaux : seulement des nombres.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

// Clé PUBLIQUE (la même que dans src/lib/features.ts).
const VAPID_PUBLIC_KEY = 'BFSlSc6xPsaWeTvtbl7chIzW2mlhTSyEa1Z1XCkoC3Zx-QveBK_ygbfEZGWQKDgSt01GYbQ5Tbp2zah7E-eaZhs'

/** Push aux PARTENAIRES (nouvel inscrit, +1 $). false = éteint. Pour l'allumer : mets true puis redéploie la fonction. */
const PARTNER_PUSH_ENABLED = false

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Méthode non autorisée', { status: 405 })
  const secret = Deno.env.get('CRON_SECRET')
  const recu = (req.headers.get('x-cron-secret') ?? '').trim()
  if (!secret || recu !== secret.trim()) return new Response('Non autorisé', { status: 401 })

  const priv = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!priv) return new Response('Notifications non configurées', { status: 503 })
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contact@memoa.app', VAPID_PUBLIC_KEY, priv)
  const site = Deno.env.get('SITE_URL') ?? './'

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const stats = { adminPush: 0, partnerPush: 0, removed: 0, failed: 0 }

  async function pushTo(userIds: string[], payload: { title: string; body: string; url?: string; tag?: string }) {
    if (!userIds.length) return 0
    const { data: subs } = await admin.from('push_subscriptions').select('id,endpoint,p256dh,auth').in('user_id', userIds)
    let sent = 0
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...payload, url: payload.url ?? site }), { TTL: 12 * 3600 })
        sent++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) { stats.removed++; await admin.from('push_subscriptions').delete().eq('id', s.id) } else { stats.failed++; console.error('partner-alerts envoi : HTTP', status ?? '?') }
      }
    }
    return sent
  }

  try {
    // ---------- 1) Alerte administrateur ----------
    const [{ data: newPartners }, { data: newPayouts }] = await Promise.all([
      admin.from('partners').select('id').eq('status', 'pending').is('admin_notified_at', null).limit(200),
      admin.from('partner_payouts').select('id').eq('status', 'requested').is('admin_notified_at', null).limit(200)
    ])
    const nP = newPartners?.length ?? 0
    const nR = newPayouts?.length ?? 0
    if (nP || nR) {
      const { data: admins } = await admin.from('app_admins').select('user_id')
      const parts: string[] = []
      if (nP) parts.push(`${nP} demande${nP > 1 ? 's' : ''} de partenaire à valider`)
      if (nR) parts.push(`${nR} retrait${nR > 1 ? 's' : ''} à payer`)
      // On marque « prévenu » d'abord : un échec d'envoi ne doit pas répéter l'alerte toutes les 5 minutes (la liste SQL reste la référence).
      const now = new Date().toISOString()
      if (nP) await admin.from('partners').update({ admin_notified_at: now }).in('id', newPartners!.map((r) => r.id))
      if (nR) await admin.from('partner_payouts').update({ admin_notified_at: now }).in('id', newPayouts!.map((r) => r.id))
      stats.adminPush = await pushTo((admins ?? []).map((a) => a.user_id), { title: 'Programme partenaire', body: parts.join(' · '), tag: 'memoa-partner-admin' })
    }

    // ---------- 2) Push aux partenaires (option) ----------
    // Heures calmes : pas de notification la nuit (heure de Kinshasa = UTC+1). Seuls les événements des dernières 24 h sont annoncés (pas d'avalanche à l'activation).
    const kinHour = (new Date().getUTCHours() + 1) % 24
    if (PARTNER_PUSH_ENABLED && kinHour >= 8 && kinHour < 20) {
      const since = new Date(Date.now() - 24 * 3_600_000).toISOString()
      const { data: refs } = await admin.from('referrals').select('referred_user_id,partner_id').is('notified_at', null).gt('created_at', since).limit(500)
      const { data: earns } = await admin.from('partner_earnings').select('id,partner_id,amount_usd').is('notified_at', null).gt('created_at', since).limit(500)
      const partnerIds = [...new Set([...(refs ?? []).map((r) => r.partner_id), ...(earns ?? []).map((e) => e.partner_id)])]
      if (partnerIds.length) {
        const { data: partners } = await admin.from('partners').select('id,user_id').in('id', partnerIds).eq('status', 'active')
        const owner = new Map((partners ?? []).filter((p) => p.user_id).map((p) => [p.id, p.user_id as string]))
        const now = new Date().toISOString()
        for (const pid of partnerIds) {
          const uid = owner.get(pid)
          if (!uid) continue
          const r = (refs ?? []).filter((x) => x.partner_id === pid)
          const e = (earns ?? []).filter((x) => x.partner_id === pid)
          if (e.length) {
            const total = e.reduce((n, x) => n + Number(x.amount_usd), 0)
            stats.partnerPush += await pushTo([uid], { title: 'Programme partenaire', body: `Un de tes filleuls vient de s’abonner : +${total.toFixed(0)} $`, url: site + '#/moi', tag: 'memoa-partner-earn' })
            await admin.from('partner_earnings').update({ notified_at: now }).in('id', e.map((x) => x.id))
          }
          if (r.length) {
            stats.partnerPush += await pushTo([uid], { title: 'Programme partenaire', body: r.length > 1 ? `${r.length} nouvelles personnes inscrites via ton lien` : 'Nouvelle personne inscrite via ton lien', url: site + '#/moi', tag: 'memoa-partner-signup' })
            await admin.from('referrals').update({ notified_at: now }).in('referred_user_id', r.map((x) => x.referred_user_id))
          }
        }
      }
    }
    return json(stats)
  } catch (e) {
    console.error('partner-alerts :', (e as Error).message)
    return json({ error: 'Erreur' }, 500)
  }
})
