// Numéro de téléphone de l'étudiant : obligatoire à l'inscription (email ET Google), pour enrichir les données.
import type { AuthUser } from './api'
import type { Profile } from './types'

/** Numéro saisi → format propre (+243…). Renvoie '' si ça ne ressemble pas à un numéro. */
export function cleanPhone(raw: string): string {
  let p = String(raw ?? '').replace(/[\s.\-()]/g, '')
  if (/^0\d{9}$/.test(p)) p = '+243' + p.slice(1)
  else if (/^243\d{9}$/.test(p)) p = '+' + p
  else if (/^00243\d{9}$/.test(p)) p = '+' + p.slice(2)
  return /^\+?[0-9]{9,15}$/.test(p) ? p : ''
}

export const PHONE_ERROR = 'Entre un numéro de téléphone valide (ex. 0812345678).'

/** Vrai quand l'étudiant connecté n'a pas encore fini l'inscription ET n'a pas de numéro : il doit passer par la page « Téléphone ».
 *  (Les étudiants déjà inscrits ne sont jamais concernés.) */
export function needsPhoneStep(user: AuthUser | null, profile: Profile | null): boolean {
  if (!user) return false
  if (profile?.university) return false
  return String(profile?.phone ?? user.phone ?? '').replace(/\D/g, '').length < 9
}
