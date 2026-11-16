import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BottomSheet, Icon, PillButton } from './ui'
import {
  CHART_KINDS, DIAGRAM_KINDS, MAX_COLS, MAX_ITEMS, MAX_ROWS, PALETTE, PALETTE_NAMES, SHAPE_KINDS,
  figScene, figToLine, linesToTable, newTable, tableToLines,
  type ChartKind, type DiagramKind, type Fig, type ShapeKind, type Table
} from '../lib/blocks'

/* Tableaux, graphiques, formes et schémas des éditeurs. Tout est dessiné en SVG/CSS : aucun réseau nécessaire. */

export type BlockKind = 'table' | 'shape' | 'diagram' | 'chart'

export const BLOCK_ROWS: { kind: BlockKind; icon: string; title: string; sub: string }[] = [
  { kind: 'table', icon: 'table', title: 'Tableau', sub: 'Des lignes et des colonnes' },
  { kind: 'chart', icon: 'chart', title: 'Graphique', sub: 'Barres, courbe ou camembert' },
  { kind: 'shape', icon: 'shapes', title: 'Formes', sub: 'Rectangle, ovale, losange, étoile' },
  { kind: 'diagram', icon: 'diagram', title: 'Diagramme', sub: 'Étapes ou boîtes reliées' }
]

/* ------------------------------------------------------------------ menu « … » */

