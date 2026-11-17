// Envoi automatique des brouillons gardés SANS réseau (bouton « Brouillon » hors connexion).
// Dès que la connexion revient : un brouillon « nouveau cours » est créé, un brouillon « note » est ajouté à son cours.
// Ça suit exactement le même chemin qu'en ligne (mise en forme par l'IA, points, etc.). Si les points manquent,
// RIEN n'est créé : le brouillon reste là et un message le dit. Aucun doublon possible, même si la connexion coupe en plein envoi.
import { askAI, getCourse, LimitError, transcribeAudio } from './api'
import { isConfigured, supabase } from './supabase'
import { protectBlocks } from './blocks'
import { stripAiNoise } from './pdf'
import { track } from './track'
import { newUuid } from './outbox'
import { autoSendable, deleteDraft, patchDraft, type Draft } from './drafts'

export interface DraftSyncResult {
  created: number
  added: number
  /** Pas envoyés faute de points : les brouillons restent. */
  creditCourses: number
  creditNotes: number
  /** Autre refus définitif (cours supprimé, texte invalide…). */
  otherCourses: number
  otherNotes: number
}

const empty = (): DraftSyncResult => ({ created: 0, added: 0, creditCourses: 0, creditNotes: 0, otherCourses: 0, otherNotes: 0 })
export const hasNews = (r: DraftSyncResult) => Object.values(r).some((n) => n > 0)

type Err = { code?: string; message?: string }
const isDup = (e: Err | null) => !!e && (e.code === '23505' || /duplicate key/i.test(e.message ?? ''))
/** Réseau coupé ou serveur occupé : on réessaiera plus tard, sans compter d'échec. */
const isTransient = (e: unknown) => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const m = e instanceof Error ? e.message : String((e as Err | null)?.message ?? '')
  return /failed to fetch|networkerror|network request|load failed|fetch|timeout|jwt|session|\b50\d\b|occupé|saturé|ai_busy/i.test(m)
}

const asFile = (b: Blob): File => (b instanceof File ? b : new File([b], 'enregistrement.webm', { type: b.type || 'audio/webm' }))
const courseSource = (s: string) => (s === 'pdf' || s === 'voix' || s === 'photo' || s === 'audio' ? s : 'texte')
const noteSource = (s: string) => (s === 'enreg' || s === 'video' ? 'audio' : ['texte', 'voix', 'audio', 'pdf', 'photo'].includes(s) ? s : 'texte')

/** Même mise en forme que l'écran « Nouveau cours » quand on touche « Créer » (15 points). */
async function buildCourseContent(content: string, instr: string): Promise<string> {
  let structured = content.trim()
  if (!structured && instr) {
    const r = await askAI({ task: 'enrich_note', purpose: 'course', web: false, prompt: `Consignes de l'étudiant : ${instr}\n\nTexte déjà écrit par l'étudiant :\n(aucun)` })
    structured = stripAiNoise(r.reply).trim()
    if (!structured) throw new Error("Memo n'a pas réussi à rédiger le cours.")
  } else if (structured) {
    try {
      const prot = protectBlocks(structured)
      if (prot.text.length > 7500) throw new Error('trop long pour la mise en forme IA')
      const keep = prot.count ? `\n\n(Les lignes §BLOC1§, §BLOC2§… sont des tableaux ou des schémas : recopie-les telles quelles, chacune sur sa ligne, à leur place.)` : ''
      const r = await askAI({ task: 'structure_notes', purpose: 'course', prompt: instr ? `Consignes de l'étudiant pour la mise en forme (applique-les, ne les recopie pas dans les notes) : ${instr}\n\nTexte à mettre en forme :\n${prot.text}${keep}` : prot.text + keep })
      if (r.reply.trim()) {
        const back = prot.count ? prot.restore(r.reply.trim()) : r.reply.trim()
        if (back) structured = back.trim()
      }
    } catch (e) {
      if (e instanceof LimitError) throw e
      /* l'IA est facultative ici : on garde le texte tel quel */
    }
  }
  return structured
}

/** Mise en forme d'une note ajoutée à un cours (15 points). Si l'IA échoue pour une autre raison que les points, le texte reste tel quel. */
export async function structureNoteText(courseId: string, base: string): Promise<string> {
  const prot = protectBlocks(base)
  try {
    if (prot.text.length > 7500) throw new Error('trop long pour la mise en forme IA')
    const keep = prot.count ? `\n\n(Les lignes §BLOC1§, §BLOC2§… sont des tableaux ou des schémas : recopie-les telles quelles, chacune sur sa ligne, à leur place.)` : ''
    const r = await askAI({ task: 'structure_notes', courseId, prompt: prot.text + keep })
    if (r.reply.trim()) {
      const back = prot.count ? prot.restore(r.reply.trim()) : r.reply.trim()
      if (back) return back.trim()
    }
  } catch (e) {
    if (e instanceof LimitError) throw e
  }
  return base
}

