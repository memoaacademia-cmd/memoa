// cards-reminder-push : prévient par notification les étudiants qui ont des cartes de révision à faire.
//  - « Nouvelles cartes » : des cartes jamais révisées existent depuis plus d'une heure (au plus un message toutes les 12 h).
//  - « Cartes à réviser » : au moins 5 cartes attendent ; au plus un rappel tous les 2 jours (message plus insistant à partir de 30 cartes).
//  - Après 3 messages de suite sans que l'étudiant révise, on s'arrête jusqu'à sa prochaine révision.
//  - Jamais la nuit : seulement entre 9 h et 20 h (heure de Kinshasa).
// Appelée par la planification (cron) toutes les heures, jamais par le navigateur : elle exige l'en-tête x-cron-secret.
// Fichier autonome (à coller tel quel dans l'éditeur du tableau de bord Supabase). Il faut avoir exécuté la migration 0025.
// Secrets attendus : VAPID_PRIVATE_KEY, CRON_SECRET. Facultatifs : VAPID_SUBJECT, SITE_URL. « Verify JWT » doit être désactivé.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

// Clé PUBLIQUE (la même que dans src/lib/features.ts).
const VAPID_PUBLIC_KEY = 'BFSlSc6xPsaWeTvtbl7chIzW2mlhTSyEa1Z1XCkoC3Zx-QveBK_ygbfEZGWQKDgSt01GYbQ5Tbp2zah7E-eaZhs'
const HOUR = 3_600_000
const FIRST_HOUR = 9 // pas de notification avant 9 h (Kinshasa)
const LAST_HOUR = 20 // ni à partir de 20 h
const NEW_EVERY_H = 12 // « nouvelles cartes » : au plus toutes les 12 h
const NAG_EVERY_H = 48 // « cartes à réviser » : au plus tous les 2 jours
const NAG_MIN_CARDS = 5 // en dessous, ça ne vaut pas une notification
const MANY_CARDS = 30 // à partir de là, le message est plus insistant
const MAX_IGNORED = 3 // rappels d'affilée sans révision avant de se taire

interface Candidate { uid: string; due_n: number; fresh_n: number; fresh_courses: number; top_title: string | null; sent_at: string | null; ignored_n: number; reviewed_since: boolean }
interface Msg { title: string; body: string }

const short = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)

/** Quel message envoyer à cet étudiant maintenant ? null = aucun. */
function messageFor(c: Candidate, now: number): Msg | null {
  const ignored = c.reviewed_since ? 0 : c.ignored_n // il a révisé depuis le dernier message : on repart de zéro
  if (ignored >= MAX_IGNORED) return null
  const hoursSince = c.sent_at ? (now - new Date(c.sent_at).getTime()) / HOUR : Infinity
  if (c.fresh_n >= 1 && hoursSince >= NEW_EVERY_H) {
    const where = c.fresh_courses > 1 ? `dans ${c.fresh_courses} cours` : `dans « ${short(c.top_title ?? 'ton cours', 40)} »`
    return {
      title: 'Nouvelles cartes de révision',
      body: c.fresh_n === 1 ? `Tu as une nouvelle carte de révision ${where}. Passe à réviser !` : `Tu as ${c.fresh_n} nouvelles cartes de révision ${where}. Passe à réviser !`
    }
  }
  if (c.due_n >= NAG_MIN_CARDS && hoursSince >= NAG_EVERY_H) {
    return c.due_n >= MANY_CARDS
      ? { title: 'Tes cartes t’attendent', body: `Tu as ${c.due_n} cartes de révision qui s’accumulent. Passe à réviser : quelques minutes par jour suffisent.` }
      : { title: 'Cartes à réviser', body: `Tu as ${c.due_n} cartes à réviser. Passe à réviser pour bien retenir !` }
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Méthode non autorisée', { status: 405 })
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) return new Response('Non autorisé', { status: 401 })

  const priv = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!priv || !VAPID_PUBLIC_KEY) return new Response('Notifications non configurées', { status: 503 })
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contact@memoa.app', VAPID_PUBLIC_KEY, priv)

  const now = Date.now()
  const hourKin = new Date(now + HOUR).getUTCHours() // Kinshasa = UTC+1, sans heure d'été
  if (hourKin < FIRST_HOUR || hourKin >= LAST_HOUR) return new Response(JSON.stringify({ skipped: 'nuit' }), { headers: { 'Content-Type': 'application/json' } })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { data: cands, error } = await admin.rpc('cards_reminder_candidates')
  if (error) { console.error('cards-reminder-push lecture :', error.message); return new Response('Erreur de lecture', { status: 500 }) }

  const todo = new Map<string, { msg: Msg; ignored: number }>()
  for (const c of (cands ?? []) as Candidate[]) {
    const msg = messageFor(c, now)
    if (msg) todo.set(c.uid, { msg, ignored: c.reviewed_since ? 0 : c.ignored_n })
  }
  const userIds = [...todo.keys()]
  if (!userIds.length) return new Response(JSON.stringify({ users: 0, sent: 0 }), { headers: { 'Content-Type': 'application/json' } })

  // Les abonnements, par paquets (la liste d'identifiants passe dans l'adresse de la requête : on la garde courte).
  const subs: { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }[] = []
  for (let i = 0; i < userIds.length; i += 150) {
    const { data, error: subErr } = await admin.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth').in('user_id', userIds.slice(i, i + 150))
    if (subErr) { console.error('cards-reminder-push abonnements :', subErr.message); return new Response('Erreur de lecture', { status: 500 }) }
    subs.push(...(data ?? []))
  }

  const site = (Deno.env.get('SITE_URL') ?? './').replace(/#.*$/, '')
  let sent = 0
  let removed = 0
  let failed = 0
  const reached = new Set<string>()
  for (let i = 0; i < subs.length; i += 20) {
    await Promise.all(subs.slice(i, i + 20).map(async (s) => {
      const t = todo.get(s.user_id)
      if (!t) return
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: t.msg.title, body: t.msg.body, url: `${site}#/revision`, tag: 'memoa-cards' }),
          { TTL: 12 * 3600 }
        )
        sent++
        reached.add(s.user_id)
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) { removed++; await admin.from('push_subscriptions').delete().eq('id', s.id) } else { failed++; console.error('cards-reminder-push envoi : HTTP', status ?? '?') }
      }
    }))
  }

  // On note la date et le nombre de rappels d'affilée seulement pour ceux qu'on a réellement joints.
  const stamp = new Date().toISOString()
  const rows = [...reached].map((uid) => ({ user_id: uid, last_sent_at: stamp, ignored: (todo.get(uid)?.ignored ?? 0) + 1 }))
  for (let i = 0; i < rows.length; i += 500) {
    const { error: upErr } = await admin.from('card_push_state').upsert(rows.slice(i, i + 500), { onConflict: 'user_id' })
    if (upErr) console.error('cards-reminder-push état :', upErr.message)
  }
  return new Response(JSON.stringify({ users: userIds.length, sent, removed, failed }), { headers: { 'Content-Type': 'application/json' } })
})
