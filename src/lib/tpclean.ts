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
const ADVICE_HEAD = /^(?:[-*•]\s*|\d+(?:\.\d+)*[.)]?\s+)?(?:#{1,4}\s*)?(?:\*\*)?\s*(conseils?|astuces?|recommandations?|remarques?|notes?)\b(?:[^.\n]{0,70}?)\b(pour\s+(?:ton|ta|tes|toi|votre|vos|l['’]étudiant|améliorer|aller|la\s+suite)|à\s+(?:l['’]étudiant|retenir\s+pour\s+toi)|aux\s+étudiants)/i
const ADVICE_BARE = /^(?:[-*•]\s*|\d+(?:\.\d+)*[.)]?\s+)?(?:#{1,4}\s*)?(?:\*\*)?\s*(conseils?|astuces?)\s*(?:personnalisés?|de\s+rédaction|finaux)?\s*:?\s*(?:\*\*)?$/i

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

  const chatty = /^(voici|bien sûr|bien sur|d'accord|d’accord|ok\b|okay|ouais|oui\b|compris\b|c'est compris|c’est compris|j'ai (bien )?(compris|reçu|noté)|j’ai (bien )?(compris|reçu|noté)|entendu\b|très bien|tres bien|parfait\b|pas de souci|pas de problème|no problem|noté(?![a-zà-ÿ])|certainement|avec plaisir|je m'en occupe|je m’en occupe|je vais (te )?(faire|rédiger|écrire|préparer|créer)|je te (fais|prépare|rédige|propose)|je comprends|bien reçu|super\b|excellent\b|volontiers\b|j'espère|j’espère|n'hésite|n’hésite|n'hesite|si tu veux|souhaites-tu|veux-tu|dis-moi|je reste|peux-tu)/i
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

    // Dièses de titre Markdown qui traînent au milieu d'une ligne (« 1.2 ### Partie 1 : Introduction ») : jamais visibles.
    t = t.replace(/^((?:\d+(?:\.\d+)*[.)]?|[-*•]))\s+#{1,6}\s+/, '$1 ').replace(/(\s)#{2,6}\s+/g, '$1')

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

  // Paragraphes d'ouverture de conversation (« Bonjour ! Je suis ravi de t'aider… », « Comme tu n'as pas fourni tes notes… », « Si tu télécharges tes notes… ») :
  // retirés tant qu'ils précèdent le vrai document. On s'arrête au premier paragraphe qui est du contenu.
  const talk = /^(bonjour|bonsoir|salut|coucou|hello|salutations)\b|\bje suis (ton|ta|ravi|ravie|ici|là|memo|mémo|un assistant|une assistante|l'assistant)|\b(ravi|ravie|heureux|heureuse) de (t'|te |vous |t’)|\bje (te |t'|t’|vous )(propose|conseille|recommande|suggère|donne|fais|prépare|rédige|ai préparé)|\bje vais (te |t'|t’|vous |donc )?(proposer|faire|rédiger|écrire|préparer|créer|structurer|développer)|\bje me base\b|\bje peux (alors |ensuite )?(te |t'|t’)?(développer|aider|compléter|détailler)|\b(comme|puisque|vu que) tu n['’]as pas|\btu n['’]as pas (encore )?(fourni|donné|envoyé|joint|mis)|\bsi tu (télécharges|fournis|me donnes|m['’]envoies|joins|ajoutes|veux)|\bn['’]hésite pas\b|^(note importante|remarque|attention)\s*:.*\b(tu|ton|tes|je)\b|générer \d+ pages? d['’]un seul coup/i
  const paras: string[] = []
  {
    let cur: string[] = []
    for (const l of out) { if (!l.trim()) { if (cur.length) { paras.push(cur.join('\n')); cur = [] } } else cur.push(l) }
    if (cur.length) paras.push(cur.join('\n'))
    let k = 0
    while (k < paras.length - 1 && talk.test(paras[k].replace(/^[#*\s]+/, ''))) k++
    if (k > 0) { out.length = 0; paras.slice(k).forEach((x, i) => { if (i) out.push(''); out.push(...x.split('\n')) }) }
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

/**
 * Nettoie le PLAN renvoyé par l'IA avant de le découper en parties. Les modèles gratuits répondent parfois en Markdown
 * (« ### Partie 1 : Introduction », « **2.1. Titre** ») précédé d'une phrase d'introduction ou suivi de phrases de description :
 * sans ce nettoyage, ces phrases devenaient de fausses « parties » et le plan affichait des « ### » et des lignes sans rapport.
 * Résultat : « 1. Titre » pour les parties, « 1.1 Titre » pour les sous-parties, rien d'autre.
 */
export function cleanPlan(text: string): string {
  const base = cleanTpText(text)
  const struct = /^(?:partie\s+\d+\s*[.:)\-–]|\d+(?:\.\d+)*\s*[.)\-:–]\s*\S|\d+\.\d+(?:\.\d+)*\s+\S|[IVXLC]+\s*[.)]\s*\S|[a-h]\)\s*\S)/i
  const keyTop = /^(introduction|conclusion|bibliographie|annexes?)\b/i
  const out: string[] = []
  let started = false
  for (const raw of base.split('\n')) {
    let s = raw.trim()
    if (!s) continue
    s = s.replace(/^#{1,6}\s*/, '').replace(/\*\*/g, '').replace(/`/g, '').replace(/(\s)#{1,6}\s+/g, '$1').replace(/^[*•·▪●]\s+/, '- ').trim()
    if (/^(titre|sujet|objectif)\s*(du\s+\w+)?\s*:/i.test(s)) continue // lignes d'information, pas des parties
    // « 1.2 Partie 1 : Introduction » (numéro en trop devant un titre de partie) : on garde « Partie 1 : Introduction »
    s = s.replace(/^\d+\.\d+\s+(?=partie\s+\d+\s*[.:)\-–])/i, '')
    const structural = struct.test(s) || keyTop.test(s)
    if (structural) {
      started = true
      s = s
        .replace(/^partie\s+(\d+)\s*[.:)\-–]\s*/i, '$1. ') // « Partie 2 : La structure » → « 2. La structure »
        .replace(/^(\d+(?:\.\d+)+)[.)\-:–]?\s+/, '$1 ') // « 2.1. Les acteurs » → « 2.1 Les acteurs »
        .replace(/[.;:]\s*$/, '')
      out.push(s)
      continue
    }
    if (!started) continue // phrase d'introduction de l'IA avant le plan
    if (/^-\s+\S/.test(s)) { out.push(s.replace(/[.;]\s*$/, '')); continue } // puce : sous-partie
    if (s.length > 200 || /[.!?]$/.test(s)) continue // phrase de description : pas une partie
    out.push(s)
  }
  // Conseils glissés dans la liste (« 5. Sources : N'oublie pas de citer… ») : jamais des parties du plan.
  let kept = out.filter((l) => !/n['’]oublie pas|n['’]oubliez pas|pense[zr]? à |pensez à |tu dois |tu peux |tu devras|ton syllabus|vérifie que tu|assure-toi/i.test(l))
  // Le plan s'arrête à la bibliographie : tout ce qui suit est du commentaire.
  const bi = kept.findIndex((l) => /^(?:\d+(?:\.\d+)*[.)]?\s+)?bibliographie/i.test(l))
  if (bi >= 0) kept = kept.slice(0, bi + 1)
  if (kept.length < 2) return base
  // Renumérotation systématique et lisible : parties « 1. », « 2. »… ; sous-parties « 1.1 », « 1.2 »… (les puces deviennent des sous-parties numérotées).
  let n = 0, m = 0
  const res: string[] = []
  for (const l of kept) {
    const isSub = /^(?:\d+\.\d+|-\s)/.test(l)
    if (isSub && n) { m++; res.push(`${n}.${m} ${l.replace(/^(?:\d+(?:\.\d+)+|-)\s*[.)\-:–]?\s*/, '')}`) }
    else { n++; m = 0; res.push(`${n}. ${l.replace(/^(?:partie\s+)?(?:\d+|[ivxlc]+|[a-h])\s*[.)\-:–]\s+/i, '')}`) }
  }
  return res.join('\n')
}