/** Toute note ajoutée avec du texte coûte 15 points (mise en forme, ou rédaction si consignes). Une note vide ne passe pas par l'IA. */
async function buildNoteContent(courseId: string, base: string, guide: string): Promise<string> {
  if (guide) {
    const r = await askAI({ task: 'enrich_note', courseId, web: false, prompt: `Consignes de l'étudiant : ${guide}\n\nTexte déjà écrit par l'étudiant :\n${base || '(aucun)'}` })
    const extra = stripAiNoise(r.reply).trim()
    return base ? `${base}\n\nComplément de Memo :\n${extra}` : extra
  }
  return base ? structureNoteText(courseId, base) : base
}

async function insertCourse(userId: string, id: string, title: string): Promise<string> {
  if (!isConfigured || !supabase) {
    const { createCourse } = await import('./api')
    return (await createCourse(userId, title)).id
  }
  const { error } = await supabase.from('courses').insert({ id, user_id: userId, title })
  if (error && !isDup(error)) throw error
  return id
}
async function insertNote(userId: string, id: string, courseId: string, title: string, content: string, source: string): Promise<void> {
  if (!isConfigured || !supabase) {
    const { addNote } = await import('./api')
    await addNote(userId, courseId, title, content, source)
    return
  }
  const { error } = await supabase.from('notes').insert({ id, user_id: userId, course_id: courseId, title, content, source })
  if (error && !isDup(error)) throw error
}

/** Envoie UN brouillon. Lance une erreur si ça échoue ; le brouillon n'est supprimé qu'une fois tout écrit. */
async function sendOne(userId: string, d0: Draft): Promise<'created' | 'added'> {
  let d = d0
  let base = d.body.trim()
  const guide = d.guide.trim()

  // Enregistrement vocal : transcrit UNE fois (3 points), le texte est gardé tout de suite.
  if (d.audio) {
    const text = (await transcribeAudio(asFile(d.audio))).trim()
    if (!text) throw new Error("Aucun texte n'a été reconnu dans l'enregistrement.")
    base = base ? `${base}\n\n${text}` : text
    d = (await patchDraft(d.id, { body: base.slice(0, 60000), audio: null })) ?? d
  }

  if (d.kind === 'course') {
    const title = d.title.trim()
    if (!title) throw new Error('Donne un nom à ton cours.')
    // Cours vierge (juste un nom) : créé tel quel, gratuit. L'IA ne passe (15 points) que s'il y a un texte ou des consignes.
    let content = d.readyContent
    if (content === undefined) {
      content = await buildCourseContent(base, guide)
      d = (await patchDraft(d.id, { readyContent: content })) ?? d // les points sont payés : un nouvel essai ne les repaie pas
    }
    let courseId = d.sendCourseId
    let noteId = d.sendNoteId
    if (!courseId || !noteId) {
      courseId = courseId ?? newUuid(); noteId = noteId ?? newUuid()
      d = (await patchDraft(d.id, { sendCourseId: courseId, sendNoteId: noteId })) ?? d
    }
    const cid = await insertCourse(userId, courseId, title.slice(0, 80))
    if (content) await insertNote(userId, noteId, cid, title.slice(0, 80), content.slice(0, 60000), base ? courseSource(d.source) : 'texte')
    await deleteDraft(d.id)
    track('course_created', { source: 'brouillon' })
    return 'created'
  }

  // Note à ajouter à un cours existant.
  const courseId = d.courseId
  if (!courseId) throw new Error('Le cours de cette note est introuvable.')
  let course
  try { course = await getCourse(courseId) } catch (e) { if (isTransient(e)) throw e; throw new Error('Le cours de cette note n’existe plus.') }
  if (!course) throw new Error('Le cours de cette note n’existe plus.')
  if (!base && !guide) throw new Error('Le brouillon est vide.')
  let content = d.readyContent
  if (content === undefined) {
    content = await buildNoteContent(courseId, base, guide)
    d = (await patchDraft(d.id, { readyContent: content })) ?? d
  }
  if (!content.trim()) throw new Error('Ta note est vide.')
  let noteId = d.sendNoteId
  if (!noteId) { noteId = newUuid(); d = (await patchDraft(d.id, { sendNoteId: noteId })) ?? d }
  const title = d.title.trim() || (guide ? guide.slice(0, 50) : '')
  await insertNote(userId, noteId, courseId, title.slice(0, 80) || 'Note', content.slice(0, 60000), noteSource(d.source))
  await deleteDraft(d.id)
  track('note_added', { source: noteSource(d.source), offline: true })
  return 'added'
}

