import { useEffect, useState, type ReactNode } from 'react'
import { Icon, Logo } from '../components/ui'
import { useAuth } from '../lib/auth'
import { PARTNER_PROGRAM_ENABLED } from '../lib/partner'
import { copyText, getInstallEvent, landingSkipped, refFromUrl, setStoredRef, skipLanding, takeInstallEvent } from '../lib/referral'

/* Écran d'accueil d'un lien partenaire (…/?ref=CODE) : pousse à INSTALLER Memoa avant de créer le compte,
   car les étudiants installent l'application d'abord. Le code est gardé, copié au clic sur « Installer », puis proposé à l'inscription. */

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

const isStandaloneNow = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true)

function ReferralLanding({ code, onSkip }: { code: string; onSkip: () => void }) {
  const [ev, setEv] = useState(() => getInstallEvent())
  const [done, setDone] = useState(false)
  const [note, setNote] = useState('')
  const [guide, setGuide] = useState(false)
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const macTouch = typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  const isIos = /iPhone|iPad|iPod/i.test(ua) || macTouch
  const inApp = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|TikTok|Snapchat|musical_ly/i.test(ua)
  const iosSafari = isIos && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(ua) && !inApp

  useEffect(() => {
    const onPrompt = () => setEv(getInstallEvent())
    const onInstalled = () => setDone(true)
    window.addEventListener('memoa-installprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('memoa-installprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function installNow() {
    setNote('')
    // Le code voyage : copié dans le presse-papiers ET gardé sur ce téléphone, avant toute installation.
    const copied = await copyText(code)
    setStoredRef(code, 'link')
    const hint = copied ? ' Ton code est copié : à l’inscription, touche « Coller mon code ».' : ''
    if (ev) {
      try {
        await ev.prompt()
        const c = await ev.userChoice
        if (c && c.outcome === 'dismissed') setNote('Installation annulée. Touche de nouveau « Installer Memoa » quand tu veux.' + hint)
        else setNote('Memoa s’installe. Ouvre-la depuis ton écran d’accueil pour créer ton compte.' + hint)
      } catch { /* annulé */ }
      takeInstallEvent()
      setEv(null)
      return
    }
    if (inApp) { setNote('Ce navigateur intégré ne permet pas d’installer. Ouvre ce lien dans ' + (isIos ? 'Safari' : 'Chrome') + ' (menu ⋯, puis « Ouvrir dans le navigateur »).' + hint); return }
    if (isIos && !iosSafari) { setNote('Ouvre ce lien dans Safari (menu ⋯ ou icône boussole, puis « Ouvrir dans Safari »), puis touche de nouveau « Installer Memoa ».' + hint); return }
    if (isIos) { setGuide(true); setNote(hint.trim()); return }
    setNote('Ton navigateur ne propose pas l’installation directe. Ouvre ce lien dans Chrome, menu ⋯, puis « Installer l’application ».' + hint)
  }

  return (
    <div className="shell">
      <main className="page" style={{ gap: 16 }}>
        <div className="memo-hero" style={{ height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden="true">
          <span className="blob b1" /><span className="blob b2" />
          <span style={{ width: 96, height: 96, borderRadius: 26, background: '#0b5d54', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 22px rgba(14,26,43,.28)', position: 'relative' }} className="notif-mock-app"><Logo size={60} /></span>
        </div>
        <h1 className="h1 big" style={{ margin: 0 }}>Installe Memoa</h1>
        <p className="lead" style={{ margin: 0 }}>Ton compagnon pour réviser plus intelligemment. Elle s’ouvre comme une vraie application, même quand la connexion est lente.</p>

        {isStandaloneNow() || done ? (
          <div className="notice" role="status">Memoa est installée. Ouvre-la depuis ton écran d’accueil, puis crée ton compte : ton code t’attend.</div>
        ) : (
          <>
            <button type="button" className="pill-btn lg" onClick={() => void installNow()}><Icon name="download" size={22} />Installer Memoa</button>
            {note && <div className="notice" role="status">{note}</div>}
          </>
        )}

        <div className="card" style={{ alignItems: 'center', textAlign: 'center', gap: 4 }}>
          <span className="muted">Ton code partenaire :</span>
          <strong className="partner-code" aria-label={'Code partenaire ' + code}>{code}</strong>
        </div>

        {isIos && !isStandaloneNow() && !done && (
          <section className="card" aria-label="Installer sur iPhone">
            <strong className="h2">Sur iPhone : 3 gestes dans Safari</strong>
            <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Step n={1}>Touche <b>Partager</b> <ShareIcon /> (en bas de Safari, ou dans les trois points).</Step>
              <Step n={2}>Fais défiler, touche <b>Sur l’écran d’accueil</b> <PlusIcon />.</Step>
              <Step n={3}>Touche <b>Ajouter</b>, puis ouvre Memoa depuis ton écran d’accueil.</Step>
            </ol>
          </section>
        )}

        <button type="button" className="link" style={{ alignSelf: 'center', padding: 12, textDecoration: 'none', color: 'var(--text-2)' }} onClick={onSkip}>Continuer sans installer</button>
      </main>

      {guide && (
        <div role="dialog" aria-modal="true" aria-label="Ajouter Memoa à l’écran d’accueil" onClick={() => setGuide(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(14,26,43,.72)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 20 }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <strong className="h2">Ajouter Memoa à l’écran d’accueil</strong>
            <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Step n={1}>Touche <b>Partager</b> <ShareIcon /> dans la barre de <b>Safari</b> (ou les trois points, puis Partager).</Step>
              <Step n={2}>Glisse vers le haut, puis touche <b>Sur l’écran d’accueil</b> <PlusIcon />.</Step>
              <Step n={3}>Touche <b>Ajouter</b> en haut à droite.</Step>
            </ol>
            <button type="button" className="pill-btn" onClick={() => setGuide(false)}>J’ai compris</button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Entoure l'application : montre l'écran d'accueil partenaire seulement quand le lien contient un code, que Memoa n'est pas installée,
 *  que personne n'est connecté et que l'étudiant n'a pas choisi « Continuer sans installer ». Sinon, ne change rien. */
export function ReferralGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const [code] = useState(refFromUrl)
  const [skipped, setSkipped] = useState(landingSkipped)
  if (!PARTNER_PROGRAM_ENABLED || !code || skipped || loading || user || isStandaloneNow()) return <>{children}</>
  return (
    <ReferralLanding
      code={code}
      onSkip={() => {
        skipLanding()
        try { window.location.hash = '#/creer-un-compte' } catch { /* sans importance */ }
        setSkipped(true)
      }}
    />
  )
}
