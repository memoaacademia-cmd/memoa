// Lit le texte d'une photo (cahier imprimé, diapositive, page de livre) directement sur le téléphone.
// La première fois, la langue française est téléchargée (quelques Mo) ; ensuite elle reste en mémoire du navigateur.
import { shrinkImage } from './image'

export async function readPhotoText(file: File, onStatus?: (s: string) => void): Promise<string> {
  onStatus?.('Préparation de la photo…')
  const small = await shrinkImage(file, 1800, 0.9)
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
