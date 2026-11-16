// Blocs des éditeurs : tableaux, graphiques, formes, diagrammes. Tout reste du TEXTE dans la note (rien à migrer, marche hors ligne) :
//  • Tableau   → lignes `| a | b |` (avec une ligne `|---|---|` après l'en-tête). Le PDF et l'IA les lisent déjà.
//  • Autres    → UNE ligne lisible : `[[graphique:barres|Titre|A=3;B=5]]`, `[[forme:ovale|Texte|#0b5d54]]`,
//                `[[diagramme:etapes|Étape 1;Étape 2;Étape 3]]`, `[[diagramme:boites|Centre;Idée A;Idée B]]`.
// Ce fichier est pur (aucune dépendance) : l'écran (SVG) et le PDF (jsPDF) dessinent la même « scène ».

export type ChartKind = 'barres' | 'courbe' | 'camembert'
export type ShapeKind = 'rectangle' | 'ovale' | 'losange' | 'etoile'
export type DiagramKind = 'etapes' | 'boites'

export type Fig =
  | { t: 'chart'; kind: ChartKind; title: string; items: { label: string; value: number }[] }
  | { t: 'shape'; kind: ShapeKind; text: string; color: string }
  | { t: 'diagram'; kind: DiagramKind; items: string[] }

export const CHART_KINDS: { id: ChartKind; label: string }[] = [{ id: 'barres', label: 'Barres' }, { id: 'courbe', label: 'Courbe' }, { id: 'camembert', label: 'Camembert' }]
export const SHAPE_KINDS: { id: ShapeKind; label: string }[] = [{ id: 'rectangle', label: 'Rectangle' }, { id: 'ovale', label: 'Ovale' }, { id: 'losange', label: 'Losange' }, { id: 'etoile', label: 'Étoile' }]
export const DIAGRAM_KINDS: { id: DiagramKind; label: string; help: string }[] = [
  { id: 'etapes', label: 'Étapes', help: 'Des étapes qui se suivent' },
  { id: 'boites', label: 'Boîtes reliées', help: 'Une idée centrale reliée à d’autres' }
]
export const PALETTE = ['#0b5d54', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#475569']
export const PALETTE_NAMES = ['Vert', 'Bleu', 'Orange', 'Rouge', 'Violet', 'Gris']

export const MAX_ITEMS = 12
export const MAX_COLS = 8
export const MAX_ROWS = 30

// ------------------------------------------------------------------ lignes de figure

const FIG_RE = /^\s*\[\[(graphique|forme|diagramme):([^|\]]+)\|(.*)\]\]\s*$/
const safe = (s: string) => s.replace(/[|;=\[\]\n\r]/g, ' ').replace(/\s+/g, ' ').trim()
const safeCell = (s: string) => s.replace(/[|\n\r]/g, '/').replace(/\s+/g, ' ').trim()

export const isFigLine = (l: string) => FIG_RE.test(l)
export const isTableLine = (l: string) => /^\s*\|.*\|\s*$/.test(l)
const SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

export function figToLine(f: Fig): string {
  if (f.t === 'chart') return `[[graphique:${f.kind}|${safe(f.title)}|${f.items.map((i) => `${safe(i.label) || '-'}=${Number.isFinite(i.value) ? i.value : 0}`).join(';')}]]`
  if (f.t === 'shape') return `[[forme:${f.kind}|${safe(f.text)}|${/^#[0-9a-fA-F]{6}$/.test(f.color) ? f.color : PALETTE[0]}]]`
  return `[[diagramme:${f.kind}|${f.items.map(safe).filter(Boolean).join(';')}]]`
}

