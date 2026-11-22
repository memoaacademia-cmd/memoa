// Dictée « enregistrer puis transcrire » : la voix est enregistrée sur le téléphone, puis transcrite par l'IA (plus fiable que la
// dictée du navigateur, qui s'arrête au moindre silence et perd des mots). Gratuite en points ; plafond par jour côté serveur
// (10 en gratuit, 20 en Premium) ; 3 minutes maximum par dictée. Au-delà du plafond, ou sans réseau : dictée du téléphone.
import { DictationLimitError, transcribeDictation } from './api'
import { isConfigured } from './supabase'
import { track } from './track'
import type { Dictation } from './speech'

export const DICTATION_MAX_SECONDS = 180
const QUOTA_KEY = 'memoa_dict_quota'

/** Jour de Kinshasa (UTC+1) sous la forme AAAA-MM-JJ : le plafond repart à minuit là-bas. */
const kinDay = () => new Date(Date.now() + 3_600_000).toISOString().slice(0, 10)

function readQuota(): { day: string; left: number } | null {
  try {
    const q = JSON.parse(localStorage.getItem(QUOTA_KEY) ?? 'null') as { day?: string; left?: number } | null
    return q && typeof q.day === 'string' && typeof q.left === 'number' ? { day: q.day, left: q.left } : null
  } catch { return null }
}
function setQuota(left: number) {
  try { localStorage.setItem(QUOTA_KEY, JSON.stringify({ day: kinDay(), left })) } catch { /* stockage indisponible : le serveur reste la référence */ }
}

/** Vrai si on peut enregistrer puis transcrire (réseau, micro et enregistrement disponibles, plafond du jour pas atteint). */
export function recordedDictationAvailable(): boolean {
  if (!isConfigured || typeof window === 'undefined' || typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false
  if (navigator.onLine === false) return false
  const q = readQuota()
  return !(q && q.day === kinDay() && q.left <= 0)
}

function pickMime(): string {
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    try { if (MediaRecorder.isTypeSupported(m)) return m } catch { /* on essaie le suivant */ }
  }
  return ''
}
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Même contrat que la dictée du navigateur : onText reçoit le texte, onEnd est appelé à la fin (avec un code d'erreur éventuel).
 * Différence : le texte arrive d'un seul coup, quelques secondes APRÈS l'arrêt. onBusy(true) pendant la transcription.
 * stop() = arrêter et transcrire ; cancel() = arrêter et jeter l'enregistrement.
 */
export function startRecordedDictation(onText: (t: string) => void, onEnd: (error?: string) => void, onBusy?: (busy: boolean) => void): Dictation {
  let stopped = false
  let cancelled = false
  let hitMax = false
  let recorder: MediaRecorder | null = null
  let stream: MediaStream | null = null
  let timer = 0
  const chunks: Blob[] = []
  const release = () => { window.clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); stream = null }

  async function begin() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch (e) {
      const n = (e as { name?: string }).name
      onEnd(n === 'NotAllowedError' || n === 'SecurityError' ? 'not-allowed' : 'audio-capture')
      return
    }
    if (stopped || cancelled) { release(); onEnd(); return } // arrêté pendant que le téléphone demandait l'autorisation
    try {
      const mime = pickMime()
      recorder = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 })
    } catch {
      release(); onEnd('audio-capture'); return
    }
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }
    recorder.onstop = () => { void finish() }
    recorder.start(1000)
    timer = window.setTimeout(() => { hitMax = true; stop() }, DICTATION_MAX_SECONDS * 1000)
  }

  async function finish() {
    release()
    if (cancelled) { onEnd(); return }
    const type = recorder?.mimeType || 'audio/webm'
    const blob = new Blob(chunks, { type })
    if (blob.size < 2000) { onEnd('no-speech'); return }
    const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
    const file = new File([blob], `dictee.${ext}`, { type })
    onBusy?.(true)
    let err: string | undefined
    for (let i = 0; i < 2; i++) {
      try {
        const r = await transcribeDictation(file)
        if (typeof r.left === 'number') setQuota(r.left)
        const t = r.text.trim()
        if (t && !cancelled) onText(t)
        err = hitMax ? 'max-duration' : undefined
        track('dictation_recorded', { seconds: Math.round(blob.size / 4000) })
        break
      } catch (e) {
        if (e instanceof DictationLimitError) { setQuota(0); err = 'dictation-limit'; break }
        if (/aucune parole/i.test((e as Error).message)) { err = 'no-speech'; break }
        if (i === 1 || navigator.onLine === false) { err = 'transcribe-failed'; break }
        await sleep(1200) // un second essai avant d'abandonner : on ne perd pas trois minutes de voix pour une coupure de réseau
      }
    }
    onBusy?.(false)
    onEnd(err)
  }

  function stop() {
    if (stopped) return
    stopped = true
    window.clearTimeout(timer)
    if (recorder && recorder.state !== 'inactive') { try { recorder.stop() } catch { release(); onEnd() } }
  }

  void begin()
  return { stop, cancel: () => { cancelled = true; stop() }, recorded: true }
}
