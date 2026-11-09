import type { Profile } from './types'

/** Majuscules propres : « kasongo  mutombo » devient « Kasongo Mutombo », « jean-pierre » devient « Jean-Pierre ». */
export function titleCase(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(^|[\s\-'’])([a-zà-öø-ÿ])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase())
}

/** Ordre habituel en RDC : nom, post-nom, prénom. */
export function composeFullName(last: string, post: string, first: string): string {
  return [last, post, first].filter(Boolean).join(' ')
}

/** Prénom à afficher dans « Bonjour … ». Vide pour un ancien compte qui n'a pas encore rempli les 3 cases. */
export function firstNameOf(p: Pick<Profile, 'first_name'> | null | undefined): string {
  return p?.first_name?.trim() ?? ''
}

/** Initiales pour la pastille de profil : prénom + nom, sinon les deux premiers mots du nom complet. */
export function initialsOf(p: Pick<Profile, 'first_name' | 'last_name' | 'full_name'> | null | undefined): string {
  if (!p) return '?'
  const parts = p.first_name && p.last_name ? [p.first_name, p.last_name] : (p.full_name ?? '').split(' ')
  const s = parts.map((x) => x[0] ?? '').slice(0, 2).join('').toUpperCase()
  return s || '?'
}
