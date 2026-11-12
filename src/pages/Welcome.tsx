import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, Logo, MemoHero, Steps } from '../components/ui'
import { useAuth } from '../lib/auth'
import { enablePush, needsInstallFirst, pushSupported } from '../lib/push'

function Skip({ to }: { to: string }) {
  const nav = useNavigate()
  return <button type="button" className="link" style={{ textDecoration: 'none', color: 'var(--text-2)', padding: 10 }} onClick={() => nav(to, { replace: true })}>Passer</button>
}

/* Cartes de présentation (avant le profil) : chaque carte résume une fonction de Memoa. */
const CARDS: { icon: string; title: string; text: string }[] = [
  { icon: 'text', title: 'Tes cours, enfin simples', text: 'Écris, dicte ou photographie tes notes. Memoa les range dans ton sac à dos, cours par cours.' },
  { icon: 'sparkle', title: 'Résumés et notes enrichies', text: 'L’IA structure tes notes, les complète et en tire un résumé clair à relire avant l’examen.' },
  { icon: 'quiz', title: 'Révise avec des quiz', text: 'Des quiz tirés de tes propres notes, avec la correction. Un quiz suivant, avec de nouvelles questions, quand tu veux.' },
  { icon: 'book', title: 'Assistant TP', text: 'Plan, rédaction et page de garde de ton université, puis un PDF prêt à remettre.' },
  { icon: 'shelf', title: 'Librairie de promotion', text: 'Retrouve les documents partagés par ta promotion et partage les tiens.' },
  { icon: 'chat', title: 'Un assistant qui te connaît', text: 'Pose tes questions à ton Memo : il s’appuie sur tes notes. Tu peux aussi l’écouter te lire un cours.' }
]

/* Étape 1 : défilé de cartes. « Suivant » passe à la carte d'après, « Passer » saute tout. */
export function Welcome() {
  const nav = useNavigate()
  const [i, setI] = useState(0)
  const [x0, setX0] = useState<number | null>(null)
  const last = i === CARDS.length - 1
  const done = () => nav('/inscription', { replace: true })
  const go = (n: number) => setI(Math.max(0, Math.min(CARDS.length - 1, n)))
  return (
    <main className="step-page">
      <div className="step-top"><span /><button type="button" className="link" style={{ textDecoration: 'none', color: 'var(--text-2)', padding: 10 }} onClick={done}>Passer</button></div>
      <div
        className="intro-viewport"
        onTouchStart={(e) => setX0(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (x0 === null) return
          const dx = e.changedTouches[0].clientX - x0
          setX0(null)
          if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1))
        }}
      >
        <div className="intro-track" style={{ transform: `translateX(-${i * 100}%)` }}>
          {CARDS.map((c, k) => (
            <section key={c.title} className="intro-card" aria-hidden={k !== i} aria-roledescription="carte" aria-label={`${k + 1} sur ${CARDS.length}`}>
              <span className="intro-art"><Icon name={c.icon} size={60} stroke={1.6} /></span>
              <h1 className="h1 big" style={{ margin: 0 }}>{c.title}</h1>
              <p className="lead" style={{ margin: 0, maxWidth: 320 }}>{c.text}</p>
            </section>
          ))}
        </div>
      </div>
      <div className="intro-dots" role="img" aria-label={`Carte ${i + 1} sur ${CARDS.length}`}>
        {CARDS.map((c, k) => <i key={c.title} className={k === i ? 'on' : ''} />)}
      </div>
      <button type="button" className="pill-btn" onClick={() => (last ? done() : go(i + 1))}>{last ? 'Commencer' : 'Suivant'}</button>
    </main>
  )
}

/* Étape 3 sur 4 : l'essai de 5 jours */
export function TrialStep() {
  const nav = useNavigate()
  const items = ['IA complète : notes, quiz, TP, audio et résumés', 'Sans carte bancaire', 'Ensuite, 20 points toutes les 7 heures, gratuitement']
  return (
    <main className="step-page">
      <div className="step-top"><span /><Skip to="/notifications-etape" /></div>
      <Steps n={3} />
      <MemoHero height={210} bubble="5 jours d’IA complète, offerts !" />
      <h1 className="h1 big" style={{ margin: 0 }}>Ton essai gratuit</h1>
      {items.map((t) => <div key={t} className="check-row"><span className="ck"><Icon name="check" size={16} stroke={2.4} /></span><span>{t}</span></div>)}
      <div style={{ flex: 1 }} />
      <span className="muted" style={{ textAlign: 'center' }}>L’essai est lié à ton numéro de téléphone.</span>
      <button type="button" className="pill-btn" onClick={() => nav('/notifications-etape', { replace: true })}>Démarrer mon essai</button>
    </main>
  )
}

/* Étape 4 sur 4 : notifications */
export function NotifStep() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const home = () => nav('/', { replace: true })

  async function accept() {
    if (!user) return home()
    setBusy(true)
    const r = await enablePush(user.id)
    setBusy(false)
    if (r.ok) home(); else setMsg(r.message)
  }

  return (
    <main className="step-page">
      <div className="step-top"><span /><Skip to="/" /></div>
      <Steps n={4} />
      <div className="notif-mock" aria-hidden="true">
        <span className="time">17:00</span>
        <div className="toast">
          <span className="app"><Logo size={27} /></span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', color: '#0b5d54' }}>MEMOA</span>
            <strong style={{ fontSize: 14 }}>Le savais-tu ?</strong>
            <span style={{ fontSize: 13, color: '#3f4f49' }}>Un fait à découvrir</span>
          </div>
        </div>
      </div>
      <h1 className="h1 big" style={{ margin: 0 }}>Une surprise chaque jour à 17 h</h1>
      <p className="lead">Un fait à découvrir, une seule notification. Tu peux l’arrêter quand tu veux.</p>
      {needsInstallFirst() && <span className="muted">Sur iPhone, ajoute d’abord Memoa à ton écran d’accueil.</span>}
      {msg && <div className="notice" role="alert">{msg}</div>}
      <div style={{ flex: 1 }} />
      {pushSupported() && <button type="button" className="pill-btn" onClick={() => void accept()} disabled={busy}><Icon name="chat" size={20} />{busy ? 'Un instant…' : 'Activer les notifications'}</button>}
      <button type="button" className="pill-btn ghost" onClick={home}>{pushSupported() ? 'Plus tard' : 'Continuer'}</button>
    </main>
  )
}
