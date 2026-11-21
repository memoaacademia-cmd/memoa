// Cartes de révision (répétition espacée). Les cartes vivent dans la table review_cards (migration 0022, RLS : ses lignes seulement).
// HORS LIGNE : la liste des cartes est gardée sur le téléphone ; chaque réponse (« Je savais » / « À revoir ») met la carte à jour tout de suite
// en local ET entre dans une file d'attente qui part au retour du réseau (même déclencheurs que les notes : OutboxSync, voir OfflineSave.tsx).
// La file est locale (localStorage) et séparée de outbox.ts, qui reste réservé aux notes.
import { useEffect, useState } from 'react'
import { askAI, touchToday } from './api'
import { isConfigured, supabase } from './supabase'
import { track } from './track'

export interface Card {
  id: string
  course_id: string
  course_title: string
  question: string
  answer: string
  /** Boîte 1 à 5. */
  box: number
  /** Jour (Kinshasa, AAAA-MM-JJ) à partir duquel la carte est à réviser. */
  due_date: string
  last_review: string | null
}

/** Délai (en jours) avant la prochaine révision, selon la boîte 1 à 5. « À revoir » renvoie en boîte 1. */
export const DELAYS = [1, 2, 4, 7, 15]
export const MAX_PER_SESSION = 30
const DAY = 864e5

/** Jour calendaire à Kinshasa (UTC+1), comme la série et les points. */
export const kinToday = () => new Date(Date.now() + 3_600_000).toISOString().slice(0, 10)
export const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10)

/** Nouvel état d'une carte après la réponse. Je savais → boîte suivante (5 au plus) ; À revoir → boîte 1. */
export function nextState(box: number, knew: boolean, today = kinToday()): { box: number; due_date: string; last_review: string } {
  const b = knew ? Math.min(5, Math.max(1, box) + 1) : 1
  return { box: b, due_date: addDays(today, DELAYS[b - 1]), last_review: today }
}

export const isDue = (c: Pick<Card, 'due_date'>, today = kinToday()) => c.due_date <= today

/** Cartes à réviser, COURS PAR COURS : on finit toutes les cartes d'un cours avant de passer au suivant (jamais de mélange).
 *  Ordre des cours : d'abord ceux qui ont une échéance proche (examen, interrogation ou remise de TP ; priority = jours restants, le plus proche en tête),
 *  puis les autres, le cours le plus en retard d'abord. Dans un cours : les plus en retard d'abord, un peu de hasard entre cartes du même jour. */
export function dueCards(cards: Card[], courseId?: string | null, today = kinToday(), priority: Record<string, number> = {}): Card[] {
  const due = cards.filter((c) => isDue(c, today) && (!courseId || c.course_id === courseId))
  const oldest = new Map<string, string>() // plus ancienne date d'échéance par cours
  for (const c of due) if (!oldest.has(c.course_id) || c.due_date < oldest.get(c.course_id)!) oldest.set(c.course_id, c.due_date)
  const rank = (id: string) => (priority[id] === undefined ? 1e6 : priority[id])
  const order = [...oldest.keys()].sort((x, y) => rank(x) - rank(y) || (oldest.get(x)! < oldest.get(y)! ? -1 : oldest.get(x)! > oldest.get(y)! ? 1 : x < y ? -1 : 1))
  const pos = new Map(order.map((id, k) => [id, k]))
  return due
    .map((c) => ({ c, r: Math.random() }))
    .sort((a, b) => pos.get(a.c.course_id)! - pos.get(b.c.course_id)! || (a.c.due_date < b.c.due_date ? -1 : a.c.due_date > b.c.due_date ? 1 : a.r - b.r))
    .map((x) => x.c)
}

/* ------------------------------ cartes en local + file d'attente ------------------------------ */
const CACHE = (u: string) => `memoa-cards:${u}`
const QUEUE = (u: string) => `memoa-cards-queue:${u}`
const ACT = (u: string) => `memoa-cards-activity:${u}`
type Pending = { id: string; box: number; due_date: string; last_review: string }

function read<T>(key: string, fallback: T): T {
  try { const v = JSON.parse(localStorage.getItem(key) ?? 'null'); return v ?? fallback } catch { return fallback }
}
function write(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* stockage plein : on reste sur la version serveur */ }
}
const changed = () => window.dispatchEvent(new Event('memoa-cards'))

export const cachedCards = (uid: string): Card[] => read<Card[]>(CACHE(uid), [])
export const pendingReviews = (uid: string): number => read<Pending[]>(QUEUE(uid), []).length

/** Les réponses pas encore envoyées passent AVANT la version serveur : une liste serveur plus ancienne ne « ressuscite » jamais une carte déjà révisée. */
function withPending(uid: string, cards: Card[]): Card[] {
  const q = new Map(read<Pending[]>(QUEUE(uid), []).map((p) => [p.id, p]))
  return q.size ? cards.map((c) => (q.has(c.id) ? { ...c, ...q.get(c.id)! } : c)) : cards
}

