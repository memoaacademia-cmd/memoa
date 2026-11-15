import { FREE_POINTS_PER_DAY } from '../lib/plan'

/** Le nombre de points gratuits par jour, en doré (même teinte que l'éclair des crédits). Le chiffre seulement, pas la phrase. */
export default function FreePts() {
  return <span className="pts-gold">{FREE_POINTS_PER_DAY}</span>
}
