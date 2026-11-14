import type { ReactNode } from 'react'
import { Icon } from './ui'
import { PRICE_LABEL } from '../lib/api'
import { BASE_PRICE_LABEL, FREE_POINTS_PER_DAY, POINT_COSTS, PREMIUM_DAYS, TRIAL_DAYS, type PlanState } from '../lib/plan'

/* Présentation des offres. Tous les chiffres viennent de src/lib/plan.ts (qui reprend les règles du serveur) et de PRICE_LABEL. */

/** Prix de base barré, puis prix promotionnel. */
export function Price({ cur }: { cur: 'USD' | 'CDF' }) {
  return <><del className="price-old"><span className="sr-only">Prix normal : </span>{BASE_PRICE_LABEL[cur]}</del> <span>{PRICE_LABEL[cur]}</span></>
}

const ROWS: { label: string; free: ReactNode; premium: ReactNode }[] = [
  {
    label: 'Usage de l’IA',
    free: `${FREE_POINTS_PER_DAY} points gratuits par jour`,
    premium: 'Utilisation généreuse, sans points à compter'
  },
  {
    label: 'Renouvellement',
    free: `Retour à ${FREE_POINTS_PER_DAY} chaque jour à minuit (heure de Kinshasa). Les points non utilisés ne se cumulent pas.`,
    premium: 'Une limite quotidienne existe seulement contre les abus'
  },
  {
    label: 'PDF des TP et des cours',
    free: 'Pages de garde Classique, Émeraude, Bordeaux et Ardoise, avec la mention « Créé avec Memoa »',
    premium: 'Page de garde dorée en plus, sans la mention « Créé avec Memoa » (aussi pendant l’essai gratuit)'
  },
  {
    label: 'Prix',
    free: 'Gratuit',
    premium: <><Price cur="USD" /> ou <Price cur="CDF" /> pour {PREMIUM_DAYS} jours</>
  }
]

/** Free et Premium côte à côte (empilés sur petit écran). */
export function FreeVsPremium() {
  return (
    <section className="plan-card" aria-labelledby="plan-vs">
      <h2 id="plan-vs" className="plan-h">Free ou Premium ?</h2>
      <div className="plan-vs-head" aria-hidden="true"><span /><b className="free"><Icon name="bolt" size={14} />Free</b><b className="prem"><Icon name="crown" size={14} />Premium</b></div>
      {ROWS.map((r) => (
        <div key={r.label} className="plan-vs-row" role="group" aria-label={r.label}>
          <span className="plan-vs-label">{r.label}</span>
          <div className="plan-vs-cells">
            <p><b className="plan-tag free">Free</b>{r.free}</p>
            <p><b className="plan-tag prem">Premium</b>{r.premium}</p>
          </div>
        </div>
      ))}
      <p className="plan-note">Tes notes, tes cours et la Librairie restent accessibles dans les deux offres : la différence porte sur l’usage de l’IA et sur le style des PDF.</p>
    </section>
  )
}

/** Ce que coûte chaque action de l'IA en offre Free. */
export function PointsGuide() {
  return (
    <section className="plan-card" aria-labelledby="plan-pts">
      <h2 id="plan-pts" className="plan-h"><span className="gold-bolt"><Icon name="bolt" size={18} /></span>Comment marchent les points</h2>
      <p className="plan-lead">En offre Free, tu disposes de {FREE_POINTS_PER_DAY} points par jour. Chaque demande à l’IA en consomme quelques-uns :</p>
      <ul className="plan-list">
        {POINT_COSTS.map((c) => <li key={c.label}><span>{c.label}</span><b>{c.cost}</b></li>)}
      </ul>
      <p className="plan-note">Si ton solde ne suffit pas pour une demande, elle n’est pas lancée à moitié : tu attends minuit ou tu passes à Premium. Ton solde s’affiche avec l’éclair doré sur l’Accueil et dans l’Assistant.</p>
    </section>
  )
}

/** L'essai gratuit : apport, durée, conditions, fin. Le texte s'adapte à l'état du compte. */
export function TrialInfo({ state }: { state: PlanState }) {
  const items: [string, string][] = [
    ['Ce que tu reçois', 'Toute l’IA de Memoa : notes, quiz, TP, audio et résumés, avec une utilisation généreuse et sans compter de points.'],
    ['Durée', `${TRIAL_DAYS} jours, jusqu’à minuit (heure de Kinshasa) le dernier jour. Le jour de ton inscription compte comme le 1er.`],
    ['Conditions', 'Sans carte bancaire et sans paiement. Un seul essai par numéro de téléphone : refaire un compte avec le même numéro ne relance pas l’essai.'],
    ['À la fin', `Rien n’est facturé. Tu gardes ton compte et tout ton contenu, avec ${FREE_POINTS_PER_DAY} points gratuits chaque jour. Tu passes à Premium seulement si tu le décides.`]
  ]
  return (
    <section className="plan-card" aria-labelledby="plan-trial">
      <h2 id="plan-trial" className="plan-h">Essai gratuit de {TRIAL_DAYS} jours</h2>
      {state === 'trial' && <p className="plan-status" role="status"><Icon name="check" size={16} stroke={2.4} />Ton essai est en cours.</p>}
      {(state === 'free' || state === 'expired') && <p className="plan-status off" role="status">Ton essai de {TRIAL_DAYS} jours est terminé : tu es en offre Free.</p>}
      <dl className="plan-dl">
        {items.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
    </section>
  )
}

/** Durée et conditions de l'abonnement Premium. */
export function SubscriptionTerms() {
  const items: ReactNode[] = [
    <>Un paiement = {PREMIUM_DAYS} jours de Premium (<Price cur="USD" /> ou <Price cur="CDF" />), par Orange Money, Airtel Money ou M-Pesa.</>,
    'Aucun renouvellement automatique : tu valides chaque paiement sur ton téléphone.',
    `Si tu paies avant la fin, les ${PREMIUM_DAYS} jours s’ajoutent à la date de fin actuelle.`,
    'Memoa te prévient 7 jours avant, 2 jours avant, puis le jour de la fin.',
    `Quand l’abonnement se termine, tu repasses en offre Free (${FREE_POINTS_PER_DAY} points par jour). Tes cours et tes notes restent là.`
  ]
  return (
    <section className="plan-card" aria-labelledby="plan-terms">
      <h2 id="plan-terms" className="plan-h">Durée et conditions</h2>
      <ul className="plan-checks">
        {items.map((t, i) => <li key={i}><Icon name="check" size={16} stroke={2.4} /><span>{t}</span></li>)}
      </ul>
    </section>
  )
}
