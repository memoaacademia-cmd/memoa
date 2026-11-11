import { useEffect, useState } from 'react'
import { ANIMALS } from '../data/animals'
import type { Fact } from '../data/facts'
import { useAuth } from '../lib/auth'
import { dailyIndex, loadFacts, otherIndex } from '../lib/facts'
import { canInvite, enablePush, noteInvited } from '../lib/push'
import { Icon, MemoAvatar } from './ui'

const W = 1080
const MIN_H = 1350
const MAX_H = 2800
const FONT = 'Sora, system-ui, -apple-system, Segoe UI, sans-serif'

/* ------------------------------------------------------------------ */
/* Image partageable : fabriquée sur le téléphone, la carte s'agrandit si le texte est long. */
/* ------------------------------------------------------------------ */

interface Block { text: string; scale: number; weight: number; color: string; gap: number; upper?: boolean }

function wrap(g: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? line + ' ' + word : word
      if (g.measureText(test).width > maxWidth && line) { lines.push(line); line = word } else line = test
    }
    if (line) lines.push(line)
  }
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

/** Ce que la carte montre : l'énigme garde sa réponse cachée tant que l'étudiant ne l'a pas révélée (c'est le crochet pour inviter les amis). */
function blocksFor(f: Fact, revealed: boolean): Block[] {
  const b: Block[] = [{ text: f.c, scale: 0.5, weight: 800, color: '#0B5D54', gap: 0, upper: true }]
  b.push({ text: f.t, scale: 1.0, weight: 800, color: '#0E1A2B', gap: 14 })
  if (f.s) b.push({ text: f.s, scale: 0.6, weight: 500, color: '#52606D', gap: 8 })
  b.push({ text: f.x, scale: 0.86, weight: 600, color: '#0E1A2B', gap: 22 })
  if (f.k === 'enigme') {
    if (f.q) b.push({ text: f.q, scale: 0.78, weight: 700, color: '#0B5D54', gap: 20 })
    if (revealed) {
      b.push({ text: 'Réponse : ' + (f.a ?? ''), scale: 0.84, weight: 700, color: '#0B5D54', gap: 22 })
      if (f.n) b.push({ text: f.n, scale: 0.72, weight: 500, color: '#52606D', gap: 14 })
    } else {
      b.push({ text: 'La réponse t’attend dans Memoa.', scale: 0.72, weight: 700, color: '#B26B00', gap: 22 })
    }
  } else {
    if (f.n) b.push({ text: (f.k === 'humour' ? '' : 'À retenir : ') + f.n, scale: 0.78, weight: 700, color: '#0B5D54', gap: 24 })
    else if (f.q) b.push({ text: f.q, scale: 0.78, weight: 700, color: '#0B5D54', gap: 24 })
  }
  return b
}

interface Laid { size: number; rows: Array<{ text: string; font: string; color: string; y: number; lh: number }>; height: number }

/** Choisit la plus grande taille de police qui tient ; si le texte est vraiment long, la taille baisse puis la carte s'agrandit. */
function layout(g: CanvasRenderingContext2D, blocks: Block[]): Laid {
  const inner = W - 140 - 120 // largeur de la bulle moins les marges intérieures
  const padTop = 64
  const padBottom = 64
  let result: Laid | null = null
  for (const size of [52, 48, 44, 40, 37, 34, 31, 28]) {
    const rows: Laid['rows'] = []
    let y = padTop
    blocks.forEach((bl, i) => {
      const fs = Math.round(size * bl.scale)
      const font = `${bl.weight} ${fs}px ${FONT}`
      g.font = font
      const lh = Math.round(fs * 1.34)
      const lines = wrap(g, bl.upper ? bl.text.toUpperCase() : bl.text, inner)
      if (i > 0) y += bl.gap
      for (const l of lines) { rows.push({ text: l, font, color: bl.color, y: y + fs, lh }); y += lh }
    })
    result = { size, rows, height: y + padBottom }
    if (result.height <= 880) break // tient dans le format standard : on garde cette taille
  }
  return result as Laid
}

