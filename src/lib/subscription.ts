// Règles d'affichage de l'abonnement Premium : palier d'expiration, jours restants, date en français.
const DAY = 86_400_000

export type ExpiryTier = '7d' | '2d' | '0d'

/** Mêmes textes que les notifications envoyées par le serveur (subscription-expiry-push). */
export const EXPIRY_TEXT: Record<ExpiryTier, string> = {
  '7d': 'Ton abonnement expire dans 1 semaine. Recharge dès maintenant pour continuer avec Memoa Premium : ton cursus académique en a besoin !',
  '2d': 'Ton abonnement expire dans 2 jours. Recharge dès maintenant pour continuer avec Memoa Premium : ton cursus académique en a besoin !',
  '0d': 'Ton abonnement est terminé. Recharge pour retrouver Memoa Premium. Ton cursus académique en a besoin.'
}

/** Palier à montrer maintenant : 7 jours avant, 2 jours avant, ou abonnement terminé (pendant 3 jours). */
export function expiryTier(expiresAt: string, now = Date.now()): ExpiryTier | null {
  const left = new Date(expiresAt).getTime() - now
  if (left <= 0) return left > -3 * DAY ? '0d' : null
  if (left <= 2 * DAY) return '2d'
  if (left <= 7 * DAY) return '7d'
  return null
}

export const isActive = (expiresAt: string, now = Date.now()) => new Date(expiresAt).getTime() > now

/** Jours restants, arrondis vers le haut (il reste 17 h : « 1 jour »). */
export const daysLeft = (expiresAt: string, now = Date.now()) => Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / DAY))

/** « 12 décembre 2026 », à l'heure de Kinshasa. */
export const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Kinshasa' })
