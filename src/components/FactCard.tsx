import { useState } from 'react'
import { ANIMALS } from '../data/animals'
import { MemoAvatar } from './ui'

const W = 1080
const H = 1350

function wrap(g: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (g.measureText(test).width > maxWidth && line) { lines.push(line); line = w } else line = test
  }
  if (line) lines.push(line)
  return lines
}

function loadSvg(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image du Memo impossible'))
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' + svg + '</svg>')
  })
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/** Fabrique l'image de la carte sur le téléphone (aucun coût serveur). */
async function makeCard(fact: string, memoName: string, animalId: string | null): Promise<Blob> {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  if (!g) throw new Error("L'image n'a pas pu être créée sur ce navigateur.")
  const font = 'Sora, system-ui, -apple-system, Segoe UI, sans-serif'

  // Fond coloré
  const bg = g.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#0B5D54')
  bg.addColorStop(0.55, '#14907F')
  bg.addColorStop(1, '#3CCFB4')
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)
  const dots: Array<[number, number, number, string, number]> = [
    [W - 40, 120, 260, '#F2A33A', 0.9], [60, 1180, 200, '#F2A33A', 0.55], [W - 120, 1120, 150, '#EEF2F0', 0.25],
    [90, 260, 90, '#EEF2F0', 0.22], [W - 220, 520, 60, '#F2A33A', 0.5], [300, 1290, 70, '#0E1A2B', 0.25]
  ]
  for (const [x, y, r, col, a] of dots) {
    g.globalAlpha = a
    g.fillStyle = col
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1

  // Titre en pastille
  g.textAlign = 'center'
  g.font = '800 46px ' + font
  const label = 'LE SAVAIS-TU ?'
  const lw = g.measureText(label).width + 90
  g.fillStyle = '#F2A33A'
  roundRect(g, W / 2 - lw / 2, 70, lw, 92, 46)
  g.fill()
  g.fillStyle = '#0E1A2B'
  g.fillText(label, W / 2, 133)

  // Texte de la bulle : la taille s'adapte à la longueur
  let size = 60
  let lines: string[] = []
  let lh = 0
  for (const sz of [60, 54, 48, 42, 36]) {
    size = sz
    g.font = '700 ' + sz + 'px ' + font
    lines = wrap(g, fact, W - 260)
    lh = Math.round(sz * 1.32)
    if (lines.length * lh + 130 <= 760) break
  }
  const bx = 70
  const bw = W - 140
  const by = 230
  const bh = Math.max(380, lines.length * lh + 130)
  g.shadowColor = 'rgba(14,26,43,0.35)'
  g.shadowBlur = 40
  g.shadowOffsetY = 16
  g.fillStyle = '#FFFFFF'
  roundRect(g, bx, by, bw, bh, 56)
  g.fill()
  // Queue de la bulle, vers Memo
  g.beginPath()
  g.moveTo(bx + 150, by + bh - 4)
  g.lineTo(bx + 250, by + bh - 4)
  g.lineTo(bx + 170, by + bh + 90)
  g.closePath()
  g.fill()
  g.shadowColor = 'transparent'
  g.shadowBlur = 0
  g.shadowOffsetY = 0

  g.fillStyle = '#0E1A2B'
  g.font = '700 ' + size + 'px ' + font
  let y = by + 75 + size
  for (const l of lines) { g.fillText(l, W / 2, y); y += lh }

  // Petit Memo (visage) sous la bulle, avec son nom
  const my = Math.min(by + bh + 210, H - 250)
  const mx = 220
  g.fillStyle = '#EEF2F0'
  g.beginPath()
  g.arc(mx, my, 105, 0, Math.PI * 2)
  g.fill()
  g.lineWidth = 10
  g.strokeStyle = '#F2A33A'
  g.stroke()
  const a = ANIMALS.find((x) => x.id === animalId) ?? ANIMALS[0]
  if (a.svg) {
    try {
      const img = await loadSvg(a.svg)
      g.drawImage(img, mx - 78, my - 78, 156, 156)
    } catch { /* le rond reste vide si l'image ne se charge pas */ }
  } else if (a.emoji) {
    g.font = '120px ' + font
    g.textBaseline = 'middle'
    g.fillText(a.emoji, mx, my + 6)
    g.textBaseline = 'alphabetic'
  }
  g.textAlign = 'left'
  g.fillStyle = '#FFFFFF'
  g.font = '800 52px ' + font
  g.fillText(memoName, mx + 140, my - 6)
  g.fillStyle = '#EEF2F0'
  g.font = '500 32px ' + font
  g.fillText('ton Memo sur Memoa', mx + 140, my + 44)

  // Pied
  g.textAlign = 'center'
  g.fillStyle = '#FFFFFF'
  g.font = '800 44px ' + font
  g.fillText('memoa', W / 2, H - 92)
  g.fillStyle = '#EEF2F0'
  g.font = '500 28px ' + font
  g.fillText('Étudiez plus intelligemment', W / 2, H - 48)

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("L'image n'a pas pu être créée."))), 'image/png'))
}

function download(blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'memoa-le-savais-tu.png'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export default function FactCard({ fact, memoName, animal }: { fact: string; memoName: string; animal: string | null }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setErr(null)
    try { download(await makeCard(fact, memoName, animal)) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  async function share() {
    setBusy(true)
    setErr(null)
    try {
      const blob = await makeCard(fact, memoName, animal)
      const file = new File([blob], 'memoa-le-savais-tu.png', { type: 'image/png' })
      if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: 'Le savais-tu ? — Memoa' })
      } else {
        download(blob)
        setErr("Le partage direct n'est pas possible ici : l'image a été enregistrée, tu peux la partager depuis ta galerie.")
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setErr((e as Error).message)
    } finally { setBusy(false) }
  }

  return (
    <section className="card" aria-label="Le savais-tu ?" style={{ background: 'linear-gradient(135deg, #0B5D54, #3CCFB4)', color: '#fff', border: 'none' }}>
      <span style={{ alignSelf: 'flex-start', background: '#F2A33A', color: '#0E1A2B', fontWeight: 800, fontSize: 13, letterSpacing: 0.5, padding: '6px 12px', borderRadius: 999 }}>LE SAVAIS-TU ?</span>
      <div style={{ background: '#fff', color: '#0E1A2B', borderRadius: 18, padding: '14px 16px', lineHeight: 1.45, fontWeight: 600, position: 'relative' }}>
        {fact}
        <span aria-hidden="true" style={{ position: 'absolute', left: 28, bottom: -9, width: 18, height: 18, background: '#fff', transform: 'rotate(45deg)' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
        <span style={{ flex: 'none', width: 46, height: 46, borderRadius: '50%', background: '#EEF2F0', border: '3px solid #F2A33A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <MemoAvatar animal={animal} size={34} />
        </span>
        <strong>{memoName}</strong>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn ghost small" onClick={() => void save()} disabled={busy}>Enregistrer</button>
        <button type="button" className="btn amber small" onClick={() => void share()} disabled={busy}>Partager</button>
      </div>
      {err && <span role="alert">{err}</span>}
    </section>
  )
}
