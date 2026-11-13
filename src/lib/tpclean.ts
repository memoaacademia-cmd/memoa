// Nettoyage du texte AVANT le PDF (et avant de découper le plan).
// Module autonome (aucun import) : il peut être testé seul.
//
// Cause racine des balises vues dans les PDF : l'énoncé de l'étudiant (ou un plan collé) contient parfois des
// indications du genre « [PAGE 1 : PAGE DE GARDE] », « [PAGES 3-4 : I. INTRODUCTION] », « (À centrer sur la page) » ou
// « [NOM DE TON UNIVERSITÉ] ». L'IA les recopie, le plan les contient, puis chaque « partie » du plan est rédigée et
// imprimée avec ces balises. On les retire donc ici, à chaque étape, et le serveur demande aussi à l'IA de ne plus en écrire.

const COVER_WORDS = /(page\s+de\s+garde|couverture|garde)/i
const SKIP_PAGE_TITLE = /^(page\s+de\s+garde|couverture|sommaire|table\s+des\s+mati[eè]res|page\s+blanche)\b/i

/** Début de ligne qui annonce un autre type de texte que le travail lui-même (phrases adressées à l'étudiant). */
const ADDRESSED = /^(?:[-•*]\s*)?(n'oublie pas|n’oublie pas|pense à|pense a|n'hésite pas|n’hésite pas|n'hesite pas|tu peux|tu pourras|tu dois|tu devras|tu pourrais|assure-toi|vérifie que tu|relis ton|rappelle-toi|à toi de|bon courage|bonne chance|j'espère que|j’espère que|voici (le|la|les|un|une|ton|ta|tes)\b|n'hésitez pas|pensez à|vous pouvez|vous devez)/i

/** Titre d'un bloc de conseils glissé par l'IA à la fin (« Conseils pour ton développement : »). */
const ADVICE_HEAD = /^(?:#{1,4}\s*)?(?:\*\*)?\s*(conseils?|astuces?|recommandations?|remarques?|notes?)\b(?:[^.\n]{0,70}?)\b(pour\s+(?:ton|ta|tes|toi|votre|vos|l['’]étudiant|améliorer|aller|la\s+suite)|à\s+(?:l['’]étudiant|retenir\s+pour\s+toi)|aux\s+étudiants)/i
const ADVICE_BARE = /^(?:#{1,4}\s*)?(?:\*\*)?\s*(conseils?|astuces?)\s*(?:personnalisés?|de\s+rédaction|finaux)?\s*:?\s*(?:\*\*)?$/i

const isDirective = (inner: string) =>
  /(centr|saut\s+de\s+page|mise\s+en\s+page|interligne|police|gras|italique|taille|aligne|marge|à\s+compléter|à\s+remplir|insérer|inserer|sur\s+la\s+page|en\s+haut|en\s+bas|logo)/i.test(inner)

/** Un texte entre crochets est un champ vide à remplir (et non une citation [1] ou [Dupont, 2019]). */
export function isPlaceholder(inner: string): boolean {
  const s = inner.trim()
  if (s.length < 2 || s.length > 90) return false
  if (/^[\d\s,.;–-]+$/.test(s)) return false // [1], [2-4]
  if (/^\.{2,}$|^…+$|^_+$/.test(s)) return true // [...] [___]
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, '')
  const upper = s.replace(/[^A-ZÀ-ÖØ-Þ]/g, '')
  if (letters.length >= 4 && upper.length / letters.length >= 0.7) return true // [NOM DE TON UNIVERSITÉ]
  return /\b(ton|ta|tes|votre|vos|nom|prénom|prenom|à compléter|a completer|à remplir|insérer|inserer|insert|titre du|date|université|universite|faculté|faculte|département|departement|promotion|numéro|numero|ville)\b/i.test(s) && !/\d{4}/.test(s)
}

const PAGE_TAG = /^\[\s*(?:pages?|p\.)\s*(?:\d+(?:\s*(?:-|–|à|et|,)\s*\d+)*)?\s*(?::|-|–|—)?\s*([^\]]*)\]\s*:?\s*$/i

export interface CleanOptions {
  /** Mode strict (travail pratique) : retire aussi les phrases adressées à l'étudiant. */
  strict?: boolean
}

export function cleanDocText(text: string, opt: CleanOptions = {}): string {
  const strict = !!opt.strict
  let lines = text.replace(/\r/g, '').split('\n')

  // 1. Bloc de conseils final : tout ce qui suit est supprimé (dans la seconde moitié du texte seulement).
  const half = Math.floor(lines.length * 0.4)
  for (let i = lines.length - 1; i >= half; i--) {
    const t = lines[i].trim()
    if (t && (ADVICE_HEAD.test(t) || (strict && ADVICE_BARE.test(t)))) { lines = lines.slice(0, i); break }
  }

  const chatty = /^(voici|bien sûr|bien sur|d'accord|d’accord|certainement|avec plaisir|j'espère|j’espère|n'hésite|n’hésite|n'hesite|si tu veux|souhaites-tu|veux-tu|dis-moi|je reste|peux-tu)/i
  const out: string[] = []
  let skipCover = 0
  for (const raw of lines) {
    let t = raw.trim()
    // Séparateurs décoratifs
    if (/^[-_*=~]{3,}$/.test(t)) continue
    if (/^[_.…·\s]{4,}$/.test(t) && t) continue

    // 2. Balises de page : [PAGE 1 : PAGE DE GARDE], [PAGES 3-4 : I. INTRODUCTION]
    const mp = PAGE_TAG.exec(t.replace(/^[*#\s]+|[*\s]+$/g, ''))
    if (mp) {
      const title = (mp[1] ?? '').trim()
      if (!title) { skipCover = 0; continue }
      if (COVER_WORDS.test(title) || SKIP_PAGE_TITLE.test(title)) { skipCover = 40; continue }
      skipCover = 0
      out.push(title) // « I. INTRODUCTION » : on garde le vrai titre, sans la balise
      continue
    }
    // Contenu de la page de garde écrit comme du texte : on le saute jusqu'au premier vrai titre.
    if (skipCover > 0) {
      if (/^(#{1,4}\s+\S|(\d+|[IVX]+)[.)]\s+\S)/.test(t)) skipCover = 0
      else { skipCover--; continue }
    }

    // 3. Consignes de mise en page entre parenthèses ou crochets
    if (/^[([].*[)\]]$/.test(t) && isDirective(t)) continue
    t = t.replace(/\(\s*(?:à|a)\s+(?:centrer|compléter|remplir|aligner)[^)]*\)/gi, '').replace(/\[\s*(?:à|a)\s+(?:centrer|compléter|remplir)[^\]]*\]/gi, '')
    t = t.replace(/\[\s*(?:ins[ée]rer|insert|saut\s+de\s+page|page\s+break)[^\]]*\]/gi, '')

    if (t !== raw.trim()) t = t.replace(/\s{2,}/g, ' ').trim()

    // 4. Champs vides entre crochets (jamais un lien [texte](url) ni une citation)
    const before = t
    t = t.replace(/\[([^\]\n]{1,90})\](?!\()/g, (m, inner: string) => (isPlaceholder(inner) ? '' : m))
    if (t !== before) {
      // Si la ligne n'était qu'un champ (ou une étiquette « Nom : ») on la retire entièrement.
      const rest = t.replace(/[\s:–—\-.,;/|·•*#]+/g, '')
      if (!rest || /^[A-Za-zÀ-ÿ' ’]{1,40}\s*:\s*$/.test(t.trim())) continue
      t = t.replace(/\s{2,}/g, ' ').trim()
    }
    t = t.replace(/\s+([,;.:])/g, '$1')
    if (!t && raw.trim()) continue

    // 5. Phrases adressées à l'étudiant (travail pratique)
    if (strict && ADDRESSED.test(t)) continue

    // Anciennes règles : lignes de « saut de page » entre crochets
    if (/^\[[^\]]*(saut de page|page break)[^\]]*\]$/i.test(t)) continue
    out.push(t === raw.trim() ? raw.replace(/\s+$/, '') : t)
  }

  while (out.length && (!out[0].trim() || chatty.test(out[0].trim()))) out.shift()
  while (out.length && (!out[out.length - 1].trim() || chatty.test(out[out.length - 1].trim()))) out.pop()
  // Une seule ligne vide entre deux blocs
  const res: string[] = []
  for (const l of out) {
    if (!l.trim() && (!res.length || !res[res.length - 1].trim())) continue
    res.push(l)
  }
  return res.join('\n')
}

/** Version stricte pour le TP (plan et parties rédigées). */
export const cleanTpText = (t: string) => cleanDocText(t, { strict: true })