export function lineToFig(line: string): Fig | null {
  const m = FIG_RE.exec(line)
  if (!m) return null
  const [, type, kind, rest] = m
  if (type === 'graphique') {
    if (!['barres', 'courbe', 'camembert'].includes(kind)) return null
    const i = rest.indexOf('|')
    const title = i >= 0 ? rest.slice(0, i) : ''
    const data = i >= 0 ? rest.slice(i + 1) : rest
    const items = data.split(';').map((p) => {
      const k = p.lastIndexOf('=')
      return { label: (k >= 0 ? p.slice(0, k) : p).trim(), value: k >= 0 ? Number(p.slice(k + 1).replace(',', '.')) : 0 }
    }).filter((x) => x.label || x.value).map((x) => ({ ...x, value: Number.isFinite(x.value) ? x.value : 0 }))
    return items.length ? { t: 'chart', kind: kind as ChartKind, title, items: items.slice(0, MAX_ITEMS) } : null
  }
  if (type === 'forme') {
    if (!['rectangle', 'ovale', 'losange', 'etoile'].includes(kind)) return null
    const i = rest.lastIndexOf('|')
    const text = i >= 0 ? rest.slice(0, i) : rest
    const color = i >= 0 && /^#[0-9a-fA-F]{6}$/.test(rest.slice(i + 1).trim()) ? rest.slice(i + 1).trim() : PALETTE[0]
    return { t: 'shape', kind: kind as ShapeKind, text: text.trim(), color }
  }
  if (!['etapes', 'boites'].includes(kind)) return null
  const items = rest.split(';').map((s) => s.trim()).filter(Boolean).slice(0, MAX_ITEMS)
  return items.length ? { t: 'diagram', kind: kind as DiagramKind, items } : null
}

// ------------------------------------------------------------------ tableaux

export interface Table { rows: string[][]; header: boolean }

export function tableToLines(t: Table): string[] {
  const cols = Math.max(1, ...t.rows.map((r) => r.length))
  const row = (r: string[]) => '| ' + Array.from({ length: cols }, (_, c) => safeCell(r[c] ?? '')).join(' | ') + ' |'
  const out = t.rows.map(row)
  if (t.header && out.length) out.splice(1, 0, '|' + Array.from({ length: cols }, () => ' --- ').join('|') + '|')
  return out
}

export function linesToTable(lines: string[]): Table {
  const rows: string[][] = []
  let header = false
  for (const l of lines) {
    if (SEP.test(l.trim())) { if (rows.length === 1) header = true; continue }
    rows.push(l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()))
  }
  const cols = Math.max(1, ...rows.map((r) => r.length))
  return { rows: rows.map((r) => Array.from({ length: cols }, (_, c) => r[c] ?? '')), header }
}

export function newTable(cols: number, rows: number, header: boolean): Table {
  const c = Math.max(1, Math.min(MAX_COLS, Math.floor(cols) || 1))
  const r = Math.max(1, Math.min(MAX_ROWS, Math.floor(rows) || 1))
  return { header, rows: Array.from({ length: r }, () => Array.from({ length: c }, () => '')) }
}

// ------------------------------------------------------------------ découpage d'une note

export type Segment =
  | { k: 'text'; lines: string[] }
  | { k: 'table'; lines: string[] }
  | { k: 'fig'; lines: string[]; fig: Fig | null }

/** Découpe la note en zones de texte et en blocs. `joinSegments(splitSegments(x)) === x` toujours. */
export function splitSegments(body: string): Segment[] {
  const lines = body.replace(/\r/g, '').split('\n')
  const out: Segment[] = []
  let i = 0
  while (i < lines.length) {
    const l = lines[i]
    if (isFigLine(l) && lineToFig(l)) { out.push({ k: 'fig', lines: [l], fig: lineToFig(l) }); i++; continue }
    if (isTableLine(l)) {
      let j = i
      while (j < lines.length && isTableLine(lines[j])) j++
      out.push({ k: 'table', lines: lines.slice(i, j) })
      i = j
      continue
    }
    let j = i
    while (j < lines.length && !(isTableLine(lines[j]) || (isFigLine(lines[j]) && lineToFig(lines[j])))) j++
    out.push({ k: 'text', lines: lines.slice(i, j) })
    i = j
  }
  return out
}

export const joinSegments = (s: Segment[]) => s.flatMap((x) => x.lines).join('\n')
export const hasBlocks = (body: string) => body.includes('[[') || body.includes('|') ? splitSegments(body).some((s) => s.k !== 'text') : false

