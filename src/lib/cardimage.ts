// Carte de révision → belle image PNG (question en haut, réponse en bas) à partager sur WhatsApp ou à enregistrer.
// Dessinée sur un canvas, sans bibliothèque ni réseau : marche aussi hors connexion.
const W = 1080
const PAD = 72
const FONT = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = []
  for (const para of text.replace(/\s+\n/g, '\n').split('\n')) {
    let cur = ''
    for (const word of para.split(/\s+/).filter(Boolean)) {
      // mot plus long que la ligne (ex. adresse) : on le coupe
      let w = word
      while (ctx.measureText(w).width > maxW && w.length > 1) {
        let k = w.length - 1
        while (k > 1 && ctx.measureText(w.slice(0, k)).width > maxW) k--
        if (cur) { lines.push(cur); cur = '' }
        lines.push(w.slice(0, k)); w = w.slice(k)
      }
      const t = cur ? cur + ' ' + w : w
      if (ctx.measureText(t).width <= maxW) cur = t
      else { lines.push(cur); cur = w }
    }
    if (cur) lines.push(cur)
  }
  return lines
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}

export async function makeReviewCardImage(card: { course_title: string; question: string; answer: string }, memo = 'Memo'): Promise<Blob> {
  const cv = document.createElement('canvas')
  const ctx = cv.getContext('2d')
  if (!ctx) throw new Error('Impossible de créer l’image sur cet appareil.')
  const inner = W - PAD * 2 - 80 // texte à l'intérieur des deux blocs
  const qSize = 54, aSize = 50, lh = 1.32

  ctx.font = `700 ${qSize}px ${FONT}`
  const q = wrap(ctx, card.question.slice(0, 400), inner).slice(0, 12)
  ctx.font = `600 ${aSize}px ${FONT}`
  const a = wrap(ctx, card.answer.slice(0, 800), inner).slice(0, 16)

  const top = 200, blockPadY = 64, label = 56, gap = 36
  const qH = blockPadY * 2 + label + q.length * qSize * lh
  const aH = blockPadY * 2 + label + a.length * aSize * lh
  const H = top + qH + gap + aH + 170
  cv.width = W; cv.height = H

  // fond
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#0B5D54'); bg.addColorStop(1, '#0E1A2B')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

  // en-tête : cours + marque
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#3CCFB4'; ctx.font = `800 40px ${FONT}`; ctx.fillText('MEMOA', PAD, 104)
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = `500 34px ${FONT}`
  let course = card.course_title
  while (course.length > 2 && ctx.measureText(course).width > W - PAD * 2) course = course.slice(0, -2) + '…'
  ctx.fillText(course, PAD, 160)

  // question
  let y = top
  ctx.fillStyle = '#FFFFFF'; round(ctx, PAD, y, W - PAD * 2, qH, 44); ctx.fill()
  ctx.fillStyle = '#0B5D54'; ctx.font = `800 30px ${FONT}`
  ctx.fillText('QUESTION', PAD + 40, y + blockPadY + 24)
  ctx.fillStyle = '#0E1A2B'; ctx.font = `700 ${qSize}px ${FONT}`
  q.forEach((l, i) => ctx.fillText(l, PAD + 40, y + blockPadY + label + qSize * 0.85 + i * qSize * lh))

  // réponse
  y += qH + gap
  const ag = ctx.createLinearGradient(PAD, y, W - PAD, y + aH)
  ag.addColorStop(0, '#3CCFB4'); ag.addColorStop(1, '#12806F')
  ctx.fillStyle = ag; round(ctx, PAD, y, W - PAD * 2, aH, 44); ctx.fill()
  ctx.fillStyle = '#0E1A2B'; ctx.font = `800 30px ${FONT}`
  ctx.fillText('RÉPONSE', PAD + 40, y + blockPadY + 24)
  ctx.fillStyle = '#FFFFFF'; ctx.font = `600 ${aSize}px ${FONT}`
  a.forEach((l, i) => ctx.fillText(l, PAD + 40, y + blockPadY + label + aSize * 0.85 + i * aSize * lh))

  // pied
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = `500 32px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText(`Carte de révision · ${memo} sur Memoa`, W / 2, H - 70)
  ctx.textAlign = 'left'

  return new Promise<Blob>((ok, ko) => cv.toBlob((b) => (b ? ok(b) : ko(new Error('Impossible de créer l’image.'))), 'image/png'))
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** Partage direct (WhatsApp, etc.) si le téléphone le permet ; sinon l'image est enregistrée. Renvoie « shared » ou « saved ». */
export async function shareReviewCard(blob: Blob, text: string): Promise<'shared' | 'saved'> {
  const file = new File([blob], 'carte-memoa.png', { type: 'image/png' })
  if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], text })
    return 'shared'
  }
  downloadBlob(blob, 'carte-memoa.png')
  return 'saved'
}
