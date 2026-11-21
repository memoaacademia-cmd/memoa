import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './ui'
import type { TrialInfo } from '../lib/api'
import { FREE_POINTS_PER_DAY, TRIAL_DAYS, usePlan } from '../lib/plan'
import { getPref, setPref } from '../lib/prefs'

const DAY = 86_400_000
const daysLeft = (endsAt: string | null) => (endsAt ? Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / DAY)) : null)

/** Bande de l'Accueil sur l'essai de 7 jours (il démarre à la première action IA) :
 *  avant le départ → « commence à ta première action IA » ; au départ → message court ; ensuite → « Essai : N jours restants » ; à la fin → plan Free. */
export default function TrialBanner() {
  const plan = usePlan()
  const [live, setLive] = useState<TrialInfo | null>(null)
  const [endHidden, setEndHidden] = useState(false)
  const [firstNote] = useState(() => getPref('trial-start-note', '') !== '1')

  // Le serveur renvoie l'état de l'essai après chaque demande IA : la bande se met à jour tout de suite.
  useEffect(() => {
    const on = (e: Event) => { const d = (e as CustomEvent<TrialInfo | null>).detail; if (d) setLive(d) }
    window.addEventListener('memoa-trial', on)
    return () => window.removeEventListener('memoa-trial', on)
  }, [])

  const trial = live ?? (plan.state === 'trial' ? plan.trial ?? null : null)
  const left = trial?.started ? daysLeft(trial.endsAt) : null

  // On retient qu'un essai a bien eu lieu : c'est ce qui permet d'afficher le message de fin, une seule fois.
  useEffect(() => {
    if (trial?.started) setPref('trial-seen', '1')
  }, [trial?.started])
  useEffect(() => {
    if (trial?.started && firstNote) setPref('trial-start-note', '1')
  }, [trial?.started, firstNote])

  if (trial) {
    if (!trial.started) {
      return <div className="notice" role="status" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="bolt" size={18} /><span>Ton essai gratuit de {trial.days || TRIAL_DAYS} jours commence à ta première action IA.</span></div>
    }
    if (left === null) return null
    const text = firstNote
      ? `Ton essai de ${trial.days || TRIAL_DAYS} jours vient de commencer : toute l’IA, sans compter de points.`
      : left <= 1 ? 'Essai : dernier jour' : `Essai : ${left} jours restants`
    return <div className="notice" role="status" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="bolt" size={18} /><span>{text}</span></div>
  }

  // Essai terminé : un message clair, une seule fois, pour ceux qui l'ont vécu.
  if ((plan.state === 'free' || plan.state === 'expired') && getPref('trial-seen', '') === '1' && getPref('trial-end-seen', '') !== '1' && !endHidden) {
    return (
      <div className="notice" role="status" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Icon name="bolt" size={18} />
        <span style={{ flex: 1 }}>Ton essai est terminé. Tu es en plan Free : {FREE_POINTS_PER_DAY} points par jour. <Link className="link" to="/premium">Voir Premium</Link></span>
        <button type="button" className="icon-btn" aria-label="Fermer ce message" onClick={() => { setPref('trial-end-seen', '1'); setEndHidden(true) }}><Icon name="close" size={18} /></button>
      </div>
    )
  }
  return null
}
