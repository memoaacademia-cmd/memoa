import { useEffect, useState, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ANIMALS } from '../data/animals'

/** Les trois livres. La couleur des deux livres droits suit le thème (Menthe en sombre, Kivu en clair). */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Logo Memoa" style={{ flex: 'none' }}>
      <rect x="10" y="22" width="11" height="30" rx="3.5" style={{ fill: 'var(--book)' }} />
      <rect x="25" y="12" width="11" height="40" rx="3.5" style={{ fill: 'var(--book)' }} />
      <rect x="40" y="22" width="11" height="30" rx="3.5" fill="#F2A33A" transform="rotate(14 45.5 52)" />
    </svg>
  )
}

/** Logo complet : les trois livres + le nom « memoa » à côté. */
export function Brand({ size = 56, center = false }: { size?: number; center?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: center ? 'center' : 'flex-start', gap: Math.round(size * 0.22) }} aria-label="Memoa">
      <Logo size={size} />
      <span style={{ fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: Math.round(size * 0.7), letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--text)' }}>memoa</span>
    </div>
  )
}

export function MemoAvatar({ animal, size = 64 }: { animal: string | null; size?: number }) {
  const a = ANIMALS.find((x) => x.id === animal) ?? ANIMALS[0]
  // Pas d'illustration : l'emoji est posé dans un rond doux, pour que tous les Memo aient la même taille.
  if (!a.svg) {
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size, flex: 'none', borderRadius: '50%', background: 'var(--surface-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.56), lineHeight: 1 }}
      >
        {a.emoji}
      </span>
    )
  }
  // Les illustrations sont des constantes statiques du dépôt (jamais du contenu utilisateur).
  return <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" dangerouslySetInnerHTML={{ __html: a.svg }} />
}

const ICONS: Record<string, string> = {
  home: 'M4 11 L12 4 L20 11 V20 H14 V14 H10 V20 H4 Z',
  plus: 'M12 5 V19 M5 12 H19',
  book: 'M4 5 H10 A2 2 0 0 1 12 7 V20 A2 2 0 0 0 10 18 H4 Z M20 5 H14 A2 2 0 0 0 12 7 V20 A2 2 0 0 1 14 18 H20 Z',
  shelf: 'M4 4 H8 V20 H4 Z M10 4 H14 V20 H10 Z M16 5.5 L20 4.5 L22.5 19 L18.5 20 Z',
  chat: 'M4 5 H20 V16 H11 L6 20 V16 H4 Z',
  user: 'M12 4 A4 4 0 1 0 12 12 A4 4 0 1 0 12 4 M4 20 C4 16 8 14 12 14 C16 14 20 16 20 20',
  back: 'M15 5 L8 12 L15 19',
  send: 'M5 12 L19 5 L15 19 L12 13 Z',
  star: 'M12 3 L14.6 9 L21 9.6 L16.2 13.9 L17.6 20.3 L12 17 L6.4 20.3 L7.8 13.9 L3 9.6 L9.4 9 Z',
  download: 'M12 4 V16 M7 11 L12 16 L17 11 M5 20 H19',
  upload: 'M12 16 V4 M7 9 L12 4 L17 9 M5 20 H19',
  check: 'M5 12.5 L10 17.5 L19 7',
  clock: 'M4 12 A8 8 0 1 0 6.3 6.3 M4 4 V8 H8 M12 8 V12 L15 14',
  gear: 'M12 9 A3 3 0 1 0 12 15 A3 3 0 1 0 12 9 M12 3 V5.5 M12 18.5 V21 M3 12 H5.5 M18.5 12 H21',
  crown: 'M4 18 L3 7 L8 11 L12 5 L16 11 L21 7 L20 18 Z',
  mic: 'M9 3 H15 V14 A3 3 0 0 1 9 14 Z M5.5 11 A6.5 6.5 0 0 0 18.5 11 M12 17.5 V21',
  audio: 'M4 10 V14 M8 7 V17 M12 4 V20 M16 8 V16 M20 11 V13',
  video: 'M3 6 H15 V18 H3 Z M15 10 L21 7 V17 L15 14',
  pdf: 'M6 3 H14 L19 8 V21 H6 Z M14 3 V8 H19',
  photo: 'M3 7 H7 L9 4 H15 L17 7 H21 V19 H3 Z M12 16 A3.5 3.5 0 1 0 12 9 A3.5 3.5 0 0 0 12 16 Z',
  text: 'M5 5 H19 M5 10 H19 M5 15 H14 M5 20 H11',
  headphones: 'M4 15 V12 A8 8 0 0 1 20 12 V15 M4 14 H7 V19 H4 Z M17 14 H20 V19 H17 Z',
  search: 'M11 4 A7 7 0 1 0 11 18 A7 7 0 1 0 11 4 M16.5 16.5 L21 21',
  flame: 'M12 3 C12 3 7 8 7 13 A5 5 0 0 0 17 13 C17 10.5 15.5 9 15 8 C14.5 10 13.5 10.5 12.5 10 C13 8 12 5 12 3 Z',
  play: 'M8 5 L19 12 L8 19 Z',
  chevdown: 'M6 9 L12 15 L18 9',
  chevup: 'M6 15 L12 9 L18 15',
  chevright: 'M9 5 L16 12 L9 19',
  speaker: 'M4 9 H8 L13 5 V19 L8 15 H4 Z M16 9 A4 4 0 0 1 16 15 M18.5 6.5 A8 8 0 0 1 18.5 17.5',
  stop: 'M7 7 H17 V17 H7 Z',
  close: 'M6 6 L18 18 M18 6 L6 18',
  sparkle: 'M12 3 L13.8 9.2 L20 11 L13.8 12.8 L12 19 L10.2 12.8 L4 11 L10.2 9.2 Z M19 3 V7 M17 5 H21',
  pause: 'M8 5 V19 M16 5 V19',
  quiz: 'M5 4 H19 V20 H5 Z M9 9 H15 M9 13 H13',
  trash: 'M5 7 H19 M9 7 V4 H15 V7 M7 7 L8 20 H16 L17 7'
}

