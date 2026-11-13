// Notes créées SANS réseau : gardées sur le téléphone (IndexedDB « memoa-outbox », séparée des brouillons de 72 h, qui ne sont pas touchés),
// puis envoyées automatiquement au retour du réseau. Aucun doublon possible : le cours et la note reçoivent leur identifiant sur le téléphone
// AVANT l'envoi ; si la connexion coupe en plein envoi, le renvoi retombe sur le même identifiant (« déjà reçu » = succès).
import { isConfigured, supabase } from './supabase'

export type OutboxKind = 'new_course' | 'add_note'
export interface OutboxItem {
  /** Identifiant de la NOTE (créé sur le téléphone). */
  id: string
  userId: string
  kind: OutboxKind
  /** new_course : identifiant du futur cours (créé sur le téléphone) · add_note : cours choisi. */
  courseId: string
  /** Nom du cours au moment du choix : sert si le cours a disparu avant l'envoi. */
  courseTitle: string
  title: string
  content: string
  source: string
  /** Empreinte pour refuser un doublon (double appui). */
  key: string
  createdAt: number
  attempts: number
  state: 'pending' | 'failed'
  lastError?: string
  /** Cours de remplacement (cours supprimé avant l'envoi), créé une seule fois même après une coupure. */
  recoverId?: string
}
export interface CachedCourse { id: string; title: string }

export const newUuid = (): string => {
  const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const b = new Uint8Array(16)
  if (c) c.getRandomValues(b); else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

function hashKey(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0).toString(36) + ':' + s.length
}

/* ------------------------------ stockage local ------------------------------ */
export interface Store { list(userId: string): Promise<OutboxItem[]>; put(i: OutboxItem): Promise<void>; del(id: string): Promise<void>; get(id: string): Promise<OutboxItem | null> }

let dbp: Promise<IDBDatabase> | null = null
function openDb(): Promise<IDBDatabase> {
  if (dbp) return dbp
  dbp = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error("Le stockage de ce téléphone n'est pas disponible (navigation privée ?)."))
    const req = indexedDB.open('memoa-outbox', 1)
    req.onupgradeneeded = () => { const s = req.result.createObjectStore('items', { keyPath: 'id' }); s.createIndex('userId', 'userId') }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Stockage impossible.'))
  })
  dbp.catch(() => { dbp = null })
  return dbp
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction('items', mode)
    const r = fn(t.objectStore('items'))
    // On n'annonce « enregistré » qu'une fois la transaction VRAIMENT terminée (sauvegarde fiable).
    t.oncomplete = () => resolve(r.result)
    t.onerror = () => reject(t.error ?? new Error('Stockage impossible.'))
    t.onabort = () => reject(t.error ?? new Error('Stockage impossible.'))
  })
}
export const idbStore: Store = {
  list: (u) => tx<OutboxItem[]>('readonly', (s) => s.index('userId').getAll(u)),
  put: async (i) => { await tx('readwrite', (s) => s.put(i)) },
  del: async (id) => { await tx('readwrite', (s) => s.delete(id)) },
  get: async (id) => (await tx<OutboxItem | undefined>('readonly', (s) => s.get(id))) ?? null
}

const changed = () => window.dispatchEvent(new Event('memoa-outbox'))

/* ------------------------------ liste des cours en local ------------------------------ */
const CACHE = (u: string) => `memoa-courses-cache:${u}`
export function cacheCourses(userId: string, list: { id: string; title: string }[]) {
  try { localStorage.setItem(CACHE(userId), JSON.stringify(list.map((c) => ({ id: c.id, title: c.title })))) } catch { /* plein : la liste en local sera simplement plus ancienne */ }
}
/** Cours disponibles sans réseau : la dernière liste connue + les cours créés hors connexion et pas encore envoyés. */
export async function offlineCourses(userId: string, store: Store = idbStore): Promise<CachedCourse[]> {
  let base: CachedCourse[] = []
  try { const v = JSON.parse(localStorage.getItem(CACHE(userId)) ?? '[]'); if (Array.isArray(v)) base = v } catch { /* liste illisible */ }
  let pending: OutboxItem[] = []
  try { pending = await store.list(userId) } catch { /* stockage indisponible */ }
  const have = new Set(base.map((c) => c.id))
  const virtual = pending.filter((p) => p.kind === 'new_course' && !have.has(p.courseId)).map((p) => ({ id: p.courseId, title: p.courseTitle }))
  return [...virtual.reverse(), ...base]
}

