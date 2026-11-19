// Actions faites DEPUIS LE CHAT de l'Assistant : créer un cours, ajouter une note, quiz, résumé, TP.
//
// Principe : Memo (le serveur) ne fait rien lui-même. Quand l'étudiant demande clairement une action, la réponse du serveur contient
// `action` (déjà vérifiée : type connu, textes limités). Ce module l'exécute avec les mêmes fonctions que les écrans habituels :
// chaque tâche coûte donc SON prix (cours ou note rédigés par Memo 15 points, quiz 1, résumé 4 à 20, TP 10 en tout), jamais en plus du message
// du chat (le serveur rend le point du message qui lance une action). Un cours créé vide, sans notes ni consignes, coûte 0.
import { addNote, askAI, createCourse, LimitError, listNotes } from './api'
import { structureNoteText } from './draftsync'
import { toAiText } from './blocks'
import { track } from './track'
import { stripAiNoise } from './pdf'
import { cleanTpText } from './tpclean'
import { limitPlan, saveProgress, subsFor, partsFor } from './tpwrite'
import { startTpJob } from './tpjob'
import { parseQuiz, QUIZ_PROMPT } from '../pages/Courses'
import type { Course } from './types'

/** TP en préparation dans le chat (le plan est aussi gardé sur le téléphone, comme dans l'écran « Assistant TP »). */
export interface TpDraft { courseId: string; courseTitle: string; title: string; brief: string; plan: string; session: string | null; pages: number; /** Nom du professeur (page de garde), vide = aucun. */ supervisor?: string; /** La rédaction a été lancée. */ writing?: boolean }

export interface ActionEnv {
  userId: string
  courses: Course[]
  /** Cours choisi dans le chat (vide = aucun). */
  courseId: string
  /** Texte du document ou de la photo joint au message (si l'étudiant l'a joint). */
  attachment?: string
  /** Texte du message de l'étudiant (pour « utilise mon message comme note » : jamais recopié par le modèle). */
  message?: string
  tp: TpDraft | null
}

export interface ActionOutcome {
  /** Message de Memo affiché dans le chat. */
  text: string
  /** Bouton « où le retrouver » sous le message. */
  link?: { to: string; label: string }
  /** Nouvel état du TP en préparation (undefined = inchangé, null = effacé). */
  tp?: TpDraft | null
  /** Vrai si la liste des cours a changé (à recharger). */
  reload?: boolean
  /** Vrai si l'étudiant doit passer à Premium (points épuisés). */
  premium?: boolean
}

type Raw = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** Retrouve le cours cité par Memo : titre exact, sinon titre qui en contient un autre (un seul résultat), sinon le cours choisi dans le chat. */
export function findCourse(courses: Course[], name: string, selectedId: string): Course | null {
  const n = norm(name)
  if (n) {
    const exact = courses.filter((c) => norm(c.title) === n)
    if (exact.length === 1) return exact[0]
    const near = courses.filter((c) => { const t = norm(c.title); return t.includes(n) || n.includes(t) })
    if (near.length === 1) return near[0]
    if (selectedId) { const s = courses.find((c) => c.id === selectedId); if (s) return s }
    return null
  }
  return selectedId ? courses.find((c) => c.id === selectedId) ?? null : null
}

const pagesLabel = (n: number) => `${n} page${n > 1 ? 's' : ''}`

const noCourse = (name: string): ActionOutcome => ({
  text: name
    ? `Je ne trouve pas de cours qui s’appelle « ${name} » (ou plusieurs lui ressemblent). Dis-moi le titre exact, ou choisis le cours avec l’icône livre en bas du chat.`
    : 'Sur quel cours ? Choisis-le avec l’icône livre en bas du chat, ou dis-moi son titre.'
})

