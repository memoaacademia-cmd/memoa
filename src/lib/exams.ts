// Examens : date par cours, compte à rebours, rappels (notifications) et import depuis l'horaire.
// Les examens vivent dans la table exams (migration 0023, RLS : ses lignes seulement). Une copie locale permet d'afficher le compte à rebours sans réseau.
// Les rappels sont envoyés par la fonction serveur exam-reminder-push (planifiée), jamais par l'appli.
import { useEffect, useState } from 'react'
import { isConfigured, supabase } from './supabase'
import { kinToday } from './review'
import { track } from './track'

/** Type d'échéance : examen, interrogation ou remise de TP. Les trois font passer les cartes du cours en premier. */
export type ExamKind = 'exam' | 'interro' | 'tp'
export const KIND_LABEL: Record<ExamKind, string> = { exam: 'Examen', interro: 'Interrogation', tp: 'Remise de TP' }
export const KIND_CHOICES: { kind: ExamKind; label: string }[] = [{ kind: 'exam', label: 'Examen' }, { kind: 'interro', label: 'Interro' }, { kind: 'tp', label: 'Remise de TP' }]
export const asKind = (v: unknown): ExamKind => (v === 'interro' || v === 'tp' ? v : 'exam')

export interface Exam {
  id: string
  kind: ExamKind
  course_id: string | null
  title: string
  /** AAAA-MM-JJ (jour de Kinshasa). */
  exam_date: string
  /** HH:MM ou null. */
  exam_time: string | null
  room: string | null
  source: 'manual' | 'schedule'
}
export type ExamInput = Omit<Exam, 'id'> & { id?: string }

const DAY = 864e5
const CACHE = (u: string) => `memoa-exams:${u}`
const cols = 'id,course_id,kind,title,exam_date,exam_time,room,source'
const changed = () => window.dispatchEvent(new Event('memoa-exams'))

/** Jours entre aujourd'hui (Kinshasa) et la date : 0 = aujourd'hui, 1 = demain, négatif = passé. */
export const daysUntil = (date: string, today = kinToday()): number => Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / DAY)
export const countdownLabel = (n: number): string => (n === 0 ? 'Aujourd’hui' : n === 1 ? 'Demain' : n > 1 ? `Dans ${n} jours` : n === -1 ? 'Hier' : `Il y a ${-n} jours`)
export const shortCountdown = (n: number): string => (n === 0 ? 'Aujourd’hui' : n === 1 ? 'Demain' : `J-${n}`)
export const fmtDate = (date: string): string => new Date(date + 'T00:00:00Z').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' })

export const cachedExams = (uid: string): Exam[] => { try { const v = JSON.parse(localStorage.getItem(CACHE(uid)) ?? '[]'); return Array.isArray(v) ? v : [] } catch { return [] } }
const writeCache = (uid: string, l: Exam[]) => { try { localStorage.setItem(CACHE(uid), JSON.stringify(l)) } catch { /* plein : la liste sera relue du serveur */ } }

function needNet() {
  if (!isConfigured || !supabase) throw new Error('Les examens ne sont pas disponibles.')
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('Pour enregistrer un examen, il faut une connexion internet.')
  return supabase
}

export async function loadExams(uid: string): Promise<Exam[]> {
  if (!isConfigured || !supabase || (typeof navigator !== 'undefined' && navigator.onLine === false)) return cachedExams(uid)
  try {
    const { data, error } = await supabase.from('exams').select(cols).order('exam_date').limit(400)
    if (error) throw error
    const list = ((data ?? []) as Exam[]).map((e) => ({ ...e, kind: asKind(e.kind) }))
    writeCache(uid, list)
    changed()
    return list
  } catch { return cachedExams(uid) }
}

