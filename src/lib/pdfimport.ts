// Lit le texte d'un PDF directement sur le téléphone (aucun envoi sur internet).
// Les tableaux sont reconnus d'après la position des mots et recopiés comme dans l'éditeur : lignes « | a | b | ».
// Un PDF scanné (sans texte) est lu page par page par l'IA qui voit l'image : voir readScannedPdf dans ocr.ts.

import { MAX_IMPORT_CHARS } from './splitnotes'

type Item = { s: string; x: number; y: number; w: number }
type Cell = { t: string; x: number }

const ROW_TOL = 3     // deux mots à moins de 3 points de hauteur sont sur la même ligne
const CELL_GAP = 14   // un blanc de plus de 14 points sépare deux cases d'un tableau
const COL_TOL = 14    // deux cases dont le début est à moins de 14 points sont dans la même colonne

async function loadPdf(file: File) {
  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.js?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const data = new Uint8Array(await file.arrayBuffer())
  return pdfjs.getDocument({ data, isEvalSupported: false }).promise
}

/** Découpe une ligne de mots en cases (un grand blanc = nouvelle case). */
function cellsOf(row: Item[]): Cell[] {
  const cells: Cell[] = []
  let cur = ''
  let start = 0
  let end: number | null = null
  for (const it of row) {
    if (!it.s.trim()) { if (end !== null) end = Math.max(end, it.x + it.w); continue }
    if (end !== null && it.x - end > CELL_GAP) { cells.push({ t: cur.trim(), x: start }); cur = ''; end = null }
    if (end === null) start = it.x
    else if (it.x - end > 1.2 && !cur.endsWith(' ')) cur += ' '
    cur += it.s
    end = it.x + it.w
  }
  if (cur.trim()) cells.push({ t: cur.trim(), x: start })
  return cells
}

const safeCell = (s: string) => s.replace(/[|\n\r]/g, '/').replace(/\s+/g, ' ').trim()

/** Transforme une suite de lignes « à cases » en lignes de tableau alignées sur les vraies colonnes. */
function tableLines(rows: Cell[][]): string[] {
  const starts = rows.flatMap((r) => r.map((c) => c.x)).sort((a, b) => a - b)
  const anchors: number[] = []
  for (const x of starts) if (!anchors.length || x - anchors[anchors.length - 1] > COL_TOL) anchors.push(x)
  const out = rows.map((r) => {
    const line: string[] = anchors.map(() => '')
    for (const c of r) {
      let best = 0
      for (let i = 0; i < anchors.length; i++) if (Math.abs(anchors[i] - c.x) < Math.abs(anchors[best] - c.x)) best = i
      line[best] = line[best] ? line[best] + ' ' + safeCell(c.t) : safeCell(c.t)
    }
    return '| ' + line.join(' | ') + ' |'
  })
  out.splice(1, 0, '|' + anchors.map(() => ' --- ').join('|') + '|')
  return out
}

function pageLines(items: Item[]): string[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const rows: Item[][] = []
  for (const it of sorted) {
    const last = rows[rows.length - 1]
    if (last && Math.abs(last[0].y - it.y) <= ROW_TOL) last.push(it)
    else rows.push([it])
  }
  const parsed = rows.map((r) => ({ cells: cellsOf(r.sort((a, b) => a.x - b.x)) })).filter((r) => r.cells.length)
  const out: string[] = []
  let i = 0
  while (i < parsed.length) {
    if (parsed[i].cells.length >= 2) {
      let j = i
      while (j < parsed.length && parsed[j].cells.length >= 2) j++
      // Un tableau = au moins 2 lignes à plusieurs cases qui se suivent.
      if (j - i >= 2) { out.push(...tableLines(parsed.slice(i, j).map((r) => r.cells))); i = j; continue }
    }
    out.push(parsed[i].cells.map((c) => c.t).join(' '))
    i++
  }
  return out
}

export async function extractPdfText(file: File, maxPages = 60): Promise<string> {
  return (await extractPdfCore(file, maxPages)).text
}

async function extractPdfCore(file: File, maxPages: number, onProgress?: (done: number, total: number) => void): Promise<{ text: string; total: number; read: number }> {
  const pdf = await loadPdf(file)
  const pages: string[] = []
  const max = Math.min(pdf.numPages, maxPages)
  for (let i = 1; i <= max; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const items: Item[] = []
    for (const it of content.items) {
      if (!('str' in it) || !it.str) continue
      items.push({ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width })
    }
    pages.push(pageLines(items).join('\n'))
    if (onProgress && (i % 10 === 0 || i === max)) onProgress(i, max)
  }
  return { text: pages.join('\n\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(), total: pdf.numPages, read: max }
}

/** Nombre de pages d'un PDF. */
export async function pdfPageCount(file: File): Promise<number> {
  return (await loadPdf(file)).numPages
}

/**
 * Lit un PDF pour l'ajouter à un cours : jusqu'à 600 pages et 900 000 caractères (le texte est ensuite rangé en
 * plusieurs notes, rien n'est perdu). Si le document dépasse encore, une ligne « [Document coupé : …] » est ajoutée
 * à la fin (l'étudiant la voit, l'IA la lit) et notice contient le message à montrer.
 */
export async function extractPdfTextChecked(file: File, maxPages = 600, maxChars = MAX_IMPORT_CHARS, onProgress?: (done: number, total: number) => void): Promise<{ text: string; notice: string | null }> {
  const { text, total, read } = await extractPdfCore(file, maxPages, onProgress)
  const cutPages = read < total
  const cutChars = text.length > maxChars - 300
  if (!cutPages && !cutChars) return { text, notice: null }
  const kept = cutChars ? text.slice(0, maxChars - 300) : text
  const keptPages = cutChars ? Math.max(1, Math.round((read * kept.length) / text.length)) : read
  const marker = `[Document coupé : seules les ${keptPages} premières pages sur ${total} ont été gardées. Le reste n'est pas dans ce cours.]`
  return {
    text: kept + '\n\n' + marker,
    notice: `Ton PDF fait ${total} pages : j'ai gardé les ${keptPages} premières (c'est la limite d'un seul import). Ajoute le reste en important la suite du PDF dans une autre note.`
  }
}

/** Dessine les premières pages d'un PDF en images (pour les PDF scannés, lus ensuite par l'IA). */
export async function renderPdfPages(file: File, maxPages = 8): Promise<string[]> {
  const pdf = await loadPdf(file)
  const out: string[] = []
  const max = Math.min(pdf.numPages, maxPages)
  for (let i = 1; i <= max; i++) {
    const page = await pdf.getPage(i)
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(2, 1600 / Math.max(base.width, base.height))
    const vp = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(vp.width)
    canvas.height = Math.round(vp.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport: vp }).promise
    out.push(canvas.toDataURL('image/jpeg', 0.82))
  }
  return out
}