async function createCourseAction(a: Raw, env: ActionEnv): Promise<ActionOutcome> {
  const title = str(a.title).slice(0, 80)
  if (!title) return { text: 'Quel titre veux-tu donner à ce cours ?' }
  const text = a.from_attachment === true ? (env.attachment ?? '') : a.from_message === true ? (env.message ?? '') : str(a.text)
  const instr = str(a.instructions)
  let content = text.trim()
  if (!content && instr) {
    // Seulement des consignes : Memo rédige le cours (15 points).
    const r = await askAI({ task: 'enrich_note', purpose: 'course', prompt: `Consignes de l'étudiant : ${instr}\n\nTexte déjà écrit par l'étudiant :\n(aucun)` })
    content = stripAiNoise(r.reply).trim()
    if (!content) return { text: 'Je n’ai pas réussi à rédiger ce cours. Reformule tes consignes et on réessaie.' }
  } else if (content) {
    // Des notes : Memo les met en forme (15 points). Si la mise en forme échoue pour une autre raison que les points, on garde le texte tel quel.
    try {
      const r = await askAI({ task: 'structure_notes', purpose: 'course', prompt: instr ? `Consignes de l'étudiant pour la mise en forme (applique-les, ne les recopie pas dans les notes) : ${instr}\n\nTexte à mettre en forme :\n${content}` : content })
      if (r.reply.trim()) content = r.reply.trim()
    } catch (e) { if (e instanceof LimitError) throw e }
  }
  const course = await createCourse(env.userId, title)
  if (content) await addNote(env.userId, course.id, title, content.slice(0, 60000), 'texte')
  track('chat_action_done', { type: 'create_course', empty: !content })
  return {
    text: content
      ? `C’est fait : ton cours « ${course.title} » est créé avec ses notes. Tu le retrouves dans l’onglet Cours.`
      : `C’est fait : ton cours « ${course.title} » est créé, vide pour l’instant. Tu le retrouves dans l’onglet Cours, et tu pourras y ajouter des notes avec « Ajouter une note » ou en me les demandant ici.`,
    link: { to: `/sac/${course.id}`, label: `Ouvrir « ${course.title} »` },
    reload: true
  }
}

async function addNoteAction(a: Raw, env: ActionEnv): Promise<ActionOutcome> {
  const course = findCourse(env.courses, str(a.course), env.courseId)
  if (!course) return noCourse(str(a.course))
  const text = a.from_attachment === true ? (env.attachment ?? '') : a.from_message === true ? (env.message ?? '') : str(a.text)
  const instr = str(a.instructions)
  let content = text.trim()
  if (instr) {
    // Memo rédige (ou complète) la note : 15 points. Avec seulement du texte, il la met en forme : 15 points aussi.
    const r = await askAI({ task: 'enrich_note', courseId: course.id, prompt: `Consignes de l'étudiant : ${instr}\n\nTexte déjà écrit par l'étudiant :\n${content || '(aucun)'}` })
    const extra = stripAiNoise(r.reply).trim()
    content = content ? `${content}\n\nComplément de Memo :\n${extra}` : extra
  } else if (content) {
    // Toute note avec du texte passe par Memo (mise en forme) : 15 points, comme dans l'écran « Ajouter une note ».
    content = await structureNoteText(course.id, content)
  }
  if (!content) return { text: 'Que veux-tu y écrire ? Donne-moi le texte de la note, ou dis-moi ce que je dois rédiger.' }
  const title = str(a.title).slice(0, 80) || (instr ? instr.slice(0, 50) : 'Note du chat')
  await addNote(env.userId, course.id, title, content.slice(0, 60000), 'texte')
  track('chat_action_done', { type: 'add_note', ai: !!instr })
  return {
    text: `C’est fait : la note « ${title} » est ajoutée au cours « ${course.title} ». Tu la retrouves en ouvrant ce cours (onglet Cours).`,
    link: { to: `/sac/${course.id}`, label: `Ouvrir « ${course.title} »` },
    reload: true
  }
}

async function quizAction(a: Raw, env: ActionEnv): Promise<ActionOutcome> {
  const course = findCourse(env.courses, str(a.course), env.courseId)
  if (!course) return noCourse(str(a.course))
  if (!(await listNotes(course.id)).length) return { text: `Le cours « ${course.title} » n’a pas encore de notes : ajoute-en une et je te fais un quiz.` }
  const r = await askAI({ task: 'quiz', courseId: course.id, prompt: QUIZ_PROMPT })
  const qs = parseQuiz(r.reply)
  track('chat_action_done', { type: 'quiz' })
  if (!qs.length) return { text: `Quiz sur « ${course.title} » :\n\n${stripAiNoise(r.reply)}`, link: { to: `/sac/${course.id}`, label: 'Quiz dans le cours' } }
  const body = qs.map((q, i) => `${i + 1}. ${q.q}\n${q.opts.map((o, k) => `${String.fromCharCode(65 + k)}) ${o}`).join('\n')}`).join('\n\n')
  const sol = qs.map((q, i) => `${i + 1}. ${String.fromCharCode(65 + q.ans)}${q.why ? ` — ${q.why}` : ''}`).join('\n')
  return { text: `Quiz sur « ${course.title} » : réponds de ton côté, puis compare avec la correction en bas.\n\n${body}\n\nCorrection :\n${sol}`, link: { to: `/sac/${course.id}`, label: 'Faire le quiz dans le cours' } }
}

