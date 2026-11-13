import { askAI, LimitError } from './api'
import { cleanTpText } from './tpclean'

/** Une partie principale du plan, avec ses sous-parties. */
export interface TpPart { n: number; title: string; subs: string[]; raw: string }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
/** Retire la numérotation (« 1. », « I) », « 2.3 », « Partie 1 : ») pour comparer seulement le titre. */
const bare = (s: string) => norm(s.replace(/^\s*(partie\s+)?([0-9]+(\.[0-9]+)*|[ivxl]+|[a-z])\s*[.)\-:–]\s*/i, '').replace(/^\s*[0-9]+(\.[0-9]+)+\s+/, ''))

const SUB = /^\s*(\d+\.\d+|[ivxl]+\.\d+|[a-z]\)|[-•·▪●])/i
const TOP = /^\s*(partie\s+)?(\d+|[ivxl]+)\s*[.)\-:–]\s*(?!\d)\S/i
/** Introduction, conclusion et bibliographie sont toujours des parties principales, même sans numéro. */
const KEYTOP = /^(introduction|conclusion|bibliographie)\b/i

/** Découpe le plan (texte) en parties. Toujours au moins une partie ; jamais d'erreur. */
export function parsePlan(plan: string): TpPart[] {
  const lines = cleanTpText(plan).split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim())
  const isTop = (l: string) => (TOP.test(l) && !SUB.test(l)) || (!/^\s/.test(l) && KEYTOP.test(l))
  let tops = lines.filter(isTop).length
  const parts: TpPart[] = []
  const push = (title: string) => parts.push({ n: parts.length + 1, title: title.trim(), subs: [], raw: title.trim() })
  if (tops >= 2) {
    for (const l of lines) {
      if (isTop(l)) push(l)
      else if (parts.length) { parts[parts.length - 1].subs.push(l.trim()); parts[parts.length - 1].raw += '\n' + l.trim() }
    }
    return parts
  }
  // Plan sans numérotation : une ligne sans retrait et sans puce = une partie.
  const flat = lines.filter((l) => !/^\s/.test(l) && !SUB.test(l))
  tops = flat.length
  if (tops >= 2) {
    for (const l of lines) {
      if (!/^\s/.test(l) && !SUB.test(l)) push(l)
      else if (parts.length) { parts[parts.length - 1].subs.push(l.trim()); parts[parts.length - 1].raw += '\n' + l.trim() }
    }
    return parts
  }
  // Dernier recours : paquets de 6 lignes, pour ne jamais demander tout le TP en un seul appel.
  for (let i = 0; i < lines.length; i += 6) {
    const chunk = lines.slice(i, i + 6)
    parts.push({ n: parts.length + 1, title: chunk[0].trim(), subs: chunk.slice(1).map((x) => x.trim()), raw: chunk.map((x) => x.trim()).join('\n') })
  }
  return parts
}

/** Une partie est valide si son titre et chacune de ses sous-parties y figurent, avec un vrai développement. */
export function partIsComplete(part: TpPart, text: string | undefined, relaxed = false): boolean {
  if (!text) return false
  const t = norm(text)
  if (!t.includes(bare(part.title))) return false
  // Dernier essai (relaxed) : le modèle a pu reformuler légèrement un titre de sous-partie ; on exige alors seulement le titre et un vrai texte.
  if (relaxed) return text.trim().length >= 300
  for (const s of part.subs) { const b = bare(s); if (b.length >= 4 && !t.includes(b)) return false }
  const needed = 350 + 250 * part.subs.length
  return text.trim().length >= Math.min(needed, 2500) * (/biblio/i.test(part.title) ? 0.25 : 0.6)
}

/** Vérification finale de l'assemblage : renvoie les numéros des parties absentes ou hors ordre. */
export function missingParts(parts: TpPart[], texts: Record<number, string>, relaxed = false): number[] {
  const bad: number[] = []
  let cursor = 0
  const doc = parts.map((p) => texts[p.n] ?? '').join('\n\n')
  const d = norm(doc)
  for (const p of parts) {
    const b = bare(p.title)
    const at = d.indexOf(b, cursor)
    if (at < 0 || !partIsComplete(p, texts[p.n], relaxed)) bad.push(p.n)
    else cursor = at + b.length
  }
  return bad
}

