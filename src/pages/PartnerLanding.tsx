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

const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-label="menu à trois points" style={{ verticalAlign: 'middle' }}>
    <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
  </svg>
)

/** Guide iPhone/iPad : les gestes exacts + la flèche qui montre les trois points de Safari (en bas à droite). */
function IosGuide({ device, code, copied, onCopy, onClose }: { device: 'IPAD' | 'IPHONE'; code: string; copied: boolean; onCopy: () => void; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Ajouter Memoa à l’écran d’accueil" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(14,26,43,.72)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <strong className="h2">Ajouter Memoa à l’écran d’accueil</strong>
        <div className="notice" role="status" style={{ textAlign: 'center' }}>
          Ton code : <b className="partner-code" style={{ fontSize: 20 }}>{code}</b><br />
          {copied ? 'Il est copié. ' : ''}À l’inscription, touche « Coller mon code ».
          <div style={{ marginTop: 8 }}><button type="button" className="pill-btn sm" onClick={onCopy}>{copied ? 'Copier de nouveau' : 'Copier mon code'}</button></div>
        </div>
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {device === 'IPAD' ? (
            <Step n={1}>Touche le bouton <b>Partager</b> <ShareIcon /> de <b>Safari</b>, en haut à droite.</Step>
          ) : (
            <>
              <Step n={1}>Touche les <b>trois points</b> <MenuIcon /> tout en bas à droite de la barre de <b>Safari</b> (la flèche te les montre).</Step>
              <Step n={2}>Dans le menu, touche <b>Partager</b> <ShareIcon />. (Sur un ancien iPhone, il n’y a pas de trois points : touche directement <b>Partager</b>, au milieu en bas.)</Step>
            </>
          )}
          <Step n={device === 'IPAD' ? 2 : 3}>Dans la fenêtre qui s’ouvre, <b>glisse vers le haut</b>, puis touche <b>Sur l’écran d’accueil</b> <PlusIcon />.</Step>
          <Step n={device === 'IPAD' ? 3 : 4}>Si tu ne le vois pas, descends tout en bas de la liste : touche <b>Modifier les actions</b> et ajoute « Sur l’écran d’accueil ».</Step>
          <Step n={device === 'IPAD' ? 4 : 5}>Touche <b>Ajouter</b> en haut à droite, puis ouvre <b>Memoa depuis ton écran d’accueil</b>.</Step>
        </ol>
        <button type="button" className="pill-btn" onClick={onClose}>J’ai compris</button>
      </div>
      {device !== 'IPAD' && (
        <div aria-hidden="true" style={{ position: 'fixed', right: 4, width: 64, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 58px)', color: '#fff', textAlign: 'center', fontWeight: 700 }}>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.15 }}>les 3 points</div>
          <div style={{ fontSize: 54, lineHeight: 1 }}>↓</div>
        </div>
      )}
    </div>
  )
}

const isStandaloneNow = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true)

function ReferralLanding({ code, onSkip }: { code: string; onSkip: () => void }) {
  const [ev, setEv] = useState(() => getInstallEvent())
  const [done, setDone] = useState(false)
  const [note, setNote] = useState('')
  const [guide, setGuide] = useState(false)
  const [copied, setCopied] = useState(false)
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const macTouch = typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  const isIos = /iPhone|iPad|iPod/i.test(ua) || macTouch
  const inApp = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|TikTok|Snapchat|musical_ly/i.test(ua)
  const device: 'IPAD' | 'IPHONE' = /iPad/i.test(ua) || (macTouch && !/iPhone/i.test(ua)) ? 'IPAD' : 'IPHONE'
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

  async function copyCode() {
    const ok = await copyText(code)
    setStoredRef(code, 'link')
    setCopied(ok)
    setNote(ok ? 'Code copié. Une fois Memoa ouverte, à « Créer un compte », touche « Coller mon code ».' : 'Copie impossible : note ton code, tu pourras le taper à l’inscription.')
  }

  async function installNow() {
    setNote('')
    // Le code voyage : copié dans le presse-papiers ET gardé sur ce téléphone, avant toute installation.
    const copiedNow = await copyText(code)
    setCopied(copiedNow)
    setStoredRef(code, 'link')
    const hint = copiedNow ? ' Ton code est copié : à l’inscription, touche « Coller mon code ».' : ''
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

        <div className="card" style={{ alignItems: 'center', textAlign: 'center', gap: 8, border: '2px solid var(--kivu)' }}>
          <span className="muted">Ton code partenaire :</span>
          <strong className="partner-code" aria-label={'Code partenaire ' + code} style={{ fontSize: 34 }}>{code}</strong>
          <button type="button" className="pill-btn sm" onClick={() => void copyCode()}>
            <Icon name={copied ? 'check' : 'copy'} size={18} />{copied ? 'Code copié' : 'Copier mon code'}
          </button>
          <span className="muted" style={{ fontSize: 13 }}>Garde-le : à l’inscription, touche « Coller mon code » et il se remplit tout seul.</span>
        </div>

        {isIos && !isStandaloneNow() && !done && (
          <section className="card" aria-label="Installer sur iPhone">
            <strong className="h2">Sur iPhone : dans Safari</strong>
            <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {device === 'IPAD' ? (
                <Step n={1}>Touche <b>Partager</b> <ShareIcon /> en haut à droite de Safari.</Step>
              ) : (
                <Step n={1}>Touche les <b>trois points</b> <MenuIcon /> tout en bas à droite de Safari, puis <b>Partager</b> <ShareIcon />.</Step>
              )}
              <Step n={2}>Glisse vers le haut, touche <b>Sur l’écran d’accueil</b> <PlusIcon />.</Step>
              <Step n={3}>Touche <b>Ajouter</b>, puis ouvre Memoa depuis ton écran d’accueil.</Step>
            </ol>
            <button type="button" className="pill-btn sm" onClick={() => { void copyCode(); setGuide(true) }}>Me montrer où toucher</button>
          </section>
        )}

        <button type="button" className="link" style={{ alignSelf: 'center', padding: 12, textDecoration: 'none', color: 'var(--text-2)' }} onClick={onSkip}>Continuer sans installer</button>
      </main>

      {guide && <IosGuide device={device} code={code} copied={copied} onCopy={() => void copyCode()} onClose={() => setGuide(false)} />}
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