export async function saveExam(uid: string, e: ExamInput): Promise<void> {
  const sb = needNet()
  const row = { course_id: e.course_id, kind: asKind(e.kind), title: e.title.trim().slice(0, 120), exam_date: e.exam_date, exam_time: e.exam_time || null, room: e.room?.trim().slice(0, 80) || null, source: e.source }
  if (!row.title) throw new Error('Donne un nom à l’examen.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.exam_date)) throw new Error('Choisis une date.')
  const q = e.id ? sb.from('exams').update(row).eq('id', e.id) : sb.from('exams').insert({ ...row, user_id: uid })
  const { error } = await q
  if (error) throw new Error(error.message)
  track('exam_saved', { source: e.source, update: !!e.id })
  await loadExams(uid)
}

export async function deleteExam(uid: string, id: string): Promise<void> {
  const sb = needNet()
  const { error } = await sb.from('exams').delete().eq('id', id)
  if (error) throw new Error(error.message)
  track('exam_deleted')
  await loadExams(uid)
}

/** Enregistre plusieurs examens (import de l'horaire). Ignore ceux qui existent déjà (même cours ou même nom, même jour). Renvoie le nombre ajouté. */
export async function saveExamsBulk(uid: string, list: ExamInput[]): Promise<number> {
  const sb = needNet()
  const have = await loadExams(uid)
  const key = (x: { course_id: string | null; title: string; exam_date: string }) => `${x.course_id ?? norm(x.title)}|${x.exam_date}`
  const known = new Set(have.map(key))
  const fresh = list.filter((x) => { const k = key(x); if (known.has(k)) return false; known.add(k); return true })
  if (!fresh.length) return 0
  const { error } = await sb.from('exams').insert(fresh.map((e) => ({ user_id: uid, course_id: e.course_id, kind: asKind(e.kind), title: e.title.trim().slice(0, 120), exam_date: e.exam_date, exam_time: e.exam_time || null, room: e.room?.trim().slice(0, 80) || null, source: e.source })))
  if (error) throw new Error(error.message)
  track('schedule_saved', { count: fresh.length })
  await loadExams(uid)
  return fresh.length
}

/** Prochain examen (aujourd'hui compris) et examens à venir, triés par date. */
export const upcoming = (list: Exam[]): Exam[] => list.filter((e) => daysUntil(e.exam_date) >= 0).sort((a, b) => (a.exam_date + (a.exam_time ?? '')).localeCompare(b.exam_date + (b.exam_time ?? '')))
export const nextExam = (list: Exam[]): Exam | null => upcoming(list)[0] ?? null

/** Cours qui ont un examen, une interrogation ou une remise de TP dans les 21 prochains jours → nombre de jours (le plus proche). Sert à passer leurs cartes en premier. */
export function priorityByCourse(list: Exam[], horizon = 21): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of list) {
    if (!e.course_id) continue
    const n = daysUntil(e.exam_date)
    if (n >= 0 && n <= horizon && (out[e.course_id] === undefined || n < out[e.course_id])) out[e.course_id] = n
  }
  return out
}

export function useExams(uid: string | undefined): { exams: Exam[]; ready: boolean } {
  const [exams, setExams] = useState<Exam[]>(() => (uid ? cachedExams(uid) : []))
  const [ready, setReady] = useState(() => !!uid && cachedExams(uid).length > 0)
  useEffect(() => {
    if (!uid) { setExams([]); return }
    let alive = true
    const local = () => { if (alive) setExams(cachedExams(uid)) }
    local()
    void loadExams(uid).then((l) => { if (alive) { setExams(l); setReady(true) } })
    window.addEventListener('memoa-exams', local)
    return () => { alive = false; window.removeEventListener('memoa-exams', local) }
  }, [uid])
  return { exams, ready }
}

/* ------------------------------ jours de rappel ------------------------------ */
export const REMINDER_CHOICES: { days: number; label: string }[] = [
  { days: 14, label: '14 jours avant' }, { days: 7, label: '7 jours avant' }, { days: 3, label: '3 jours avant' },
  { days: 1, label: 'La veille' }, { days: 0, label: 'Le jour même' }
]
export const DEFAULT_REMINDERS = [7, 3, 1, 0]

