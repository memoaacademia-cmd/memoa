// Mesure d'usage et rapport d'erreurs : tout va dans Supabase (tables app_events et app_errors, migration 0020). Aucun outil externe.
//
// Utilisation :   track('course_created')   ·   track('quiz_started', { source: 'cours' })   ·   trackOncePerDay('app_open')
//
// Règles :
//  • Jamais de contenu de note, de numéro de téléphone ni d'e-mail dans les propriétés : les clés sensibles et les valeurs qui
//    ressemblent à un e-mail ou à un numéro sont retirées automatiquement. Mets des CHOIX (« voix », « pdf »), des COMPTES (3) ou
//    des identifiants techniques, jamais ce que l'étudiant a écrit.
//  • Envoi par lots, limité (anti-spam), gardé sur le téléphone tant que le réseau est coupé (file locale, comme l'outbox des notes).
//  • Un événement n'est enregistré que pour un étudiant connecté : le rapport d'erreurs, lui, marche aussi avant la connexion.
//  • Ne casse jamais l'application : tout est dans des try/catch silencieux.
//
// Convention de nommage : minuscules + tirets bas, « objet_action » au passé.
//   app_open · onboarding_step{step} · trial_started · course_created{source} · note_added{source} · draft_saved{kind} · draft_resumed{kind}
//   quiz_started · assistant_message{web,course} · voice_play{where} · tp_started · tp_done · library_view · library_publish
//   premium_view{state} · payment_started · payment_success · tour_started{id} · tour_done{id} · tour_skipped{id} · export_data · account_deleted
// Les blocs suivants ajoutent les leurs avec la même convention (voir PASSATION).
import { isConfigured, supabase } from './supabase'

export type TrackProps = Record<string, string | number | boolean | null | undefined>

type QEvent = { k: 'v'; u: string; name: string; props: Record<string, string | number | boolean | null>; t: number }
type QError = { k: 'e'; u: string | null; message: string; stack: string | null; route: string | null; ua: string | null; t: number }
type QItem = QEvent | QError

const KEY = 'memoa-track-queue'
const MAX_QUEUE = 200
const BATCH = 25
const FLUSH_DELAY = 4000
const MAX_EVENTS_PER_MIN = 60
const MAX_ERRORS_PER_MIN = 5
const MAX_ERRORS_PER_SESSION = 30
const MAX_AGE_MS = 3 * 864e5

let userId: string | null = null
let timer: number | undefined
let flushing = false
const recent: number[] = []
const recentErrors: number[] = []
let errorsThisSession = 0
const seenErrors = new Set<string>()

/** À appeler quand l'étudiant se connecte / se déconnecte (AuthProvider). */
export function setTrackUser(id: string | null) {
  userId = id
  if (id) { markInstalledIfNeeded(); schedule(1500) }
}

/** L'appli est-elle ouverte comme une application (ajoutée à l'écran d'accueil ou installée), et non dans un onglet du navigateur ? */
export function isStandalone(): boolean {
  try {
    const mm = (q: string) => !!window.matchMedia?.(q).matches
    return mm('(display-mode: standalone)') || mm('(display-mode: fullscreen)') || mm('(display-mode: minimal-ui)') || (navigator as unknown as { standalone?: boolean }).standalone === true
  } catch { return false }
}

/** Compteur « Installés » du tableau de bord : « app_installed » est enregistré UNE fois par étudiant et par téléphone, dès que
 *  (1) le navigateur annonce l'installation (événement appinstalled, Android et ordinateur), ou
 *  (2) l'appli s'ouvre depuis l'icône de l'écran d'accueil (seul signal disponible sur iPhone, et sur Android si « Ajouter à l'écran d'accueil »).
 *  Si l'annonce arrive avant la connexion, elle est gardée et comptée à la connexion suivante. */
