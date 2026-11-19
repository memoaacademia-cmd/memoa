// Dictée vocale et lecture à voix haute : tout se fait avec le navigateur du téléphone, sans serveur ni coût.
import { useSyncExternalStore } from 'react'
import { track } from './track'
import { toSpeechText } from './blocks'

/** Lecture en cours (une seule à la fois). Partagée par toute l'application : le mini-lecteur la montre sur tous les écrans. */
export interface Voice {
  label: string
  sub?: string
  /** Identifiant de ce qui est lu (ex. un message de l'Assistant), pour afficher « Arrêter » au bon endroit. */
  id?: string
  /** Vrai quand la lecture est en pause (le mini-lecteur affiche alors « Reprendre »). */
  paused?: boolean
}
let current: Voice | null = null
let session = 0
const listeners = new Set<() => void>()
const setCurrent = (v: Voice | null) => {
  current = v
  listeners.forEach((f) => f())
}
const subscribe = (f: () => void) => {
  listeners.add(f)
  return () => { listeners.delete(f) }
}
/** Vaut null quand rien n'est lu. */
export const useVoice = () => useSyncExternalStore(subscribe, () => current)

interface RecognitionEvent {
  resultIndex: number
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
}
interface Recognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error?: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

function recognitionCtor(): (new () => Recognition) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const canDictate = () => recognitionCtor() !== null
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window

export interface Dictation {
  stop: () => void
}

/** Durée maximale d'une dictée (le navigateur coupe tout seul après quelques secondes de silence : on relance automatiquement). */
const MAX_DICTATION_MS = 30 * 60_000

/** Message à montrer à l'étudiant selon l'erreur renvoyée par le navigateur (undefined = rien à dire). */
export function dictationMessage(err?: string): string | null {
  switch (err) {
    case 'not-allowed':
    case 'service-not-allowed': return 'Le micro est bloqué. Autorise-le dans les réglages du navigateur, puis réessaie.'
    case 'audio-capture': return "Je n'arrive pas à utiliser le micro (il est peut-être pris par une autre application). Ferme-la puis réessaie."
    case 'network': return 'La dictée a besoin du réseau sur ce téléphone. Écris à la main, ou réessaie quand le réseau revient.'
    case 'no-speech': return "Je n'ai rien entendu. Rapproche le téléphone de ta bouche et réessaie."
    case 'language-not-supported': return "La dictée en français n'est pas disponible sur ce navigateur. Essaie avec Chrome."
    default: return err ? 'La dictée a été interrompue. Réessaie.' : null
  }
}

/**
 * Démarre la dictée. onText reçoit le texte au fur et à mesure ; onEnd est appelé à l'arrêt (avec l'erreur éventuelle).
 * La dictée continue tant que l'étudiant ne l'arrête pas : les silences et les coupures automatiques du navigateur
 * relancent l'écoute sans qu'il s'en aperçoive. Limite : 30 minutes.
 * Sur Android, Chrome gère mal le mode « continu » (texte vide ou répété) : on y écoute phrase par phrase et on relance.
 * Si le navigateur coupe sans avoir confirmé la dernière phrase, le texte provisoire est quand même gardé.
 */
export function startDictation(onText: (t: string) => void, onEnd: (error?: string) => void): Dictation | null {
  const Ctor = recognitionCtor()
  if (!Ctor) return null
  const android = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)
  const startedAt = Date.now()
  let stopped = false
  let current: Recognition | null = null
  let quick = 0 // coupures rapprochées d'affilée : au-delà de 3, on s'arrête
  let began = 0
  let lang = 'fr-FR'

  const begin = (): boolean => {
    const r = new Ctor()
    r.lang = lang
    r.interimResults = true
    r.continuous = !android
    let err: string | undefined
    let pending = '' // texte provisoire pas encore confirmé
    let heard = false
    const flush = () => { const t = pending.trim(); pending = ''; if (t) { heard = true; onText(t) } }
    r.onresult = (e) => {
      let fin = ''
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) fin += res[0].transcript
        else interim += res[0].transcript
      }
      if (fin.trim()) { heard = true; onText(fin.trim()) }
      pending = interim
    }
    r.onerror = (e) => { err = e.error }
    r.onend = () => {
      flush()
      if (stopped) return onEnd(undefined)
      // Erreur « no-speech » : simple silence, on continue d'écouter ; les autres erreurs graves arrêtent la dictée.
      if (err === 'language-not-supported' && lang === 'fr-FR') { lang = 'fr'; err = undefined }
      const fatal = err === 'not-allowed' || err === 'service-not-allowed' || err === 'audio-capture' || err === 'network' || err === 'language-not-supported'
      if (fatal || Date.now() - startedAt > MAX_DICTATION_MS) { stopped = true; return onEnd(fatal ? err : undefined) }
      quick = !heard && Date.now() - began < 1500 ? quick + 1 : 0
      if (quick >= 4) { stopped = true; return onEnd(err ?? 'no-speech') }
      // Coupure automatique (silence, fin de phrase, limite du navigateur) : on relance l'écoute.
      window.setTimeout(() => {
        if (stopped) return
        if (!begin()) { stopped = true; onEnd(err) }
      }, 250)
    }
    try {
      began = Date.now()
      r.start()
    } catch {
      return false
    }
    current = r
    return true
  }

  if (!begin()) return null
  return { stop: () => { stopped = true; try { current?.stop() } catch { /* déjà arrêtée */ } } }
}

