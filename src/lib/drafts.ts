// Brouillons : notes gardées sur le téléphone (IndexedDB), surtout utiles sans connexion.
// Un brouillon vit 48 h à partir de sa première sauvegarde, puis il est supprimé définitivement.
// Le serveur ne reçoit JAMAIS le texte : seulement « ce brouillon disparaît à telle heure », pour pouvoir prévenir par notification.
import { track } from './track'
import { useCallback, useEffect, useState } from 'react'
import { isConfigured, supabase } from './supabase'

export const DRAFT_HOURS = 48
export const WARN_HOURS = 5
const HOUR = 3_600_000

export type DraftKind = 'course' | 'note' | 'edit'

export interface Draft {
  id: string
  userId: string
  /** course = nouveau cours · note = note à ajouter à un cours · edit = modification d'un cours existant */
  kind: DraftKind
  courseId: string | null
  noteId: string | null
  title: string
  body: string
  guide: string
  source: string
  /** Enregistrement vocal fait sans réseau, à transcrire quand le réseau revient. */
  audio: Blob | null
  createdAt: number
  updatedAt: number
  expiresAt: number
  /** Gardé SANS réseau avec « Brouillon » : créé / ajouté tout seul dès que la connexion revient (voir draftsync.ts). */
  offline?: boolean
  /** Dernier envoi automatique refusé : « credit » = plus assez de points, « error » = autre problème. Le brouillon reste là. */
  failed?: 'credit' | 'error'
  failedMsg?: string
  attempts?: number
  /** Texte déjà rédigé par l'IA (points déjà payés) : un nouvel essai ne repaie pas. */
  readyContent?: string
  /** Identifiants créés sur le téléphone avant l'envoi : une coupure en plein envoi ne crée jamais de doublon. */
  sendCourseId?: string
  sendNoteId?: string
}

const DB_NAME = 'memoa-drafts'
const STORE = 'drafts'
let dbp: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbp) return dbp
  dbp = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error("Le stockage de ce téléphone n'est pas disponible (navigation privée ?)."))
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore(STORE, { keyPath: 'id' })
      s.createIndex('userId', 'userId')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Stockage impossible.'))
  })
  dbp.catch(() => { dbp = null })
  return dbp
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const r = fn(t.objectStore(STORE))
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error ?? new Error('Stockage impossible.'))
  })
}

const changed = () => window.dispatchEvent(new Event('memoa-drafts'))

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10))

/* ------------------------- lecture / écriture locales ------------------------- */

export async function getDraft(id: string): Promise<Draft | null> {
  const d = await run<Draft | undefined>('readonly', (s) => s.get(id))
  return d && d.expiresAt > Date.now() ? d : null
}

async function allOf(userId: string): Promise<Draft[]> {
  return run<Draft[]>('readonly', (s) => s.index('userId').getAll(userId))
}

/** Brouillons actifs de l'étudiant, du plus pressé au moins pressé. Supprime d'abord ceux qui ont expiré. */
export async function listDrafts(userId: string): Promise<Draft[]> {
  await purgeExpired(userId)
  const all = await allOf(userId)
  return all.sort((a, b) => a.expiresAt - b.expiresAt)
}

export async function saveDraft(input: {
  id?: string | null
  userId: string
  kind: DraftKind
  courseId?: string | null
  noteId?: string | null
  title: string
  body: string
  guide?: string
  source?: string
  audio?: Blob | null
  /** Vrai quand la note est gardée sans réseau : elle partira toute seule au retour de la connexion. */
  offline?: boolean
}): Promise<Draft> {
  const now = Date.now()
  const prev = input.id ? await run<Draft | undefined>('readonly', (s) => s.get(input.id as string)) : undefined
  const draft: Draft = {
    id: prev?.id ?? input.id ?? newId(),
    userId: input.userId,
    kind: input.kind,
    courseId: input.courseId ?? null,
    noteId: input.noteId ?? null,
    title: input.title.slice(0, 80),
    body: input.body.slice(0, 60000),
    guide: (input.guide ?? '').slice(0, 2000),
    source: input.source ?? 'texte',
    audio: input.audio ?? null,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    // Enregistrer à nouveau ne prolonge PAS les 48 h : le compte à rebours part de la première sauvegarde.
    expiresAt: prev?.expiresAt ?? now + DRAFT_HOURS * HOUR,
    offline: !!input.offline,
    // Le texte a pu changer : l'ancien résultat de l'IA et l'ancien refus ne valent plus. Les identifiants d'envoi, eux, restent.
    sendCourseId: prev?.sendCourseId,
    sendNoteId: prev?.sendNoteId
  }
  await run('readwrite', (s) => s.put(draft))
  changed()
  void syncDraftExpiry(input.userId)
  track('draft_saved', { kind: input.kind, update: !!prev })
  return draft
}

/** Met à jour quelques champs d'un brouillon (envoi automatique) sans toucher à sa date de fin. */
export async function patchDraft(id: string, patch: Partial<Draft>): Promise<Draft | null> {
  const d = await run<Draft | undefined>('readonly', (s) => s.get(id))
  if (!d) return null
  const next: Draft = { ...d, ...patch, id: d.id, userId: d.userId, expiresAt: d.expiresAt }
  await run('readwrite', (s) => s.put(next))
  changed()
  return next
}

