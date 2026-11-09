import { useState } from 'react'
import { ANIMALS } from '../data/animals'

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

/** Fabrique l'image de la carte sur le téléphone (aucun coût serveur). */
async function makeCard(fact: string, memoName: string, animalId: string | null): Promise<Blob> {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  if (!g) throw new Error("L'image n'a pas pu être créée sur ce navigateur.")
  const font = 'Sora, system-ui, -apple-system, Segoe UI, sans-serif'

  g.fillStyle = '#0B5D54'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#0E1A2B'
  g.globalAlpha = 0.18
  g.beginPath()
  g.arc(W, 0, 520, 0, Math.PI * 2)
  g.fill()
  g.globalAlpha = 1

  g.textAlign = 'center'
  g.fillStyle = '#3CCFB4'
  g.font = '700 40px ' + font
  g.fillText('LE SAVAIS-TU ?', W / 2, 130)

  // Memo dans un rond clair
  const cy = 330
  g.fillStyle = '#EEF2F0'
  g.beginPath()
  g.arc(W / 2, cy, 130, 0, Math.PI * 2)
  g.fill()
  const a = ANIMALS.find((x) => x.id === animalId) ?? ANIMALS[0]
  if (a.svg) {
    try {
      const img = await loadSvg(a.svg)
      g.drawImage(img, W / 2 - 100, cy - 100, 200, 200)
    } catch { /* le rond reste vide si l'image ne se charge pas */ }
  } else if (a.emoji) {
    g.font = '150px ' + font
    g.textBaseline = 'middle'
    g.fillText(a.emoji, W / 2, cy + 8)
    g.textBaseline = 'alphabetic'
  }

  g.fillStyle = '#FFFFFF'
  g.font = '700 46px ' + font
  g.fillText(memoName + ' te dit :', W / 2, 560)

  g.font = '600 58px ' + font
  const lines = wrap(g, fact, W - 200)
  const lh = 78
  let y = 680
  for (const l of lines.slice(0, 10)) { g.fillText(l, W / 2, y); y += lh }

  g.fillStyle = '#3CCFB4'
  g.font = '700 40px ' + font
  g.fillText('memoa', W / 2, H - 110)
  g.fillStyle = '#EEF2F0'
  g.font = '400 30px ' + font
  g.fillText('Étudiez plus intelligemment', W / 2, H - 62)

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
    <section className="card" aria-label="Le savais-tu ?">
      <span className="label-mono">Le savais-tu ?</span>
      <span style={{ lineHeight: 1.45 }}><b>{memoName} :</b> {fact}</span>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn ghost small" onClick={() => void save()} disabled={busy}>Enregistrer</button>
        <button type="button" className="btn small" onClick={() => void share()} disabled={busy}>Partager</button>
      </div>
      {err && <span className="muted" role="alert">{err}</span>}
    </section>
  )
}
