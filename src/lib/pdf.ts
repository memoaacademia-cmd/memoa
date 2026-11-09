// Fabrique le PDF des notes d'un cours, directement dans le navigateur (aucune donnée ne quitte le téléphone).
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

export async function buildCoursePdf(title: string, author: string, notes: Note[]): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210
  const H = 297
  const M = 20
  const width = W - 2 * M
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
    const lines = doc.splitTextToSize(text, width - indent) as string[]
    for (const line of lines) {
      ensure(lh)
      doc.text(line, M + indent, y + lh * 0.8)
      y += lh
    }
    y += gap
  }

  // Première page : titre du cours
  doc.setFillColor(11, 93, 84)
  doc.rect(0, 0, W, 8, 'F')
  y = 60
  write('MEMOA · NOTES DE COURS', 10, 'bold', 0, 6, 11)
  write(clean(title), 26, 'bold', 0, 6, 20)
  doc.setDrawColor(11, 93, 84)
  doc.setLineWidth(0.8)
  doc.line(M, y, M + 24, y)
  y += 8
  if (author) write(clean(author), 12, 'normal', 0, 2, 70)
  write(new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }), 11, 'normal', 0, 2, 110)

  // Les notes, une par section
  notes.forEach((n, i) => {
    doc.addPage()
    y = M
    write(clean(n.title || `Note ${i + 1}`), 18, 'bold', 0, 5, 11)
    for (const raw of n.content.split('\n')) {
      const line = raw.trimEnd()
      const t = line.trim()
      if (!t) { y += 2.5; continue }
      const h = /^(#{1,4})\s+(.*)$/.exec(t)
      if (h) {
        y += 2
        write(clean(h[2]), h[1].length <= 2 ? 14 : 12, 'bold', 0, 2, 20)
        continue
      }
      const b = /^[-*•]\s+(.*)$/.exec(t)
      if (b) {
        ensure(6)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.setTextColor(11)
        doc.text('-', M + 2, y + 4)
        write(clean(b[1]), 11, 'normal', 7, 1.2, 30)
        continue
      }
      const num = /^(\d+[.)])\s+(.*)$/.exec(t)
      if (num) {
        ensure(6)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.setTextColor(11)
        doc.text(num[1], M + 1, y + 4)
        write(clean(num[2]), 11, 'normal', 8, 1.2, 30)
        continue
      }
      write(clean(t), 11, 'normal', 0, 1.8, 30)
    }
  })

  // Pied de page : numéro de page (pas sur la première)
  const total = doc.getNumberOfPages()
  for (let p = 2; p <= total; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(130)
    doc.text(clean(title).slice(0, 60), M, H - 10)
    doc.text(`${p - 1}`, W - M, H - 10, { align: 'right' })
  }
  return doc.output('blob')
}
