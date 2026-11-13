import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon, Logo } from '../components/ui'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start', lineHeight: 1.45 }}>
      <span aria-hidden="true" style={{ flex: 'none', width: 28, height: 28, borderRadius: '50%', background: 'var(--surface-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>{n}</span>
      <span>{children}</span>
    </li>
  )
}

const ShareIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-label="icône Partager" style={{ verticalAlign: 'middle' }}>
    <path d="M12 3v12M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </svg>
)
const PlusIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-label="icône Sur l'écran d'accueil" style={{ verticalAlign: 'middle' }}>
    <rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8M8 12h8" />
  </svg>
)
const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-label="menu à trois points" style={{ verticalAlign: 'middle' }}>
    <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
  </svg>
)

/** Page publique et partageable : …/#/installer */
export default function Install() {
  const [ev, setEv] = useState<InstallPromptEvent | null>(null)
  const [done, setDone] = useState(false)
  const [note, setNote] = useState('')
  const [hl, setHl] = useState(false)
  const [shareNote, setShareNote] = useState('')
  const stepsRef = useRef<HTMLDivElement | null>(null)
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isIos = /iPhone|iPad|iPod/i.test(ua)
  const isAndroid = /Android/i.test(ua)
  const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true)

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEv(e as InstallPromptEvent) }
    const onInstalled = () => setDone(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function install() {
    if (!ev) return
    try { await ev.prompt() } catch { /* annulé */ }
    setEv(null)
  }

  /** Un seul gros bouton pour tout le monde : installe directement quand le navigateur le permet, sinon montre les étapes. */
  async function installNow() {
    setNote('')
    if (ev) return install()
    if (isIos) setNote('Sur iPhone, Apple impose 3 touches : Partager, puis « Sur l’écran d’accueil », puis Ajouter. Suis les étapes ci-dessous.')
    else setNote('Ton navigateur ne propose pas l’installation directe ici. Ouvre cette page dans Chrome, ou suis les étapes ci-dessous.')
    setHl(true)
    stepsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.setTimeout(() => setHl(false), 2500)
  }

  async function shareLink() {
    const url = window.location.origin + window.location.pathname + '#/installer'
    try {
      if (typeof navigator.share === 'function') await navigator.share({ title: 'Memoa', text: 'Installe Memoa sur ton téléphone :', url })
      else { await navigator.clipboard.writeText(url); setShareNote('Lien copié.') }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setShareNote('Copie le lien depuis la barre d’adresse du navigateur.')
    }
  }

  const android = (
    <section className="card" aria-label="Android">
      <strong className="h2">Android (Chrome)</strong>
      {done && <span className="muted">Memoa est installée. Cherche son icône sur ton écran d’accueil.</span>}
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Step n={1}>Ouvre cette page dans <b>Chrome</b>.</Step>
        <Step n={2}>Touche le menu <MenuIcon /> en haut à droite.</Step>
        <Step n={3}>Touche <b>Installer l’application</b> (ou « Ajouter à l’écran d’accueil »).</Step>
      </ol>
    </section>
  )
  const iphone = (
    <section className="card" aria-label="iPhone">
      <strong className="h2">iPhone (Safari)</strong>
      <span className="muted">Apple n’autorise pas le bouton d’installation direct : il faut passer par Safari.</span>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Step n={1}>Ouvre cette page dans <b>Safari</b> (pas dans Chrome).</Step>
        <Step n={2}>Touche <b>Partager</b> <ShareIcon /> en bas de l’écran.</Step>
        <Step n={3}>Fais défiler et touche <b>Sur l’écran d’accueil</b> <PlusIcon />.</Step>
        <Step n={4}>Touche <b>Ajouter</b> en haut à droite.</Step>
      </ol>
    </section>
  )
  const desktop = (
    <section className="card" aria-label="Ordinateur">
      <strong className="h2">Ordinateur (Chrome ou Edge)</strong>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Step n={1}>Ouvre cette page dans Chrome ou Edge.</Step>
        <Step n={2}>Clique sur l’icône d’installation à droite de la barre d’adresse (un écran avec une flèche).</Step>
        <Step n={3}>Clique sur <b>Installer</b>.</Step>
      </ol>
    </section>
  )

  return (
    <main className="page">
      <div className="memo-hero" style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden="true">
        <span className="blob b1" /><span className="blob b2" />
        <span style={{ width: 110, height: 110, borderRadius: 28, background: '#0b5d54', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 22px rgba(14,26,43,.28)', position: 'relative' }} className="notif-mock-app"><Logo size={68} /></span>
      </div>
      <span className="badge" style={{ alignSelf: 'flex-start', letterSpacing: '.04em', padding: '6px 12px' }}>DÉTECTÉ : {isIos ? 'IPHONE · SAFARI' : isAndroid ? 'ANDROID · CHROME' : 'ORDINATEUR'}</span>
      <h1 className="h1 big" style={{ margin: 0 }}>Installe Memoa</h1>
      <p className="lead" style={{ margin: 0 }}>Elle s’ouvre comme une vraie application, même quand la connexion est lente.</p>
      <div style={{ display: 'flex', gap: 10 }}>
        {([['Plein écran', 'home'], ['Plus rapide', 'star'], ['Notifications', 'chat']] as const).map(([t, ic]) => (
          <div key={t} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
            <span style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--link)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={ic} size={22} /></span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)' }}>{t}</span>
          </div>
        ))}
      </div>
      {standalone || done ? (
        <div className="notice" role="status">Memoa est déjà installée sur cet appareil. Cherche son icône sur ton écran d’accueil.</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }} aria-hidden="true">
            <span style={{ flex: 1, height: 2, borderRadius: 2, background: 'var(--line-strong)' }} />
            <span className="label-mono" style={{ letterSpacing: '0.14em' }}>INSTALLER</span>
            <span style={{ flex: 1, height: 2, borderRadius: 2, background: 'var(--line-strong)' }} />
          </div>
          <button type="button" className="pill-btn" style={{ minHeight: 60 }} onClick={() => void installNow()}><Icon name="download" size={22} />
            Installer Memoa
          </button>
          <span className="muted" style={{ textAlign: 'center' }}>
            {ev ? 'Un seul geste : ton téléphone te demande de confirmer.' : isIos ? 'Sur iPhone, Apple demande 3 touches : voici lesquelles.' : 'Touche le bouton : on t’installe l’application ou on te montre comment.'}
          </span>
          {note && <div className="notice" role="status">{note}</div>}
        </>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
        <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        <span className="label-mono">Comment ça marche</span>
        <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
      </div>
      <div ref={stepsRef} style={{ display: 'flex', flexDirection: 'column', gap: 14, borderRadius: 16, outline: hl ? '3px solid var(--btn)' : '3px solid transparent', outlineOffset: 4, transition: 'outline-color .3s' }}>
        {isIos ? <>{iphone}{android}{desktop}</> : isAndroid ? <>{android}{iphone}{desktop}</> : <>{desktop}{android}{iphone}</>}
      </div>
      <button type="button" className="btn ghost" onClick={() => void shareLink()}>Partager ce lien</button>
      {shareNote && <span className="muted" role="status" style={{ textAlign: 'center' }}>{shareNote}</span>}
      <Link to="/" className="link" style={{ textAlign: 'center' }}>Ouvrir Memoa</Link>
    </main>
  )
}
