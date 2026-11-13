// Fabrique les PDF (notes d'un cours, TP avec page de garde) directement dans le navigateur : aucune donnée ne quitte le téléphone.
import { universityLabel } from '../data/academic'
import type { Note } from './types'

import { sanitize, parseBlocks, layoutDocument, audit, PAGE_W, PAGE_H, type Block, type Page, type Measure, type Params } from './pdflayout'
import { cleanDocText, cleanTpText } from './tpclean'

const clean = sanitize

/** Retire ce que l'IA glisse parfois autour d'un texte : introductions, séparateurs, balises de plan, champs vides, consignes. */
export function stripAiNoise(text: string): string {
  return cleanDocText(text)
}

/** Taille de police par défaut du texte dans tous les PDF de l'application (en points). */
export const BODY_PT = 13

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
  return {
    write,
    get y() { return y },
    set y(v: number) { y = v },
    newPage() { doc.addPage(); y = M }
  }
}

/** Mesure du texte avec les vraies polices du PDF (c'est ce qui rend le comptage des pages exact). */
function measurer(doc: Doc, scale = 1): Measure {
  return (text, size, bold) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    return doc.getTextWidth(text) * scale
  }
}

/** Dessine les pages calculées par le moteur. Chaque page du moteur devient une page du PDF (nouvelle page ajoutée à chaque fois). */
function drawPages(doc: Doc, pages: Page[]) {
  const col = (c: number | [number, number, number], fn: 'text' | 'draw' | 'fill') => {
    const [r, g, b] = typeof c === 'number' ? [c, c, c] : c
    if (fn === 'text') doc.setTextColor(r, g, b); else if (fn === 'draw') doc.setDrawColor(r, g, b); else doc.setFillColor(r, g, b)
  }
  for (const pg of pages) {
    doc.addPage()
    for (const it of pg.items) {
      if (it.k === 'text') {
        doc.setFont('helvetica', it.bold ? 'bold' : 'normal')
        doc.setFontSize(it.size)
        col(it.color, 'text')
        doc.text(it.s, it.x, it.y)
      } else if (it.k === 'rect') { col(it.fill, 'fill'); doc.rect(it.x, it.y, it.w, it.h, 'F') }
      else if (it.k === 'line') { col(it.color, 'draw'); doc.setLineWidth(it.w); doc.line(it.x1, it.y1, it.x2, it.y2) }
      else { col(it.color, 'fill'); doc.circle(it.x, it.y, it.r, 'F') }
    }
  }
}

/** Pieds de page discrets : filet fin, titre à gauche, numéro à droite. La page de garde n'est pas numérotée ; le contenu commence à 1. */
function footers(doc: Doc, label: string, p: Params, rule: RGB | number = 215) {
  const total = doc.getNumberOfPages()
  for (let pg = 2; pg <= total; pg++) {
    doc.setPage(pg)
    if (typeof rule === 'number') doc.setDrawColor(rule); else doc.setDrawColor(rule[0], rule[1], rule[2])
    doc.setLineWidth(0.2)
    doc.line(p.ml, PAGE_H - 15, PAGE_W - p.mr, PAGE_H - 15)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(135)
    doc.text(clean(label).slice(0, 70), p.ml, PAGE_H - 10)
    doc.text(`${pg - 1}`, PAGE_W - p.mr, PAGE_H - 10, { align: 'right' })
  }
}

export interface PdfReport {
  /** Pages de contenu réellement présentes dans le PDF (page de garde non comptée). */
  contentPages: number
  /** Pages demandées (null = automatique). */
  target: number | null
  exact: boolean
  /** « too_long » / « too_short » : le texte est trop long ou trop court pour la cible, même avec la mise en page la plus serrée ou la plus aérée. */
  status: 'auto' | 'exact' | 'too_long' | 'too_short'
  /** Pages (fractionnaires) à retirer (>0) ou à ajouter (<0) pour atteindre la cible. */
  gap: number
  /** Défauts de mise en page trouvés (titre isolé, débordement…) : doit rester vide. */
  issues: string[]
}