/* ------------------------------ mise en file ------------------------------ */
export interface EnqueueInput { userId: string; kind: OutboxKind; courseId?: string; courseTitle: string; title: string; content: string; source?: string }
const SOURCES = ['texte', 'voix', 'audio', 'video', 'pdf', 'photo']

/** Garde la note sur le téléphone. Renvoie seulement quand elle est bien écrite ET relue. Refuse un doublon identique encore en attente. */
let chain: Promise<unknown> = Promise.resolve()
/** Les mises en file passent une par une : trois appuis en même temps ne peuvent pas créer trois notes. */
export function enqueueNote(inp: EnqueueInput, store: Store = idbStore): Promise<OutboxItem> {
  const run = chain.then(() => enqueueNow(inp, store))
  chain = run.catch(() => undefined)
  return run
}
async function enqueueNow(inp: EnqueueInput, store: Store): Promise<OutboxItem> {
  const content = inp.content.trim()
  if (!content) throw new Error('Ta note est vide.')
  if (content.length > 60000) throw new Error('Cette note est trop longue. Découpe-la en plusieurs notes.')
  const courseTitle = inp.courseTitle.trim().slice(0, 80)
  if (!courseTitle) throw new Error('Donne un nom à ton cours.')
  const target = inp.kind === 'new_course' ? '' : inp.courseId ?? ''
  if (inp.kind === 'add_note' && !target) throw new Error('Choisis un cours.')
  const key = hashKey([inp.userId, inp.kind, target, courseTitle, inp.title.trim(), content].join('\u0001'))
  const same = (await store.list(inp.userId)).find((i) => i.key === key)
  if (same) return same // double appui : on ne crée rien de plus
  const item: OutboxItem = {
    id: newUuid(), userId: inp.userId, kind: inp.kind,
    courseId: inp.kind === 'new_course' ? newUuid() : target,
    courseTitle, title: (inp.title.trim() || courseTitle).slice(0, 80), content,
    source: SOURCES.includes(inp.source ?? '') ? (inp.source as string) : 'texte',
    key, createdAt: Date.now(), attempts: 0, state: 'pending'
  }
  await store.put(item)
  const back = await store.get(item.id)
  if (!back || back.content !== content) throw new Error("La note n'a pas pu être gardée sur ton téléphone. Garde-la en brouillon.")
  changed()
  return item
}

export async function pendingCount(userId: string, store: Store = idbStore): Promise<number> {
  try { return (await store.list(userId)).length } catch { return 0 }
}

/* ------------------------------ envoi ------------------------------ */
export interface Client {
  insertCourse(row: { id: string; user_id: string; title: string }): Promise<{ error: { code?: string; message?: string } | null }>
  getCourse(id: string): Promise<{ data: { id: string; title: string; deleted_at: string | null } | null; error: { code?: string; message?: string } | null }>
  insertNote(row: { id: string; user_id: string; course_id: string; title: string; content: string; source: string }): Promise<{ error: { code?: string; message?: string } | null }>
}
const supa = (): Client => ({
  insertCourse: async (row) => ({ error: (await supabase!.from('courses').insert(row)).error }),
  getCourse: async (id) => { const r = await supabase!.from('courses').select('id,title,deleted_at').eq('id', id).maybeSingle(); return { data: r.data as never, error: r.error } },
  insertNote: async (row) => ({ error: (await supabase!.from('notes').insert(row)).error })
})