/** Ajoute un bloc dans le texte, à la position du curseur de la zone `seg` (ou à la fin). Laisse toujours une ligne vide après pour continuer à écrire. */
export function insertBlock(body: string, blockLines: string[], at?: { seg: number; pos: number }): string {
  const segs = splitSegments(body)
  const ti = at && segs[at.seg]?.k === 'text' ? at.seg : -1
  if (ti >= 0) {
    const text = segs[ti].lines.join('\n')
    const pos = Math.max(0, Math.min(text.length, at!.pos))
    const before = text.slice(0, pos)
    const after = text.slice(pos)
    const bl = before ? before.split('\n') : []
    const al = after.startsWith('\n') ? after.slice(1).split('\n') : after.split('\n')
    const next = [...bl, ...blockLines, ...(al.length === 1 && al[0] === '' ? [''] : al)]
    return joinSegments(segs.map((s, k) => (k === ti ? ({ k: 'text', lines: next } as Segment) : s)))
  }
  const base = body.length && !body.endsWith('\n') ? body + '\n' : body
  return base + blockLines.join('\n') + '\n'
}

/** Remplace les lignes d'un bloc (numéro de zone `seg`) par d'autres lignes ; liste vide = supprime le bloc. */
export function replaceBlock(body: string, seg: number, lines: string[]): string {
  const segs = splitSegments(body)
  if (!segs[seg]) return body
  const flat = segs.flatMap((s, k) => (k === seg ? lines : s.lines))
  return flat.join('\n')
}

// ------------------------------------------------------------------ versions texte

function figText(f: Fig): string {
  if (f.t === 'chart') {
    const kind = f.kind === 'barres' ? 'en barres' : f.kind === 'courbe' ? 'en courbe' : 'en camembert'
    return `[Graphique ${kind}${f.title ? ' « ' + f.title + ' »' : ''} : ${f.items.map((i) => `${i.label} = ${i.value}`).join(' ; ')}]`
  }
  if (f.t === 'shape') return f.text ? `[Forme : ${f.text}]` : ''
  return f.kind === 'etapes' ? `[Schéma d'étapes : ${f.items.join(' → ')}]` : `[Schéma : ${f.items[0]} relié à ${f.items.slice(1).join(', ') || '(rien)'}]`
}

/** Version pour l'IA : les graphiques, formes et schémas deviennent une phrase ; les tableaux restent des tableaux texte. */
export function toAiText(body: string): string {
  if (!body.includes('[[')) return body
  return splitSegments(body).map((s) => (s.k === 'fig' ? (s.fig ? figText(s.fig) : '') : s.lines.join('\n'))).join('\n')
}

/** Version pour la lecture vocale : tableaux, graphiques, formes et schémas sont ignorés (rien de bizarre à entendre). */
export function toSpeechText(body: string): string {
  if (!body.includes('[[') && !body.includes('|')) return body
  return splitSegments(body).filter((s) => s.k === 'text').map((s) => s.lines.join('\n')).join('\n')
}

// ------------------------------------------------------------------ scène de dessin (écran SVG + PDF)

export type Prim =
  | { p: 'rect'; x: number; y: number; w: number; h: number; r: number; fill: string; stroke?: string }
  | { p: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill: string }
  | { p: 'poly'; pts: [number, number][]; fill: string }
  | { p: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; w: number }
  | { p: 'text'; x: number; y: number; s: string; size: number; anchor: 'start' | 'middle' | 'end'; color: string; bold?: boolean }

export interface Scene { w: number; h: number; prims: Prim[] }

/** Couleur du texte : « ink » = couleur normale du thème (écran) ou noir (PDF). */
export const INK = 'ink'
const MUTED = '#6b7280'
const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 }
const onColor = (hex: string) => (lum(hex) > 0.62 ? '#111827' : '#ffffff')
const cw = (size: number) => size * 0.55