async function summaryAction(a: Raw, env: ActionEnv): Promise<ActionOutcome> {
  const course = findCourse(env.courses, str(a.course), env.courseId)
  if (!course) return noCourse(str(a.course))
  const notes = await listNotes(course.id)
  if (!notes.length) return { text: `Le cours « ${course.title} » n’a pas encore de notes à résumer.` }
  const full = notes.map((n) => n.title + '. ' + n.content).join('\n')
  const r = await askAI({ task: 'summary', prompt: toAiText(full).slice(0, 60000) })
  track('chat_action_done', { type: 'summary' })
  return { text: `Résumé de « ${course.title} » :\n\n${stripAiNoise(r.reply)}\n\nPour l’écouter à voix haute ou le mettre en PDF, ouvre le cours et choisis « Écouter ».`, link: { to: `/sac/${course.id}`, label: `Ouvrir « ${course.title} »` } }
}

async function tpPlanAction(a: Raw, env: ActionEnv): Promise<ActionOutcome> {
  const course = findCourse(env.courses, str(a.course), env.courseId)
  if (!course) return noCourse(str(a.course))
  const title = str(a.title).slice(0, 120)
  const brief = str(a.brief).slice(0, 3000)
  if (!title || !brief) return { text: 'Pour préparer le plan, j’ai besoin du titre du TP et de son énoncé (ou de ses consignes).' }
  const pages = Math.max(1, Math.min(60, Math.round(Number(a.pages) || 5)))
  const r = await askAI({
    task: 'tp_plan', courseId: course.id, tpSession: null,
    prompt: `Titre : ${title}\nConsignes : ${brief}\n\nLONGUEUR DU TRAVAIL : ${pagesLabel(pages)} au total (sans la page de garde). Propose AU PLUS ${partsFor(pages)} parties principales (introduction, conclusion et bibliographie comprises) et ${subsFor(pages) ? `${subsFor(pages)} sous-parties par partie principale (au plus)` : 'AUCUNE sous-partie (seulement les titres des parties)'}. Le plan doit être COMPLET et DÉTAILLÉ : chaque sous-partie dit précisément ce qu'elle contiendra, pour que l'étudiant voie tout le contenu de son travail, tout en tenant en ${pagesLabel(pages)}. Ne dépasse jamais ce nombre de parties.`
  })
  const plan = limitPlan(cleanTpText(r.reply), pages)
  const supervisor = str(a.professor).slice(0, 80)
  const tp: TpDraft = { courseId: course.id, courseTitle: course.title, title, brief, plan, session: r.tpSession ?? null, pages, supervisor }
  saveProgress({ courseId: course.id, title, brief, plan, session: tp.session, texts: {}, at: Date.now(), pages, supervisor })
  track('chat_action_done', { type: 'tp_plan' })
  return { text: `Voici le plan proposé pour « ${title} » (${pagesLabel(pages)}, cours « ${course.title} »${supervisor ? `, professeur : ${supervisor}` : ''}) :\n\n${plan}\n\nDis-moi ce que tu veux changer, ou dis « c’est bon » et je rédige le TP.`, tp }
}

async function tpReviseAction(a: Raw, env: ActionEnv): Promise<ActionOutcome> {
  const tp = env.tp
  if (!tp) return { text: 'Je n’ai pas de plan de TP en cours. Dis-moi le cours, le sujet et le nombre de pages, et je prépare un plan.' }
  const changes = str(a.changes)
  if (!changes) return { text: 'Que veux-tu changer dans le plan ?' }
  const r = await askAI({
    task: 'tp_revise', courseId: tp.courseId, tpSession: tp.session,
    prompt: `Titre : ${tp.title}\nConsignes : ${tp.brief.slice(0, 2500)}\n\nPlan actuel :\n${tp.plan}\n\nModifications demandées par l'étudiant : ${changes}\n\nLe travail final doit rester à environ ${tp.pages} pages : n'ajoute des parties que si l'étudiant le demande.`
  })
  const plan = limitPlan(cleanTpText(r.reply), tp.pages)
  const next: TpDraft = { ...tp, plan, session: r.tpSession ?? tp.session }
  saveProgress({ courseId: next.courseId, title: next.title, brief: next.brief, plan, session: next.session, texts: {}, at: Date.now(), pages: next.pages, supervisor: next.supervisor })
  track('chat_action_done', { type: 'tp_revise' })
  return { text: `Plan mis à jour :\n\n${plan}\n\nC’est mieux ? Dis « c’est bon » et je rédige, ou dis-moi quoi changer encore.`, tp: next }
}