/** Brouillon ouvert dans un éditeur en ce moment : l'envoi automatique ne le touche pas. */
let editingDraft: string | null = null
export const setEditingDraft = (id: string | null) => { editingDraft = id }
export const isEditingDraft = (id: string) => editingDraft === id

/** Brouillons de CE téléphone à envoyer tout seuls (gardés sans réseau, pas déjà refusés). */
export async function autoSendable(userId: string): Promise<Draft[]> {
  const all = await listDrafts(userId)
  return all.filter((d) => d.offline && !d.failed && (d.kind === 'course' || d.kind === 'note') && !isEditingDraft(d.id)).sort((a, b) => a.createdAt - b.createdAt)
}

export async function deleteDraft(id: string): Promise<void> {
  const d = await run<Draft | undefined>('readonly', (s) => s.get(id))
  await run('readwrite', (s) => s.delete(id))
  changed()
  if (d) void syncDraftExpiry(d.userId)
}

/** Efface du téléphone TOUS les brouillons de cet étudiant (suppression de compte), sans rien envoyer au serveur. */
export async function wipeLocalDrafts(userId: string): Promise<void> {
  const all = await allOf(userId)
  for (const d of all) await run('readwrite', (s) => s.delete(d.id))
  changed()
}

/** Supprime définitivement les brouillons dont les 48 h sont écoulées. */
export async function purgeExpired(userId: string): Promise<number> {
  try {
    const all = await allOf(userId)
    const dead = all.filter((d) => d.expiresAt <= Date.now())
    for (const d of dead) await run('readwrite', (s) => s.delete(d.id))
    if (dead.length) { changed(); void syncDraftExpiry(userId) }
    return dead.length
  } catch {
    return 0
  }
}

/* ------------------------- affichage du compte à rebours ------------------------- */

/** « 71 h 12 », « 4 h 05 », « 38 min ». */
export function timeLeft(expiresAt: number, now = Date.now()): string {
  const ms = Math.max(0, expiresAt - now)
  const h = Math.floor(ms / HOUR)
  const m = Math.floor((ms % HOUR) / 60_000)
  if (h <= 0) return `${Math.max(1, m)} min`
  return `${h} h ${String(m).padStart(2, '0')}`
}

export const isUrgent = (d: Draft, now = Date.now()) => d.expiresAt - now <= WARN_HOURS * HOUR

export function excerpt(text: string, n = 90): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > n ? flat.slice(0, n).trimEnd() + '…' : flat || 'Sans texte'
}

/** Liste vivante : se met à jour quand un brouillon change, et chaque minute pour le compte à rebours. */
export function useDrafts(userId: string | undefined) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [now, setNow] = useState(() => Date.now())
  const reload = useCallback(async () => {
    if (!userId) return setDrafts([])
    try {
      setDrafts(await listDrafts(userId))
    } catch {
      setDrafts([])
    }
    setNow(Date.now())
  }, [userId])
  useEffect(() => {
    void reload()
    const on = () => void reload()
    window.addEventListener('memoa-drafts', on)
    const t = window.setInterval(on, 60_000)
    return () => {
      window.removeEventListener('memoa-drafts', on)
      window.clearInterval(t)
    }
  }, [reload])
  return { drafts, now, reload }
}

/* ------------------------- date de fin envoyée au serveur ------------------------- */

const DEVICE_KEY = 'memoa-device-id'
function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) { id = newId(); localStorage.setItem(DEVICE_KEY, id) }
    return id
  } catch {
    return 'inconnu'
  }
}

let syncing = false
/**
 * Au retour du réseau : dit au serveur à quelle heure chaque brouillon de CE téléphone disparaît (jamais son contenu),
 * et retire les lignes des brouillons déjà supprimés. Le serveur envoie alors une notification 5 h avant.
 */
export async function syncDraftExpiry(userId: string): Promise<void> {
  if (!isConfigured || !supabase || syncing || (typeof navigator !== 'undefined' && !navigator.onLine)) return
  syncing = true
  try {
    const mine = (await allOf(userId)).filter((d) => d.expiresAt > Date.now())
    const dev = deviceId()
    if (mine.length) {
      const rows = mine.map((d) => ({ user_id: userId, device_id: dev, draft_id: d.id, expires_at: new Date(d.expiresAt).toISOString() }))
      await supabase.from('drafts_expiry').upsert(rows, { onConflict: 'user_id,draft_id' })
    }
    const { data } = await supabase.from('drafts_expiry').select('draft_id').eq('device_id', dev)
    const keep = new Set(mine.map((d) => d.id))
    const stale = (data ?? []).map((r: { draft_id: string }) => r.draft_id).filter((id) => !keep.has(id))
    if (stale.length) await supabase.from('drafts_expiry').delete().in('draft_id', stale).eq('device_id', dev)
  } catch {
    /* le serveur est facultatif : le bandeau local prévient quand même */
  } finally {
    syncing = false
  }
}