const COLS = 'id,course_id,question,answer,box,due_date,last_review,courses(title,deleted_at)'
type Raw = Omit<Card, 'course_title'> & { courses: { title: string; deleted_at: string | null } | { title: string; deleted_at: string | null }[] | null }
function fromRaw(r: Raw): Card | null {
  const c = Array.isArray(r.courses) ? r.courses[0] : r.courses
  if (!c || c.deleted_at) return null // cours à la corbeille : ses cartes ne sont pas proposées
  return { id: r.id, course_id: r.course_id, course_title: c.title, question: r.question, answer: r.answer, box: r.box, due_date: r.due_date, last_review: r.last_review }
}

/** Toutes les cartes de l'étudiant : depuis le serveur si le réseau marche (et la copie locale est mise à jour), sinon la copie locale. */
export async function loadCards(uid: string): Promise<Card[]> {
  if (!isConfigured || !supabase || (typeof navigator !== 'undefined' && navigator.onLine === false)) return withPending(uid, cachedCards(uid))
  try {
    await syncReviews(uid) // d'abord envoyer ce qui attend, pour ne pas relire d'anciennes dates
    const { data, error } = await supabase.from('review_cards').select(COLS).order('due_date').limit(2000)
    if (error) throw error
    const list = ((data ?? []) as unknown as Raw[]).map(fromRaw).filter((c): c is Card => !!c)
    write(CACHE(uid), list)
    changed()
    return withPending(uid, list)
  } catch {
    return withPending(uid, cachedCards(uid))
  }
}

/** « Je savais » / « À revoir » : mis à jour tout de suite sur le téléphone, envoyé dès que possible. */
export async function answerCard(uid: string, card: Card, knew: boolean): Promise<Card> {
  const st = nextState(card.box, knew)
  const next: Card = { ...card, ...st }
  write(CACHE(uid), cachedCards(uid).map((c) => (c.id === card.id ? next : c)))
  const q = read<Pending[]>(QUEUE(uid), []).filter((p) => p.id !== card.id)
  q.push({ id: card.id, ...st })
  write(QUEUE(uid), q)
  changed()
  void syncReviews(uid)
  return next
}

let syncing = false
/** Envoie les réponses en attente (une carte = une mise à jour, sans risque de doublon) puis le jour d'activité de la série. Ne lève jamais d'erreur. */
export async function syncReviews(uid: string): Promise<void> {
  if (syncing || !isConfigured || !supabase || (typeof navigator !== 'undefined' && navigator.onLine === false)) return
  syncing = true
  try {
    let q = read<Pending[]>(QUEUE(uid), [])
    for (const p of q) {
      const { error } = await supabase.from('review_cards').update({ box: p.box, due_date: p.due_date, last_review: p.last_review }).eq('id', p.id)
      if (error) {
        if (/fetch|network|jwt|timeout|load failed/i.test(error.message)) break // réseau instable : on réessaiera, tout est gardé
        // Autre refus (ex. carte supprimée entre-temps) : on abandonne cette ligne pour ne pas bloquer les suivantes.
      }
      q = q.filter((x) => x !== p)
      write(QUEUE(uid), q)
    }
    const day = read<string>(ACT(uid), '')
    if (day && day === kinToday()) {
      try { await touchToday(uid); localStorage.removeItem(ACT(uid)) } catch { /* sera réessayé */ }
    } else if (day) localStorage.removeItem(ACT(uid)) // la règle serveur n'accepte que le jour courant : trop tard, on laisse tomber
    changed()
  } catch { /* jamais bloquant */ } finally { syncing = false }
}

/** Réviser compte pour la série de jours : marqué tout de suite si possible, sinon au retour du réseau (le même jour). */
export async function markReviewDay(uid: string): Promise<void> {
  try { await touchToday(uid) } catch { try { localStorage.setItem(ACT(uid), JSON.stringify(kinToday())) } catch { /* sans importance */ } }
}

/* ------------------------------ génération par Memo ------------------------------ */
/** « Q: … / R: … » → cartes. Tolère les variantes (« Question : », « Réponse : », réponses sur plusieurs lignes). */
export function parseCards(text: string): { question: string; answer: string }[] {
  const strict = parseStrict(text)
  return strict.length ? strict : parseLoose(text)
}

/** Enlève puces et numérotation en début de ligne (« - », « • », « 1. », « 2) »). */
const unbullet = (l: string) => l.replace(/^(?:[-*•–—]+|\d+\s*[.)])\s*/, '').trim()