export function Icon({ name, size = 22, color = 'currentColor', stroke = 1.9 }: { name: string; size?: number; color?: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: 'none' }}>
      <path d={ICONS[name] ?? ''} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function BackLink({ to, title }: { to: string; title: string }) {
  return (
    <div className="topbar">
      <Link to={to} className="icon-btn" aria-label="Retour">
        <Icon name="back" stroke={2.2} />
      </Link>
      <h1 className="h1">{title}</h1>
    </div>
  )
}

export function NavBar() {
  const loc = useLocation()
  const items = [
    { to: '/', label: 'Accueil', icon: 'home', end: true },
    { to: '/sac', label: 'Cours', icon: 'book', also: '/cours' },
    { to: '/librairie', label: 'Librairie', icon: 'shelf' },
    { to: '/assistant', label: 'Assistant', icon: 'chat' },
    { to: '/moi', label: 'Moi', icon: 'user' }
  ]
  return (
    <nav className="nav" aria-label="Navigation principale">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => 'nav-item' + (isActive || (i.also && loc.pathname.startsWith(i.also)) ? ' active' : '')}>
          <span className="nav-pill"><Icon name={i.icon} size={24} /></span>
          {i.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="error" role="alert">
      {message}
      {/Premium/.test(message) && <div style={{ marginTop: 10 }}><Link to="/premium" className="btn small">Passer en Premium</Link></div>}
    </div>
  )
}

export function Spinner({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="muted" role="status" style={{ padding: 24, textAlign: 'center' }}>
      {label}
    </div>
  )
}

export function Empty({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="card" style={{ textAlign: 'center', alignItems: 'center' }}>
      <strong className="h2">{title}</strong>
      <span className="muted">{text}</span>
      {children}
    </div>
  )
}

/** Petit hook : exécute une action async avec état « en cours » et message d'erreur. */
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run<T>(fn: () => Promise<T>, onError?: (e: unknown) => string): Promise<T | undefined> {
    setBusy(true)
    setError(null)
    try {
      return await fn()
    } catch (e) {
      const { friendlyError } = await import('../lib/api')
      setError(onError ? onError(e) : friendlyError(e))
      return undefined
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, setError, run }
}

/** Charge des données au montage et lorsque `deps` change. */
/** Message clair quand le réseau est coupé ou instable (au lieu de « Failed to fetch »). */
function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'Pas de connexion : ça se mettra à jour dès que le réseau revient.'
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) return 'Connexion instable : réessaie dans un instant.'
  return msg
}

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    setLoading(true)
    fn()
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => alive && setError(friendlyError(e)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  // Quand la connexion revient, tout se recharge tout seul.
  useEffect(() => {
    const on = () => setTick((t) => t + 1)
    window.addEventListener('online', on)
    return () => window.removeEventListener('online', on)
  }, [])
  return { data, error, loading, reload: () => setTick((t) => t + 1) }
}

