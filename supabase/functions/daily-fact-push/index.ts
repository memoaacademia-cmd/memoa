// daily-fact-push : envoie chaque jour la notification « Le savais-tu ? » aux étudiants qui l'ont acceptée.
// Appelée par la planification (cron) de Supabase, jamais par le navigateur : elle exige l'en-tête x-cron-secret.
// Fichier autonome (à coller tel quel dans l'éditeur du tableau de bord Supabase, fonction « daily-fact-push »).
// Secrets attendus : VAPID_PRIVATE_KEY, CRON_SECRET. Facultatifs : VAPID_SUBJECT, SITE_URL.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

// Clé PUBLIQUE (la même que dans src/lib/features.ts).
const VAPID_PUBLIC_KEY = 'BKEwywdGG-Xrulany_C1IdB4BG6TZJ7eKZGy3qH6wwZ1KCY98FpDU2B6y5LASnPFAX9ynEmWRca5S0WFNzTijzo'

const MESSAGES = (name: string): Array<{ title: string; body: string }> => [
  { title: `${name} a une surprise pour toi`, body: 'Ton « Savais-tu ? » du jour est prêt.' },
  { title: `${name} t'attend`, body: 'Une petite énigme, une histoire ou une blague t’attend dans Memoa.' },
  { title: 'Le savais-tu ?', body: `${name} a choisi quelque chose pour toi aujourd'hui.` },
  { title: `Coucou de la part de ${name}`, body: 'Viens découvrir la carte du jour, ça prend une minute.' }
]

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Méthode non autorisée', { status: 405 })
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) return new Response('Non autorisé', { status: 401 })

  const priv = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!priv || !VAPID_PUBLIC_KEY) return new Response('Notifications non configurées', { status: 503 })
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contact@memoa.app', VAPID_PUBLIC_KEY, priv)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  // Pas deux fois dans la même journée, même si la planification se déclenche en double (12 h : l'envoi de 8 h suit bien celui de la veille, y compris après le passage de 17 h à 8 h).
  const since = new Date(Date.now() - 12 * 3_600_000).toISOString()
  const { data: subs, error } = await admin.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth,last_sent_at').or(`last_sent_at.is.null,last_sent_at.lt.${since}`).limit(5000)
  if (error) { console.error('daily-fact-push lecture :', error.message); return new Response('Erreur de lecture', { status: 500 }) }

  const ids = [...new Set((subs ?? []).map((s) => s.user_id))]
  const names = new Map<string, string>()
  if (ids.length) {
    const { data: profs } = await admin.from('profiles').select('id,memo_name').in('id', ids)
    for (const p of profs ?? []) names.set(p.id, p.memo_name || 'Memo')
  }

  let sent = 0
  let removed = 0
  let failed = 0
  const list = subs ?? []
  for (let i = 0; i < list.length; i += 20) {
    await Promise.all(list.slice(i, i + 20).map(async (s) => {
      const name = names.get(s.user_id) ?? 'Memo'
      const pool = MESSAGES(name)
      const msg = pool[Math.floor(Math.random() * pool.length)]
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ ...msg, url: Deno.env.get('SITE_URL') ?? './' }),
          { TTL: 12 * 3600 }
        )
        sent++
        await admin.from('push_subscriptions').update({ last_sent_at: new Date().toISOString() }).eq('id', s.id)
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) { removed++; await admin.from('push_subscriptions').delete().eq('id', s.id) } else { failed++; console.error('daily-fact-push envoi : HTTP', status ?? '?') }
      }
    }))
  }
  return new Response(JSON.stringify({ sent, removed, failed }), { headers: { 'Content-Type': 'application/json' } })
})
