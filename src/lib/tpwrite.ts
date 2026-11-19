import { askAI, LimitError } from './api'
import { cleanPlan, cleanTpText } from './tpclean'

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
  const lines = cleanPlan(plan).split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim())
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

/** Nombre MAXIMUM de parties principales selon les pages voulues (introduction, conclusion et bibliographie comprises). 1 page = 3 parties. */
export const partsFor = (n: number) => (n <= 1 ? 3 : n <= 3 ? 4 : n <= 5 ? 5 : n <= 7 ? 6 : n <= 10 ? 7 : n <= 15 ? 8 : 10)
/** Nombre maximum de sous-parties par partie : aucune pour un travail très court (1 à 2 pages), sinon 2. */
export const subsFor = (n: number) => (n <= 1 ? 0 : n <= 2 ? 2 : n <= 7 ? 3 : 4)

/** Retire la numérotation ou la puce au début d'une ligne de plan, pour garder seulement le titre. */
const stripNum = (s: string) => s.replace(/^\s*[0-9]+(\.[0-9]+)+\s*[.)\-:–]?\s*/, '').replace(/^\s*(partie\s+)?([0-9]+|[ivxl]+|[a-z])\s*[.)\-:–]\s*/i, '').replace(/^[-•·▪●]\s*/, '').trim()

/**
 * Impose au plan le nombre de parties voulu. Le modèle ne respecte pas toujours « au plus N parties » (un TP d'une page pouvait revenir avec 18 parties,
 * donc 18 appels de rédaction). Ici le code garde l'introduction et la conclusion, regroupe les parties du milieu (les titres en trop deviennent des
 * sous-parties, ou sont joints au titre quand il n'y a pas de sous-partie) et renumérote. Un plan déjà dans la limite n'est pas touché.
 */
export function limitPlan(plan: string, pages: number): string {
  if (!pages || pages < 1) return plan
  const maxP = partsFor(pages)
  const maxS = subsFor(pages)
  const parts = parsePlan(plan)
  if (parts.length < 2) return plan
  const subsOf = (p: TpPart) => p.subs.map(stripNum).filter(Boolean)
  if (parts.length <= maxP && parts.every((p) => subsOf(p).length <= maxS)) return plan

  type Item = { title: string; subs: string[] }
  const items: Item[] = parts.map((p) => ({ title: stripNum(p.title), subs: subsOf(p) }))
  const intro = items.filter((i, k) => k === 0 && /^introduction/i.test(i.title))
  let concl = items.filter((i, k) => k >= items.length - 2 && /^conclusion/i.test(i.title))
  let biblio = items.filter((i) => /^bibliographie/i.test(i.title))
  const middle = items.filter((i) => !intro.includes(i) && !concl.includes(i) && !biblio.includes(i))
  if (intro.length + concl.length + biblio.length >= maxP) biblio = [] // très court : la bibliographie saute en premier
  if (intro.length + concl.length + biblio.length >= maxP) concl = concl.slice(0, 1)
  const slots = Math.max(1, maxP - intro.length - concl.length - biblio.length)

  // Regroupe les parties du milieu en `slots` groupes consécutifs de taille à peu près égale.
  const groups: Item[][] = []
  const base = Math.floor(middle.length / slots)
  let extra = middle.length % slots
  let at = 0
  for (let g = 0; g < slots && at < middle.length; g++) {
    const size = base + (extra-- > 0 ? 1 : 0)
    groups.push(middle.slice(at, at + size))
    at += size
  }
  const merged: Item[] = groups.map((g) => {
    if (g.length === 1) return g[0]
    const [head, ...rest] = g
    return maxS > 0
      ? { title: head.title, subs: [...head.subs, ...rest.map((r) => r.title)] }
      : { title: [head.title, rest[0].title].join(' et '), subs: [] }
  })
  const out = [...intro, ...merged, ...concl, ...biblio]
  return out.map((it, i) => [`${i + 1}. ${it.title}`, ...it.subs.slice(0, maxS).map((x, j) => `${i + 1}.${j + 1} ${x}`)].join('\n')).join('\n')
}

/**
 * Une sous-partie est présente si son titre court figure dans le texte. Les sous-parties du plan sont des lignes détaillées
 * (« Contexte et enjeux : définition des notions clés ») que l'IA raccourcit ou reformule : on compare seulement le titre avant les deux-points,
 * et à défaut la plupart de ses mots importants (le texte est déjà normalisé).
 */
function subPresent(sub: string, normText: string): boolean {
  const head = sub.replace(/^\s*(\d+\.\d+|[ivxl]+\.\d+|[a-z]\)|[-•·▪●])\s*/i, '').split(/\s*[:–—]\s+/)[0]
  const b = norm(head)
  if (b.length < 4 || normText.includes(b)) return true
  const words = b.split(' ').filter((w) => w.length > 3)
  if (!words.length) return true
  return words.filter((w) => normText.includes(w)).length / words.length >= 0.6
}

