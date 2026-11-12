// Dictée vocale et lecture à voix haute : tout se fait avec le navigateur du téléphone, sans serveur ni coût.
import { useSyncExternalStore } from 'react'

/** Lecture en cours (une seule à la fois). Partagée par toute l'application : le mini-lecteur la montre sur tous les écrans. */
export interface Voice {
  label: string
  sub?: string
  /** Identifiant de ce qui est lu (ex. un message de l'Assistant), pour afficher « Arrêter » au bon endroit. */
  id?: string
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

/**
 * Démarre la dictée. onText reçoit le texte définitif au fur et à mesure ; onEnd est appelé à l'arrêt.
 * La dictée continue tant que l'étudiant ne l'arrête pas : les silences et les coupures automatiques du navigateur
 * (quelques secondes, parfois une minute) relancent l'écoute sans qu'il s'en aperçoive. Limite : 30 minutes.
 */
export function startDictation(onText: (t: string) => void, onEnd: (error?: string) => void): Dictation | null {
  const Ctor = recognitionCtor()
  if (!Ctor) return null
  const startedAt = Date.now()
  let stopped = false
  let current: Recognition | null = null
  let quick = 0 // coupures rapprochées d'affilée : au-delà de 3, on s'arrête (micro indisponible)
  let began = 0

  const begin = (): boolean => {
    const r = new Ctor()
    r.lang = 'fr-FR'
    r.interimResults = false
    r.continuous = true
    let err: string | undefined
    r.onresult = (e) => {
      let out = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) out += e.results[i][0].transcript
      }
      if (out.trim()) onText(out.trim())
    }
    r.onerror = (e) => { err = e.error }
    r.onend = () => {
      if (stopped) return onEnd(undefined)
      const fatal = err === 'not-allowed' || err === 'service-not-allowed' || err === 'audio-capture'
      if (fatal || Date.now() - startedAt > MAX_DICTATION_MS) { stopped = true; return onEnd(fatal ? err : undefined) }
      quick = Date.now() - began < 700 ? quick + 1 : 0
      if (quick >= 3) { stopped = true; return onEnd(err) }
      // Coupure automatique (silence, limite du navigateur) : on relance l'écoute.
      window.setTimeout(() => {
        if (stopped) return
        if (!begin()) { stopped = true; onEnd(err) }
      }, 200)
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
  return text.replace(/[#*_`>]/g, '').replace(/\s+/g, ' ').trim()
}

/** Lit le texte à voix haute en français. Les textes longs sont coupés en morceaux (sinon certains téléphones s'arrêtent). */
export function speak(text: string, onEnd?: () => void, meta: Voice = { label: 'Lecture en cours' }): boolean {
  if (!canSpeak()) return false
  const synth = window.speechSynthesis
  const my = ++session // les anciens morceaux annulés ne doivent plus rien déclencher
  synth.cancel()
  const chunks = plain(text).match(/[^.!?\n]+[.!?]*\s*/g) ?? []
  const parts: string[] = []
  let cur = ''
  for (const c of chunks) {
    if ((cur + c).length > 220) { if (cur) parts.push(cur); cur = c } else cur += c
  }
  if (cur) parts.push(cur)
  if (!parts.length) { setCurrent(null); return false }
  const done = () => {
    if (my !== session) return
    setCurrent(null)
    onEnd?.()
  }
  const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('fr'))
  setCurrent(meta)
  parts.forEach((p, i) => {
    const u = new SpeechSynthesisUtterance(p)
    u.lang = 'fr-FR'
    if (voice) u.voice = voice
    u.rate = 1
    if (i === parts.length - 1) u.onend = done
    u.onerror = done
    synth.speak(u)
  })
  return true
}

export function stopSpeaking() {
  session++
  if (canSpeak()) window.speechSynthesis.cancel()
  if (current) setCurrent(null)
}