export function DotsMenu({ label, items, className = '' }: { label: string; items: { text: string; onClick: () => void; danger?: boolean; disabled?: boolean }[]; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const off = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', off)
    return () => document.removeEventListener('pointerdown', off)
  }, [open])
  return (
    <div className={'blk-menu ' + className} ref={ref}>
      <button type="button" className="blk-dots" aria-label={label} aria-expanded={open} onClick={() => setOpen((v) => !v)}><Icon name="more" size={20} stroke={3} /></button>
      {open && (
        <div className="blk-pop" role="menu">
          {items.map((it) => (
            <button key={it.text} type="button" role="menuitem" className={it.danger ? 'danger' : ''} disabled={it.disabled} onClick={() => { setOpen(false); it.onClick() }}>{it.text}</button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ figures */

export function FigSvg({ fig, width = 300 }: { fig: Fig; width?: number }) {
  const sc = figScene(fig, width)
  const ink = (c: string) => (c === 'ink' ? 'var(--text)' : c)
  return (
    <svg className="blk-svg" viewBox={`0 0 ${sc.w} ${sc.h}`} role="img" aria-label={fig.t === 'chart' ? 'Graphique' : fig.t === 'shape' ? 'Forme' : 'Diagramme'}>
      {sc.prims.map((p, i) => {
        if (p.p === 'rect') return <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.r} fill={p.fill} />
        if (p.p === 'ellipse') return <ellipse key={i} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} fill={p.fill} />
        if (p.p === 'poly') return <polygon key={i} points={p.pts.map((q) => q.join(',')).join(' ')} fill={p.fill} stroke={p.fill} strokeWidth={0.4} />
        if (p.p === 'line') return <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.color} strokeWidth={p.w} strokeLinecap="round" />
        return <text key={i} x={p.x} y={p.y} fontSize={p.size} textAnchor={p.anchor} fill={ink(p.color)} fontWeight={p.bold ? 700 : 400}>{p.s}</text>
      })}
    </svg>
  )
}

export function FigBlock({ fig, onEdit, onDelete }: { fig: Fig; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="blk blk-fig" data-tour="editor-block">
      <DotsMenu label="Options du bloc" className="blk-menu-top" items={[{ text: 'Modifier', onClick: onEdit }, { text: 'Supprimer', onClick: onDelete, danger: true }]} />
      <button type="button" className="blk-tap" onClick={onEdit} aria-label="Modifier ce bloc"><FigSvg fig={fig} /></button>
    </div>
  )
}

/* ------------------------------------------------------------------ tableau */

export function TableBlock({ lines, onChange }: { lines: string[]; onChange: (lines: string[]) => void }) {
  const t = linesToTable(lines)
  const cols = t.rows[0]?.length ?? 1
  const commit = (next: Table) => onChange(tableToLines(next))
  const setCell = (r: number, c: number, v: string) => commit({ ...t, rows: t.rows.map((row, ri) => (ri === r ? row.map((x, ci) => (ci === c ? v : x)) : row)) })
  const addCol = () => commit({ ...t, rows: t.rows.map((r) => [...r, '']) })
  const addRow = () => commit({ ...t, rows: [...t.rows, Array.from({ length: cols }, () => '')] })
  const dropCol = () => commit({ ...t, rows: t.rows.map((r) => r.slice(0, -1)) })
  const dropRow = () => commit({ ...t, rows: t.rows.slice(0, -1) })
  return (
    <div className="blk blk-table" data-tour="editor-table">
      <div className="blk-table-top">
        <DotsMenu label="Options des colonnes" items={[
          { text: 'Ajouter une colonne', onClick: addCol, disabled: cols >= MAX_COLS },
          { text: 'Retirer la dernière colonne', onClick: dropCol, disabled: cols <= 1 },
          { text: 'Supprimer le tableau', onClick: () => onChange([]), danger: true }
        ]} />
      </div>
      <div className="blk-table-body">
        <div className="blk-table-scroll">
          <table>
            <tbody>
              {t.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => {
                    const head = t.header && r === 0
                    return <td key={c} className={head ? 'th' : ''}><input value={cell} aria-label={`Ligne ${r + 1}, colonne ${c + 1}`} placeholder={head ? 'Titre' : ''} autoComplete="off" onChange={(e) => setCell(r, c, e.target.value)} /></td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DotsMenu label="Options des lignes" className="blk-menu-side" items={[
          { text: 'Ajouter une ligne', onClick: addRow, disabled: t.rows.length >= MAX_ROWS },
          { text: 'Retirer la dernière ligne', onClick: dropRow, disabled: t.rows.length <= 1 }
        ]} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ feuille de création / modification */

const DEFAULT_ITEMS = [{ label: 'A', value: 3 }, { label: 'B', value: 5 }, { label: 'C', value: 2 }]

export function BlockSheet({ open, kind, initial, onClose, onSave, onDelete }: {
  open: boolean
  kind: BlockKind
  /** Figure à modifier (absent = création). */
  initial?: Fig | null
  onClose: () => void
  /** Reçoit les lignes à écrire dans la note. */
  onSave: (lines: string[]) => void
  onDelete?: () => void
}) {
  const [cols, setCols] = useState(3)
  const [rows, setRows] = useState(3)
  const [header, setHeader] = useState(true)
  const [ckind, setCkind] = useState<ChartKind>('barres')
  const [title, setTitle] = useState('')
  const [items, setItems] = useState<{ label: string; value: string }[]>(DEFAULT_ITEMS.map((i) => ({ label: i.label, value: String(i.value) })))
  const [skind, setSkind] = useState<ShapeKind>('rectangle')
  const [text, setText] = useState('')
  const [color, setColor] = useState(PALETTE[0])
  const [dkind, setDkind] = useState<DiagramKind>('etapes')
  const [steps, setSteps] = useState<string[]>(['', '', ''])

  // Remplit le formulaire à chaque ouverture (création : valeurs de départ ; modification : la figure existante).
  useEffect(() => {
    if (!open) return
    const f = initial
    setCols(3); setRows(3); setHeader(true)
    setCkind(f?.t === 'chart' ? f.kind : 'barres')
    setTitle(f?.t === 'chart' ? f.title : '')
    setItems(f?.t === 'chart' ? f.items.map((i) => ({ label: i.label, value: String(i.value) })) : DEFAULT_ITEMS.map((i) => ({ label: i.label, value: String(i.value) })))
    setSkind(f?.t === 'shape' ? f.kind : 'rectangle')
    setText(f?.t === 'shape' ? f.text : '')
    setColor(f?.t === 'shape' ? f.color : PALETTE[0])
    setDkind(f?.t === 'diagram' ? f.kind : 'etapes')
    setSteps(f?.t === 'diagram' ? f.items : ['', '', ''])
  }, [open, initial])

  const heading = { table: 'Insérer un tableau', chart: 'Graphique', shape: 'Forme', diagram: 'Diagramme' }[kind]
  const [err, setErr] = useState('')
  useEffect(() => { if (open) setErr('') }, [open])

  const preview: Fig | null = (() => {
    if (kind === 'chart') {
      const its = items.map((i) => ({ label: i.label.trim(), value: Number(i.value.replace(',', '.')) })).filter((i) => i.label && Number.isFinite(i.value))
      return its.length ? { t: 'chart', kind: ckind, title: title.trim(), items: its } : null
    }
    if (kind === 'shape') return { t: 'shape', kind: skind, text: text.trim(), color }
    if (kind === 'diagram') { const its = steps.map((s) => s.trim()).filter(Boolean); return its.length >= 2 ? { t: 'diagram', kind: dkind, items: its } : null }
    return null
  })()

  function save() {
    if (kind === 'table') {
      const c = Math.floor(cols), r = Math.floor(rows)
      if (!(c >= 1 && c <= MAX_COLS)) return setErr(`Choisis entre 1 et ${MAX_COLS} colonnes.`)
      if (!(r >= 1 && r <= MAX_ROWS)) return setErr(`Choisis entre 1 et ${MAX_ROWS} lignes.`)
      return onSave(tableToLines(newTable(c, r, header && r > 1)))
    }
    if (!preview) return setErr(kind === 'chart' ? 'Ajoute au moins un libellé avec sa valeur (un nombre).' : 'Écris au moins deux étapes ou boîtes.')
    onSave([figToLine(preview)])
  }

  const num = (v: number, set: (n: number) => void, max: number, label: string) => (
    <div className="blk-step">
      <button type="button" onClick={() => set(Math.max(1, v - 1))} aria-label={`Moins de ${label}`}>−</button>
      <input inputMode="numeric" value={Number.isFinite(v) ? v : ''} aria-label={label} onChange={(e) => set(e.target.value === '' ? NaN : Math.min(max, Number(e.target.value.replace(/\D/g, '')) || 0))} />
      <button type="button" onClick={() => set(Math.min(max, (Number.isFinite(v) ? v : 0) + 1))} aria-label={`Plus de ${label}`}>+</button>
    </div>
  )

  const pills = <T extends string>(list: { id: T; label: string }[], v: T, set: (x: T) => void) => (
    <div className="blk-pills" role="radiogroup">
      {list.map((o) => <button key={o.id} type="button" role="radio" aria-checked={v === o.id} className={'pill' + (v === o.id ? ' on' : '')} onClick={() => set(o.id)}>{o.label}</button>)}
    </div>
  )

  return (
    <BottomSheet open={open} onClose={onClose} title={heading}>
      <div className="blk-form">
        {kind === 'table' && (
          <>
            <div className="field"><label>Colonnes</label>{num(cols, setCols, MAX_COLS, 'colonnes')}</div>
            <div className="field"><label>Lignes</label>{num(rows, setRows, MAX_ROWS, 'lignes')}</div>
            <label className="blk-check"><input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} />Première ligne = en-tête (titres des colonnes)</label>
            <span className="muted">Tu pourras ajouter une colonne ou une ligne ensuite avec les menus « … ».</span>
          </>
        )}
        {kind === 'chart' && (
          <>
            <div className="field"><label>Type</label>{pills(CHART_KINDS, ckind, setCkind)}</div>
            <div className="field"><label htmlFor="blk-title">Titre (facultatif)</label><input id="blk-title" className="input" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Notes par matière" /></div>
            <div className="field">
              <label>Libellés et valeurs</label>
              {items.map((it, i) => (
                <div className="blk-line" key={i}>
                  <input className="input" value={it.label} maxLength={30} placeholder="Libellé" aria-label={`Libellé ${i + 1}`} onChange={(e) => setItems(items.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
                  <input className="input blk-val" inputMode="decimal" value={it.value} placeholder="Valeur" aria-label={`Valeur ${i + 1}`} onChange={(e) => setItems(items.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)))} />
                  <button type="button" className="blk-x" aria-label="Retirer cette ligne" disabled={items.length <= 1} onClick={() => setItems(items.filter((_, k) => k !== i))}><Icon name="close" size={16} /></button>
                </div>
              ))}
              {items.length < MAX_ITEMS && <button type="button" className="link" style={{ alignSelf: 'flex-start', minHeight: 40 }} onClick={() => setItems([...items, { label: '', value: '' }])}>+ Ajouter une valeur</button>}
            </div>
          </>
        )}
        {kind === 'shape' && (
          <>
            <div className="field"><label>Forme</label>{pills(SHAPE_KINDS, skind, setSkind)}</div>
            <div className="field"><label htmlFor="blk-text">Texte dans la forme</label><input id="blk-text" className="input" value={text} maxLength={60} onChange={(e) => setText(e.target.value)} placeholder="Ex. Notion à retenir" /></div>
            <div className="field">
              <label>Couleur</label>
              <div className="blk-colors" role="radiogroup">
                {PALETTE.map((c, i) => <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={PALETTE_NAMES[i]} className={color === c ? 'on' : ''} style={{ background: c }} onClick={() => setColor(c)} />)}
              </div>
            </div>
          </>
        )}
        {kind === 'diagram' && (
          <>
            <div className="field"><label>Type de schéma</label>{pills(DIAGRAM_KINDS, dkind, setDkind)}<span className="muted">{DIAGRAM_KINDS.find((d) => d.id === dkind)?.help}</span></div>
            <div className="field">
              <label>{dkind === 'etapes' ? 'Étapes, dans l’ordre' : 'Boîte centrale, puis les boîtes reliées'}</label>
              {steps.map((s, i) => (
                <div className="blk-line" key={i}>
                  <input className="input" value={s} maxLength={40} placeholder={dkind === 'boites' && i === 0 ? 'Idée centrale' : dkind === 'etapes' ? `Étape ${i + 1}` : `Boîte ${i}`} aria-label={dkind === 'boites' && i === 0 ? 'Idée centrale' : `Texte ${i + 1}`} onChange={(e) => setSteps(steps.map((x, k) => (k === i ? e.target.value : x)))} />
                  <button type="button" className="blk-x" aria-label="Retirer" disabled={steps.length <= 2} onClick={() => setSteps(steps.filter((_, k) => k !== i))}><Icon name="close" size={16} /></button>
                </div>
              ))}
              {steps.length < MAX_ITEMS && <button type="button" className="link" style={{ alignSelf: 'flex-start', minHeight: 40 }} onClick={() => setSteps([...steps, ''])}>+ Ajouter {dkind === 'etapes' ? 'une étape' : 'une boîte'}</button>}
            </div>
          </>
        )}
        {preview && <div className="blk blk-preview" aria-label="Aperçu"><FigSvg fig={preview} /></div>}
        {err && <div className="error" role="alert">{err}</div>}
        <PillButton onClick={save}>{initial ? 'Enregistrer' : kind === 'table' ? 'Insérer le tableau' : 'Insérer'}</PillButton>
        {initial && onDelete && <button type="button" className="link" style={{ alignSelf: 'center', color: 'var(--danger)', minHeight: 44 }} onClick={onDelete}>Supprimer ce bloc</button>}
      </div>
    </BottomSheet>
  )
}

/* ------------------------------------------------------------------ zone de texte qui grandit avec son contenu */

export function AutoText({ value, onChange, className = '', placeholder, onSelect, tourId }: {
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
  onSelect?: (pos: number) => void
  tourId?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.max(el.scrollHeight, 28) + 'px'
  }, [value])
  const report = () => { if (ref.current && onSelect) onSelect(ref.current.selectionStart ?? 0) }
  return (
    <textarea
      ref={ref}
      rows={1}
      data-tour={tourId}
      className={'ed-body-seg ' + className}
      value={value}
      placeholder={placeholder}
      aria-label="Texte"
      onChange={(e) => { onChange(e.target.value); report() }}
      onFocus={report}
      onSelect={report}
      onKeyUp={report}
      onClick={report}
    />
  )
}