type Err = { code?: string; message?: string }
const isDup = (e: Err | null) => !!e && (e.code === '23505' || /duplicate key/i.test(e.message ?? ''))
/** Réseau coupé, session à renouveler, serveur occupé : on réessaiera plus tard, sans compter d'échec. */
const isTransient = (e: Err | null) => !!e && ((typeof navigator !== 'undefined' && navigator.onLine === false) || /failed to fetch|networkerror|network request|load failed|fetch|timeout|jwt|\b50\d\b/i.test(`${e.code ?? ''} ${e.message ?? ''}`))
const MAX_ATTEMPTS = 5

export interface SyncResult { sent: number; left: number; notices: string[] }
let running = false

/** Envoie les notes en attente, dans l'ordre. S'arrête au premier problème de réseau. Peut être appelée n'importe quand, plusieurs fois : sans risque de doublon. */
export async function syncOutbox(userId: string, deps: { store?: Store; client?: Client; online?: () => boolean } = {}): Promise<SyncResult> {
  const store = deps.store ?? idbStore
  const online = deps.online ?? (() => typeof navigator === 'undefined' || navigator.onLine !== false)
  const res: SyncResult = { sent: 0, left: 0, notices: [] }
  if (running || !online()) return { ...res, left: await pendingCount(userId, store) }
  if (!deps.client && (!isConfigured || !supabase)) return res
  running = true
  try {
    if (!deps.client) {
      const { data } = await supabase!.auth.getSession()
      if (data.session?.user.id !== userId) return { ...res, left: await pendingCount(userId, store) } // pas (ou plus) connecté : on garde tout
    }
    const client = deps.client ?? supa()
    const items = (await store.list(userId)).filter((i) => i.state === 'pending').sort((a, b) => a.createdAt - b.createdAt)
    for (const it of items) {
      try {
        let courseId = it.courseId
        let isNew = it.kind === 'new_course'
        if (it.kind === 'add_note') {
          const c = await client.getCourse(it.courseId)
          if (c.error) throw c.error
          if (!c.data || c.data.deleted_at) {
            // Cours supprimé avant la synchronisation : la note n'est pas perdue, elle est rangée dans un nouveau cours du même nom.
            if (!it.recoverId) { it.recoverId = newUuid(); await store.put(it) }
            courseId = it.recoverId; isNew = true
            res.notices.push(`Le cours « ${it.courseTitle} » n'existe plus : ta note « ${it.title} » a été rangée dans un nouveau cours du même nom.`)
          }
        }
        if (isNew) {
          const r = await client.insertCourse({ id: courseId, user_id: userId, title: it.courseTitle })
          if (r.error && !isDup(r.error)) throw r.error
          if (r.error) { // déjà créé (envoi précédent coupé) : on vérifie qu'il n'est pas dans la corbeille
            const c = await client.getCourse(courseId)
            if (c.error) throw c.error
            if (c.data?.deleted_at) { await store.del(it.id); continue } // supprimé volontairement : on n'y remet rien
          }
        }
        const n = await client.insertNote({ id: it.id, user_id: userId, course_id: courseId, title: it.title, content: it.content, source: it.source })
        if (n.error && !isDup(n.error)) throw n.error
        await store.del(it.id)
        res.sent++
      } catch (e) {
        const err = e as Err
        if (isTransient(err)) break // réseau instable : on s'arrête, tout est gardé
        it.attempts++; it.lastError = String(err?.message ?? 'Erreur').slice(0, 200)
        if (it.attempts >= MAX_ATTEMPTS) it.state = 'failed' // jamais effacée : la note reste sur le téléphone
        await store.put(it).catch(() => {})
      }
    }
    res.left = await pendingCount(userId, store)
    return res
  } finally {
    running = false
    changed()
  }
}

/** Version sûre entre plusieurs onglets ouverts en même temps. */
export async function syncOutboxLocked(userId: string): Promise<SyncResult | null> {
  const locks = (typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined)
  if (!locks) return syncOutbox(userId)
  return locks.request('memoa-outbox-sync', { ifAvailable: true }, async (lock) => (lock ? syncOutbox(userId) : null))
}
