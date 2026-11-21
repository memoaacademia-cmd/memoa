// Programme partenaire : le « code qui voyage ».
// Le code parrain (ex. JOEL-K7X2) arrive par le lien ?ref=CODE, est gardé sur le téléphone, copié dans le presse-papiers
// au clic sur « Installer », puis proposé à l'inscription. On ne devine JAMAIS le parrain par l'adresse IP.
// Tout est protégé par try/catch : navigation privée, stockage plein ou presse-papiers refusé ne doivent jamais casser l'appli.

export type RefSource = 'link' | 'clipboard' | 'manual'

const KEY = 'memoa-ref'
const SKIP_KEY = 'memoa-ref-skip'
const MAX_AGE = 30 * 86_400_000 // un code oublié depuis plus de 30 jours est ignoré

/** Forme d'un code : 3 à 6 lettres, un tiret, 4 caractères (ex. JOEL-K7X2). Le serveur revérifie toujours. */
const CODE_RE = /^[A-Z]{3,6}-[A-Z0-9]{4}$/

/** Majuscules, espaces et tirets typographiques ramenés à « - ». Renvoie '' si le texte ne ressemble pas à un code. */
export function normalizeCode(raw: unknown): string {
  const s = String(raw ?? '').trim().toUpperCase().replace(/[\s_\u2010-\u2015\u2212]+/g, '-')
  return CODE_RE.test(s) ? s : ''
}

