// Fabrique les PDF (notes d'un cours, TP avec page de garde) directement dans le navigateur : aucune donnée ne quitte le téléphone.
import { universityLabel } from '../data/academic'
import type { Note } from './types'

// Les polices PDF standard ne connaissent pas tous les caractères : on remplace ou on retire ceux qui poseraient problème.
function clean(s: string): string {
  return s
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/→/g, '->')
    .replace(/[  ]/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/(^|\s)\*(\S)/g, '$1$2')
    .replace(/(\S)\*(\s|$)/g, '$1$2')
    .replace(/`/g, '')
    .replace(/[^\n\x20-\x7EÀ-ÿ]/g, '')
}

const W = 210
const H = 297
const M = 20
const WIDTH = W - 2 * M

type Doc = InstanceType<typeof import('jspdf').jsPDF>

/** Petit « rédacteur » : écrit du texte avec retour à la ligne et changement de page automatiques. */
function writer(doc: Doc) {
  let y = M
  const ensure = (h: number) => {
    if (y + h > H - 20) {
      doc.addPage()
      y = M
    }
  }
  const write = (text: string, size: number, style: 'normal' | 'bold', indent = 0, gap = 1.6, color = 30) => {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(color)
    const lh = size * 0.46
    const lines = doc.splitTextToSize(text, WIDTH - indent) as string[]
    for (const line of lines) {
      ensure(lh)
      doc.text(line, M + indent, y + lh * 0.8)
      y += lh
    }
    y += gap
  }
  const marker = (m: string) => {
    ensure(6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(11)
    doc.text(m, M + 1, y + 4)
  }
  /** Écrit un texte simple (titres #, listes - et 1.) comme l'IA les produit. */
  const body = (content: string) => {
    for (const raw of content.split('\n')) {
      const t = raw.trim()
      if (!t) { y += 2.5; continue }
      const h = /^(#{1,4})\s+(.*)$/.exec(t)
      if (h) { y += 2; write(clean(h[2]), h[1].length <= 2 ? 14 : 12, 'bold', 0, 2, 20); continue }
      const b = /^[-*•]\s+(.*)$/.exec(t)
      if (b) { marker('-'); write(clean(b[1]), 11, 'normal', 7, 1.2, 30); continue }
      const num = /^(\d+[.)])\s+(.*)$/.exec(t)
      if (num) { marker(num[1]); write(clean(num[2]), 11, 'normal', 8, 1.2, 30); continue }
      write(clean(t), 11, 'normal', 0, 1.8, 30)
    }
  }
  return {
    write,
    body,
    get y() { return y },
    set y(v: number) { y = v },
    newPage() { doc.addPage(); y = M }
  }
}

/** Numérotation des pages à partir de la deuxième ; la page de garde n'en porte pas. */
function footers(doc: Doc, label: string) {
  const total = doc.getNumberOfPages()
  for (let p = 2; p <= total; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(130)
    doc.text(clean(label).slice(0, 60), M, H - 10)
    doc.text(`${p - 1}`, W - M, H - 10, { align: 'right' })
  }
}

export async function buildCoursePdf(title: string, author: string, notes: Note[]): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const w = writer(doc)

  doc.setFillColor(11, 93, 84)
  doc.rect(0, 0, W, 8, 'F')
  w.y = 60
  w.write('MEMOA · NOTES DE COURS', 10, 'bold', 0, 6, 11)
  w.write(clean(title), 26, 'bold', 0, 6, 20)
  doc.setDrawColor(11, 93, 84)
  doc.setLineWidth(0.8)
  doc.line(M, w.y, M + 24, w.y)
  w.y += 8
  if (author) w.write(clean(author), 12, 'normal', 0, 2, 70)
  w.write(new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }), 11, 'normal', 0, 2, 110)

  notes.forEach((n, i) => {
    w.newPage()
    w.write(clean(n.title || `Note ${i + 1}`), 18, 'bold', 0, 5, 11)
    w.body(n.content)
  })
  footers(doc, title)
  return doc.output('blob')
}

export interface TpCover {
  university: string
  faculty: string
  department: string
  promotion: string
  vacation?: string
  title: string
  course: string
  student: string
  year: string
  /** Adresse du logo de l'université (public/logos), s'il existe. */
  logoUrl?: string | null
  /** Petit libellé au-dessus du titre dans le bandeau. */
  kind?: string
}

interface LoadedLogo { data: string; w: number; h: number }

/** Charge un logo et mesure ses proportions ; en cas d'échec la page de garde se fait simplement sans logo. */
async function loadLogo(url: string | null | undefined): Promise<LoadedLogo | null> {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const data = await new Promise<string>((ok, ko) => {
      const r = new FileReader()
      r.onload = () => ok(String(r.result))
      r.onerror = () => ko(new Error('lecture du logo'))
      r.readAsDataURL(blob)
    })
    const dims = await new Promise<{ w: number; h: number }>((ok, ko) => {
      const img = new Image()
      img.onload = () => ok({ w: img.naturalWidth, h: img.naturalHeight })
      img.onerror = () => ko(new Error('logo illisible'))
      img.src = data
    })
    return { data, ...dims }
  } catch {
    return null
  }
}

const NAVY: [number, number, number] = [27, 42, 107]
const GOLD: [number, number, number] = [184, 137, 43]

/** TP : page de garde sur le modèle validé (double cadre, logo, bandeau, présenté par), puis le travail. */
export async function buildTpPdf(c: TpCover, content: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const logo = await loadLogo(c.logoUrl)
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const w = writer(doc)
  const cx = W / 2

  /** Texte centré, avec espacement entre les lettres si demandé ; renvoie le y après la dernière ligne. */
  const center = (text: string, size: number, style: 'normal' | 'bold', y: number, color: [number, number, number], space = 0, maxW = 140, up = false) => {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(color[0], color[1], color[2])
    const t = clean(up ? text.toUpperCase() : text)
    const lh = size * 0.5
    const lines = doc.splitTextToSize(t, maxW) as string[]
    lines.forEach((l, i) => {
      const width = doc.getTextWidth(l) + space * Math.max(0, l.length - 1) * 0.3528
      doc.text(l, cx - width / 2, y + i * lh, space ? { charSpace: space } : undefined)
    })
    return y + lines.length * lh
  }
  const rule = (y: number, half: number, thick = 0.5) => {
    doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2])
    doc.setLineWidth(thick)
    doc.line(cx - half, y, cx + half, y)
  }

  // Double cadre bleu
  doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2])
  doc.setLineWidth(0.9)
  doc.rect(10, 10, W - 20, H - 20)
  doc.setLineWidth(0.3)
  doc.rect(12.5, 12.5, W - 25, H - 25)

  // En-tête : pays, université, faculté
  let y = 36
  y = center('RÉPUBLIQUE DÉMOCRATIQUE DU CONGO', 10, 'bold', y, [60, 60, 70], 1.2, 150)
  rule(y + 5, 30, 0.7)
  y = center(universityOnly(c.university), 15, 'bold', y + 16, NAVY, 0.3, 150, true)
  y = center(`${c.faculty}`, 11.5, 'bold', y + 3, GOLD, 0.8, 150, true)
  if (c.department) y = center(`Département : ${c.department}`, 10, 'normal', y + 3, [90, 90, 100], 0, 150)

  // Logo (hauteur max 55 mm, largeur max 70 mm)
  let logoBottom = y + 8
  if (logo) {
    const ratio = logo.w / logo.h
    let lw = 70
    let lh = lw / ratio
    if (lh > 55) { lh = 55; lw = lh * ratio }
    doc.addImage(logo.data, 'PNG', cx - lw / 2, y + 12, lw, lh)
    logoBottom = y + 12 + lh
  }

  // Bandeau bleu : type de document et titre
  const bandTop = Math.max(logoBottom + 14, 150)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  const titleLines = doc.splitTextToSize(clean(c.title).toUpperCase(), 148) as string[]
  const bandH = 16 + titleLines.length * 9.5 + 6
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2])
  doc.rect(33, bandTop, W - 66, bandH, 'F')
  doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2])
  doc.setLineWidth(0.8)
  doc.line(33, bandTop, W - 33, bandTop)
  doc.line(33, bandTop + bandH, W - 33, bandTop + bandH)
  center(c.kind ?? 'TRAVAIL PRATIQUE', 10, 'normal', bandTop + 9, [255, 255, 255], 2.4, 150, true)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(255, 255, 255)
  titleLines.forEach((l, i) => doc.text(l, cx - doc.getTextWidth(l) / 2, bandTop + 18 + i * 9.5))

  // Bloc « présenté par » : étiquettes dorées, valeurs bleues, trait vertical doré
  const rows: Array<[string, string]> = [['PRÉSENTÉ PAR', c.student]]
  if (c.course) rows.push(['COURS', c.course])
  rows.push(['PROMOTION', [c.promotion, c.department].filter(Boolean).join(' / ')])
  if (c.vacation) rows.push(['VACATION', c.vacation.replace(/^Vacation\s+/i, '')])
  let ry = bandTop + bandH + 22
  const lineX = 78
  const startY = ry - 5
  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(GOLD[0], GOLD[1], GOLD[2])
    const lw = doc.getTextWidth(label) + 1.6 * (label.length - 1) * 0.3528
    doc.text(label, lineX - 5 - lw, ry, { charSpace: 1.6 })
    doc.setFontSize(11.5)
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
    const vl = doc.splitTextToSize(clean(value), W - lineX - 30) as string[]
    vl.forEach((l, i) => doc.text(l, lineX + 5, ry + i * 5.2))
    ry += Math.max(1, vl.length) * 5.2 + 5
  })
  doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2])
  doc.setLineWidth(0.5)
  doc.line(lineX, startY, lineX, ry - 8)

  // Année académique entre deux filets dorés
  const yearY = H - 46
  rule(yearY - 7, 46, 0.5)
  center(`ANNÉE ACADÉMIQUE ${c.year.replace('-', ' – ')}`, 10, 'bold', yearY, NAVY, 1.6, 150)
  rule(yearY + 6, 46, 0.5)

  w.newPage()
  w.body(content)
  footers(doc, c.title)
  return doc.output('blob')
}

function universityOnly(u: string): string {
  return universityLabel(u)
}
