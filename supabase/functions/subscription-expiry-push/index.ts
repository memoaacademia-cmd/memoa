// subscription-expiry-push : prévient les abonnés Premium que leur abonnement se termine (7 jours, 2 jours, jour de la fin).
// Appelée toutes les heures par la planification (cron) de Supabase, jamais par le navigateur : elle exige l'en-tête x-cron-secret.
// Fichier autonome (à coller tel quel dans l'éditeur du tableau de bord Supabase, fonction « subscription-expiry-push »).
// Secrets attendus : VAPID_PRIVATE_KEY, CRON_SECRET. Facultatifs : VAPID_SUBJECT, SITE_URL.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

// Clé PUBLIQUE (la même que dans src/lib/features.ts).
const VAPID_PUBLIC_KEY = 'BFSlSc6xPsaWeTvtbl7chIzW2mlhTSyEa1Z1XCkoC3Zx-QveBK_ygbfEZGWQKDgSt01GYbQ5Tbp2zah7E-eaZhs'

const DAY = 86_400_000
type Tier = '7d' | '2d' | '0d'

const TEXT: Record<Tier, { title: string; body: string }> = {
  '7d': { title: 'Memoa Premium', body: "Ton abonnement expire dans 1 semaine. Recharge dès maintenant pour continuer avec Memoa Premium : ton cursus académique en a besoin !" },
  '2d': { title: 'Memoa Premium', body: "Ton abonnement expire dans 2 jours. Recharge dès maintenant pour continuer avec Memoa Premium : ton cursus académique en a besoin !" },
  '0d': { title: 'Memoa Premium', body: "Ton abonnement est terminé. Recharge pour retrouver Memoa Premium. Ton cursus académique en a besoin." }
}

/** Palier à envoyer maintenant (ou null). Le palier du jour même n'est envoyé qu'une fois l'abonnement réellement terminé. */
function tierFor(expiresAt: number, now: number): Tier | null {
  const left = expiresAt - now
  if (left <= 0) return left > -3 * DAY ? '0d' : null
  if (left <= 2 * DAY) return '2d'
  if (left <= 7 * DAY) return '7d'
  return null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Méthode non autorisée', { status: 405 })
  const secret = Deno.env.get('CRON_SECRET')
 const recu = (req.headers.get('x-cron-secret') ?? '').trim()
  if (!secret || recu !== secret.trim()) {
    console.error('401 cron', { secretDefini: !!secret, enteteRecu: !!recu, longueurAttendue: secret?.length ?? 0, longueurRecue: recu.length })
    return new Response('Non autorisé', { status: 401 })
  }
  // Heures calmes : pas de notification la nuit (heure de Kinshasa = UTC+1).
  const kinHour = (new Date().getUTCHours() + 1) % 24
  if (kinHour < 8 || kinHour >= 20) return new Response(JSON.stringify({ skipped: 'nuit' }), { headers: { 'Content-Type': 'application/json' } })

  const priv = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!priv || !VAPID_PUBLIC_KEY) return new Response('Notifications non configurées', { status: 503 })
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contact@memoa.app', VAPID_PUBLIC_KEY, priv)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const now = Date.now()

  // Dernière date de fin de chaque abonné, parmi ceux qui se terminent bientôt ou viennent de se terminer.
  const { data: rows, error } = await admin.from('subscriptions').select('user_id,expires_at')
    .gt('expires_at', new Date(now - 3 * DAY).toISOString()).lt('expires_at', new Date(now + 7 * DAY).toISOString()).limit(5000)
  if (error) { console.error('subscription-expiry-push lecture :', error.message); return new Response('Erreur de lecture', { status: 500 }) }

  // Un abonné qui a re-payé a une date de fin plus lointaine : on ne le prévient pas pour l'ancienne.
  const { data: later } = await admin.from('subscriptions').select('user_id').gte('expires_at', new Date(now + 7 * DAY).toISOString()).limit(5000)
  const renewed = new Set((later ?? []).map((r) => r.user_id))

  const due: { user_id: string; expires_at: string; tier: Tier }[] = []
  for (const r of rows ?? []) {
    if (renewed.has(r.user_id)) continue
    const tier = tierFor(new Date(r.expires_at).getTime(), now)
    if (tier) due.push({ user_id: r.user_id, expires_at: r.expires_at, tier })
  }
  if (!due.length) return new Response(JSON.stringify({ sent: 0 }), { headers: { 'Content-Type': 'application/json' } })

  const ids = [...new Set(due.map((d) => d.user_id))]
  const [{ data: done }, { data: subs }] = await Promise.all([
    admin.from('expiry_notices').select('user_id,tier,expires_at').in('user_id', ids),
    admin.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth').in('user_id', ids)
  ])
  const sentKey = new Set((done ?? []).map((d) => `${d.user_id}|${d.tier}|${new Date(d.expires_at).getTime()}`))

  let sent = 0
  let removed = 0
  let failed = 0
  for (const d of due) {
    const key = `${d.user_id}|${d.tier}|${new Date(d.expires_at).getTime()}`
    if (sentKey.has(key)) continue // une seule fois par palier
    // On note le rappel d'abord : même si l'envoi échoue, on ne répète pas (le bandeau dans l'appli prend le relais).
    await admin.from('expiry_notices').insert({ user_id: d.user_id, tier: d.tier, expires_at: d.expires_at })
    const payload = JSON.stringify({ ...TEXT[d.tier], url: (Deno.env.get('SITE_URL') ?? './') + '#/premium' })
    for (const s of (subs ?? []).filter((x) => x.user_id === d.user_id)) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 12 * 3600 })
        sent++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) { removed++; await admin.from('push_subscriptions').delete().eq('id', s.id) } else { failed++; console.error('subscription-expiry-push envoi : HTTP', status ?? '?') }
      }
    }
  }
  return new Response(JSON.stringify({ sent, removed, failed }), { headers: { 'Content-Type': 'application/json' } })
})
