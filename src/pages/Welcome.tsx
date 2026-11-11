import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, Logo, MemoHero, Steps } from '../components/ui'
import { useAuth } from '../lib/auth'
import { enablePush, needsInstallFirst, pushSupported } from '../lib/push'

function Skip({ to }: { to: string }) {
  const nav = useNavigate()
  return <button type="button" className="link" style={{ textDecoration: 'none', color: 'var(--text-2)', padding: 10 }} onClick={() => nav(to, { replace: true })}>Passer</button>
}

/* Étape 1 sur 4 : bienvenue */
export function Welcome() {
  const nav = useNavigate()
  return (
    <main className="step-page">
      <div className="step-top"><span /><Skip to="/inscription" /></div>
      <Steps n={1} />
      <MemoHero height={300} tags={[
        { text: 'Résumés IA', style: { left: 22, top: 34 } },
        { text: 'Quiz', style: { right: 26, top: 70 } },
        { text: 'Écouter', style: { left: 30, bottom: 130 } }
      ]} />
      <h1 className="h1 big" style={{ margin: 0 }}>Tes cours, enfin simples</h1>
      <p className="lead">Écris tes notes. Memo les résume, te pose des quiz et te les lit à voix haute.</p>
      <div style={{ flex: 1 }} />
      <button type="button" className="pill-btn" onClick={() => nav('/inscription', { replace: true })}>Continuer</button>
    </main>
  )
}

/* Étape 3 sur 4 : l'essai de 5 jours */
export function TrialStep() {
  const nav = useNavigate()
  const items = ['IA complète : notes, quiz, TP, audio et résumés', 'Sans carte bancaire', 'Ensuite, 20 points toutes les 5 heures, gratuitement']
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
