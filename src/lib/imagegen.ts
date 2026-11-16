// Images créées par Memo (Premium) : détection de la demande dans l'Assistant et lecture du repère enregistré dans l'historique.
// Le contrôle Premium est fait par le SERVEUR (ai-gateway, tâche « image ») : ici on décide seulement quel appel faire.

// « dessine-moi un chat », « génère une image de… », « peux-tu créer une illustration de… »
const VERB = '(?:dessine(?:r)?(?:-moi|-nous)?|g[ée]n[èe]re(?:r)?(?:-moi|-nous)?|cr[ée]{1,2}(?:r)?(?:-moi|-nous)?|fais(?:-moi)?|r[ée]alise(?:-moi)?|produis(?:-moi)?)'
const THING = '(?:image|illustration|dessin|photo|logo|affiche|poster|portrait|caricature|sch[ée]ma en image)'
const POLITE = "(?:memo\\s*[,:-]?\\s*)?(?:(?:peux|pourrais|veux|voudrais)-tu\\s+|tu\\s+peux\\s+|s['’]il\\s+te\\s+pla[iî]t\\s*,?\\s*|stp\\s*,?\\s*|please\\s*,?\\s*)*"
const ASK = new RegExp(`^\\s*${POLITE}(?:dessine(?:-moi|-nous)?\\b|${VERB}\\b[^.?!\\n]{0,30}?\\b(?:une?\\s+|des\\s+)?${THING}\\b)`, 'i')

/** Vrai si le message ressemble à « dessine-moi… » / « génère une image de… ». Prudent : une question sur une image (« explique cette image ») n'en fait pas partie. */
export function isImageRequest(text: string): boolean {
  return ASK.test(text.trim())
}

const MARK = /^\[\[image:([^\]\s]+)\]\]\s*/

/** Sépare le repère d'image d'une réponse de Memo : { path, text } si c'est une image, sinon null. */
export function parseImageMessage(content: string): { path: string; text: string } | null {
  const m = MARK.exec(content)
  return m ? { path: m[1], text: content.slice(m[0].length).trim() } : null
}

/** Texte lisible (copie, lecture à voix haute) d'un message, sans le repère technique. */
export function plainMessage(content: string): string {
  const p = parseImageMessage(content)
  return p ? p.text || 'Image créée par Memo.' : content
}