function plain(text: string): string {
  // Les titres et puces n'ont pas de ponctuation : on ajoute un point à la fin de chaque ligne pour que la voix marque une pause.
  return toSpeechText(text)
    .replace(/^\s*[-•·]\s+/gm, '')
    .replace(/[#*_`>]/g, '')
    .split('\n')
    .map((l) => { const t = l.trim(); return t && t.length <= 110 && !/[.!?:;,]$/.test(t) ? t + '.' : t }) // courte ligne sans ponctuation = titre ou puce
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Lecture morceau par morceau : on garde la position pour pouvoir mettre en pause et reprendre.
// (La pause native du navigateur ne marche pas sur beaucoup de téléphones Android : on arrête le morceau et on le relit au « Reprendre ».)
let parts: string[] = []
let idx = 0
let paused = false
let seq = 0
let endCb: (() => void) | undefined
let meta: Voice = { label: 'Lecture en cours' }

function finish(my: number) {
  if (my !== session) return
  parts = []
  paused = false
  setCurrent(null)
  endCb?.()
}

function playChunk(my: number) {
  if (my !== session || paused) return
  if (idx >= parts.length) return finish(my)
  const synth = window.speechSynthesis
  const mine = ++seq // ignore les événements tardifs d'un morceau annulé
  const u = new SpeechSynthesisUtterance(parts[idx])
  u.lang = 'fr-FR'
  const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('fr'))
  if (voice) u.voice = voice
  u.rate = 1
  u.onend = () => { if (mine !== seq || my !== session || paused) return; idx++; playChunk(my) }
  u.onerror = (e) => {
    if (mine !== seq || my !== session || paused) return
    const err = (e as SpeechSynthesisErrorEvent).error
    if (err === 'canceled' || err === 'interrupted') return
    finish(my)
  }
  synth.speak(u)
}

/** Lit le texte à voix haute en français. Les textes longs sont coupés en morceaux (sinon certains téléphones s'arrêtent). */
export function speak(text: string, onEnd?: () => void, m: Voice = { label: 'Lecture en cours' }): boolean {
  if (!canSpeak()) return false
  const synth = window.speechSynthesis
  const my = ++session // les anciens morceaux annulés ne doivent plus rien déclencher
  seq++
  synth.cancel()
  const chunks = plain(text).match(/[^.!?\n]+[.!?]*\s*/g) ?? []
  const next: string[] = []
  let cur = ''
  for (const c of chunks) {
    if ((cur + c).length > 220) { if (cur) next.push(cur); cur = c } else cur += c
  }
  if (cur) next.push(cur)
  if (!next.length) { setCurrent(null); return false }
  parts = next
  idx = 0
  paused = false
  endCb = onEnd
  meta = m
  setCurrent({ ...m, paused: false })
  playChunk(my)
  track('voice_play', { where: m.id ? 'assistant' : 'cours' })
  return true
}

/** Met la lecture en pause (la phrase en cours sera relue depuis son début à la reprise). */
export function pauseSpeaking() {
  if (!current || paused || !parts.length) return
  paused = true
  seq++
  if (canSpeak()) window.speechSynthesis.cancel()
  setCurrent({ ...meta, paused: true })
}

export function resumeSpeaking() {
  if (!current || !paused || !parts.length) return
  paused = false
  setCurrent({ ...meta, paused: false })
  playChunk(session)
}

export function togglePause() { if (paused) resumeSpeaking(); else pauseSpeaking() }

export function stopSpeaking() {
  session++
  seq++
  parts = []
  paused = false
  if (canSpeak()) window.speechSynthesis.cancel()
  if (current) setCurrent(null)
}
