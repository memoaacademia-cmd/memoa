// Lit le texte d'une photo (cahier manuscrit, page imprimée, diapositive, tableau).
// 1) D'abord par l'IA qui VOIT l'image (serveur) : elle lit l'écriture à la main et recopie les tableaux comme tableaux.
// 2) Si l'IA n'est pas disponible (pas de réseau stable, modèle sans vision, panne), on retombe sur la lecture du téléphone (tesseract.js),
//    qui ne comprend bien que le texte imprimé. Si les points sont épuisés, on le dit au lieu de renvoyer un texte faux.
import { shrinkImage } from './image'
import { LimitError, readPhotoAI } from './api'

/** Nombre maximum de photos lisibles dans un même éditeur (cours ou note). */
export const MAX_PHOTOS = 20

/** Nettoie un texte transcrit (photo, PDF, audio, dictée) : plus aucun « # » ni « * » visible.
 *  Les titres restent des lignes seules, les listes passent en « - », et les lignes de tableau « | a | b | » sont gardées telles quelles. */
export function cleanTranscript(text: string): string {
  return text
    .replace(/\r/g, '')
    .split('\n')
    .map((raw) => {
      let t = raw
      if (/^\s*\|.*\|\s*$/.test(t)) return t.replace(/\*+/g, '').replace(/#+/g, '') // ligne de tableau : on ne touche qu'aux symboles parasites
      t = t.replace(/^\s{0,3}#{1,6}\s*/, '')   // titres « # Titre »
      t = t.replace(/^(\s*)[*•·]\s+/, '$1- ')   // puces « * item » → « - item »
      t = t.replace(/\*{1,3}/g, '')             // gras et italique
      t = t.replace(/(^|\s)#{1,6}(?=\s)/g, '$1') // dièses isolés au milieu d'une ligne
      return t.replace(/[ \t]{2,}/g, ' ').replace(/\s+$/, '')
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Lit plusieurs photos en même temps (3 à la fois) : 20 photos prennent environ 7 fois le temps d'une seule, pas 20 fois.
 *  Le texte garde l'ordre des photos. Une photo illisible est comptée dans `failed` mais n'arrête pas les autres. */
export async function readPhotosText(files: File[], onStatus?: (s: string) => void, memoName = 'Memo'): Promise<{ text: string; failed: number }> {
  const list = files.slice(0, MAX_PHOTOS)
  const out: string[] = new Array(list.length).fill('')
  let done = 0
  let next = 0
  let stop: unknown = null
  const status = () => onStatus?.(list.length > 1 ? `${memoName} lit tes photos… ${done}/${list.length}` : `${memoName} lit ta photo…`)
  status()
  async function worker() {
    while (next < list.length && !stop) {
      const i = next++
      try {
        out[i] = await readPhotoText(list[i], undefined, memoName)
      } catch (e) {
        if (e instanceof LimitError) { stop = e; return }
      }
      done++
      status()
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, list.length) }, () => worker()))
  if (stop) throw stop
  return { text: out.filter((x) => x.trim()).join('\n\n'), failed: out.filter((x) => !x.trim()).length }
}

const toDataUrl = (f: File) =>
  new Promise<string>((ok, ko) => {
    const r = new FileReader()
    r.onload = () => ok(String(r.result))
    r.onerror = () => ko(new Error('lecture de la photo impossible'))
    r.readAsDataURL(f)
  })

async function readWithDeviceOcr(small: File, onStatus?: (s: string) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  onStatus?.('Lecture du texte (la première fois, c’est plus long)…')
  const worker = await createWorker('fra')
  try {
    const { data } = await worker.recognize(small)
    return data.text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  } finally {
    await worker.terminate()
  }
}

export async function readPhotoText(file: File, onStatus?: (s: string) => void, memoName = 'Memo'): Promise<string> {
  onStatus?.('Préparation de la photo…')
  // 1600 px suffisent pour lire un cahier : l'envoi et la lecture sont nettement plus rapides qu'à 2000 px.
  const small = await shrinkImage(file, 1600, 0.82)
  if (typeof navigator === 'undefined' || navigator.onLine !== false) {
    try {
      onStatus?.(`${memoName} lit ta photo…`)
      const text = cleanTranscript((await readPhotoAI(await toDataUrl(small))).trim())
      if (text) return text
      // L'IA n'a rien vu d'écrit : on laisse l'écran afficher son message habituel (« photo illisible »).
      return ''
    } catch (e) {
      if (e instanceof LimitError) throw e
      /* IA indisponible : repli sur la lecture du téléphone */
    }
  }
  return cleanTranscript(await readWithDeviceOcr(small, onStatus))
}

/** PDF scanné (aucun texte dans le fichier) : on lit chaque page comme une photo, 3 à la fois. Tableaux recopiés comme tableaux. */
export async function readScannedPdf(file: File, onStatus?: (s: string) => void, memoName = 'Memo', maxPages = 8): Promise<string> {
  onStatus?.('Préparation des pages…')
  const { renderPdfPages } = await import('./pdfimport')
  const pages = await renderPdfPages(file, maxPages)
  const out: string[] = new Array(pages.length).fill('')
  let done = 0
  let next = 0
  let stop: unknown = null
  async function worker() {
    while (next < pages.length && !stop) {
      const i = next++
      try {
        out[i] = cleanTranscript((await readPhotoAI(pages[i])).trim())
      } catch (e) {
        if (e instanceof LimitError) { stop = e; return }
      }
      done++
      onStatus?.(`${memoName} lit ton PDF… page ${done}/${pages.length}`)
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, pages.length) }, () => worker()))
  if (stop) throw stop
  return out.filter((x) => x.trim()).join('\n\n')
}