const INSTALL_PENDING = 'memoa-install-pending'
function markInstalledIfNeeded() {
  try {
    const pending = localStorage.getItem(INSTALL_PENDING) === '1'
    if (!pending && !isStandalone()) return
    trackOnce('app_installed', { via: pending ? 'event' : 'standalone' })
    localStorage.removeItem(INSTALL_PENDING)
  } catch { /* ignoré */ }
}

function readQ(): QItem[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}
function writeQ(q: QItem[]) {
  try { localStorage.setItem(KEY, JSON.stringify(q.slice(-MAX_QUEUE))) } catch { /* stockage plein : on perd seulement des statistiques */ }
}
function push(i: QItem) { const q = readQ(); q.push(i); writeQ(q) }

const BAD_KEY = /mail|phone|tel|content|text|body|password|token|title|note|message|prompt|question|answer/i
const LOOKS_PRIVATE = /@|\d{8,}/
function clean(props?: TrackProps): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {}
  if (!props) return out
  let n = 0
  for (const [k, v] of Object.entries(props)) {
    if (n >= 8) break
    if (!/^[a-z][a-z0-9_]{0,29}$/.test(k) || BAD_KEY.test(k) || v === undefined) continue
    if (typeof v === 'string') { if (LOOKS_PRIVATE.test(v)) continue; out[k] = v.slice(0, 60) }
    else if (typeof v === 'number') { if (Number.isFinite(v)) out[k] = Math.round(v * 100) / 100 }
    else out[k] = v
    n++
  }
  return out
}

/** Enregistre un événement d'usage. Sans effet hors connexion à un compte, ou au-delà de la limite anti-spam. */
export function track(name: string, props?: TrackProps) {
  try {
    if (!isConfigured || !userId || !/^[a-z][a-z0-9_]{1,59}$/.test(name)) return
    const now = Date.now()
    while (recent.length && now - recent[0] > 60_000) recent.shift()
    if (recent.length >= MAX_EVENTS_PER_MIN) return
    recent.push(now)
    push({ k: 'v', u: userId, name, props: clean(props), t: now })
    schedule(FLUSH_DELAY)
  } catch { /* la mesure ne doit jamais gêner l'appli */ }
}

/** Jour de Kinshasa (UTC+1), comme la série de jours. */
const kinDay = () => new Date(Date.now() + 3_600_000).toISOString().slice(0, 10)
/** Comme track, mais une seule fois par jour et par étudiant (ex. « app_open »). */
export function trackOncePerDay(name: string, props?: TrackProps) {
  try {
    if (!userId) return
    const k = `memoa-track-day:${userId}:${name}`
    const d = kinDay()
    if (localStorage.getItem(k) === d) return
    localStorage.setItem(k, d)
    track(name, props)
  } catch { /* ignoré */ }
}
/** Comme track, mais une seule fois pour toujours sur ce téléphone (ex. « trial_started »). */
export function trackOnce(name: string, props?: TrackProps) {
  try {
    if (!userId) return
    const k = `memoa-track-once:${userId}:${name}`
    if (localStorage.getItem(k)) return
    localStorage.setItem(k, '1')
    track(name, props)
  } catch { /* ignoré */ }
}

/** Enregistre une erreur (téléphone de l'étudiant). Limitée et dédoublonnée. */
export function reportError(err: unknown, extra?: string) {
  try {
    if (!isConfigured) return
    const e = err as { message?: unknown; stack?: unknown } | string | null
    const rawMsg = typeof e === 'string' ? e : String(e?.message ?? 'Erreur inconnue')
    const message = (extra ? `${extra} · ${rawMsg}` : rawMsg).slice(0, 580)
    if (!message.trim()) return
    // Bruits sans intérêt : coupure réseau, onglet qui se ferme, extensions du navigateur.
    if (/ResizeObserver loop|Script error\.?$|network timeout|aborted|AbortError|Load failed$|Failed to fetch$/i.test(message) && !extra) return
    const stack = typeof e === 'object' && e && typeof e.stack === 'string' ? e.stack.slice(0, 3900) : null
    const sig = message.slice(0, 120) + '|' + (stack ?? '').split('\n')[1]
    if (seenErrors.has(sig)) return
    const now = Date.now()
    while (recentErrors.length && now - recentErrors[0] > 60_000) recentErrors.shift()
    if (recentErrors.length >= MAX_ERRORS_PER_MIN || errorsThisSession >= MAX_ERRORS_PER_SESSION) return
    recentErrors.push(now); errorsThisSession++; seenErrors.add(sig)
    push({
      k: 'e', u: userId, message, stack,
      route: (typeof location !== 'undefined' ? location.hash || location.pathname : '').slice(0, 190) || null,
      ua: (typeof navigator !== 'undefined' ? navigator.userAgent : '').slice(0, 290) || null, t: now
    })
    schedule(FLUSH_DELAY)
  } catch { /* ignoré */ }
}

