// Notifications « Le savais-tu ? » sur le téléphone (Web Push). Rien ne part sans le choix de l'étudiant :
// on ne demande l'autorisation qu'après qu'il a aimé une première carte, jamais à l'ouverture de l'application.
import { NOTIFICATIONS_ENABLED, VAPID_PUBLIC_KEY } from './features'
import { getPref, setPref } from './prefs'
import { deletePushSubscription, savePushSubscription } from './api'

const ASKED = 'push-asked' // combien de fois on a proposé
const ASKED_AT = 'push-asked-at' // dernière proposition (date en millisecondes)
const WEEK = 7 * 86_400_000

export function pushSupported(): boolean {
  return NOTIFICATIONS_ENABLED && Boolean(VAPID_PUBLIC_KEY) && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** Sur iPhone, les notifications n'existent que si Memoa est installée sur l'écran d'accueil. */
export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}
export function isInstalled(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
}
export function needsInstallFirst(): boolean {
  return isIos() && !isInstalled()
}

export function permissionState(): NotificationPermission | 'unsupported' {
  return pushSupported() || (NOTIFICATIONS_ENABLED && Boolean(VAPID_PUBLIC_KEY) && 'Notification' in window) ? Notification.permission : 'unsupported'
}

/** Est-ce le bon moment pour proposer ? Jamais si déjà accepté ou refusé, au plus deux fois, à une semaine d'écart. */
export function canInvite(): boolean {
  if (!pushSupported() || Notification.permission !== 'default') return false
  if (getPref('notif', '') === '0') return false
  const asked = Number(getPref(ASKED, '0'))
  if (asked >= 2) return false
  const at = Number(getPref(ASKED_AT, '0'))
  return !at || Date.now() - at >= WEEK
}
export function noteInvited() {
  setPref(ASKED, String(Number(getPref(ASKED, '0')) + 1))
  setPref(ASKED_AT, String(Date.now()))
}

function keyBytes(base64Url: string): Uint8Array {
  const pad = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const raw = atob((base64Url + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.getRegistration()
  return reg ?? navigator.serviceWorker.ready
}

/** À appeler depuis un clic de l'étudiant (les navigateurs l'exigent). Renvoie un message clair en cas d'échec. */
export async function enablePush(userId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!pushSupported()) return { ok: false, message: "Les notifications ne sont pas disponibles sur ce navigateur. Essaie avec Chrome, ou installe Memoa sur ton téléphone." }
  if (needsInstallFirst()) return { ok: false, message: "Sur iPhone, installe d'abord Memoa sur l'écran d'accueil (Partager, puis « Sur l'écran d'accueil »), puis réessaie." }
  try {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') {
      setPref('notif', '0')
      return { ok: false, message: "Les notifications sont bloquées. Tu peux les autoriser dans les réglages de ton navigateur quand tu veux." }
    }
    const reg = await registration()
    const existing = await reg.pushManager.getSubscription()
    const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) as BufferSource }))
    const json = sub.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return { ok: false, message: "L'abonnement n'a pas pu être créé. Réessaie dans un instant." }
    await savePushSubscription(userId, { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth })
    setPref('notif', '1')
    return { ok: true }
  } catch {
    return { ok: false, message: "Les notifications n'ont pas pu être activées. Réessaie dans un instant." }
  }
}

export async function disablePush(): Promise<void> {
  setPref('notif', '0')
  try {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      await deletePushSubscription(sub.endpoint)
      await sub.unsubscribe()
    }
  } catch {
    /* si le serveur n'a pas pu être prévenu, le prochain envoi nettoiera l'abonnement tout seul */
  }
}

const SYNCED_AT = 'push-synced-at' // dernier rappel de ce téléphone au serveur (date en millisecondes)
const DAY = 86_400_000

/** À l'ouverture de l'appli : si l'étudiant a accepté les notifications sur CE téléphone (et ne les a pas coupées lui-même),
 *  on s'assure que le téléphone est bien abonné ET connu du serveur. Répare en silence les cas où l'abonnement a été perdu
 *  (navigateur qui le renouvelle ou le nettoie, ligne supprimée côté serveur, clé d'envoi changée). Ne demande jamais rien à l'étudiant.
 *  Renvoie true si le téléphone est abonné à la fin. */
export async function syncPush(userId: string): Promise<boolean> {
  try {
    if (!pushSupported() || Notification.permission !== 'granted') return false
    if (getPref('notif', '') !== '1') return false // seulement si l'étudiant l'a activé ici, et jamais s'il l'a coupé
    const reg = await Promise.race([registration(), new Promise<null>((r) => setTimeout(() => r(null), 8000))])
    if (!reg) return false
    let sub = await reg.pushManager.getSubscription()
    let changed = false
    // Abonnement créé avec une autre clé d'envoi que l'actuelle : le serveur ne pourrait pas lui écrire. On le refait.
    const k = sub?.options?.applicationServerKey
    if (sub && k) {
      const a = new Uint8Array(k)
      const b = keyBytes(VAPID_PUBLIC_KEY)
      if (a.length !== b.length || a.some((v, i) => v !== b[i])) { await sub.unsubscribe().catch(() => {}); sub = null }
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) as BufferSource })
      changed = true
    }
    const json = sub.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false
    // On rappelle le téléphone au serveur au plus une fois par jour (ou tout de suite si l'abonnement vient d'être refait).
    const last = Number(getPref(SYNCED_AT, '0'))
    if (changed || !last || Date.now() - last >= DAY) {
      await savePushSubscription(userId, { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth })
      setPref(SYNCED_AT, String(Date.now()))
    }
    return true
  } catch {
    return false
  }
}

/** Le téléphone est-il réellement abonné ? (la case des paramètres reflète cet état, pas seulement une préférence) */
export async function isSubscribed(): Promise<boolean> {
  try {
    if (!pushSupported() || Notification.permission !== 'granted') return false
    const reg = await navigator.serviceWorker.getRegistration()
    return Boolean(await reg?.pushManager.getSubscription())
  } catch {
    return false
  }
}
