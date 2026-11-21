// exam-reminder-push : prévient par notification les étudiants dont un examen approche (7 jours, 3 jours, la veille, le jour même — réglable par étudiant).
// Appelée par la planification (cron) deux fois par jour, jamais par le navigateur : elle exige l'en-tête x-cron-secret.
// Fichier autonome (à coller tel quel dans l'éditeur du tableau de bord Supabase). Même configuration que draft-reminder-push.
// Secrets attendus : VAPID_PRIVATE_KEY, CRON_SECRET. Facultatifs : VAPID_SUBJECT, SITE_URL. « Verify JWT » doit être désactivé.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

// Clé PUBLIQUE (la même que dans src/lib/features.ts).
const VAPID_PUBLIC_KEY = 'BFSlSc6xPsaWeTvtbl7chIzW2mlhTSyEa1Z1XCkoC3Zx-QveBK_ygbfEZGWQKDgSt01GYbQ5Tbp2zah7E-eaZhs'
const DEFAULT_DAYS = [7, 3, 1, 0]
const DAY = 86_400_000

type Item = { examId: string; days: number; title: string; time: string | null; kind: string }

const NOUN: Record<string, string> = { exam: 'examen', interro: 'interrogation', tp: 'remise du TP' }
const noun = (k: string) => NOUN[k] ?? 'examen'
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function line(i: Item): string {
  const at = i.time ? ` à ${i.time}` : ''
  const n = noun(i.kind)
  if (i.days === 0) return `Aujourd’hui : ${n} de ${i.title}${at}. Bon courage !`
  if (i.days === 1) return `Demain : ${n} de ${i.title}${at}. Une dernière révision ce soir ?`
  return `${cap(n)} de ${i.title} dans ${i.days} jours. Quelques cartes aujourd’hui ?`
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Méthode non autorisée', { status: 405 })
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) return new Response('Non autorisé', { status: 401 })

  const priv = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!priv || !VAPID_PUBLIC_KEY) return new Response('Notifications non configurées', { status: 503 })
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contact@memoa.app', VAPID_PUBLIC_KEY, priv)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  // Jour calendaire à Kinshasa (UTC+1), comme partout dans Memoa.
  const today = new Date(Date.now() + 3_600_000).toISOString().slice(0, 10)
  const todayMs = Date.parse(today + 'T00:00:00Z')
  const horizon = new Date(todayMs + 30 * DAY).toISOString().slice(0, 10)

  const { data: exams, error } = await admin.from('exams').select('id,user_id,kind,title,exam_date,exam_time').gte('exam_date', today).lte('exam_date', horizon).limit(5000)
  if (error) { console.error('exam-reminder-push lecture :', error.message); return new Response('Erreur de lecture', { status: 500 }) }
  if (!exams?.length) return new Response(JSON.stringify({ users: 0, sent: 0 }), { headers: { 'Content-Type': 'application/json' } })

  const userIds = [...new Set(exams.map((e) => e.user_id))]
  const [{ data: prefs }, { data: done }] = await Promise.all([
    admin.from('exam_prefs').select('user_id,days').in('user_id', userIds),
    admin.from('exam_reminders').select('exam_id,days_before').in('exam_id', exams.map((e) => e.id))
  ])
  const daysOf = new Map<string, number[]>((prefs ?? []).map((p) => [p.user_id as string, (p.days as number[]) ?? DEFAULT_DAYS] as [string, number[]]))
  const sentSet = new Set((done ?? []).map((d) => `${d.exam_id}:${d.days_before}`))

  // Rappels dus aujourd'hui, regroupés par étudiant (une seule notification par étudiant et par passage).
  const byUser = new Map<string, Item[]>()
  for (const e of exams) {
    const n = Math.round((Date.parse(e.exam_date + 'T00:00:00Z') - todayMs) / DAY)
    const wanted = daysOf.get(e.user_id) ?? DEFAULT_DAYS
    if (!wanted.includes(n) || sentSet.has(`${e.id}:${n}`)) continue
    const list = byUser.get(e.user_id) ?? []
    list.push({ examId: e.id, days: n, title: String(e.title).slice(0, 60), time: e.exam_time, kind: String(e.kind ?? 'exam') })
    byUser.set(e.user_id, list)
  }
  const dueUsers = [...byUser.keys()]
  if (!dueUsers.length) return new Response(JSON.stringify({ users: 0, sent: 0 }), { headers: { 'Content-Type': 'application/json' } })

  const { data: subs, error: subErr } = await admin.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth').in('user_id', dueUsers)
  if (subErr) { console.error('exam-reminder-push abonnements :', subErr.message); return new Response('Erreur de lecture', { status: 500 }) }

  const site = (Deno.env.get('SITE_URL') ?? './').replace(/#.*$/, '')
  let sent = 0, removed = 0, failed = 0
  const reached = new Set<string>()
  const list = subs ?? []
  for (let i = 0; i < list.length; i += 20) {
    await Promise.all(list.slice(i, i + 20).map(async (s) => {
      const items = (byUser.get(s.user_id) ?? []).slice().sort((a, b) => a.days - b.days)
      if (!items.length) return
      const f = cap(noun(items[0].kind))
      const title = items[0].days === 0 ? `${f} aujourd’hui` : items[0].days === 1 ? `${f} demain` : 'Une échéance approche'
      const body = items.length === 1 ? line(items[0]) : `${items.length} échéances approchent : ${items.slice(0, 3).map((x) => x.title).join(', ')}${items.length > 3 ? '…' : ''}. Ouvre Memoa pour réviser.`
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title, body, url: `${site}#/examens`, tag: 'memoa-exam' }),
          { TTL: 6 * 3600, urgency: 'high' }
        )
        sent++
        reached.add(s.user_id)
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) { removed++; await admin.from('push_subscriptions').delete().eq('id', s.id) } else { failed++; console.error('exam-reminder-push envoi : HTTP', status ?? '?') }
      }
    }))
  }

  // Un rappel n'est marqué « envoyé » que si l'étudiant a été joint : sinon le second passage de la journée réessaie.
  const rows: { exam_id: string; days_before: number }[] = []
  for (const uid of reached) for (const it of byUser.get(uid) ?? []) rows.push({ exam_id: it.examId, days_before: it.days })
  if (rows.length) await admin.from('exam_reminders').upsert(rows, { onConflict: 'exam_id,days_before', ignoreDuplicates: true })
  return new Response(JSON.stringify({ users: dueUsers.length, sent, removed, failed }), { headers: { 'Content-Type': 'application/json' } })
})