function schedule(ms: number) {
  if (typeof window === 'undefined') return
  window.clearTimeout(timer)
  timer = window.setTimeout(() => { void flush() }, ms)
}

/** Envoie la file par lots. Les lignes d'un autre compte ou trop anciennes sont jetées ; en cas de coupure réseau, tout est gardé. */
export async function flush(): Promise<void> {
  if (flushing || !isConfigured || !supabase) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  flushing = true
  try {
    const { data } = await supabase.auth.getSession()
    const session = data.session?.user.id ?? null
    const now = Date.now()
    let q = readQ().filter((i) => now - i.t < MAX_AGE_MS)
    // Événements : seulement ceux du compte connecté. Erreurs : toutes (avec leur user_id seulement s'il s'agit du compte connecté).
    q = q.filter((i) => i.k === 'e' || i.u === session || session === null)
    let guard = 0
    while (guard++ < 8) {
      const events = q.filter((i): i is QEvent => i.k === 'v' && i.u === session).slice(0, BATCH)
      const errors = q.filter((i): i is QError => i.k === 'e').slice(0, 10)
      if (!events.length && !errors.length) break
      let ok = true
      if (events.length && session) {
        const { error } = await supabase.from('app_events').insert(events.map((e) => ({ user_id: e.u, name: e.name, props: e.props, created_at: new Date(e.t).toISOString() })))
        if (error && isNet(error)) ok = false
        else q = q.filter((i) => !events.includes(i as QEvent)) // envoyé, ou refusé pour de bon (on ne boucle pas)
      }
      if (ok && errors.length) {
        const { error } = await supabase.from('app_errors').insert(errors.map((e) => ({ user_id: e.u && e.u === session ? e.u : null, message: e.message, stack: e.stack, route: e.route, user_agent: e.ua, created_at: new Date(e.t).toISOString() })))
        if (error && isNet(error)) ok = false
        else q = q.filter((i) => !errors.includes(i as QError))
      }
      writeQ(q)
      if (!ok) break
    }
    writeQ(q)
  } catch { /* on réessaiera plus tard */ } finally {
    flushing = false
  }
}
const isNet = (e: { message?: string }) => (typeof navigator !== 'undefined' && !navigator.onLine) || /failed to fetch|networkerror|load failed|network request|timeout|fetch/i.test(e.message ?? '')

/** Erreurs non rattrapées + envoi de la file au retour du réseau et quand l'appli passe en arrière-plan. À appeler une fois (main.tsx). */
export function installTracking() {
  if (typeof window === 'undefined') return
  window.addEventListener('error', (ev) => {
    // Erreur de chargement d'image/script (pas de message utile) : ignorée.
    if (!ev.message && !ev.error) return
    reportError(ev.error ?? ev.message, 'window.onerror')
  })
  window.addEventListener('unhandledrejection', (ev) => reportError(ev.reason ?? 'promesse rejetée', 'unhandledrejection'))
  window.addEventListener('appinstalled', () => {
    try { localStorage.setItem(INSTALL_PENDING, '1') } catch { /* ignoré */ }
    markInstalledIfNeeded()
  })
  window.addEventListener('online', () => schedule(1000))
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void flush() })
  schedule(3000)
}