export const assemble = (parts: TpPart[], texts: Record<number, string>) => cleanTpText(parts.map((p) => (texts[p.n] ?? '').trim()).filter(Boolean).join('\n\n'))

const KEY = (courseId: string) => `memoa-tp-progress:${courseId}`
export interface TpProgress { courseId: string; title: string; brief: string; plan: string; session: string | null; texts: Record<number, string>; at: number }
export function loadProgress(courseId: string): TpProgress | null {
  try {
    const p = JSON.parse(localStorage.getItem(KEY(courseId)) ?? 'null') as TpProgress | null
    return p && Date.now() - p.at < 23 * 3600_000 ? p : null // la session de TP expire au bout de 24 h
  } catch { return null }
}
export function saveProgress(p: TpProgress) { try { localStorage.setItem(KEY(p.courseId), JSON.stringify({ ...p, at: Date.now() })) } catch { /* stockage plein : on continue sans */ } }
export function clearProgress(courseId: string) { try { localStorage.removeItem(KEY(courseId)) } catch { /* rien */ } }

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const transient = (e: unknown) => !(e instanceof LimitError) && !/expir|session|point|Premium|limite|Doucement/i.test(e instanceof Error ? e.message : '')

/** Un appel avec 2 nouvelles tentatives en cas de coupure réseau ou d'erreur passagère (aucun point en plus : même session). */
async function callRetry<T>(fn: () => Promise<T>): Promise<T> {
  let last: unknown
  for (let i = 0; i < 3; i++) {
    try { return await fn() } catch (e) {
      last = e
      if (!transient(e)) throw e
      await wait(2500 * (i + 1))
      for (let k = 0; k < 30 && typeof navigator !== 'undefined' && !navigator.onLine; k++) await wait(1000) // attend le retour du réseau (30 s)
    }
  }
  throw last
}

export interface WriteArgs {
  courseId: string; title: string; brief: string; plan: string; session: string
  texts: Record<number, string>
  onProgress: (done: number, total: number, current: string) => void
  onSave: (texts: Record<number, string>) => void
  /** Renvoie true quand l'étudiant a demandé d'attendre ou d'abandonner : on s'arrête proprement entre deux parties. */
  shouldStop?: () => boolean
}

/** Levée quand la rédaction est arrêtée volontairement (Attendre / Abandonner) : ce n'est pas une erreur. */
export class TpStopped extends Error { constructor() { super('Rédaction arrêtée') } }

/** Rédige le TP partie par partie. Ne refait que les parties manquantes ou incomplètes. Lève une erreur claire si une partie échoue : le travail déjà fait est conservé (onSave). */
export async function writeTp(a: WriteArgs): Promise<string> {
  const parts = parsePlan(a.plan)
  const texts: Record<number, string> = { ...a.texts }
  const titles = parts.map((p) => p.title).join('\n')
  for (let round = 0; round < 3; round++) {
    const todo = parts.filter((p) => !partIsComplete(p, texts[p.n], round === 2))
    if (!todo.length) break
    for (const p of todo) {
      if (a.shouldStop?.()) throw new TpStopped()
      a.onProgress(parts.length - todo.length + todo.indexOf(p), parts.length, p.title)
      const prev = parts[p.n - 2] ? (texts[p.n - 1] ?? '').slice(-700) : ''
      const prompt = `Titre du travail : ${a.title}\nConsignes : ${a.brief.slice(0, 2500)}\n\nPLAN COMPLET (pour la cohérence, ne rédige que la partie demandée) :\n${titles}\n\nPARTIE À RÉDIGER (titre et sous-parties à reprendre tels quels) :\n${p.raw}\n` + (prev ? `\nFin de la partie précédente (ne la répète pas) :\n${prev}\n` : '')
      const r = await callRetry(() => askAI({ task: 'tp_section', courseId: a.courseId, tpSession: a.session, prompt }))
      const txt = cleanTpText(r.reply).trim()
      // Abandon : on jette ce résultat. Attente : on le garde, la partie est payée et déjà faite.
      if (txt) texts[p.n] = txt
      a.onSave(texts)
      if (a.shouldStop?.()) throw new TpStopped()
    }
  }
  const bad = missingParts(parts, texts, true)
  if (bad.length) throw new Error(`Il manque encore la partie ${bad.join(', ')}. Appuie sur « Reprendre la rédaction » : seules les parties manquantes seront refaites, sans point en plus.`)
  return assemble(parts, texts)
}