export function wrapText(s: string, maxW: number, size: number, maxLines = 4): string[] {
  const per = Math.max(3, Math.floor(maxW / cw(size)))
  const words = s.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (let w of words) {
    while (w.length > per) { if (cur) { lines.push(cur); cur = '' } lines.push(w.slice(0, per - 1) + '-'); w = w.slice(per - 1) }
    if (cur && (cur + ' ' + w).length > per) { lines.push(cur); cur = w } else cur = cur ? cur + ' ' + w : w
  }
  if (cur) lines.push(cur)
  if (lines.length > maxLines) { const k = lines.slice(0, maxLines); k[maxLines - 1] = k[maxLines - 1].replace(/.{0,2}$/, '') + '…'; return k }
  return lines.length ? lines : ['']
}

function centered(prims: Prim[], lines: string[], cx: number, cy: number, size: number, color: string, bold = false) {
  const lh = size * 1.2
  const top = cy - (lines.length * lh) / 2 + lh * 0.78
  lines.forEach((s, i) => prims.push({ p: 'text', x: cx, y: top + i * lh, s, size, anchor: 'middle', color, bold }))
}

const nice = (v: number) => (Math.abs(v) >= 1000 ? Math.round(v).toString() : Number(v.toFixed(2)).toString())

export function figScene(f: Fig, W = 300): Scene {
  const prims: Prim[] = []
  if (f.t === 'chart') {
    const items = f.items
    const titleH = f.title ? 26 : 8
    if (f.title) prims.push({ p: 'text', x: W / 2, y: 18, s: f.title, size: 13, anchor: 'middle', color: INK, bold: true })
    if (f.kind === 'camembert') {
      const total = items.reduce((a, i) => a + Math.max(0, i.value), 0)
      const R = 62, cx = 78, cy = titleH + R + 6
      const H = Math.max(cy + R + 10, titleH + items.length * 20 + 26)
      if (total <= 0) { prims.push({ p: 'text', x: W / 2, y: cy, s: 'Aucune valeur', size: 12, anchor: 'middle', color: MUTED }); return { w: W, h: H, prims } }
      let a0 = -Math.PI / 2
      const nonZero = items.filter((i) => i.value > 0)
      items.forEach((it, k) => {
        if (it.value <= 0) return
        const col = PALETTE[k % PALETTE.length]
        if (nonZero.length === 1) prims.push({ p: 'ellipse', cx, cy, rx: R, ry: R, fill: col })
        else {
          const a1 = a0 + (it.value / total) * Math.PI * 2
          const n = Math.max(2, Math.ceil((a1 - a0) / 0.12))
          const pts: [number, number][] = [[cx, cy]]
          for (let s = 0; s <= n; s++) { const a = a0 + ((a1 - a0) * s) / n; pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]) }
          prims.push({ p: 'poly', pts, fill: col })
          a0 = a1
        }
      })
      items.forEach((it, k) => {
        const y = titleH + 16 + k * 20
        prims.push({ p: 'rect', x: 156, y: y - 8, w: 10, h: 10, r: 2, fill: PALETTE[k % PALETTE.length] })
        const pct = it.value > 0 ? Math.round((it.value / total) * 100) : 0
        prims.push({ p: 'text', x: 172, y, s: wrapText(`${it.label} (${pct} %)`, W - 176, 11, 1)[0], size: 11, anchor: 'start', color: INK })
      })
      return { w: W, h: H, prims }
    }
    // barres et courbe
    const H = 190
    const x0 = 34, x1 = W - 10, y0 = titleH + 6, y1 = H - 40
    // Axe avec des graduations « rondes » (1, 2, 5, 10…) : 0 · 5 · 10 · 15 plutôt que 0 · 3,75 · 7,5
    const rawMax = Math.max(1, ...items.map((i) => i.value))
    const rawMin = Math.min(0, ...items.map((i) => i.value))
    const rough = (rawMax - rawMin) / 4
    const pow = Math.pow(10, Math.floor(Math.log10(rough)))
    const step = ([1, 2, 2.5, 5, 10].find((k) => k * pow >= rough) ?? 10) * pow
    const max = Math.ceil(rawMax / step - 1e-9) * step
    const min = Math.floor(rawMin / step + 1e-9) * step
    const span = max - min || 1
    const ticks = Math.round(span / step)
    const yv = (v: number) => y1 - ((v - min) / span) * (y1 - y0)
    for (let g = 0; g <= ticks; g++) {
      const v = min + step * g, y = yv(v)
      prims.push({ p: 'line', x1: x0, y1: y, x2: x1, y2: y, color: '#d1d5db', w: 0.6 })
      prims.push({ p: 'text', x: x0 - 4, y: y + 3.5, s: nice(v), size: 9, anchor: 'end', color: MUTED })
    }
    const slot = (x1 - x0) / items.length
    const pts: [number, number][] = items.map((it, k) => [x0 + slot * (k + 0.5), yv(it.value)])
    items.forEach((it, k) => {
      const cx = x0 + slot * (k + 0.5)
      if (f.kind === 'barres') {
        const bw = Math.min(40, slot * 0.62)
        const top = Math.min(yv(it.value), yv(0)), hh = Math.abs(yv(it.value) - yv(0))
        prims.push({ p: 'rect', x: cx - bw / 2, y: top, w: bw, h: Math.max(0.5, hh), r: 2, fill: PALETTE[0] })
        prims.push({ p: 'text', x: cx, y: top - 3, s: nice(it.value), size: 9, anchor: 'middle', color: INK })
      } else prims.push({ p: 'ellipse', cx: pts[k][0], cy: pts[k][1], rx: 3, ry: 3, fill: PALETTE[0] })
      const per = Math.max(3, Math.floor(slot / cw(9)))
      const lab = it.label.length > per ? it.label.slice(0, Math.max(1, per - 1)) + '…' : it.label
      prims.push({ p: 'text', x: cx, y: y1 + 14, s: lab, size: 9, anchor: 'middle', color: INK })
    })
    if (f.kind === 'courbe') for (let k = 0; k < pts.length - 1; k++) prims.push({ p: 'line', x1: pts[k][0], y1: pts[k][1], x2: pts[k + 1][0], y2: pts[k + 1][1], color: PALETTE[0], w: 2 })
    return { w: W, h: H, prims }
  }

  if (f.t === 'shape') {
    const H = 110, bw = Math.min(W - 20, 200), bh = 80, cx = W / 2, cy = H / 2
    const fill = f.color, tc = onColor(fill)
    if (f.kind === 'rectangle') prims.push({ p: 'rect', x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh, r: 10, fill })
    else if (f.kind === 'ovale') prims.push({ p: 'ellipse', cx, cy, rx: bw / 2, ry: bh / 2, fill })
    else if (f.kind === 'losange') prims.push({ p: 'poly', pts: [[cx, cy - bh / 2 - 6], [cx + bw / 2 - 6, cy], [cx, cy + bh / 2 + 6], [cx - bw / 2 + 6, cy]], fill })
    else {
      const pts: [number, number][] = []
      for (let k = 0; k < 10; k++) { const r = k % 2 ? 22 : 50, a = -Math.PI / 2 + (k * Math.PI) / 5; pts.push([cx + r * Math.cos(a), cy + 4 + r * Math.sin(a)]) }
      prims.push({ p: 'poly', pts, fill })
    }
    if (f.text) {
      const inner = f.kind === 'etoile' ? 60 : f.kind === 'losange' ? bw * 0.5 : bw - 24
      centered(prims, wrapText(f.text, inner, 13, 3), cx, f.kind === 'etoile' ? cy + 6 : cy, 13, f.kind === 'etoile' ? onColor(fill) : tc, true)
    }
    return { w: W, h: H, prims }
  }

  // diagrammes
  const items = f.items
  const BH = 40
  if (f.kind === 'etapes') {
    const bw = Math.min(W - 40, 220), gap = 22
    items.forEach((s, k) => {
      const y = 6 + k * (BH + gap), x = (W - bw) / 2
      prims.push({ p: 'rect', x, y, w: bw, h: BH, r: 8, fill: PALETTE[0] })
      centered(prims, wrapText(s, bw - 16, 12, 2), W / 2, y + BH / 2, 12, '#ffffff', true)
      if (k < items.length - 1) {
        const ay = y + BH
        prims.push({ p: 'line', x1: W / 2, y1: ay, x2: W / 2, y2: ay + gap - 4, color: '#6b7280', w: 1.5 })
        prims.push({ p: 'poly', pts: [[W / 2 - 5, ay + gap - 9], [W / 2 + 5, ay + gap - 9], [W / 2, ay + gap - 1]], fill: '#6b7280' })
      }
    })
    return { w: W, h: 12 + items.length * BH + (items.length - 1) * gap, prims }
  }
  // boîtes reliées : la première au centre-haut, les autres en dessous, reliées par des traits
  const [root, ...kids] = items
  const rw = Math.min(W - 40, 170)
  prims.push({ p: 'rect', x: (W - rw) / 2, y: 6, w: rw, h: BH, r: 8, fill: PALETTE[0] })
  centered(prims, wrapText(root, rw - 16, 12, 2), W / 2, 6 + BH / 2, 12, '#ffffff', true)
  if (!kids.length) return { w: W, h: BH + 12, prims }
  const perRow = Math.min(3, kids.length)
  const kw = (W - 16 - (perRow - 1) * 8) / perRow
  const rowsN = Math.ceil(kids.length / perRow)
  const rowY = (r: number) => 6 + BH + 30 + r * (BH + 28)
  const lastBus = rowY(rowsN - 1) - 14
  const LC = '#6b7280'
  prims.push({ p: 'line', x1: W / 2, y1: 6 + BH, x2: W / 2, y2: lastBus, color: LC, w: 1.5 })
  for (let r = 0; r < rowsN; r++) {
    const inRow = Math.min(perRow, kids.length - r * perRow)
    const rowW = inRow * kw + (inRow - 1) * 8
    const bus = rowY(r) - 14
    const left = (W - rowW) / 2 + kw / 2, right = (W - rowW) / 2 + rowW - kw / 2
    if (right > left) prims.push({ p: 'line', x1: left, y1: bus, x2: right, y2: bus, color: LC, w: 1.5 })
  }
  kids.forEach((s, k) => {
    const r = Math.floor(k / perRow), c = k % perRow
    const inRow = Math.min(perRow, kids.length - r * perRow)
    const rowW = inRow * kw + (inRow - 1) * 8
    const x = (W - rowW) / 2 + c * (kw + 8), y = rowY(r), cxk = x + kw / 2
    prims.push({ p: 'line', x1: cxk, y1: y - 14, x2: cxk, y2: y, color: LC, w: 1.5 })
    prims.push({ p: 'rect', x, y, w: kw, h: BH, r: 8, fill: PALETTE[(k + 1) % PALETTE.length] })
    centered(prims, wrapText(s, kw - 10, 11, 2), cxk, y + BH / 2, 11, '#ffffff', true)
  })
  return { w: W, h: rowY(rowsN - 1) + BH + 8, prims }
}

// ------------------------------------------------------------------ protéger les blocs pendant une mise en forme par l'IA

/** Remplace chaque graphique, forme, schéma ou tableau par un repère `§BLOC1§` avant d'envoyer le texte à l'IA.
 *  `restore(reply)` remet les blocs à leur place ; il renvoie null si l'IA a perdu un repère (on garde alors le texte d'origine). */
export function protectBlocks(text: string): { text: string; count: number; restore: (reply: string) => string | null } {
  const segs = splitSegments(text)
  const saved: string[][] = []
  const masked = segs.map((s) => {
    if (s.k === 'text') return s.lines.join('\n')
    saved.push(s.lines)
    return `§BLOC${saved.length}§`
  }).join('\n')
  return {
    text: masked,
    count: saved.length,
    restore: (reply) => {
      let out = reply
      for (let i = 0; i < saved.length; i++) {
        const tag = `§BLOC${i + 1}§`
        if (!out.includes(tag)) return null
        out = out.replace(new RegExp(`^[ \\t]*[*_#>-]*\\s*${tag}\\s*[*_]*[ \\t]*$`, 'm'), saved[i].join('\n'))
        if (out.includes(tag)) out = out.replace(tag, saved[i].join('\n'))
      }
      return out
    }
  }
}