/** Cherche un code dans un texte quelconque (ex. un lien collé en entier). */
export function extractCode(raw: unknown): string {
  const text = String(raw ?? '')
  const fromUrl = text.match(/[?&]ref=([^&#\s]+)/i)
  if (fromUrl) {
    try { const c = normalizeCode(decodeURIComponent(fromUrl[1])); if (c) return c } catch { /* texte mal codé : on continue */ }
  }
  const direct = normalizeCode(text)
  if (direct) return direct
  const m = text.toUpperCase().match(/\b[A-Z]{3,6}-[A-Z0-9]{4}\b/)
  return m ? normalizeCode(m[0]) : ''
}

/** Code présent dans l'adresse de la page (?ref=…), normalisé ; '' sinon. */
export function refFromUrl(): string {
  try {
    return normalizeCode(new URLSearchParams(window.location.search).get('ref'))
  } catch {
    return ''
  }
}

export interface StoredRef { code: string; source: RefSource; at: number }

/** Code gardé sur ce téléphone (localStorage, avec sessionStorage en secours). null si aucun ou trop ancien. */
export function getStoredRef(): StoredRef | null {
  for (const store of ['local', 'session'] as const) {
    try {
      const raw = (store === 'local' ? localStorage : sessionStorage).getItem(KEY)
      if (!raw) continue
      const j = JSON.parse(raw) as Partial<StoredRef>
      const code = normalizeCode(j.code)
      if (!code) continue
      if (typeof j.at === 'number' && Date.now() - j.at > MAX_AGE) continue
      const source: RefSource = j.source === 'clipboard' || j.source === 'manual' ? j.source : 'link'
      return { code, source, at: typeof j.at === 'number' ? j.at : Date.now() }
    } catch { /* stockage indisponible : on essaie l'autre */ }
  }
  return null
}

/** Garde le code dans localStorage ET sessionStorage. Renvoie false si le texte n'est pas un code valide. */
export function setStoredRef(code: string, source: RefSource): boolean {
  const c = normalizeCode(code)
  if (!c) return false
  const value = JSON.stringify({ code: c, source, at: Date.now() } satisfies StoredRef)
  try { localStorage.setItem(KEY, value) } catch { /* navigation privée */ }
  try { sessionStorage.setItem(KEY, value) } catch { /* navigation privée */ }
  return true
}

/** Efface le code gardé (après usage). */
export function clearStoredRef() {
  try { localStorage.removeItem(KEY) } catch { /* rien à faire */ }
  try { sessionStorage.removeItem(KEY) } catch { /* rien à faire */ }
}

/** À appeler une seule fois au démarrage : lit ?ref= dans l'adresse et le garde. Le paramètre reste dans l'adresse (utile si l'app est installée depuis cette page). */
export function captureRefFromUrl(): string {
  const c = refFromUrl()
  if (c) {
    // Un code déjà saisi à la main n'est pas écrasé par un lien identique, mais un nouveau lien remplace l'ancien.
    setStoredRef(c, 'link')
  }
  return c
}

/** « Continuer sans installer » : on n'affiche plus l'écran d'accueil partenaire pendant cette visite. */
export function skipLanding() {
  try { sessionStorage.setItem(SKIP_KEY, '1') } catch { /* sans importance */ }
}
export function landingSkipped(): boolean {
  try { return sessionStorage.getItem(SKIP_KEY) === '1' } catch { return false }
}

/** Lien à partager : adresse réelle du site + ?ref=CODE (marche sur GitHub Pages comme sur un domaine à soi). */
export function partnerLink(code: string): string {
  const base = typeof window === 'undefined' ? '' : window.location.origin + window.location.pathname
  return `${base}?ref=${encodeURIComponent(code)}`
}

/** Copie un texte : API moderne d'abord, puis l'ancienne méthode (document.execCommand) en repli. Renvoie true si c'est copié. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* refusé : repli ci-dessous */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/** Lit le presse-papiers (à appeler sur un geste de l'étudiant). Renvoie un code valide, ou '' si refusé, vide ou sans code. */
export async function readClipboardCode(): Promise<{ code: string; denied: boolean }> {
  try {
    if (!navigator.clipboard?.readText) return { code: '', denied: true }
    const t = await navigator.clipboard.readText()
    return { code: extractCode(t), denied: false }
  } catch {
    return { code: '', denied: true }
  }
}

/** Mini-notification en bas de l'écran (utilise la barre « memoa-notice » déjà présente dans l'appli). */
export function notice(msg: string) {
  try { window.dispatchEvent(new CustomEvent('memoa-notice', { detail: msg })) } catch { /* sans importance */ }
}

// ---------- Installation : événement « beforeinstallprompt » capté tôt (il peut partir avant l'affichage de l'écran) ----------
export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
let installEvent: InstallPromptEvent | null = null
export const getInstallEvent = () => installEvent
export const takeInstallEvent = () => { const e = installEvent; installEvent = null; return e }

/** À appeler au démarrage QUAND l'adresse contient ?ref= : capte l'invitation d'installation d'Android et prépare un manifeste qui garde le code. */
export function prepareInstall(code: string) {
  try {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      installEvent = e as InstallPromptEvent
      window.dispatchEvent(new Event('memoa-installprompt'))
    })
    window.addEventListener('appinstalled', () => { installEvent = null })
  } catch { /* navigateur sans cet événement */ }
  keepRefInManifest(code)
}

/** Remplace le manifeste par une copie dont start_url garde ?ref=CODE : sur certains Android, l'appli installée s'ouvre alors déjà avec le code.
 *  Ce n'est PAS garanti partout (Chrome peut ignorer un manifeste dynamique ; iPhone n'en tient pas toujours compte) : le presse-papiers prend le relais. */
function keepRefInManifest(code: string) {
  try {
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null
    if (!link || !code) return
    const base = new URL('./', window.location.href)
    const abs = (p: string) => new URL(p, base).href
    const manifest = {
      name: 'Memoa',
      short_name: 'Memoa',
      description: 'Étudiez plus intelligemment.',
      lang: 'fr',
      id: base.href,
      start_url: `${base.href}?ref=${encodeURIComponent(code)}`,
      scope: base.href,
      display: 'standalone',
      background_color: '#EEF2F0',
      theme_color: '#EEF2F0',
      icons: [
        { src: abs('icon-192.png'), sizes: '192x192', type: 'image/png' },
        { src: abs('icon-512.png'), sizes: '512x512', type: 'image/png' },
        { src: abs('icon-maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }))
    link.setAttribute('href', url)
  } catch { /* on garde le manifeste d'origine */ }
}