/** Une partie est valide si son titre et chacune de ses sous-parties y figurent, avec un vrai développement. */
export function partIsComplete(part: TpPart, text: string | undefined, relaxed = false): boolean {
  if (!text) return false
  const t = norm(text)
  if (!t.includes(bare(part.title))) return false
  // Dernier essai (relaxed) : le modèle a pu reformuler légèrement un titre de sous-partie ; on exige alors seulement le titre et un vrai texte.
  if (relaxed) return text.trim().length >= 300
  for (const s of part.subs) if (!subPresent(s, t)) return false
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
export interface TpProgress { courseId: string; title: string; brief: string; plan: string; session: string | null; texts: Record<number, string>; at: number; /** Nombre de pages voulu (sans page de garde). */ pages?: number; /** Nom du professeur (page de garde). */ supervisor?: string }
export function loadProgress(courseId: string): TpProgress | null {
  try {
    const p = JSON.parse(localStorage.getItem(KEY(courseId)) ?? 'null') as TpProgress | null
    return p && Date.now() - p.at < 23 * 3600_000 ? p : null // la session de TP expire au bout de 24 h
  } catch { return null }
}
export function saveProgress(p: TpProgress) { try { localStorage.setItem(KEY(p.courseId), JSON.stringify({ ...p, at: Date.now() })) } catch { /* stockage plein : on continue sans */ } }
export function clearProgress(courseId: string) { try { localStorage.removeItem(KEY(courseId)) } catch { /* rien */ } }

// ---- TP terminé : gardé sur le téléphone jusqu'à ce que l'étudiant en commence un nouveau (48 h au plus) ----
// Avant, le texte terminé n'existait que dans l'écran : fermer l'appli ou en sortir pendant la rédaction le faisait disparaître.
const DONE = (courseId: string) => `memoa-tp-done:${courseId}`
export interface TpDone { courseId: string; title: string; brief: string; plan: string; session: string | null; pages?: number; supervisor?: string; doc: string; texts: Record<number, string>; at: number }
export function saveDone(d: Omit<TpDone, 'at'>) { try { localStorage.setItem(DONE(d.courseId), JSON.stringify({ ...d, at: Date.now() })) } catch { /* stockage plein : on continue sans */ } }
export function loadDone(courseId: string): TpDone | null {
  try {
    const d = JSON.parse(localStorage.getItem(DONE(courseId)) ?? 'null') as TpDone | null
    return d && d.doc && Date.now() - d.at < 48 * 3600_000 ? d : null
  } catch { return null }
}
export function clearDone(courseId: string) { try { localStorage.removeItem(DONE(courseId)) } catch { /* rien */ } }

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const transient = (e: unknown) => !(e instanceof LimitError) && !/expir|session|point|Premium|limite|Doucement/i.test(e instanceof Error ? e.message : '')

/** Levée quand l'étudiant appuie sur « pause » ou « annuler » : ce n'est pas une erreur à afficher. */
export class StopError extends Error { constructor() { super('stop') } }
export const isStop = (e: unknown): e is StopError => e instanceof StopError

const TRY_MS = 75_000 // une tentative qui dépasse 75 s est abandonnée tout de suite et refaite (le serveur passe alors à un autre modèle)
/** Attend le résultat, mais s'arrête si l'étudiant met en pause / annule, ou si le serveur met trop longtemps. */
function withLimit<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let done = false
    const end = () => { done = true; clearTimeout(timer); signal?.removeEventListener('abort', onAbort) }
    const timer = setTimeout(() => { if (!done) { end(); reject(new Error('Le serveur met trop de temps à répondre.')) } }, TRY_MS)
    const onAbort = () => { if (!done) { end(); reject(new StopError()) } }
    if (signal?.aborted) { onAbort(); return }
    signal?.addEventListener('abort', onAbort, { once: true })
    p.then((v) => { if (!done) { end(); resolve(v) } }, (e) => { if (!done) { end(); reject(e) } })
  })
}

/** Un appel avec 1 nouvelle tentative immédiate en cas de coupure réseau ou d'erreur passagère (aucun point en plus : même session). */
async function callRetry<T>(fn: () => Promise<T>, signal?: AbortSignal, note?: (m: string) => void): Promise<T> {
  let last: unknown
  for (let i = 0; i < 2; i++) {
    if (signal?.aborted) throw new StopError()
    try { return await withLimit(fn(), signal) } catch (e) {
      if (e instanceof StopError) throw e
      last = e
      if (!transient(e)) throw e
      if (i < 1) note?.('Le serveur répond lentement… nouvelle tentative')
      await wait(1000)
      for (let k = 0; k < 30 && !signal?.aborted && typeof navigator !== 'undefined' && !navigator.onLine; k++) await wait(1000) // attend le retour du réseau (30 s)
      if (signal?.aborted) throw new StopError()
    }
  }
  throw last
}