const MAX_TRIES = 3
let running = false

/** Envoie les brouillons gardés sans réseau, dans l'ordre. S'arrête au premier problème de réseau. Peut être appelée n'importe quand, sans risque de doublon. */
export async function syncOfflineDrafts(userId: string): Promise<DraftSyncResult> {
  const res = empty()
  if (running || (typeof navigator !== 'undefined' && navigator.onLine === false)) return res
  if (isConfigured && supabase) {
    const { data } = await supabase.auth.getSession()
    if (data.session?.user.id !== userId) return res // pas (ou plus) connecté : on garde tout
  }
  running = true
  try {
    const list = await autoSendable(userId)
    for (const d of list) {
      try {
        const kind = await sendOne(userId, d)
        if (kind === 'created') res.created++; else res.added++
      } catch (e) {
        if (isTransient(e) && !(e instanceof LimitError)) break // réseau instable : tout est gardé, on réessaiera
        const course = d.kind === 'course'
        if (e instanceof LimitError) {
          await patchDraft(d.id, { failed: 'credit', failedMsg: 'Points insuffisants' }).catch(() => {})
          if (course) res.creditCourses++; else res.creditNotes++
          continue
        }
        const tries = (d.attempts ?? 0) + 1
        const msg = String((e as Err)?.message ?? 'Erreur').slice(0, 200)
        if (tries >= MAX_TRIES) {
          await patchDraft(d.id, { failed: 'error', failedMsg: msg, attempts: tries }).catch(() => {})
          if (course) res.otherCourses++; else res.otherNotes++
        } else await patchDraft(d.id, { attempts: tries, failedMsg: msg }).catch(() => {})
      }
    }
    return res
  } finally {
    running = false
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('memoa-content'))
  }
}

/** Version sûre entre plusieurs onglets ouverts en même temps. */
export async function syncOfflineDraftsLocked(userId: string): Promise<DraftSyncResult | null> {
  const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined
  if (!locks) return syncOfflineDrafts(userId)
  return locks.request('memoa-drafts-sync', { ifAvailable: true }, async (lock) => (lock ? syncOfflineDrafts(userId) : null))
}

const n = (k: number, one: string, many: string) => (k === 1 ? `1 ${one}` : `${k} ${many}`)

/** Phrase affichée au retour de la connexion. */
export function describeSync(r: DraftSyncResult): string {
  const done: string[] = []
  if (r.created) done.push(n(r.created, 'cours créé', 'cours créés'))
  if (r.added) done.push(n(r.added, 'note ajoutée', 'notes ajoutées'))
  const doneText = done.join(' et ')
  const noCredit: string[] = []
  if (r.creditCourses) noCredit.push(r.creditCourses === 1 ? '1 cours n’a pas pu être créé' : `${r.creditCourses} cours n’ont pas pu être créés`)
  if (r.creditNotes) noCredit.push(r.creditNotes === 1 ? '1 note n’a pas pu être ajoutée' : `${r.creditNotes} notes n’ont pas pu être ajoutées`)
  const other: string[] = []
  if (r.otherCourses) other.push(r.otherCourses === 1 ? '1 cours n’a pas pu être créé' : `${r.otherCourses} cours n’ont pas pu être créés`)
  if (r.otherNotes) other.push(r.otherNotes === 1 ? '1 note n’a pas pu être ajoutée' : `${r.otherNotes} notes n’ont pas pu être ajoutées`)

  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
  const parts: string[] = []
  if (noCredit.length) {
    const total = r.creditCourses + r.creditNotes
    if (doneText) parts.push(`${cap(doneText)} et ${noCredit.join(' et ')} faute de crédit.`)
    else if (total === 1) parts.push(r.creditCourses ? 'Ton cours n’a pas été créé faute de crédit.' : 'Ta note n’a pas été ajoutée faute de crédit.')
    else if (r.creditCourses && r.creditNotes) parts.push('Tes cours et tes notes n’ont pas été créés ni ajoutés faute de crédit.')
    else parts.push(r.creditCourses ? 'Tes cours n’ont pas été créés faute de crédit.' : 'Tes notes n’ont pas été ajoutées faute de crédit.')
    parts.push(total === 1 ? 'Le brouillon reste là.' : 'Les brouillons restent là.')
  } else if (doneText) parts.push(`${cap(doneText)}.`)
  if (other.length) parts.push(`${other.join(' et ')} : le brouillon reste là.`)
  return parts.join(' ')
}