/** Calcule la mise en page ; si le vrai PDF n'a pas le bon nombre de pages, essaie des réglages voisins (contrôle réel, pas une estimation). */
async function buildBody(doc: Doc, blocks: Block[], target: number | null): Promise<{ params: Params; report: PdfReport }> {
  // On utilise la vraie classe jsPDF (doc.constructor n'est pas fiable une fois l'application compilée).
  const { jsPDF } = await import('jspdf')
  const startPages = doc.getNumberOfPages()
  let best: { fit: ReturnType<typeof layoutDocument>; real: number } | null = null
  for (let attempt = 0; attempt < 4; attempt++) {
    const fit = layoutDocument(blocks, measurer(doc, 1 + attempt * 0.004), target)
    // épreuve : on dessine pour de vrai sur un PDF jetable et on compte les pages
    const probe = new jsPDF({ unit: 'mm', format: 'a4' })
    drawPages(probe, fit.pages)
    const real = probe.getNumberOfPages() - 1
    if (!best || Math.abs(real - (target ?? real)) < Math.abs(best.real - (target ?? best.real))) best = { fit, real }
    if (!target || real === target) break
  }
  const fit = best!.fit
  drawPages(doc, fit.pages)
  const content = doc.getNumberOfPages() - startPages
  const exact = target ? content === target : true
  return {
    params: fit.params,
    report: {
      contentPages: content, target, exact,
      status: !target ? 'auto' : exact ? 'exact' : content > target ? 'too_long' : 'too_short',
      gap: exact ? 0 : fit.gap, issues: audit(fit.pages, fit.params)
    }
  }
}

export interface CoursePdfOptions {
  /** Étudiant Premium : présentation dorée, aucune mention « Créé avec Memoa ». */
  premium?: boolean
  university?: string
  faculty?: string
  department?: string
  promotion?: string
  /** Modèle choisi (défaut : Émeraude, l'identité Memoa ; Premium : doré). */
  template?: CoverTemplate
}

export async function buildCoursePdf(title: string, author: string, notes: Note[], kind = 'NOTES DE COURS', opts: CoursePdfOptions = {}): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const look = lookFor(opts.template, !!opts.premium)
  drawCourseCover(doc, look, { title, author, kind, ...opts })

  // Les notes s'enchaînent sans pages à moitié vides : chaque note commence par son titre, avec un espace au-dessus.
  const blocks: Block[] = []
  notes.forEach((n, i) => {
    blocks.push({ t: 'title', text: clean(n.title || `Note ${i + 1}`) })
    blocks.push(...parseBlocks(cleanDocText(n.content), 1))
  })
  const { params } = await buildBody(doc, blocks, null)
  footers(doc, title, params, opts.premium ? look.accent : 215)
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
  /** Modèle de page de garde (« classique » par défaut). */
  template?: CoverTemplate
  /** Encadrant / professeur (facultatif). */
  supervisor?: string
  /** Étudiant Premium : aucune mention « Créé avec Memoa ». Le modèle doré lui est réservé. */
  premium?: boolean
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