function parseStrict(text: string): { question: string; answer: string }[] {
  const out: { question: string; answer: string }[] = []
  let q: string | null = null
  let a: string | null = null
  const flush = () => { if (q && a) out.push({ question: q.trim().slice(0, 400), answer: a.trim().slice(0, 800) }); q = null; a = null }
  for (const raw of text.replace(/\*\*|__|`/g, '').split(/\r?\n/)) {
    const line = unbullet(raw.trim())
    const mq = /^(?:Q|Question)\s*\d*\s*[:.)-]\s*(.+)$/i.exec(line)
    const ma = /^(?:R|Réponse|Reponse)\s*\d*\s*[:.)-]\s*(.+)$/i.exec(line)
    if (mq) { flush(); q = mq[1]; continue }
    if (ma && q !== null) { a = ma[1]; continue }
    if (!line) { if (q && a) flush(); continue }
    if (a !== null) a += ' ' + line
    else if (q !== null) q += ' ' + line
  }
  flush()
  return out.filter((c) => c.question.length >= 3 && c.answer.length >= 1)
}

/** Plan B si le modèle n'a pas respecté « Q: / R: » : une ligne qui finit par « ? » = question, la ligne suivante = réponse. */
function parseLoose(text: string): { question: string; answer: string }[] {
  const out: { question: string; answer: string }[] = []
  const lines = text.replace(/\*\*|__|`/g, '').split(/\r?\n/).map((l) => unbullet(l.trim())).filter(Boolean)
  for (let k = 0; k < lines.length - 1; k++) {
    if (!/[?？]\s*$/.test(lines[k])) continue
    const ans = lines[k + 1].replace(/^(?:R|Réponse|Reponse)\s*\d*\s*[:.)-]\s*/i, '')
    if (ans && !/[?？]\s*$/.test(ans)) { out.push({ question: lines[k].replace(/^(?:Q|Question)\s*\d*\s*[:.)-]\s*/i, '').slice(0, 400), answer: ans.slice(0, 800) }); k++ }
  }
  return out.filter((c) => c.question.length >= 3 && c.answer.length >= 1)
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** Memo crée des cartes à partir des notes du cours (à la demande : 1 point comme un quiz, Premium et essai : rien à compter ; en automatique : gratuit, une fois par cours et par jour). Renvoie le nombre de cartes ajoutées. */
export async function generateCards(uid: string, courseId: string, memo = 'Memo', opts: { auto?: boolean } = {}): Promise<number> {
  if (!isConfigured || !supabase) throw new Error("Les cartes de révision ne sont pas disponibles.")
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('Pour créer des cartes, il faut une connexion internet.')
  const existing = cachedCards(uid).filter((c) => c.course_id === courseId)
  const avoid = existing.slice(-40).map((c) => `- ${c.question}`).join('\n')
  const prompt = 'Crée des cartes de révision (question et réponse courte) à partir des notes de ce cours.' + (avoid ? `\n\nQuestions DÉJÀ existantes, ne les repose pas :\n${avoid}` : '')
  const r = await askAI({ task: 'cards', courseId, prompt, auto: opts.auto === true })
  const known = new Set(existing.map((c) => norm(c.question)))
  const fresh = parseCards(r.reply).filter((c) => !known.has(norm(c.question)))
  if (!fresh.length) throw new Error(`${memo} n'a pas réussi à préparer de cartes cette fois. Réessaie (ou ajoute d'abord des notes à ce cours).`)
  const { data, error } = await supabase.from('review_cards').insert(fresh.map((c) => ({ user_id: uid, course_id: courseId, question: c.question, answer: c.answer }))).select(COLS)
  if (error) throw new Error(error.message)
  const added = ((data ?? []) as unknown as Raw[]).map(fromRaw).filter((c): c is Card => !!c)
  write(CACHE(uid), [...cachedCards(uid), ...added])
  changed()
  track(opts.auto ? 'cards_auto_generated' : 'cards_generated', { count: added.length })
  return added.length
}

/* ------------------------------ pour l'interface ------------------------------ */
/** Cartes de l'étudiant (copie locale tout de suite, puis mise à jour réseau). Se met à jour quand une carte est révisée ou créée. */
export function useCardList(uid: string | undefined): { cards: Card[]; ready: boolean } {
  const [cards, setCards] = useState<Card[]>(() => (uid ? withPending(uid, cachedCards(uid)) : []))
  const [ready, setReady] = useState(() => !!uid && cachedCards(uid).length > 0)
  useEffect(() => {
    if (!uid) { setCards([]); return }
    let alive = true
    const local = () => { if (alive) setCards(withPending(uid, cachedCards(uid))) }
    local()
    void loadCards(uid).then((l) => { if (alive) { setCards(l); setReady(true) } })
    window.addEventListener('memoa-cards', local)
    return () => { alive = false; window.removeEventListener('memoa-cards', local) }
  }, [uid])
  return { cards, ready }
}
export const useCards = (uid: string | undefined): Card[] => useCardList(uid).cards
