// Vignette d'un document de la Librairie : sa première page (la page de garde), dessinée sur le téléphone à partir du PDF.
// Rien n'est stocké en ligne : la vignette est gardée en mémoire le temps de la visite.
import { docDownloadUrl } from './api'

const cache = new Map<string, string | null>()
const waiting: Array<() => void> = []
let running = 0
const MAX_PARALLEL = 2 // un téléphone modeste ne doit pas dessiner dix PDF à la fois

async function slot<T>(job: () => Promise<T>): Promise<T> {
  if (running >= MAX_PARALLEL) await new Promise<void>((ok) => waiting.push(ok))
  running++
  try { return await job() } finally { running--; waiting.shift()?.() }
}

/** Adresse d'image (JPEG) de la page de garde, ou null si le PDF est illisible. */
export function documentCover(filePath: string): Promise<string | null> {
  if (cache.has(filePath)) return Promise.resolve(cache.get(filePath) ?? null)
  return slot(async () => {
    try {
      const url = await docDownloadUrl(filePath)
      if (!url) return null
      const pdfjs = await import('pdfjs-dist')
      const worker = (await import('pdfjs-dist/build/pdf.worker.min.js?url')).default
      pdfjs.GlobalWorkerOptions.workerSrc = worker
      const pdf = await pdfjs.getDocument({ url, isEvalSupported: false }).promise
      const page = await pdf.getPage(1)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: 260 / base.width }) // ~260 px de large : net sur écran, léger en mémoire
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvasContext: ctx, viewport }).promise
      const img = canvas.toDataURL('image/jpeg', 0.72)
      void pdf.destroy()
      cache.set(filePath, img)
      return img
    } catch {
      cache.set(filePath, null)
      return null
    }
  })
}