/** Mots qui annoncent un autre type de document que « travail pratique ». */
const OTHER_DOC = /^(rapport|mémoire|memoire|dissertation|exposé|expose|devoir|projet|synthèse|synthese|compte[- ]rendu|étude|etude|analyse|essai|fiche|commentaire|rédaction|redaction|travail\s+(dirigé|dirige|de\s+fin|de\s+recherche|de\s+groupe|personnel)|tfc|tfe|td\b|interrogation|examen|présentation|presentation)(?=[\s:.,'’\-–—]|$)/i
const TP_PREFIX = /^\s*((?:travail|travaux)\s+pratiques?|t\.?\s?p\.?)(?=[\s:.\-–—'’,]|$)\s*(n\s?[°ºo.]\s*\d+|\d+)?\s*([:\-–—.,]\s*)?(de\s+la\s+|de\s+l['’]|de\s+|du\s+|des\s+|d['’]|sur\s+|en\s+)?/i

/**
 * Titre de la page de garde. Le bandeau annonce déjà « Travail pratique » : on ne le répète pas.
 * - « Travail pratique de géographie » -> bandeau « Travail pratique », titre « Géographie »
 * - « Géométrie »                       -> bandeau « Travail pratique », titre « Géométrie »
 * - « Rapport de stage »                -> pas de bandeau « Travail pratique », titre « Rapport de stage » (intact)
 */
export function splitTpTitle(raw: string, defaultKind = 'TRAVAIL PRATIQUE'): { kind: string; title: string } {
  const t = raw.trim().replace(/\s+/g, ' ')
  if (!t) return { kind: defaultKind, title: '' }
  if (OTHER_DOC.test(t)) return { kind: '', title: t }
  const m = TP_PREFIX.exec(t)
  // Le titre ne commence pas par « Travail pratique » : le bandeau l'annonce déjà, on garde le titre tel quel.
  if (!m) return { kind: defaultKind, title: t.charAt(0).toUpperCase() + t.slice(1) }
  const rest = t.slice(m[0].length).trim()
  // Le titre EST « Travail pratique 2 » (rien d'autre) : on l'écrit une seule fois, sans répéter le bandeau.
  if (!rest) return { kind: '', title: t.toUpperCase() }
  const num = (m[2] ?? '').replace(/\D/g, '')
  return { kind: num ? `${defaultKind} ${num}` : defaultKind, title: rest.charAt(0).toUpperCase() + rest.slice(1) }
}

type RGB = [number, number, number]

export type CoverTemplate = 'classique' | 'emeraude' | 'bordeaux' | 'ardoise' | 'premium'

interface CoverLook {
  label: string
  main: RGB
  accent: RGB
  /** Forme du cadre autour de la page. */
  frame: 'double' | 'single' | 'corners' | 'sidebar' | 'gold'
  /** Bandeau du titre : plein (texte blanc) ou seulement entre deux filets. */
  band: 'filled' | 'outlined'
}

/** Les modèles de page de garde proposés à l'étudiant. « premium » : charbon et or, réservé aux abonnés. */
export const COVER_TEMPLATES: Record<CoverTemplate, CoverLook> = {
  classique: { label: 'Classique', main: [27, 42, 107], accent: [184, 137, 43], frame: 'double', band: 'filled' },
  emeraude: { label: 'Émeraude', main: [11, 93, 84], accent: [242, 163, 58], frame: 'single', band: 'filled' },
  bordeaux: { label: 'Bordeaux', main: [110, 24, 48], accent: [160, 124, 60], frame: 'corners', band: 'outlined' },
  ardoise: { label: 'Ardoise', main: [30, 41, 59], accent: [13, 148, 136], frame: 'sidebar', band: 'outlined' },
  premium: { label: 'Premium', main: [28, 27, 33], accent: [176, 138, 46], frame: 'gold', band: 'filled' }
}
export const COVER_ORDER: CoverTemplate[] = ['classique', 'emeraude', 'bordeaux', 'ardoise', 'premium']

/** Le modèle doré est réservé à Premium : sans abonnement, on retombe sur « classique » (jamais d'erreur). */
export function effectiveTemplate(t: CoverTemplate | undefined, premium: boolean, fallback: CoverTemplate = 'classique'): CoverTemplate {
  const k = t && COVER_TEMPLATES[t] ? t : fallback
  return k === 'premium' && !premium ? fallback : k
}
/** Cours : Émeraude (identité Memoa) en Free, doré en Premium, sauf autre modèle demandé. */
function lookFor(t: CoverTemplate | undefined, premium: boolean): CoverLook {
  return COVER_TEMPLATES[effectiveTemplate(t ?? (premium ? 'premium' : 'emeraude'), premium, 'emeraude')]
}

/** Aucun crochet ni champ vide sur la page de garde : « [Nom] », « [ ] » et espaces en trop disparaissent. */
export function cleanField(v: string | null | undefined): string {
  return (v ?? '').replace(/\[[^\]]*\]/g, '').replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim()
}

const MENTION = 'Créé avec Memoa'

/** Petite mention discrète en bas de la page de garde (Free seulement). */
function mention(doc: Doc, cx: number) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(150)
  doc.text(clean(MENTION), cx, H - 17.5, { align: 'center' })
}

/** Cadre de la page de garde selon le modèle. */
function drawFrame(doc: Doc, look: CoverLook, sideW: number) {
  const MAIN = look.main
  const ACC = look.accent
  if (look.frame === 'double') {
    doc.setDrawColor(MAIN[0], MAIN[1], MAIN[2])
    doc.setLineWidth(0.9)
    doc.rect(10, 10, W - 20, H - 20)
    doc.setLineWidth(0.3)
    doc.rect(12.5, 12.5, W - 25, H - 25)
  } else if (look.frame === 'single') {
    doc.setDrawColor(MAIN[0], MAIN[1], MAIN[2])
    doc.setLineWidth(1.6)
    doc.rect(10, 10, W - 20, H - 20)
    doc.setDrawColor(ACC[0], ACC[1], ACC[2])
    doc.setLineWidth(0.35)
    doc.rect(14, 14, W - 28, H - 28)
  } else if (look.frame === 'corners') {
    doc.setDrawColor(MAIN[0], MAIN[1], MAIN[2])
    doc.setLineWidth(0.25)
    doc.rect(12, 12, W - 24, H - 24)
    doc.setDrawColor(ACC[0], ACC[1], ACC[2])
    doc.setLineWidth(1.6)
    const L = 24
    for (const [x, y, dx, dy] of [[10, 10, 1, 1], [W - 10, 10, -1, 1], [10, H - 10, 1, -1], [W - 10, H - 10, -1, -1]] as const) {
      doc.line(x, y, x + dx * L, y)
      doc.line(x, y, x, y + dy * L)
    }
  } else if (look.frame === 'gold') {
    // Premium : barre charbon et filet or en haut, double filet or, petit carré d'or aux quatre coins.
    doc.setFillColor(MAIN[0], MAIN[1], MAIN[2])
    doc.rect(0, 0, W, 6, 'F')
    doc.setFillColor(ACC[0], ACC[1], ACC[2])
    doc.rect(0, 6, W, 1, 'F')
    doc.setDrawColor(ACC[0], ACC[1], ACC[2])
    doc.setLineWidth(1)
    doc.rect(11, 14, W - 22, H - 25)
    doc.setLineWidth(0.3)
    doc.rect(13.5, 16.5, W - 27, H - 30)
    doc.setFillColor(ACC[0], ACC[1], ACC[2])
    for (const [x, y] of [[11, 14], [W - 11, 14], [11, H - 11], [W - 11, H - 11]] as const) doc.rect(x - 1.6, y - 1.6, 3.2, 3.2, 'F')
  } else {
    doc.setFillColor(MAIN[0], MAIN[1], MAIN[2])
    doc.rect(0, 0, sideW, H, 'F')
    doc.setFillColor(ACC[0], ACC[1], ACC[2])
    doc.rect(sideW, 0, 1.6, H, 'F')
  }
}

/** Bandeau (plein ou entre deux filets) : dessine le fond et les filets. */
function drawBand(doc: Doc, look: CoverLook, cx: number, top: number, bw: number, bh: number) {
  const MAIN = look.main
  const ACC = look.accent
  const filled = look.band === 'filled'
  if (filled) {
    doc.setFillColor(MAIN[0], MAIN[1], MAIN[2])
    doc.rect(cx - bw / 2, top, bw, bh, 'F')
  }
  doc.setDrawColor(ACC[0], ACC[1], ACC[2])
  doc.setLineWidth(filled ? 0.8 : 1.2)
  doc.line(cx - bw / 2, top, cx + bw / 2, top)
  doc.line(cx - bw / 2, top + bh, cx + bw / 2, top + bh)
  if (!filled) {
    doc.setDrawColor(MAIN[0], MAIN[1], MAIN[2])
    doc.setLineWidth(0.3)
    doc.line(cx - bw / 2, top + 1.8, cx + bw / 2, top + 1.8)
    doc.line(cx - bw / 2, top + bh - 1.8, cx + bw / 2, top + bh - 1.8)
  }
}

/** Texte centré (lettres espacées au besoin) : le centrage est exact. `center` renvoie le y après la dernière ligne. */
function makeCenter(doc: Doc, cx: number) {
  const widthOf = (l: string, sz: number, gap: number) => {
    doc.setFontSize(sz)
    return Array.from(l).reduce((n, ch) => n + doc.getTextWidth(ch), 0) + gap * Math.max(0, Array.from(l).length - 1)
  }
  const center = (text: string, size: number, style: 'normal' | 'bold', y: number, color: RGB, gap = 0, maxW = 140, up = false) => {
    const t = clean(up ? text.toUpperCase() : text)
    doc.setFont('helvetica', style)
    doc.setTextColor(color[0], color[1], color[2])
    const lines: string[] = []
    let cur = ''
    for (const wd of t.split(/\s+/)) {
      const test = cur ? `${cur} ${wd}` : wd
      if (cur && widthOf(test, size, gap) > maxW) { lines.push(cur); cur = wd } else cur = test
    }
    if (cur) lines.push(cur)
    let sz = size
    while (sz > 7 && lines.some((l) => widthOf(l, sz, gap) > maxW)) sz -= 0.5
    doc.setFontSize(sz)
    const lh = sz * 0.5
    lines.forEach((l, i) => {
      let x = cx - widthOf(l, sz, gap) / 2
      if (!gap) { doc.text(l, x, y + i * lh); return }
      for (const ch of Array.from(l)) { doc.text(ch, x, y + i * lh); x += doc.getTextWidth(ch) + gap }
    })
    return y + lines.length * lh
  }
  const rule = (y: number, half: number, thick: number, color: RGB) => {
    doc.setDrawColor(color[0], color[1], color[2])
    doc.setLineWidth(thick)
    doc.line(cx - half, y, cx + half, y)
  }
  return { widthOf, center, rule }
}

/** Page de garde des cours et résumés : identité Memoa (doré en Premium), champs du profil, jamais de crochets vides. */
function drawCourseCover(doc: Doc, look: CoverLook, o: { title: string; author: string; kind: string } & CoursePdfOptions) {
  const MAIN = look.main
  const ACC = look.accent
  const sideW = look.frame === 'sidebar' ? 12 : 0
  const cx = (W + sideW) / 2
  const { center, rule } = makeCenter(doc, cx)
  drawFrame(doc, look, sideW)

  let y = 44
  y = center('MEMOA', 15, 'bold', y, MAIN, 3.2, 120)
  rule(y + 4, 14, 0.8, ACC)
  y += 14
  const uni = cleanField(o.university)
  if (uni) y = center(universityOnly(uni), 12, 'bold', y, MAIN, 0.3, 150, true) + 2
  const fac = cleanField(o.faculty)
  if (fac) y = center(fac, 10.5, 'bold', y + 1, ACC, 0.4, 140, true)
  const dep = cleanField(o.department)
  if (dep) y = center(`Département : ${dep}`, 11, 'normal', y + 3, MAIN, 0, 150)

  // Bandeau : type de document + titre
  const filled = look.band === 'filled'
  const bw = 150
  const bandTop = Math.max(y + 22, 112)
  const kind = cleanField(o.kind)
  const pad = 10
  const titleText = clean(cleanField(o.title) || 'Sans titre')
  doc.setFont('helvetica', 'bold')
  let tSize = 22
  let titleLines: string[] = []
  for (; tSize >= 14; tSize -= 2) {
    doc.setFontSize(tSize)
    titleLines = doc.splitTextToSize(titleText.toUpperCase(), bw - 18) as string[]
    if (titleLines.length <= 4) break
  }
  const LH = tSize * 0.46
  const labelBase = bandTop + pad + 2.6
  const firstBase = kind ? labelBase + 5.5 + tSize * 0.26 : bandTop + pad + tSize * 0.26
  const lastBase = firstBase + (titleLines.length - 1) * LH
  const bandH = lastBase - bandTop + pad
  drawBand(doc, look, cx, bandTop, bw, bandH)
  const labelColor: RGB = filled ? (look.frame === 'gold' ? ACC : [255, 255, 255]) : ACC
  if (kind) center(kind, 10, 'normal', labelBase, labelColor, 2.4, bw - 12, true)
  const titleColor: RGB = filled ? [255, 255, 255] : MAIN
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(tSize)
  doc.setTextColor(titleColor[0], titleColor[1], titleColor[2])
  titleLines.forEach((l, i) => doc.text(l, cx - doc.getTextWidth(l) / 2, firstBase + i * LH))

  // Auteur, promotion, date
  let ry = bandTop + bandH + 20
  const author = cleanField(o.author)
  if (author) {
    ry = center('PRÉSENTÉ PAR', 8.5, 'bold', ry, ACC, 1.6, 120) + 2
    ry = center(author, 14, 'bold', ry, MAIN, 0, 140) + 3
  }
  const promo = cleanField(o.promotion)
  if (promo) center(promo, 11, 'normal', ry + 1, MAIN, 0, 140)
  const dateTxt = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  rule(H - 54, 24, 0.5, ACC)
  center(dateTxt, 10.5, 'normal', H - 46, MAIN, 0, 110)
  if (!o.premium) mention(doc, cx)
}

/** TP : page de garde (4 modèles : double cadre, cadre simple, coins, bandeau latéral), puis le travail. */
export async function buildTpPdf(c: TpCover, content: string, targetPages: number | null = null): Promise<Blob> {
  return (await buildTpPdfDetailed(c, content, targetPages)).blob
}

/** Comme buildTpPdf, mais renvoie aussi le contrôle réel du PDF produit (nombre de pages de contenu, défauts). */
export async function buildTpPdfDetailed(c: TpCover, content: string, targetPages: number | null = null): Promise<{ blob: Blob; report: PdfReport }> {
  const { jsPDF } = await import('jspdf')
  const logo = await loadLogo(c.logoUrl)
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const premium = !!c.premium
  const look = COVER_TEMPLATES[effectiveTemplate(c.template, premium)]
  const MAIN = look.main
  const ACC = look.accent
  const sideW = look.frame === 'sidebar' ? 12 : 0
  const cx = (W + sideW) / 2
  const head = splitTpTitle(cleanField(c.title), c.kind ?? 'TRAVAIL PRATIQUE')
  const f = {
    university: cleanField(c.university), faculty: cleanField(c.faculty), department: cleanField(c.department),
    promotion: cleanField(c.promotion), vacation: cleanField(c.vacation), course: cleanField(c.course),
    student: cleanField(c.student), year: cleanField(c.year), supervisor: cleanField(c.supervisor)
  }
  const { center, rule: ruleAt } = makeCenter(doc, cx)
  const rule = (y: number, half: number, thick = 0.5) => ruleAt(y, half, thick, ACC)

  drawFrame(doc, look, sideW)

  // En-tête : pays, université, faculté, département (bien visible)
  let y = 36
  y = center('RÉPUBLIQUE DÉMOCRATIQUE DU CONGO', 10, 'bold', y, [60, 60, 70], 1.2, 150)
  rule(y + 5, 30, 0.7)
  y = center(universityOnly(f.university), 15, 'bold', y + 16, MAIN, 0.3, 150, true)
  if (f.faculty) y = center(f.faculty, 11.5, 'bold', y + 3, ACC, 0.5, 140, true)
  if (f.department) y = center(`Département : ${f.department}`, 12.5, 'bold', y + 4, MAIN, 0, 150)

  // Logo (hauteur max 48 mm, largeur max 70 mm)
  let logoBottom = y + 8
  if (logo) {
    const ratio = logo.w / logo.h
    let lw = 70
    let lh = lw / ratio
    if (lh > 48) { lh = 48; lw = lh * ratio }
    doc.addImage(logo.data, 'PNG', cx - lw / 2, y + 12, lw, lh)
    logoBottom = y + 12 + lh
  }

  // Bandeau : « TRAVAIL PRATIQUE » et le titre forment un seul bloc, centré dans le bandeau
  // (même marge en haut et en bas, chaque ligne centrée exactement sur le milieu de la page).
  const bandTop = Math.max(logoBottom + 10, 132)
  const bw = 150
  const LH = 9.5
  const TITLE_PT = 20
  const pad = 9
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(TITLE_PT)
  const titleLines = doc.splitTextToSize(clean(head.title).toUpperCase(), bw - 18) as string[]
  const labelBase = bandTop + pad + 2.6 // le haut des majuscules du libellé touche la marge du haut
  const firstBase = head.kind ? labelBase + 5.5 + 5.1 : bandTop + pad + 5.1
  const lastBase = firstBase + (titleLines.length - 1) * LH
  const bandH = lastBase - bandTop + pad
  const filled = look.band === 'filled'
  drawBand(doc, look, cx, bandTop, bw, bandH)
  if (head.kind) center(head.kind, 10, 'normal', labelBase, filled && look.frame !== 'gold' ? [255, 255, 255] : ACC, 2.4, bw - 12, true)
  const titleColor: RGB = filled ? [255, 255, 255] : MAIN
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(TITLE_PT)
  doc.setTextColor(titleColor[0], titleColor[1], titleColor[2])
  titleLines.forEach((l, i) => doc.text(l, cx - doc.getTextWidth(l) / 2, firstBase + i * LH))

  // Bloc « présenté par » : étiquettes à gauche, trait vertical, valeurs à droite
  const rows: Array<[string, string]> = []
  if (f.student) rows.push(['PRÉSENTÉ PAR', f.student])
  if (f.course) rows.push(['COURS', f.course])
  const promo = [f.promotion, f.department].filter(Boolean).join(' / ')
  if (promo) rows.push(['PROMOTION', promo])
  if (f.vacation) rows.push(['VACATION', f.vacation.replace(/^Vacation\s+/i, '')])
  if (f.supervisor) rows.push(['ENCADRANT', f.supervisor])
  const lineX = 74 + sideW / 2
  const valueW = W - lineX - 28
  const yearY = H - 46
  let ry = bandTop + bandH + 16
  const startY = ry - 5
  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(ACC[0], ACC[1], ACC[2])
    doc.text(label, lineX - 6, ry, { align: 'right' })
    doc.setFontSize(11)
    doc.setTextColor(MAIN[0], MAIN[1], MAIN[2])
    const vl = doc.splitTextToSize(clean(value), valueW) as string[]
    vl.forEach((l, i) => doc.text(l, lineX + 6, ry + i * 5))
    ry += Math.max(1, vl.length) * 5 + 4.5
  })
  doc.setDrawColor(ACC[0], ACC[1], ACC[2])
  doc.setLineWidth(0.5)
  doc.line(lineX, startY, lineX, Math.min(ry - 6, yearY - 16))

  // Année académique entre deux filets. Les lettres sont espacées à la main (mesure exacte) : le texte ne dépasse jamais.
  const yearText = clean(f.year ? `ANNÉE ACADÉMIQUE ${f.year.replace('-', ' – ')}` : '')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  const gap = 0.6
  const chars = Array.from(yearText)
  const widths = chars.map((ch) => doc.getTextWidth(ch))
  const yearW = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, chars.length - 1)
  const yearHalf = Math.max(46, yearW / 2 + 8)
  rule(yearY - 7, yearHalf, 0.5)
  doc.setTextColor(MAIN[0], MAIN[1], MAIN[2])
  let yx = cx - yearW / 2
  chars.forEach((ch, i) => { doc.text(ch, yx, yearY); yx += widths[i] + gap })
  rule(yearY + 6, yearHalf, 0.5)

  if (!premium) mention(doc, cx)

  // Contenu : texte nettoyé (balises, champs vides, consignes), puis mise en page ajustée au nombre de pages demandé.
  const blocks = parseBlocks(cleanTpText(content))
  const { params, report } = await buildBody(doc, blocks, targetPages && targetPages > 0 ? Math.round(targetPages) : null)
  footers(doc, c.title, params, premium ? ACC : 215)
  return { blob: doc.output('blob'), report }
}

function universityOnly(u: string): string {
  return universityLabel(u)
}
