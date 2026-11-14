// draft-reminder-push : prévient par notification les étudiants dont un brouillon disparaît dans 5 h ou moins.
// Appelée par la planification (cron) toutes les 30 minutes, jamais par le navigateur : elle exige l'en-tête x-cron-secret.
// Fichier autonome (à coller tel quel dans l'éditeur du tableau de bord Supabase).
// Secrets attendus : VAPID_PRIVATE_KEY, CRON_SECRET. Facultatifs : VAPID_SUBJECT, SITE_URL. « Verify JWT » doit être désactivé.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

// Clé PUBLIQUE (la même que dans src/lib/features.ts).
const VAPID_PUBLIC_KEY = 'BFSlSc6xPsaWeTvtbl7chIzW2mlhTSyEa1Z1XCkoC3Zx-QveBK_ygbfEZGWQKDgSt01GYbQ5Tbp2zah7E-eaZhs'
const WARN_MS = 5 * 3_600_000

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Méthode non autorisée', { status: 405 })
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) return new Response('Non autorisé', { status: 401 })

  const priv = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!priv || !VAPID_PUBLIC_KEY) return new Response('Notifications non configurées', { status: 503 })
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contact@memoa.app', VAPID_PUBLIC_KEY, priv)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const now = Date.now()

  // Nettoyage : les lignes dont l'heure est passée depuis plus d'un jour ne servent plus.
  await admin.from('drafts_expiry').delete().lt('expires_at', new Date(now - 24 * 3_600_000).toISOString())

  const { data: rows, error } = await admin
    .from('drafts_expiry')
    .select('user_id,draft_id,expires_at')
    .is('notified_at', null)
    .gt('expires_at', new Date(now).toISOString())
    .lte('expires_at', new Date(now + WARN_MS).toISOString())
    .limit(5000)
  if (error) { console.error('draft-reminder-push lecture :', error.message); return new Response('Erreur de lecture', { status: 500 }) }

  // Un seul message par étudiant, calé sur son brouillon le plus pressé.
  const byUser = new Map<string, { ids: string[]; soonest: number }>()
  for (const r of rows ?? []) {
    const t = new Date(r.expires_at).getTime()
    const cur = byUser.get(r.user_id) ?? { ids: [], soonest: t }
    cur.ids.push(r.draft_id)
    cur.soonest = Math.min(cur.soonest, t)
    byUser.set(r.user_id, cur)
  }
  const userIds = [...byUser.keys()]
  if (!userIds.length) return new Response(JSON.stringify({ users: 0, sent: 0 }), { headers: { 'Content-Type': 'application/json' } })

  const { data: subs, error: subErr } = await admin.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth').in('user_id', userIds)
  if (subErr) { console.error('draft-reminder-push abonnements :', subErr.message); return new Response('Erreur de lecture', { status: 500 }) }

  let sent = 0
  let removed = 0
  let failed = 0
  const reached = new Set<string>()
  const list = subs ?? []
  for (let i = 0; i < list.length; i += 20) {
    await Promise.all(list.slice(i, i + 20).map(async (s) => {
      const info = byUser.get(s.user_id)
      if (!info) return
      const hours = Math.max(1, Math.round((info.soonest - now) / 3_600_000))
      const body = `Tes notes disparaissent dans ${hours} h : génère ton PDF maintenant, sinon tu les perdras.`
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: 'Tes notes vont disparaître', body, url: Deno.env.get('SITE_URL') ?? './', tag: 'memoa-draft' }),
          { TTL: 4 * 3600 }
        )
        sent++
        reached.add(s.user_id)
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) { removed++; await admin.from('push_subscriptions').delete().eq('id', s.id) } else { failed++; console.error('draft-reminder-push envoi : HTTP', status ?? '?') }
      }
    }))
  }

  // Une seule notification par brouillon : on ne marque que ceux dont l'étudiant a été joint.
  for (const uid of reached) {
    const info = byUser.get(uid)
    if (info) await admin.from('drafts_expiry').update({ notified_at: new Date().toISOString() }).eq('user_id', uid).in('draft_id', info.ids)
  }
  return new Response(JSON.stringify({ users: userIds.length, sent, removed, failed }), { headers: { 'Content-Type': 'application/json' } })
})
