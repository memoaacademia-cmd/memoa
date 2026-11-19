// Plaques de la Librairie : l'anneau qui entoure la photo d'un auteur, selon les likes de son document.
// Pour changer un palier, on ne modifie que ce fichier.
export type PlaqueId = 'bronze' | 'or' | 'diamant' | 'emeraude' | 'rubis'

export interface Plaque {
  id: PlaqueId
  label: string
  /** Nombre de likes à atteindre. */
  min: number
  /** Couleurs de l'anneau (dégradé) et de la pierre. */
  ring: [string, string, string]
  gem: string
}

export const PLAQUES: Plaque[] = [
  { id: 'bronze', label: 'Bronze', min: 100, ring: ['#e7a26b', '#a55f2a', '#f1bd8b'], gem: '#b8692f' },
  { id: 'or', label: 'Or', min: 500, ring: ['#ffe27a', '#d69a14', '#fff0b0'], gem: '#e6a817' },
  { id: 'diamant', label: 'Diamant', min: 1000, ring: ['#bff3ff', '#62c9ee', '#f4fdff'], gem: '#7fdcf5' },
  { id: 'emeraude', label: 'Émeraude', min: 1500, ring: ['#6df0b0', '#0e9a63', '#b8ffd9'], gem: '#19b673' },
  { id: 'rubis', label: 'Rubis', min: 2000, ring: ['#ff8a9a', '#c4163a', '#ffc2cb'], gem: '#e0244a' }
]

/** Plaque gagnée avec ce nombre de likes (null en dessous de 100 : pas de plaque). */
export function plaqueFor(likes: number): Plaque | null {
  let found: Plaque | null = null
  for (const p of PLAQUES) if (likes >= p.min) found = p
  return found
}

/** Prochain palier à atteindre (null si le rubis est déjà obtenu). */
export function nextPlaque(likes: number): Plaque | null {
  return PLAQUES.find((p) => likes < p.min) ?? null
}
