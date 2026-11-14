import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, Logo, MemoHero, Steps } from '../components/ui'
import { FreeVsPremium } from '../components/PlanInfo'
import { PRICE_LABEL } from '../lib/api'
import { FREE_POINTS_PER_DAY, PREMIUM_DAYS, TRIAL_DAYS } from '../lib/plan'
import { useAuth } from '../lib/auth'
import { enablePush, needsInstallFirst, pushSupported } from '../lib/push'

function Skip({ to }: { to: string }) {
  const nav = useNavigate()
  return <button type="button" className="link" style={{ textDecoration: 'none', color: 'var(--text-2)', padding: 10 }} onClick={() => nav(to, { replace: true })}>Passer</button>
}

/* Étape 3 sur 4 : l'essai de 5 jours. L'essai démarre à l'inscription (règle du serveur) : ce bouton ne lance rien, il continue l'accueil. */
export function TrialStep() {
  const nav = useNavigate()
  const items: [string, string][] = [
    ['Ce que tu reçois', 'Toute l’IA de Memoa : notes, quiz, TP, audio et résumés, sans compter de points.'],
    ['Durée', `${TRIAL_DAYS} jours, jusqu’à minuit (heure de Kinshasa) le dernier jour. Le jour de ton inscription compte comme le 1er.`],
    ['Conditions', 'Sans carte bancaire. Un seul essai par numéro de téléphone. Il commence à ton inscription.'],
    ['Aperçu Premium', 'Pendant l’essai, tu as aussi les pages de garde dorées et aucune mention « Créé avec Memoa » sur tes PDF.'],
    ['À la fin', `Rien n’est facturé : tu restes en Memoa Free (${FREE_POINTS_PER_DAY} points gratuits chaque jour, renouvelés à minuit). Premium reste en option : ${PRICE_LABEL.USD} ou ${PRICE_LABEL.CDF} pour ${PREMIUM_DAYS} jours.`]
  ]
  return (
    <main className="step-page">
      <div className="step-top"><span /><Skip to="/notifications-etape" /></div>
      <Steps n={3} />
      <MemoHero height={150} bubble={`${TRIAL_DAYS} jours d’IA complète, offerts !`} />
      <h1 className="h1 big" style={{ margin: 0 }}>Memoa Free ou Memoa Premium</h1>
      <FreeVsPremium />
      <section className="plan-card" aria-label="Conditions de l’essai gratuit">
        <h2 className="plan-h">Conditions de l’essai gratuit</h2>
        {items.map(([k, t]) => (
          <div key={k} className="check-row" style={{ alignItems: 'flex-start' }}>
            <span className="ck"><Icon name="check" size={16} stroke={2.4} /></span>
            <span><b>{k}.</b> {t}</span>
          </div>
        ))}
      </section>
      <div style={{ position: 'sticky', bottom: 0, display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0 4px', background: 'linear-gradient(to top, var(--bg) 70%, transparent)' }}>
        <button type="button" className="pill-btn" onClick={() => nav('/notifications-etape', { replace: true })}>Commencer l’essai gratuit de {TRIAL_DAYS} jours</button>
      </div>
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