/** Barre de progression du parcours d'inscription (4 étapes). */
export function Steps({ n, total = 4 }: { n: number; total?: number }) {
  return (
    <div className="steps" role="img" aria-label={`Étape ${n} sur ${total}`}>
      {Array.from({ length: total }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}
    </div>
  )
}

/** Bandeau illustré : Memo qui parle (bulle), avec les trois livres. */
export function MemoHero({ bubble, height = 150, tags }: { bubble?: string; height?: number; tags?: { text: string; style: CSSProperties }[] }) {
  return (
    <div className="memo-hero" style={{ height }} aria-hidden="true">
      <span className="blob b1" /><span className="blob b2" /><span className="blob b3" />
      {tags?.map((t) => <span key={t.text} className="tag" style={t.style}>{t.text}</span>)}
      {bubble && <div className="bubble-w">{bubble}<i /></div>}
      <span className="mh-av"><MemoAvatar animal={null} size={Math.round(height * 0.38)} /></span>
      <span className="mh-books"><Logo size={Math.round(height * 0.5)} /></span>
    </div>
  )
}

/* ====================== Refonte : composants communs ====================== */

/** Bouton pilule. « solid » = l'action principale (une seule par écran), « outline » = action secondaire. */
export function PillButton({ children, to, onClick, type = 'button', variant = 'solid', size = 'md', disabled, className = '' }: {
  children: ReactNode
  to?: string
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'solid' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  className?: string
}) {
  const cls = ['pill-btn', variant === 'outline' ? 'outline' : '', size === 'lg' ? 'lg' : '', size === 'sm' ? 'sm' : '', className].filter(Boolean).join(' ')
  if (to) return <Link to={to} className={cls}>{children}</Link>
  return <button type={type} className={cls} onClick={onClick} disabled={disabled}>{children}</button>
}

/** Champ pilule : le texte d'aide est le placeholder (pas de libellé au-dessus). */
export function PillInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={'pill-input' + (props.className ? ' ' + props.className : '')} />
}

/** En-tête d'écran : bouton retour rond + titre facultatif. */
export function PageHead({ to, title, size = 22 }: { to: string; title?: string; size?: number }) {
  return (
    <div className="topbar">
      <Link to={to} className="icon-btn round" aria-label="Retour"><Icon name="back" stroke={2.2} /></Link>
      {title && <h1 className="h1" style={{ fontSize: size, lineHeight: 1.2 }}>{title}</h1>}
    </div>
  )
}

/** Groupe de lignes (liste « iOS ») : une surface arrondie, des filets, jamais de cartes imbriquées. */
export function RowGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <section>
      {label && <div className="rg-label">{label}</div>}
      <div className="rg">{children}</div>
    </section>
  )
}

/** Une ligne : icône dans un carré arrondi, titre, sous-titre, valeur à droite, chevron. */
export function Row({ icon, title, sub, right, to, onClick, disabled, chevron = true, expanded }: {
  icon?: string
  title: string
  sub?: string
  right?: ReactNode
  to?: string
  onClick?: () => void
  disabled?: boolean
  chevron?: boolean
  expanded?: boolean
}) {
  const inner = (
    <>
      {icon && <span className="rg-ico"><Icon name={icon} size={22} /></span>}
      <span className="rg-body">
        <span className="rg-title">{title}</span>
        {sub && <span className="rg-sub">{sub}</span>}
      </span>
      {right != null && <span className="rg-right">{right}</span>}
      {chevron && <Icon name="chevright" size={18} color="var(--text-3)" />}
    </>
  )
  if (to) return <Link to={to} className="rg-row">{inner}</Link>
  return <button type="button" className="rg-row" onClick={onClick} disabled={disabled} aria-expanded={expanded}>{inner}</button>
}

/** Feuille du bas : coins hauts 28 px, poignée 40×4. `dark` = version sombre (enregistrement). */
export function BottomSheet({ open, onClose, title, children, dark = false }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; dark?: boolean }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="sheet-back" onClick={onClose}>
      <div className={'sheet' + (dark ? ' dark' : '')} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <span className="sheet-handle" aria-hidden="true" />
        {title && <h2 className="sheet-title">{title}</h2>}
        {children}
      </div>
    </div>
  )
}
