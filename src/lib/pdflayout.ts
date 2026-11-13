// Moteur de mise en page des PDF Memoa (sans dépendance : testable seul).
// Il transforme un texte en pages positionnées (mm), SANS dessiner. pdf.ts dessine ensuite ces pages avec jsPDF.
// La mesure du texte est fournie par l'appelant (jsPDF en production), donc le moteur compte les pages avec les vraies largeurs.

export const PAGE_W = 210
export const PAGE_H = 297
const PT = 0.3528 // 1 point en mm

/** Les polices PDF standard ne connaissent pas tous les caractères : on remplace ou on retire ceux qui poseraient problème. */
export function sanitize(s: string): string {
  return s
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/→/g, '->')
    .replace(/[  ]/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/(^|\s)\*(\S)/g, '$1$2')
    .replace(/(\S)\*(\s|$)/g, '$1$2')
    .replace(/`/g, '')
    .replace(/[^\n\x20-\x7EÀ-ÿ]/g, '')
}

export type Measure = (text: string, sizePt: number, bold: boolean) => number // largeur en mm

export type Block =
  | { t: 'title'; text: string }
  | { t: 'h'; level: 1 | 2 | 3; text: string }
  | { t: 'p'; text: string }
  | { t: 'li'; marker: string; text: string; level: number }
  | { t: 'table'; rows: string[][]; header: boolean }

export type Color = number | [number, number, number]
export type Item =
  | { k: 'text'; x: number; y: number; s: string; size: number; bold: boolean; color: Color; role: string; blk: number; i: number; n: number }
  | { k: 'rect'; x: number; y: number; w: number; h: number; fill: [number, number, number] }
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number; w: number; color: Color }
  | { k: 'dot'; x: number; y: number; r: number; color: Color }
export interface Page { items: Item[]; fill: number }

// ---------------------------------------------------------------- lecture du texte

const SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/
const isRow = (l: string) => /^\s*\|.*\|\s*$/.test(l)
const cells = (l: string) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
const noEnd = (s: string) => !/[.;,!?]$/.test(s.trim())

/** Découpe un texte (titres #, titres numérotés, listes, tableaux |a|b|) en blocs. `shift` descend les titres d'un niveau (notes de cours). */
export function parseBlocks(text: string, shift = 0, san: (s: string) => string = sanitize): Block[] {
  const lines = text.replace(/\r/g, '').split('\n')
  const out: Block[] = []
  const lvl = (n: number): 1 | 2 | 3 => Math.min(3, n + shift) as 1 | 2 | 3
  const nextText = (i: number) => { for (let j = i + 1; j < lines.length; j++) if (lines[j].trim()) return { j, l: lines[j].trim() }; return null }
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const t = raw.trim()
    if (!t) continue
    // tableau
    if (isRow(t)) {
      const rows: string[][] = []
      let header = false
      let j = i
      while (j < lines.length && isRow(lines[j].trim())) {
        if (SEP.test(lines[j].trim())) { if (rows.length === 1) header = true } else rows.push(cells(lines[j]).map((c) => san(c)))
        j++
      }
      if (rows.length) out.push({ t: 'table', rows, header })
      i = j - 1
      continue
    }
    let m: RegExpExecArray | null
    if ((m = /^(#{1,6})\s+(.*)$/.exec(t))) { out.push({ t: 'h', level: lvl(m[1].length >= 3 ? 3 : m[1].length), text: san(m[2]) }); continue }
    const nx = nextText(i)
    const adjacent = nx && nx.j === i + 1
    const prevNum = i > 0 && /^\s*(\d+)[.)]\s+\S/.test(lines[i - 1]) // numéro juste au-dessus : on est dans une liste
    if ((m = /^(\d+\.\d+\.\d+(?:\.\d+)*)[.)]?\s+(\S.*)$/.exec(t)) && t.length <= 110 && noEnd(t)) { out.push({ t: 'h', level: lvl(3), text: san(t) }); continue }
    if ((m = /^(\d+\.\d+)[.)]?\s+(\S.*)$/.exec(t)) && t.length <= 110 && noEnd(t)) { out.push({ t: 'h', level: lvl(2), text: san(t) }); continue }
    if (/^(partie|chapitre|section)\s+(\d+|[IVXLC]+)\b/i.test(t) && t.length <= 100 && noEnd(t)) { out.push({ t: 'h', level: lvl(1), text: san(t) }); continue }
    if ((m = /^(\d+|[IVXLC]+)[.)]\s+(\S.*)$/.exec(t)) && t.length <= 100 && noEnd(t)) {
      // « 1. Titre » est un titre, sauf si la ligne suivante est directement un autre numéro (liste)
      const asList = (adjacent && nx && /^(\d+|[IVXLC]+)[.)]\s+\S/.test(nx.l) && !/^\d+\.\d+/.test(nx.l)) || (prevNum && /^\d+[.)]/.test(t))
      if (!asList || /^[IVXLC]+[.)]/.test(t)) { out.push({ t: 'h', level: lvl(1), text: san(t) }); continue }
    }
    if (/^[A-H][.)]\s+\S/.test(t) && t.length <= 90 && noEnd(t)) { out.push({ t: 'h', level: lvl(2), text: san(t) }); continue }
    if (/^(introduction|conclusion|bibliographie|sommaire|résumé|resume|annexes?)\b.{0,50}$/i.test(t) && t.length <= 60 && noEnd(t)) { out.push({ t: 'h', level: lvl(1), text: san(t) }); continue }
    const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, '')
    if (letters.length >= 8 && t.length <= 80 && noEnd(t) && t.replace(/[^A-ZÀ-ÖØ-Þ]/g, '').length / letters.length >= 0.9) { out.push({ t: 'h', level: lvl(2), text: san(t) }); continue }
    const indent = Math.min(2, Math.floor((raw.length - raw.trimStart().length) / 2))
    if ((m = /^[-*•·▪●]\s+(.*)$/.exec(t))) { out.push({ t: 'li', marker: '•', text: san(m[1]), level: indent }); continue }
    if ((m = /^(\d+[.)]|[a-z][.)])\s+(.*)$/.exec(t))) { out.push({ t: 'li', marker: m[1], text: san(m[2]), level: indent }); continue }
    out.push({ t: 'p', text: san(t) })
  }
  return out.filter((b) => b.t === 'table' || ('text' in b && b.text.trim()))
}

// ---------------------------------------------------------------- paramètres de mise en page

export interface Params {
  t: number
  font: number // pt
  lead: number // interligne (multiple de la taille)
  para: number // espace entre paragraphes (mm)
  ml: number; mr: number; mt: number; mb: number
}

/** t = 0 : aéré ; t = 1 : compact. Limites de lisibilité : corps 11 à 14 pt, interligne 1,28 à 1,65, marges 18 à 26 mm. */
export function paramsAt(t: number): Params {
  const c = Math.max(0, Math.min(1, t))
  return {
    t: c,
    font: 14 - 3 * c,
    lead: 1.65 - 0.37 * c,
    para: 4.2 - 2 * c,
    ml: 26 - 8 * c, mr: 26 - 8 * c,
    mt: 25 - 5 * c, mb: 26 - 6 * c
  }
}
export const DEFAULT_T = 0.33

// ---------------------------------------------------------------- césure en lignes

function wrap(text: string, maxW: number, size: number, bold: boolean, m: Measure): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  const push = () => { if (cur) lines.push(cur); cur = '' }
  for (const w0 of words) {
    let w = w0
    // mot plus large que la ligne (adresse web…) : coupé caractère par caractère, il ne déborde jamais
    while (m(w, size, bold) > maxW && w.length > 1) {
      let k = w.length - 1
      while (k > 1 && m(w.slice(0, k) + '-', size, bold) > maxW) k--
      if (cur) push()
      lines.push(w.slice(0, k) + '-')
      w = w.slice(k)
    }
    const test = cur ? `${cur} ${w}` : w
    if (cur && m(test, size, bold) > maxW) { push(); cur = w } else cur = test
  }
  push()
  return lines.length ? lines : ['']
}

// ---------------------------------------------------------------- pagination

const INK = 30
const HEAD = 20
const ACCENT: [number, number, number] = [11, 93, 84]

export function paginate(blocks: Block[], p: Params, m0: Measure): Page[] {
  const cache = new Map<string, number>()
  const m: Measure = (s, z, b) => {
    const k = `${z}|${b ? 1 : 0}|${s}`
    let v = cache.get(k)
    if (v === undefined) { v = m0(s, z, b); cache.set(k, v) }
    return v
  }
  const top = p.mt
  const limit = PAGE_H - p.mb
  const textW = PAGE_W - p.ml - p.mr
  const lh = (size: number) => size * PT * p.lead
  const pages: Page[] = []
  let cur: Page = { items: [], fill: 0 }
  pages.push(cur)
  let y = top
  let blk = 0
  const newPage = () => { cur = { items: [], fill: 0 }; pages.push(cur); y = top }
  const atTop = () => y <= top + 0.01
  const spacing = 1 - 0.2 * p.t

  const hSize = (level: number) => (level === 1 ? p.font + 5 : level === 2 ? p.font + 2.5 : p.font + 0.8)
  const hBefore = (level: number) => (level === 1 ? 8 : level === 2 ? 5.5 : 4) * spacing
  const hAfter = (level: number) => (level === 1 ? 3.2 : level === 2 ? 2.2 : 1.6) * spacing

  /** Hauteur de lignes d'un bloc de texte (sans espace autour). */
  const linesOf = (b: Block): string[] => {
    if (b.t === 'title') return wrap(b.text, textW, p.font + 8, true, m)
    if (b.t === 'h') return wrap(b.text, textW, hSize(b.level), true, m)
    if (b.t === 'p') return wrap(b.text, textW, p.font, false, m)
    if (b.t === 'li') return wrap(b.text, textW - 7 - b.level * 6, p.font, false, m)
    return []
  }

  // Table : largeurs de colonnes et hauteurs de lignes
  const tableFont = () => Math.max(8.5, p.font - 2.2)
  const PADX = 2
  const PADY = 1.6
  const layoutTable = (b: Extract<Block, { t: 'table' }>) => {
    const cols = Math.max(...b.rows.map((r) => r.length))
    const size = tableFont()
    const nat = new Array(cols).fill(0)
    const min = new Array(cols).fill(0)
    b.rows.forEach((r, ri) => {
      for (let c = 0; c < cols; c++) {
        const s = r[c] ?? ''
        const bold = b.header && ri === 0
        nat[c] = Math.max(nat[c], m(s, size, bold) + 2 * PADX)
        const longest = s.split(/\s+/).reduce((a, w) => Math.max(a, m(w.length > 14 ? w.slice(0, 14) : w, size, bold)), 0)
        min[c] = Math.max(min[c], longest + 2 * PADX)
      }
    })
    for (let c = 0; c < cols; c++) min[c] = Math.max(min[c], Math.min(nat[c], 26)) // une cellule courte ne se coupe jamais
    let widths: number[]
    const sumNat = nat.reduce((a, v) => a + v, 0)
    if (sumNat <= textW) widths = nat.map((v) => (v * textW) / sumNat)
    else {
      const sumMin = min.reduce((a, v) => a + v, 0)
      if (sumMin >= textW) widths = new Array(cols).fill(textW / cols)
      else {
        const extra = textW - sumMin
        const want = nat.map((v, i) => Math.max(0, v - min[i]))
        const sw = want.reduce((a, v) => a + v, 0) || 1
        widths = min.map((v, i) => v + (extra * want[i]) / sw)
      }
    }
    const tlh = size * PT * 1.3
    const rows = b.rows.map((r, ri) => {
      const wr = widths.map((w, c) => wrap(r[c] ?? '', w - 2 * PADX, size, !!(b.header && ri === 0), m))
      const n = Math.max(...wr.map((x) => x.length))
      return { cells: wr, h: n * tlh + 2 * PADY }
    })
    return { widths, rows, size, tlh }
  }

  const putText = (s: string, x: number, top0: number, size: number, bold: boolean, color: Color, role: string, i: number, n: number, line = lh(size)) => {
    const baseline = top0 + (line - size * PT) / 2 + size * PT * 0.8
    cur.items.push({ k: 'text', x, y: baseline, s, size, bold, color, role, blk, i, n })
  }

  /** Hauteur minimale à garder avec un titre : ses lignes + les 2 premières lignes (ou la première rangée) de ce qui suit. */
  const keepNeed = (idx: number): number => {
    const b = blocks[idx]
    if (!b) return 0
    if (b.t === 'h' || b.t === 'title') {
      const size = b.t === 'h' ? hSize(b.level) : p.font + 8
      const own = linesOf(b).length * lh(size) + (b.t === 'h' ? hAfter(b.level) + hBefore(b.level) : 3)
      return own + keepNeed(idx + 1)
    }
    if (b.t === 'table') {
      const lt = layoutTable(b)
      return lt.rows[0].h + (lt.rows[1] ? lt.rows[1].h : 0)
    }
    const n = linesOf(b).length
    const own = (n <= 3 ? n : 2) * lh(p.font) // 2-3 lignes ne se coupent pas : il faut alors toutes les lignes
    return b.t !== 'li' && /:\s*$/.test(b.text) && n <= 2 ? n * lh(p.font) + p.para + keepNeed(idx + 1) : own
  }

  blocks.forEach((b, bi) => {
    blk++
    if (b.t === 'h' || b.t === 'title') {
      const level = b.t === 'h' ? b.level : 0
      const size = b.t === 'h' ? hSize(b.level) : p.font + 8
      const before = b.t === 'h' ? hBefore(b.level) : 11
      const lines = linesOf(b)
      const own = lines.length * lh(size) + (b.t === 'h' ? hAfter(b.level) : 3)
      const need = (atTop() ? 0 : before) + own + keepNeed(bi + 1)
      if (!atTop() && y + need > limit) newPage()
      if (!atTop()) y += before
      lines.forEach((l, i) => { putText(l, p.ml, y, size, true, HEAD, 'h', i, lines.length); y += lh(size) })
      if (b.t === 'title' || (b.t === 'h' && b.level === 1)) {
        cur.items.push({ k: 'line', x1: p.ml, y1: y + 0.6, x2: p.ml + 22, y2: y + 0.6, w: 0.7, color: ACCENT })
      }
      y += b.t === 'h' ? hAfter(b.level) : 3
      void level
      return
    }
    if (b.t === 'table') {
      const lt = layoutTable(b)
      const drawRow = (ri: number, head: boolean) => {
        const r = lt.rows[ri]
        let x = p.ml
        if (head) cur.items.push({ k: 'rect', x: p.ml, y, w: textW, h: r.h, fill: [226, 239, 236] })
        r.cells.forEach((lines, c) => {
          lines.forEach((l, i) => putText(l, x + PADX, y + PADY + i * lt.tlh, lt.size, head, head ? HEAD : INK, 'td', i, lines.length, lt.tlh))
          x += lt.widths[c]
        })
        const col: Color = 190
        cur.items.push({ k: 'line', x1: p.ml, y1: y + r.h, x2: p.ml + textW, y2: y + r.h, w: 0.2, color: col })
        if (ri === 0) cur.items.push({ k: 'line', x1: p.ml, y1: y, x2: p.ml + textW, y2: y, w: 0.2, color: col })
        y += r.h
      }
      const hasHead = b.header
      // la première rangée ne reste jamais seule avec l'en-tête tout en bas : on garde en-tête + 1 rangée
      const firstNeed = lt.rows[0].h + (lt.rows[1] ? lt.rows[1].h : 0)
      if (!atTop() && y + firstNeed > limit) newPage()
      lt.rows.forEach((r, ri) => {
        if (y + r.h > limit && !atTop()) {
          newPage()
          if (hasHead && ri > 0) drawRow(0, true) // l'en-tête du tableau est répété sur la page suivante
        }
        drawRow(ri, hasHead && ri === 0)
      })
      // trait vertical gauche et droit et séparateurs de colonnes seraient lourds : lignes horizontales seules, lisibles sur téléphone
      y += p.para + 1
      return
    }

    // paragraphe ou élément de liste
    const li = b.t === 'li' ? b : null
    const indent = li ? 7 + li.level * 6 : 0
    const lines = linesOf(b)
    const line = lh(p.font)
    const after = li ? p.para * 0.45 : p.para
    const x = p.ml + indent
    // une phrase qui annonce une liste (« Points à retenir : ») ne reste jamais seule en bas de page
    if (!li && lines.length <= 2 && /:\s*$/.test(b.text) && !atTop() && y + lines.length * line + p.para + keepNeed(bi + 1) > limit) newPage()
    let from = 0
    const total = lines.length
    while (from < total) {
      const left = total - from
      let avail = Math.floor((limit - y + 0.01) / line)
      if (left <= avail) { avail = left }
      else if (left <= 3 && !atTop()) { newPage(); continue } // 2-3 lignes : tout ensemble
      else {
        let take = Math.min(avail, left - 2) // jamais une seule ligne seule en haut de la page suivante
        if (take < 2 && !atTop()) { newPage(); continue } // ni une seule ligne seule en bas
        avail = Math.max(1, take)
      }
      for (let k = 0; k < avail; k++) {
        const idx = from + k
        if (li && idx === 0) {
          if (li.marker === '•') cur.items.push({ k: 'dot', x: p.ml + 2 + li.level * 6, y: y + line / 2, r: 0.7, color: ACCENT })
          else putText(li.marker, p.ml + li.level * 6, y, p.font, true, ACCENT, 'mk', 0, 1)
        }
        putText(lines[idx], x, y, p.font, false, INK, li ? 'li' : 'p', idx, total)
        y += line
      }
      from += avail
      if (from < total) newPage()
    }
    y += after
  })

  // taux de remplissage de chaque page
  const usable = limit - top
  pages.forEach((pg) => {
    let bottom = top
    for (const it of pg.items) {
      const yy = it.k === 'text' ? it.y + 1.5 : it.k === 'rect' ? it.y + it.h : it.k === 'line' ? it.y2 : it.y
      if (yy > bottom) bottom = yy
    }
    pg.fill = Math.max(0, Math.min(1, (bottom - top) / usable))
  })
  // une page finale vide (texte vide) n'existe pas
  while (pages.length > 1 && pages[pages.length - 1].items.length === 0) pages.pop()
  return pages
}

// ---------------------------------------------------------------- ajustement au nombre de pages

export type FitStatus = 'auto' | 'exact' | 'too_long' | 'too_short'
export interface FitResult {
  pages: Page[]
  params: Params
  count: number
  target: number | null
  exact: boolean
  status: FitStatus
  /** Pages (fractionnaires) à retirer (>0) ou à ajouter (<0) pour atteindre la cible, avec les limites de lisibilité. */
  gap: number
}

const pagesFloat = (pg: Page[]) => pg.length - 1 + pg[pg.length - 1].fill

/** Choisit la mise en page (interligne, marges, espacements dans les limites de lisibilité) qui donne EXACTEMENT `target` pages de contenu. */
export function layoutDocument(blocks: Block[], m: Measure, target: number | null): FitResult {
  const run = (t: number) => paginate(blocks, paramsAt(t), m)
  if (!target) {
    const pages = run(DEFAULT_T)
    return { pages, params: paramsAt(DEFAULT_T), count: pages.length, target: null, exact: true, status: 'auto', gap: 0 }
  }
  const memo = new Map<number, Page[]>()
  const at = (t: number) => { const k = Math.round(t * 1000); let v = memo.get(k); if (!v) { v = run(k / 1000); memo.set(k, v) } return v }
  const ts: number[] = []
  for (let i = 0; i <= 20; i++) ts.push(i / 20)
  const exactAt: number[] = ts.filter((t) => at(t).length === target)
  if (!exactAt.length) {
    for (let i = 0; i < ts.length - 1; i++) {
      const a = at(ts[i]).length, b = at(ts[i + 1]).length
      if (a > target && b < target) for (let t = ts[i]; t <= ts[i + 1] + 1e-9; t += 0.005) if (at(t).length === target) exactAt.push(Math.round(t * 1000) / 1000)
    }
  }
  if (exactAt.length) {
    const score = (t: number) => Math.abs(t - DEFAULT_T) + (at(t)[at(t).length - 1].fill < 0.2 ? 0.3 : 0)
    exactAt.sort((a, b) => score(a) - score(b))
    const t = exactAt[0]
    const pages = at(t)
    return { pages, params: paramsAt(t), count: pages.length, target, exact: true, status: 'exact', gap: 0 }
  }
  const airy = at(0), tight = at(1)
  if (airy.length < target) return { pages: airy, params: paramsAt(0), count: airy.length, target, exact: false, status: 'too_short', gap: pagesFloat(airy) - target }
  if (tight.length > target) return { pages: tight, params: paramsAt(1), count: tight.length, target, exact: false, status: 'too_long', gap: pagesFloat(tight) - target }
  // cas rare : le compte saute la cible entre deux réglages voisins ; on prend le réglage le plus proche
  const best = ts.map((t) => ({ t, d: Math.abs(at(t).length - target) })).sort((a, b) => a.d - b.d)[0]
  const pages = at(best.t)
  return { pages, params: paramsAt(best.t), count: pages.length, target, exact: false, status: pages.length > target ? 'too_long' : 'too_short', gap: pagesFloat(pages) - target }
}

// ---------------------------------------------------------------- contrôle de qualité

/** Cherche les défauts de mise en page : titre seul en bas de page, ligne seule (veuve/orpheline), débordement. */
export function audit(pages: Page[], p: Params): string[] {
  const issues: string[] = []
  const limit = PAGE_H - p.mb
  pages.forEach((pg, i) => {
    const texts = pg.items.filter((x): x is Extract<Item, { k: 'text' }> => x.k === 'text')
    if (!texts.length) { issues.push(`page ${i + 1} vide`); return }
    const last = texts[texts.length - 1]
    if (last.role === 'h') issues.push(`page ${i + 1} : titre isolé en bas`)
    for (const t of texts) {
      if (t.y > limit) issues.push(`page ${i + 1} : débordement en bas`)
      if (t.x < p.ml - 0.01 || t.x > PAGE_W - p.mr) issues.push(`page ${i + 1} : débordement latéral`)
    }
    const first = texts[0]
    if ((first.role === 'p' || first.role === 'li') && first.i > 0 && first.n - first.i < 2) issues.push(`page ${i + 1} : ligne seule en haut`)
    if ((last.role === 'p' || last.role === 'li') && last.i < last.n - 1 && last.i === 0) issues.push(`page ${i + 1} : ligne seule en bas`)
  })
  return issues
}