async function makeCard(f: Fact, revealed: boolean, memoName: string, animalId: string | null): Promise<Blob> {
  const scratch = document.createElement('canvas').getContext('2d')
  if (!scratch) throw new Error("L'image n'a pas pu être créée sur ce navigateur.")
  const lay = layout(scratch, blocksFor(f, revealed))
  const bh = Math.max(380, lay.height)
  const topY = 240
  const needed = topY + bh + 90 + 130 + 105 + 190 // bulle + queue + Memo + pied de page
  const H = Math.min(MAX_H, Math.max(MIN_H, needed))
  const extra = H === MIN_H ? Math.max(0, (MIN_H - needed) / 2) : 0
  const by = topY + Math.round(extra)

  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  if (!g) throw new Error("L'image n'a pas pu être créée sur ce navigateur.")

  const bg = g.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#0B5D54')
  bg.addColorStop(0.55, '#14907F')
  bg.addColorStop(1, '#3CCFB4')
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)
  const dots: Array<[number, number, number, string, number]> = [
    [W - 40, 120, 260, '#F2A33A', 0.9], [60, H - 170, 200, '#F2A33A', 0.55], [W - 120, H - 230, 150, '#EEF2F0', 0.25],
    [90, 260, 90, '#EEF2F0', 0.22], [W - 220, Math.round(H * 0.4), 60, '#F2A33A', 0.5], [300, H - 60, 70, '#0E1A2B', 0.25]
  ]
  for (const [x, y, r, col, a] of dots) {
    g.globalAlpha = a
    g.fillStyle = col
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1

  g.textAlign = 'center'
  g.font = '800 46px ' + FONT
  const label = 'LE SAVAIS-TU ?'
  const lw = g.measureText(label).width + 90
  g.fillStyle = '#F2A33A'
  roundRect(g, W / 2 - lw / 2, by - 170, lw, 92, 46)
  g.fill()
  g.fillStyle = '#0E1A2B'
  g.fillText(label, W / 2, by - 107)

  const bx = 70
  const bw = W - 140
  g.shadowColor = 'rgba(14,26,43,0.35)'
  g.shadowBlur = 40
  g.shadowOffsetY = 16
  g.fillStyle = '#FFFFFF'
  roundRect(g, bx, by, bw, bh, 56)
  g.fill()
  g.beginPath()
  g.moveTo(bx + 150, by + bh - 4)
  g.lineTo(bx + 250, by + bh - 4)
  g.lineTo(bx + 170, by + bh + 90)
  g.closePath()
  g.fill()
  g.shadowColor = 'transparent'
  g.shadowBlur = 0
  g.shadowOffsetY = 0

  // Texte de la bulle, aligné à gauche, centré verticalement si la bulle est plus haute que le texte
  g.textAlign = 'left'
  const shift = Math.max(0, (bh - lay.height) / 2)
  for (const r of lay.rows) {
    g.font = r.font
    g.fillStyle = r.color
    g.fillText(r.text, bx + 60, by + shift + r.y)
  }

  const my = by + bh + 90 + 130
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
    g.font = '120px ' + FONT
    g.textBaseline = 'middle'
    g.textAlign = 'center'
    g.fillText(a.emoji, mx, my + 6)
    g.textBaseline = 'alphabetic'
  }
  g.textAlign = 'left'
  g.fillStyle = '#FFFFFF'
  g.font = '800 52px ' + FONT
  g.fillText(memoName, mx + 140, my - 6)
  g.fillStyle = '#EEF2F0'
  g.font = '500 32px ' + FONT
  g.fillText('ton Memo sur Memoa', mx + 140, my + 44)

  g.textAlign = 'center'
  g.fillStyle = '#FFFFFF'
  g.font = '800 44px ' + FONT
  g.fillText('memoa', W / 2, H - 92)
  g.fillStyle = '#EEF2F0'
  g.font = '500 28px ' + FONT
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