/**
 * Ajuste la LONGUEUR du texte quand la mise en page seule ne suffit pas pour obtenir le nombre de pages demandé.
 * Rien n'est supprimé au hasard et aucune page vide n'est ajoutée : on demande à l'IA d'étoffer (ou de condenser) quelques parties précises,
 * en gardant leurs titres. Une partie de rédaction coûte 0 point (même session de TP). Au plus 6 appels par ajustement.
 * `gap` = pages à retirer (> 0) ou à ajouter (< 0), mesuré sur le PDF réel.
 */
export async function adjustLength(a: { courseId: string; title: string; brief: string; plan: string; session: string; texts: Record<number, string>; gap: number; onProgress: (msg: string) => void }): Promise<Record<number, string>> {
  const parts = parsePlan(a.plan)
  const texts: Record<number, string> = { ...a.texts }
  const grow = a.gap < 0
  const pageChars = 2300 // ordre de grandeur d'une page de texte courant
  let wanted = Math.round(Math.abs(a.gap) * pageChars)
  const body = parts.filter((p) => !/introduction|conclusion|biblio/i.test(p.title) && (texts[p.n] ?? '').length > 0)
  const pool = (body.length ? body : parts.filter((p) => (texts[p.n] ?? '').length > 0))
    .sort((x, y) => grow ? (texts[x.n] ?? '').length - (texts[y.n] ?? '').length : (texts[y.n] ?? '').length - (texts[x.n] ?? '').length)
  let calls = 0
  for (const p of pool) {
    if (wanted <= 150 || calls >= 6) break
    const cur = texts[p.n] ?? ''
    const share = Math.min(wanted, grow ? Math.max(500, Math.round(cur.length * 0.6)) : Math.round(cur.length * 0.4))
    const newLen = grow ? cur.length + share : Math.max(400, cur.length - share)
    a.onProgress(`${grow ? 'Je développe' : 'Je condense'} : ${p.title.slice(0, 50)}`)
    const consigne = `CONSIGNE DE LONGUEUR : réécris cette partie ${grow ? 'en l\u2019étoffant (explications, exemples, arguments utiles, sans remplissage ni répétition)' : 'en la condensant (garde l\u2019essentiel, supprime les redites)'} pour obtenir environ ${newLen} caractères. Garde EXACTEMENT les mêmes titres et sous-parties, dans le même ordre.\n\nTEXTE ACTUEL DE LA PARTIE :\n${cur.slice(0, 6000)}`
    const prompt = `Titre du travail : ${a.title}\nConsignes : ${a.brief.slice(0, 1500)}\n\nPARTIE À RÉDIGER (titre et sous-parties à reprendre tels quels) :\n${p.raw}\n\n${consigne}`
    try {
      const r = await callRetry(() => askAI({ task: 'tp_section', courseId: a.courseId, tpSession: a.session, prompt }))
      const txt = cleanTpText(r.reply).trim()
      // on n'accepte la réécriture que si elle est complète (titres présents) et va dans le bon sens
      if (txt && partIsComplete(p, txt, false) && (grow ? txt.length > cur.length * 1.1 : txt.length < cur.length * 0.95)) {
        wanted -= Math.abs(txt.length - cur.length)
        texts[p.n] = txt
      }
    } catch (e) {
      if (e instanceof LimitError || !transient(e)) break
    }
    calls++
  }
  return texts
}
