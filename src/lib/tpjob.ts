// Rédaction du TP « hors de la page » : le travail vit dans ce module, pas dans l'écran.
// L'étudiant peut changer de page dans l'appli, la rédaction continue ; en revenant, il retrouve l'avancement ou le résultat.
import { useSyncExternalStore } from 'react'
import { friendlyError } from './api'
import { writeTp, clearProgress, saveProgress, isStop } from './tpwrite'

export interface TpJob {
  courseId: string
  running: boolean
  step: string
  texts: Record<number, string>
  /** Texte final quand la rédaction est terminée (à récupérer une fois avec takeTpResult). */
  result: string | null
  error: string | null
  /** La rédaction a été interrompue (appli en arrière-plan, coupure) : elle repart toute seule au retour. */
  interrupted: boolean
  /** L'étudiant a mis la rédaction en pause : le travail déjà fait est gardé, « Reprendre » repart de là. */
  paused: boolean
}

const jobs = new Map<string, TpJob>()
const args = new Map<string, Parameters<typeof writeTp>[0]>()
const ctrls = new Map<string, AbortController>()
const stopMode = new Map<string, 'pause' | 'cancel'>()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((f) => f())
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f) } }
const set = (id: string, patch: Partial<TpJob>) => {
  const cur = jobs.get(id) ?? { courseId: id, running: false, step: '', texts: {}, result: null, error: null, interrupted: false, paused: false }
  jobs.set(id, { ...cur, ...patch })
  emit()
}

export const useTpJob = (courseId: string): TpJob | undefined => useSyncExternalStore(subscribe, () => jobs.get(courseId))

let wake: { release: () => Promise<void> } | null = null
async function keepAwake(on: boolean) {
  try {
    if (on && !wake && 'wakeLock' in navigator) wake = await (navigator as unknown as { wakeLock: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen')
    if (!on && wake) { await wake.release(); wake = null }
  } catch { wake = null /* non disponible : on continue sans */ }
}

/** Prévient l'étudiant (si il l'a autorisé) quand le TP est prêt ou bloqué alors qu'il est ailleurs. */
async function notify(title: string, body: string) {
  try {
    if (document.visibilityState === 'visible') return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(title, { body, icon: './icon-192.png', tag: 'memoa-tp' })
  } catch { /* pas de notification : tant pis */ }
}

type Start = Omit<Parameters<typeof writeTp>[0], 'onProgress' | 'onSave'> & { onSave?: (texts: Record<number, string>) => void }

/** Lance (ou relance) la rédaction. Ne fait rien si elle tourne déjà pour ce cours. */
export function startTpJob(a: Start): void {
  if (jobs.get(a.courseId)?.running) return
  args.set(a.courseId, { ...a, onProgress: () => {}, onSave: a.onSave ?? (() => {}) })
  void run(a.courseId)
}

async function run(id: string) {
  const a = args.get(id)
  if (!a) return
  const seed = jobs.get(id)?.texts
  const ctrl = new AbortController()
  ctrls.set(id, ctrl)
  set(id, { running: true, error: null, result: null, interrupted: false, paused: false, texts: seed && Object.keys(seed).length ? seed : a.texts })
  void keepAwake(true)
  try {
    const result = await writeTp({
      ...a,
      texts: jobs.get(id)?.texts ?? a.texts,
      signal: ctrl.signal,
      onNote: (m) => set(id, { step: m }),
      onProgress: (d, t, cur) => set(id, { step: `Rédaction : partie ${Math.min(d + 1, t)} sur ${t} — ${cur.slice(0, 60)}` }),
      onSave: (t) => { set(id, { texts: { ...t } }); a.onSave({ ...t }) }
    })
    set(id, { running: false, step: '', result })
    void notify('Ton TP est prêt', 'Ouvre Memoa pour le télécharger en PDF.')
  } catch (e) {
    if (isStop(e)) {
      const mode = stopMode.get(id) ?? 'pause'
      stopMode.delete(id)
      if (mode === 'cancel') {
        // Annulation : on efface les parties rédigées, mais on garde le plan et la session déjà payée.
        saveProgress({ courseId: id, title: a.title, brief: a.brief, plan: a.plan, session: a.session, texts: {}, at: Date.now() })
        set(id, { running: false, step: '', texts: {}, result: null, error: null, interrupted: false, paused: false })
      } else {
        set(id, { running: false, step: '', interrupted: false, paused: true })
      }
      return
    }
    const hidden = document.visibilityState === 'hidden'
    set(id, { running: false, step: '', error: friendlyError(e), interrupted: hidden })
    if (hidden) void notify('Ton TP est en pause', 'Reviens dans Memoa : la rédaction reprend où elle s’est arrêtée.')
  } finally {
    ctrls.delete(id)
    void keepAwake(false)
  }
}

/** Pause (garde le travail fait) ou annulation (efface les parties rédigées) de la rédaction en cours. */
export function stopTpJob(courseId: string, mode: 'pause' | 'cancel') {
  if (!jobs.get(courseId)?.running) return
  stopMode.set(courseId, mode)
  ctrls.get(courseId)?.abort()
}

/** Au retour dans l'appli : une rédaction interrompue par la mise en arrière-plan repart toute seule. */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    jobs.forEach((j, id) => { if (j.interrupted && !j.running && navigator.onLine) void run(id) })
  })
}

/** Récupère le résultat terminé (une seule fois) et efface le travail enregistré. */
export function takeTpResult(courseId: string): { text: string; texts: Record<number, string> } | null {
  const j = jobs.get(courseId)
  if (!j || j.result === null) return null
  const out = { text: j.result, texts: j.texts }
  jobs.delete(courseId); args.delete(courseId)
  clearProgress(courseId)
  emit()
  return out
}

export function dismissTpError(courseId: string) {
  const j = jobs.get(courseId)
  if (j && !j.running) { jobs.set(courseId, { ...j, error: null }); emit() }
}