export async function loadReminderDays(uid: string): Promise<number[]> {
  if (!isConfigured || !supabase) return DEFAULT_REMINDERS
  try {
    const { data } = await supabase.from('exam_prefs').select('days').eq('user_id', uid).maybeSingle()
    return Array.isArray(data?.days) ? (data!.days as number[]) : DEFAULT_REMINDERS
  } catch { return DEFAULT_REMINDERS }
}
export async function saveReminderDays(uid: string, days: number[]): Promise<void> {
  const sb = needNet()
  const clean = [...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 30))].sort((a, b) => b - a).slice(0, 6)
  const { error } = await sb.from('exam_prefs').upsert({ user_id: uid, days: clean, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) throw new Error(error.message)
  track('exam_reminders_changed', { count: clean.length })
}

/* ------------------------------ lecture de l'horaire ------------------------------ */
export interface ScheduleRow { include: boolean; kind: ExamKind; group: string; title: string; course_id: string | null; exam_date: string; exam_time: string; room: string }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** Cours de l'étudiant qui correspond le mieux au nom lu dans l'horaire (comparaison souple). null si rien de sûr. */
export function matchCourse(title: string, courses: { id: string; title: string }[]): string | null {
  const t = norm(title)
  if (t.length < 3) return null
  let best: { id: string; score: number } | null = null
  for (const c of courses) {
    const n = norm(c.title)
    if (!n) continue
    let score = 0
    if (n === t) score = 3
    else if (n.includes(t) || t.includes(n)) score = 2
    else {
      const a = new Set(t.split(' ').filter((w) => w.length > 3))
      const b = n.split(' ').filter((w) => w.length > 3)
      const common = b.filter((w) => a.has(w)).length
      if (a.size && b.length && common / Math.min(a.size, b.length) >= 0.6) score = 1
    }
    if (score && (!best || score > best.score)) best = { id: c.id, score }
  }
  return best?.id ?? null
}

/** « 08h30-10h30 », « 8h30 », « 08:30 » → « 08:30 » (heure de début). Vide si illisible. */
export function cleanTime(v: unknown): string {
  const m = /(\d{1,2})\s*[h:H]\s*(\d{2})?/.exec(String(v ?? ''))
  if (!m) return ''
  const h = Number(m[1]); const mi = Number(m[2] ?? '0')
  return h <= 23 && mi <= 59 ? `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}` : ''
}
/** « 24/10/2026 », « samedi 24-10-2026 » ou « 2026-10-24 » → « 2026-10-24 ». Vide si illisible (jour et mois : jamais inversés, on est au format français). */
export function cleanDate(v: unknown): string {
  const s = String(v ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = /(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{4})/.exec(s)
  if (!m) return ''
  const d = Number(m[1]); const mo = Number(m[2])
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return ''
  return `${m[3]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Réponse de Memo (tableau JSON, parfois entouré de texte) → lignes à vérifier. Une ligne sans date reste dans la liste : l'étudiant la complète ou la décoche. */
export function parseSchedule(reply: string, courses: { id: string; title: string }[]): ScheduleRow[] {
  const a = reply.indexOf('[')
  const b = reply.lastIndexOf(']')
  if (a < 0 || b <= a) return []
  let raw: unknown
  try { raw = JSON.parse(reply.slice(a, b + 1)) } catch { return [] }
  if (!Array.isArray(raw)) return []
  const out: ScheduleRow[] = []
  for (const r of raw.slice(0, 80)) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const title = String(o.matiere ?? o.cours ?? '').trim().slice(0, 120)
    if (!title) continue
    const date = cleanDate(o.date)
    const time = cleanTime(o.heure)
    const group = String(o.groupe ?? '').trim().slice(0, 40)
    out.push({ include: !!date, kind: asKind(o.type), group, title, course_id: matchCourse(title, courses), exam_date: date, exam_time: time, room: String(o.salle ?? '').trim().slice(0, 80) })
  }
  return out
}

/** Signale une date douteuse (déjà passée, ou à plus de 14 mois) pour que l'étudiant la vérifie avant d'enregistrer. */
export function dateWarning(date: string): string | null {
  if (!date) return 'Date à compléter'
  const n = daysUntil(date)
  if (n < 0) return 'Cette date est déjà passée'
  if (n > 430) return 'Date très lointaine : vérifie l’année'
  return null
}
