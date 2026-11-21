// Compte : export des données de l'étudiant (un seul fichier) et suppression du compte (fonction serveur « account-delete »).
import { isConfigured, supabase } from './supabase'
import { listDrafts, wipeLocalDrafts } from './drafts'
import { idbStore } from './outbox'
import { clearOfflineCopy } from './api'
import { flush, reportError, setTrackUser, track } from './track'

/** Nom de la fonction serveur de suppression (le nom affiché dans le tableau de bord Supabase / l'adresse de déploiement). */
export const ACCOUNT_DELETE_FN = 'smooth-api'
/** Le mot à taper pour confirmer. Le serveur le revérifie. */
export const DELETE_WORD = 'SUPPRIMER'
const DELETED_FLAG = 'memoa-account-deleted'

type Row = Record<string, unknown>

/** Lit toutes les lignes d'une table (par pages de 1000). Les règles RLS ne renvoient que les lignes de l'étudiant. */
async function all(table: string, columns: string, order: string, filter?: (q: any) => any): Promise<Row[]> {
  const out: Row[] = []
  for (let from = 0; from < 50_000; from += 1000) {
    const base = supabase!.from(table).select(columns)
    const { data, error } = await (filter ? filter(base) : base).order(order, { ascending: true }).range(from, from + 999)
    if (error) throw new Error(`${table} : ${error.message}`)
    out.push(...((data ?? []) as unknown as Row[]))
    if ((data ?? []).length < 1000) break
  }
  return out
}

/** Rassemble tout ce que Memoa garde sur l'étudiant dans un objet (profil, cours, notes, brouillons, favoris…). */
export async function collectMyData(userId: string, email: string): Promise<Row> {
  const base: Row = { exporte_le: new Date().toISOString(), application: 'Memoa', compte: { id: userId, email } }
  const drafts = (await listDrafts(userId).catch(() => [])).map((d) => ({
    id: d.id, type: d.kind, titre: d.title, texte: d.body, consignes: d.guide, source: d.source,
    enregistrement_audio_en_attente: !!d.audio, cree_le: new Date(d.createdAt).toISOString(), disparait_le: new Date(d.expiresAt).toISOString()
  }))
  if (!supabase) return { ...base, brouillons: drafts }
  const [profile, courses, notes, favs, activity, conversations, messages, payments, docs, cartes, examens] = await Promise.all([
    all('profiles', '*', 'created_at', (q) => q.eq('id', userId)),
    all('courses', 'id,title,created_at,deleted_at', 'created_at'),
    all('notes', 'id,course_id,title,content,source,created_at', 'created_at'),
    all('library_favorites', 'document_id,created_at', 'created_at'),
    all('activity_days', 'day', 'day'),
    all('ai_conversations', 'id,title,created_at', 'created_at'),
    all('ai_messages', 'id,conversation_id,role,content,created_at', 'created_at'),
    all('payments', 'amount,currency,status,provider,created_at', 'created_at'),
    all('library_documents', 'id,title,doc_type,course_title,promotion,status,created_at', 'created_at', (q) => q.eq('owner_id', userId)),
    all('review_cards', 'id,course_id,question,answer,box,due_date,last_review,created_at', 'created_at'),
    all('exams', 'id,course_id,title,exam_date,exam_time,room,source,created_at', 'created_at')
  ])
  // Titres des documents mis en favoris.
  const ids = favs.map((f) => String(f.document_id))
  let favTitles: Row[] = []
  if (ids.length) {
    const { data } = await supabase.from('library_documents').select('id,title,doc_type').in('id', ids.slice(0, 500))
    favTitles = (data ?? []) as Row[]
  }
  const titleOf = new Map(favTitles.map((d) => [String(d.id), d]))
  return {
    ...base,
    profil: profile[0] ?? null,
    cours: courses,
    notes,
    brouillons: drafts,
    favoris: favs.map((f) => ({ ...f, document: titleOf.get(String(f.document_id)) ?? null })),
    mes_documents_librairie: docs,
    jours_actifs: activity.map((a) => a.day),
    conversations_assistant: conversations.map((c) => ({ ...c, messages: messages.filter((m) => m.conversation_id === c.id) })),
    paiements: payments,
    cartes_de_revision: cartes,
    examens
  }
}

/** Télécharge l'export (un fichier .json). */
export async function downloadMyData(userId: string, email: string): Promise<void> {
  const data = await collectMyData(userId, email)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `memoa-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
  track('export_data')
}

/** Efface tout ce que Memoa garde SUR CE TÉLÉPHONE pour cet étudiant (brouillons, notes en attente, copies hors ligne, préférences de session). */
async function wipeLocal(userId: string) {
  try { await wipeLocalDrafts(userId) } catch { /* rien à effacer */ }
  try { for (const i of await idbStore.list(userId)) await idbStore.del(i.id) } catch { /* rien à effacer */ }
  clearOfflineCopy()
  try {
    // Tout ce que l'appli a écrit en local, sauf les préférences de l'appareil (thème, langue).
    Object.keys(localStorage).filter((k) => k.startsWith('memoa-') && !k.startsWith('memoa-pref-')).forEach((k) => localStorage.removeItem(k))
    sessionStorage.setItem(DELETED_FLAG, '1')
  } catch { /* stockage indisponible */ }
}

/** Vrai (une seule fois) quand l'étudiant vient de supprimer son compte : l'écran de connexion le confirme. */
export function takeDeletedNotice(): boolean {
  try { const v = sessionStorage.getItem(DELETED_FLAG) === '1'; sessionStorage.removeItem(DELETED_FLAG); return v } catch { return false }
}

/** Supprime le compte (serveur), puis nettoie le téléphone et déconnecte. Lève une Error au message lisible en cas d'échec : rien n'est alors effacé du téléphone. */
export async function deleteMyAccount(userId: string, word: string): Promise<void> {
  const typed = word.trim().toUpperCase()
  if (typed !== DELETE_WORD) throw new Error(`Pour confirmer, écris le mot ${DELETE_WORD}.`)
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('Pas de connexion : la suppression du compte a besoin du réseau.')
  if (isConfigured && supabase) {
    await flush() // dernières statistiques envoyées avant que le compte n'existe plus
    const { error } = await supabase.functions.invoke(ACCOUNT_DELETE_FN, { body: { confirm: typed } })
    if (error) {
      let msg = "La suppression n'a pas pu aboutir. Réessaie dans un instant."
      const ctx = (error as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') {
        try { const j = await ctx.json(); if (j && typeof j.error === 'string') msg = j.error } catch { /* corps illisible */ }
      }
      if (!ctx || ctx.status >= 500) reportError(String((error as Error).message ?? 'échec'), `fn:${ACCOUNT_DELETE_FN}:${ctx?.status ?? 'réseau'}`)
      throw new Error(msg)
    }
  }
  setTrackUser(null)
  await wipeLocal(userId)
  try { await supabase?.auth.signOut({ scope: 'local' }) } catch { /* la session locale est de toute façon invalide */ }
}