export interface WriteArgs {
  courseId: string; title: string; brief: string; plan: string; session: string
  texts: Record<number, string>
  onProgress: (done: number, total: number, current: string) => void
  onSave: (texts: Record<number, string>) => void
  /** Pause / annulation demandée par l'étudiant. */
  /** Nombre de pages voulu (sans la page de garde) : sert à fixer la longueur visée de chaque partie. */
  pages?: number
  /** Professeur (page de garde) : gardé avec le TP terminé. */
  supervisor?: string
  signal?: AbortSignal
  /** Petit message d'état (ex. nouvelle tentative). */
  onNote?: (msg: string) => void
}

/** Rédige le TP partie par partie. Ne refait que les parties manquantes ou incomplètes. Lève une erreur claire si une partie échoue : le travail déjà fait est conservé (onSave). */
export async function writeTp(a: WriteArgs): Promise<string> {
  const parts = parsePlan(a.pages ? limitPlan(a.plan, a.pages) : a.plan)
  const texts: Record<number, string> = { ...a.texts }
  const titles = parts.map((p) => p.title).join('\n')
  // Longueur visée par partie : répartit les pages voulues (≈ 2000 caractères par page, titres et espaces compris) ; introduction et conclusion plus courtes.
  const weight = (p: TpPart) => (/biblio/i.test(p.title) ? 0.25 : /introduction|conclusion/i.test(p.title) ? 0.7 : 1)
  const totalW = parts.reduce((t, p) => t + weight(p), 0) || 1
  const target = (p: TpPart) => (a.pages ? Math.max(300, Math.round((a.pages * 2000 * weight(p)) / totalW / 50) * 50) : 0)
  let softRounds = 0
  for (let round = 0; round < 3; round++) {
    const todo = parts.filter((p) => !partIsComplete(p, texts[p.n], round === 2))
    if (!todo.length) break
    // Plusieurs parties à la fois (3 au plus) : le TP est fini environ 3 fois plus vite qu'en une seule file.
    // Chaque partie connaît le plan complet ; la fin de la partie précédente n'est donnée que si elle existe déjà (reprise, nouvelle tentative).
    let next = 0
    let finished = 0
    let failure: unknown = null // erreur définitive (points épuisés, pause, session expirée…) : on s'arrête
    let soft: unknown = null // échec passager d'une partie : les autres continuent, la partie est refaite au tour suivant
    const worker = async () => {
      while (!failure) {
        if (a.signal?.aborted) throw new StopError()
        const p = todo[next++]
        if (!p) return
        a.onProgress(parts.length - todo.length + finished, parts.length, p.title)
        const prev = parts[p.n - 2] ? (texts[p.n - 1] ?? '').slice(-700) : ''
        const prompt = `Titre du travail : ${a.title}\nConsignes : ${a.brief.slice(0, 2500)}\n\nPLAN COMPLET (pour la cohérence, ne rédige que la partie demandée) :\n${titles}\n\nPARTIE À RÉDIGER (titre et sous-parties à reprendre tels quels) :\n${p.raw}\n` + (prev ? `\nFin de la partie précédente (ne la répète pas) :\n${prev}\n` : '')
          + (target(p) ? `\nLONGUEUR VISÉE POUR CETTE PARTIE : environ ${target(p)} caractères (${Math.round(target(p) / 6)} mots). Ne dépasse pas ce volume de plus de 15 % : le travail entier doit tenir en ${a.pages} pages.\n` : '')
        try {
          const r = await callRetry(() => askAI({ task: 'tp_section', courseId: a.courseId, tpSession: a.session, prompt }), a.signal, a.onNote)
          const txt = cleanTpText(r.reply).trim()
          if (txt) texts[p.n] = txt
          finished++
          a.onSave(texts)
        } catch (e) {
          // Coupure ou lenteur passagère : on garde cette partie « à refaire » et on continue les autres ; elle sera retentée automatiquement.
          if (e instanceof StopError || e instanceof LimitError || !transient(e)) { failure = failure ?? e; return }
          soft = soft ?? e
          a.onNote?.('Une partie a pris trop de temps : je la refais…')
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, todo.length) }, () => worker()))
    if (failure) throw failure
    // Une partie a échoué : UN seul tour de rattrapage automatique (seulement les parties manquantes), puis on s'arrête et on propose « Reprendre ».
    if (soft) { softRounds++; if (softRounds >= 2) break; await wait(500) }
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
