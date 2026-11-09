// Dictée vocale et lecture à voix haute : tout se fait avec le navigateur du téléphone, sans serveur ni coût.

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

/** Démarre la dictée. onText reçoit le texte définitif au fur et à mesure ; onEnd est appelé à l'arrêt. */
export function startDictation(onText: (t: string) => void, onEnd: (error?: string) => void): Dictation | null {
  const Ctor = recognitionCtor()
  if (!Ctor) return null
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
  r.onend = () => onEnd(err)
  try {
    r.start()
  } catch {
    return null
  }
  return { stop: () => { try { r.stop() } catch { /* déjà arrêtée */ } } }
}

function plain(text: string): string {
  return text.replace(/[#*_`>]/g, '').replace(/\s+/g, ' ').trim()
}

/** Lit le texte à voix haute en français. Les textes longs sont coupés en morceaux (sinon certains téléphones s'arrêtent). */
export function speak(text: string, onEnd?: () => void): boolean {
  if (!canSpeak()) return false
  const synth = window.speechSynthesis
  synth.cancel()
  const chunks = plain(text).match(/[^.!?\n]+[.!?]*\s*/g) ?? []
  const parts: string[] = []
  let cur = ''
  for (const c of chunks) {
    if ((cur + c).length > 220) { if (cur) parts.push(cur); cur = c } else cur += c
  }
  if (cur) parts.push(cur)
  if (!parts.length) return false
  const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('fr'))
  parts.forEach((p, i) => {
    const u = new SpeechSynthesisUtterance(p)
    u.lang = 'fr-FR'
    if (voice) u.voice = voice
    u.rate = 1
    if (i === parts.length - 1) u.onend = () => onEnd?.()
    u.onerror = () => onEnd?.()
    synth.speak(u)
  })
  return true
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel()
}
