// Gros documents : une note est limitée à 60 000 caractères par la base de données.
// Au lieu de couper le texte, on le range dans PLUSIEURS notes du même cours, dans l'ordre (« Titre (partie 2/8) »).

/** Texte maximum accepté à l'import d'un seul document (environ 500 pages). */
export const MAX_IMPORT_CHARS = 900000
/** Taille d'une partie (la base accepte 60 000 au maximum : on garde de la marge). */
export const NOTE_PART_CHARS = 50000

/** Découpe un texte en parties d'au plus `max` caractères, de préférence entre deux paragraphes. */
export function splitText(text: string, max = NOTE_PART_CHARS): string[] {
  const t = text.trim()
  if (!t) return []
  if (t.length <= max) return [t]
  const out: string[] = []
  let cur = ''
  const push = () => { if (cur.trim()) out.push(cur.trim()); cur = '' }
  for (const p of t.split(/\n{2,}/)) {
    if (p.length > max) {
      push()
      let rest = p
      while (rest.length > max) {
        let k = rest.lastIndexOf('\n', max)
        if (k < max * 0.5) k = rest.lastIndexOf(' ', max)
        if (k < max * 0.5) k = max
        out.push(rest.slice(0, k).trim())
        rest = rest.slice(k)
      }
      cur = rest
      continue
    }
    if (cur && cur.length + 2 + p.length > max) push()
    cur = cur ? cur + '\n\n' + p : p
  }
  push()
  return out.filter(Boolean)
}

/** Identifiant stable de la partie i d'une note (la partie 0 garde l'identifiant d'origine) : un renvoi après coupure ne crée aucun doublon. */
export function partId(base: string, i: number): string {
  return i === 0 ? base : base.slice(0, base.length - 4) + i.toString(16).padStart(4, '0')
}
/** Titre de la partie i sur n (80 caractères maximum). */
export function partTitle(base: string, i: number, n: number): string {
  const b = base.trim() || 'Note'
  return n === 1 ? b.slice(0, 80) : `${b.slice(0, 65)} (partie ${i + 1}/${n})`
}
