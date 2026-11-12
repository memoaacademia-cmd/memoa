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

/**
 * Nom tel qu'on l'écrit sur les documents officiels (page de garde, PDF) :
 * NOM et POST-NOM en majuscules, prénom avec seulement la première lettre en majuscule.
 * « kasongo mutombo jean-pierre » devient « KASONGO MUTOMBO Jean-Pierre ».
 */
export function officialName(p: Pick<Profile, 'last_name' | 'post_name' | 'first_name' | 'full_name'> | null | undefined): string {
  if (!p) return ''
  const up = (x: string | null | undefined) => (x ?? '').trim().replace(/\s+/g, ' ').toUpperCase()
  if ((p.last_name ?? '').trim() || (p.post_name ?? '').trim()) {
    return [up(p.last_name), up(p.post_name), titleCase(p.first_name ?? '')].filter(Boolean).join(' ')
  }
  // Ancien compte sans les 3 cases : ordre habituel nom, post-nom, prénom.
  const parts = (p.full_name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return titleCase(parts.join(' '))
  const lead = parts.slice(0, Math.min(2, parts.length - 1))
  return [...lead.map((x) => x.toUpperCase()), titleCase(parts.slice(lead.length).join(' '))].join(' ')
}