async function tpWriteAction(env: ActionEnv): Promise<ActionOutcome> {
  const tp = env.tp
  if (!tp) return { text: 'Je n’ai pas de plan de TP validé. Dis-moi le cours, le sujet et le nombre de pages, et je prépare un plan.' }
  if (!tp.session) return { text: 'La session de ce TP a expiré. Redemande-moi le plan et on repart.', tp: null }
  if (tp.writing) return { text: 'La rédaction de ce TP est déjà lancée : je te préviens ici dès que c’est prêt.' }
  const planNow = limitPlan(tp.plan, tp.pages) // sécurité : jamais plus de parties que ne le permet le nombre de pages
  startTpJob({
    courseId: tp.courseId, title: tp.title, brief: tp.brief, plan: planNow, session: tp.session, texts: {}, pages: tp.pages, supervisor: tp.supervisor,
    onSave: (t) => saveProgress({ courseId: tp.courseId, title: tp.title, brief: tp.brief, plan: planNow, session: tp.session, texts: t, at: Date.now(), pages: tp.pages, supervisor: tp.supervisor })
  })
  track('chat_action_done', { type: 'tp_write' })
  return {
    text: `Je rédige ton TP « ${tp.title} » : ça prend quelques minutes, et tu peux changer de page, la rédaction continue. Quand il est prêt (je te le dis ici si tu restes, sinon une notification te prévient), va dans le cours « ${tp.courseTitle} » › Assistant TP : tu le trouveras déjà rédigé, prêt à télécharger en PDF avec sa page de garde.`,
    link: { to: `/tp/${tp.courseId}`, label: 'Ouvrir l’Assistant TP' },
    tp: { ...tp, plan: planNow, writing: true }
  }
}

/** Exécute l'action demandée. Ne lève jamais d'erreur : l'échec devient un message de Memo (les points sont rendus par le serveur si l'IA échoue). */
export async function runChatAction(raw: Raw, env: ActionEnv): Promise<ActionOutcome> {
  const type = str(raw.type)
  try {
    switch (type) {
      case 'create_course': return await createCourseAction(raw, env)
      case 'add_note': return await addNoteAction(raw, env)
      case 'quiz': return await quizAction(raw, env)
      case 'summary': return await summaryAction(raw, env)
      case 'tp_plan': return await tpPlanAction(raw, env)
      case 'tp_revise': return await tpReviseAction(raw, env)
      case 'tp_write': return await tpWriteAction(env)
      default: return { text: 'Je n’ai pas compris cette demande. Peux-tu la reformuler ?' }
    }
  } catch (e) {
    const msg = e instanceof Error && e.message ? e.message : 'Je n’ai pas pu finir. Réessaie dans un instant.'
    return { text: msg, premium: e instanceof LimitError }
  }
}

/** Texte envoyé à Memo à chaque message : où en est le TP, et ce que les actions ont déjà fait (sans contenu de notes). */
export function pendingState(tp: TpDraft | null, done: string[]): string {
  const lines: string[] = []
  if (tp) lines.push(tp.writing
    ? `TP « ${tp.title} » (cours « ${tp.courseTitle} ») : la rédaction est lancée, l'étudiant sera prévenu quand c'est prêt (Assistant TP du cours).`
    : `TP en préparation : « ${tp.title} », cours « ${tp.courseTitle} », ${pagesLabel(tp.pages)}. Plan actuel (pas encore rédigé, en attente de validation ou d'ajustements) :\n${tp.plan.slice(0, 1800)}`)
  if (done.length) lines.push(`Actions déjà faites dans cette conversation :\n${done.slice(-6).map((d) => `- ${d}`).join('\n')}`)
  return lines.join('\n\n')
}
