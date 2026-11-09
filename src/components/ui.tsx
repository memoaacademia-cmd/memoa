import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
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
  headphones: 'M4 15 V12 A8 8 0 0 1 20 12 V15 M4 14 H7 V19 H4 Z M17 14 H20 V19 H17 Z'
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
  const items = [
    { to: '/', label: 'Accueil', icon: 'home', end: true },
    { to: '/cours', label: 'Cours', icon: 'book' },
    { to: '/librairie', label: 'Librairie', icon: 'shelf' },
    { to: '/assistant', label: 'Assistant', icon: 'chat' },
    { to: '/moi', label: 'Moi', icon: 'user' }
  ]
  return (
    <nav className="nav" aria-label="Navigation principale">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
          <Icon name={i.icon} size={24} />
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
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  return { data, error, loading, reload: () => setTick((t) => t + 1) }
}
