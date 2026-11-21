// Lit le texte d'une photo (cahier manuscrit, page imprimée, diapositive, tableau).
// 1) D'abord par l'IA qui VOIT l'image (serveur) : elle lit l'écriture à la main et recopie les tableaux comme tableaux.
// 2) Si l'IA n'est pas disponible (pas de réseau stable, modèle sans vision, panne), on retombe sur la lecture du téléphone (tesseract.js),
//    qui ne comprend bien que le texte imprimé. Si les points sont épuisés, on le dit au lieu de renvoyer un texte faux.
import { shrinkImage } from './image'
import { LimitError, readPhotoAI } from './api'

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

export async function readPhotoText(file: File, onStatus?: (s: string) => void): Promise<string> {
  onStatus?.('Préparation de la photo…')
  const small = await shrinkImage(file, 2000, 0.88)
  if (typeof navigator === 'undefined' || navigator.onLine !== false) {
    try {
      onStatus?.('Memo lit ta photo…')
      const text = (await readPhotoAI(await toDataUrl(small))).trim()
      if (text) return text
      // L'IA n'a rien vu d'écrit : on laisse l'écran afficher son message habituel (« photo illisible »).
      return ''
    } catch (e) {
      if (e instanceof LimitError) throw e
      /* IA indisponible : repli sur la lecture du téléphone */
    }
  }
  return readWithDeviceOcr(small, onStatus)
}