/* ------------------------------------------------------------------ */
/* Carte à l'écran : la hauteur suit le texte, rien ne sort jamais du cadre. */
/* ------------------------------------------------------------------ */

const safe = { overflowWrap: 'anywhere' as const, wordBreak: 'break-word' as const, minWidth: 0, maxWidth: '100%' }

export default function FactCard({ memoName, animal }: { memoName: string; animal: string | null }) {
  const { user } = useAuth()
  const [facts, setFacts] = useState<Fact[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [hint, setHint] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [liked, setLiked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [invite, setInvite] = useState<'none' | 'show' | 'done'>('none')
  const [inviteMsg, setInviteMsg] = useState<string | null>(null)
  const [engaged, setEngaged] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    loadFacts().then((all) => { if (alive) { setFacts(all); setIdx(dailyIndex(all.length)) } }).catch(() => { if (alive) setErr('La carte du jour ne se charge pas. Réessaie dans un instant.') })
    return () => { alive = false }
  }, [])

  // Le bon moment pour proposer les notifications : juste après le premier geste positif sur une carte, jamais avant.
  function markEngaged() {
    if (engaged) return
    setEngaged(true)
    if (canInvite()) { noteInvited(); setInvite('show') }
  }

  const fact = facts ? facts[idx] : null
  if (!fact) {
    return <section className="card" aria-label="Le savais-tu ?" style={{ background: 'linear-gradient(135deg, #0B5D54, #3CCFB4)', color: '#fff', border: 'none' }}><span style={{ alignSelf: 'flex-start', background: '#F2A33A', color: '#0E1A2B', fontWeight: 800, fontSize: 13, padding: '6px 12px', borderRadius: 999 }}>LE SAVAIS-TU ?</span>{err ? <span role="alert">{err}</span> : <span>Memo prépare ta carte…</span>}</section>
  }

  if (!open) {
    return (
      <button type="button" aria-expanded="false" aria-label={`Le savais-tu ? ${fact.t}. Touche pour dérouler.`} onClick={() => setOpen(true)} className="fact-fold">
        <span aria-hidden="true" className="fact-fold-bubble" />
        <span className="fact-fold-body">
          <span className="fact-fold-pill">LE SAVAIS-TU ?</span>
          <strong className="fact-fold-title">{fact.t}</strong>
        </span>
        <span aria-hidden="true" className="fact-fold-chev"><Icon name="chevdown" size={22} /></span>
      </button>
    )
  }

  const answerShown = fact.k === 'enigme' ? revealed : true

  function next() {
    if (!facts) return
    setIdx((i) => otherIndex(facts.length, i))
    setHint(false); setRevealed(false); setLiked(false); setErr(null)
    markEngaged()
  }
  async function save() {
    setBusy(true); setErr(null); markEngaged()
    try { download(await makeCard(fact as Fact, revealed, memoName, animal)) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  async function share() {
    setBusy(true); setErr(null); markEngaged()
    try {
      const blob = await makeCard(fact as Fact, revealed, memoName, animal)
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
  async function accept() {
    if (!user) return
    setBusy(true)
    const r = await enablePush(user.id)
    setBusy(false)
    if (r.ok) { setInvite('done'); setInviteMsg(`C'est noté : ${memoName} te glissera un « Savais-tu ? » de temps en temps. Tu peux l'arrêter dans Paramètres.`) } else { setInvite('done'); setInviteMsg(r.message) }
  }

  const note = fact.n
  return (
    <section className="card" aria-label="Le savais-tu ?" style={{ background: 'linear-gradient(135deg, #0B5D54, #3CCFB4)', color: '#fff', border: 'none', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ background: '#F2A33A', color: '#0E1A2B', fontWeight: 800, fontSize: 13, letterSpacing: 0.5, padding: '6px 12px', borderRadius: 999 }}>LE SAVAIS-TU ?</span>
        <button type="button" aria-expanded="true" aria-label="Replier la carte" onClick={() => setOpen(false)} style={{ width: 44, height: 44, borderRadius: '50%', border: 0, background: 'rgba(255,255,255,.16)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="chevup" size={22} /></button>
      </div>

      <div style={{ ...safe, background: '#fff', color: '#0E1A2B', borderRadius: 18, padding: '16px 16px 18px', lineHeight: 1.5, position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: '#0B5D54' }}>{fact.c}</span>
        <strong style={{ ...safe, fontSize: 17, lineHeight: 1.3 }}>{fact.t}</strong>
        {fact.s && <span style={{ ...safe, fontSize: 13, color: '#52606D' }}>{fact.s}</span>}
        <span style={{ ...safe, fontWeight: 500, fontSize: 15 }}>{fact.x}</span>

        {fact.k === 'enigme' && (
          <>
            {fact.q && <span style={{ ...safe, fontWeight: 700, fontSize: 14, color: '#0B5D54' }}>{fact.q}</span>}
            {fact.h && !revealed && (hint
              ? <span style={{ ...safe, fontSize: 14, color: '#52606D' }}>Indice : {fact.h}</span>
              : <button type="button" className="link" style={{ alignSelf: 'flex-start', color: '#0B5D54' }} onClick={() => { setHint(true); markEngaged() }}>Un indice ?</button>)}
            {!revealed
              ? <button type="button" className="btn small" style={{ alignSelf: 'flex-start' }} onClick={() => { setRevealed(true); markEngaged() }}>Voir la réponse</button>
              : <span style={{ ...safe, fontWeight: 700, fontSize: 15, color: '#0B5D54' }}>Réponse : {fact.a}</span>}
          </>
        )}
        {fact.k !== 'enigme' && answerShown && note && <span style={{ ...safe, fontWeight: 700, fontSize: 14, color: '#0B5D54' }}>{fact.k === 'humour' ? note : `À retenir : ${note}`}</span>}
        {fact.k !== 'enigme' && !note && fact.q && <span style={{ ...safe, fontWeight: 700, fontSize: 14, color: '#0B5D54' }}>{fact.q}</span>}
        {fact.k === 'enigme' && revealed && note && <span style={{ ...safe, fontSize: 13, color: '#52606D' }}>{note}</span>}
        <span aria-hidden="true" style={{ position: 'absolute', left: 28, bottom: -9, width: 18, height: 18, background: '#fff', transform: 'rotate(45deg)' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
        <span style={{ flex: 'none', width: 46, height: 46, borderRadius: '50%', background: '#EEF2F0', border: '3px solid #F2A33A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <MemoAvatar animal={animal} size={34} />
        </span>
        <strong style={safe}>{memoName}</strong>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn ghost small" aria-pressed={liked} onClick={() => { setLiked((v) => !v); markEngaged() }}>{liked ? '♥ J’aime' : '♡ J’aime'}</button>
        <button type="button" className="btn ghost small" onClick={next}>Encore une</button>
        <button type="button" className="btn ghost small" onClick={() => void save()} disabled={busy}>Enregistrer</button>
        <button type="button" className="btn amber small" onClick={() => void share()} disabled={busy}>Partager</button>
      </div>

      {invite === 'show' && (
        <div role="group" aria-label="Notifications" style={{ background: 'rgba(255,255,255,0.16)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <strong style={safe}>Ça te plaît ? {memoName} peut t’en glisser un chaque jour.</strong>
          <span style={{ ...safe, fontSize: 14 }}>Une petite notification sur ton téléphone, rien de plus. Tu pourras l’arrêter quand tu veux dans Paramètres.</span>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn amber small" onClick={() => void accept()} disabled={busy}>Oui, avec plaisir</button>
            <button type="button" className="btn ghost small" onClick={() => setInvite('done')}>Pas maintenant</button>
          </div>
        </div>
      )}
      {invite === 'done' && inviteMsg && <span role="status" style={safe}>{inviteMsg}</span>}
      {err && <span role="alert" style={safe}>{err}</span>}
    </section>
  )
}
