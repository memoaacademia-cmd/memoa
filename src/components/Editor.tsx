import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { BottomSheet, Icon, MemoAvatar, PillButton, Row, RowGroup } from './ui'
import { useAuth } from '../lib/auth'
import { track } from '../lib/track'
import { joinSegments, insertBlock, lineToFig, replaceBlock, splitSegments, type Fig } from '../lib/blocks'
import { useTours } from './Tour'
import { AutoText, BLOCK_ROWS, BlockSheet, FigBlock, TableBlock, type BlockKind } from './Blocks'

/* Écran d'écriture plein écran, style Notes : sans cadre, titre grand, texte qui occupe la page.
   Utilisé par « Ajouter une note » (CourseDetail) et, au bloc 2, par « Nouveau cours » (NewCourse). */

/** Dernière position du curseur dans la note (zone de texte + caractère) : sert à insérer un bloc là où l'étudiant écrivait. */
let caret: { seg: number; pos: number } | null = null

/** L'éditeur prête sa zone « Consignes » à la barre d'outils : la barre y met le bouton (photo du mémo), l'éditeur affiche la zone au-dessus. */
const GuideCtx = createContext<{ open: boolean; toggle: () => void; animal: string | null; name: string } | null>(null)

export function EditorScreen(p: {
  backLabel: string
  onBack: () => void
  status?: string
  doneLabel: string
  onDone: () => void
  doneDisabled?: boolean
  /** Cache le bouton principal (hors connexion : seul « Brouillon » reste). */
  hideDone?: boolean
  /** Bouton « Brouillon » (hors de la zone de texte) : garde la note sur le téléphone. Absent = pas de bouton. */
  onDraft?: () => void
  draftDisabled?: boolean
  /** Repère de visite posé sur l'écran entier (ex. « editor-note » : visite « Ajouter une note »). */
  tourKey?: string
  title: string
  onTitle: (v: string) => void
  titlePlaceholder: string
  dateText?: string
  body: string
  onBody: (v: string) => void
  bodyPlaceholder: string
  /** Message d'information long (ex. « Sans connexion… ») : réduit à un petit « ! » en bas, le texte s'affiche quand on le touche. */
  hint?: string
  /** Messages (erreur, « Transcription en cours… ») juste au-dessus des outils. */
  banner?: ReactNode
  guide: string
  onGuide: (v: string) => void
  guideHelp: string
  guideExtra?: ReactNode
  bar: ReactNode
}) {
  const [guideOpen, setGuideOpen] = useState(false)
  const { profile } = useAuth()
  // Tableaux, graphiques, formes et schémas : la note reste du texte ; on la découpe en zones de texte et en blocs pour l'affichage.
  const segs = splitSegments(p.body)
  const flow = segs.some((x) => x.k !== 'text')
  const [editing, setEditing] = useState<{ seg: number; fig: Fig } | null>(null)
  useEffect(() => { caret = null; return () => { caret = null } }, [])
  const setSeg = (i: number, lines: string[]) => p.onBody(joinSegments(segs.map((x, k) => (k === i ? ({ k: 'text', lines } as typeof x) : x))))
  const lastIsBlock = segs.length > 0 && segs[segs.length - 1].k !== 'text'
  const memoName = profile?.memo_name || 'Memo'
  const [hintOpen, setHintOpen] = useState(false)
  // Pendant qu'on écrit le titre, tout ce qui est sous le texte (consignes, messages) se range pour laisser la place au clavier.
  const [titleFocus, setTitleFocus] = useState(false)
  // Le titre est un champ qui passe à la ligne et grandit (plus de défilement horizontal).
  // On ne touche à la hauteur que si elle change vraiment : la remettre à « auto » à chaque lettre perturbe le clavier de certains téléphones.
  const titleRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = titleRef.current
    if (!el) return
    // On ne réajuste que si le texte déborde ou si la hauteur est devenue trop grande.
    if (el.scrollHeight > el.clientHeight + 1) el.style.height = el.scrollHeight + 'px'
    else if (el.clientHeight > 0 && el.scrollHeight < el.clientHeight - 1) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
    // Le titre est tout en haut : pendant qu'on l'écrit, la zone reste calée en haut pour qu'on voie toujours ce qu'on tape.
    if (document.activeElement === el) { const main = el.closest('.ed-main'); if (main) main.scrollTop = 0 }
  }, [p.title])
  // Quand le clavier s'ouvre, l'écran se réduit à la zone visible : la barre d'outils reste au-dessus du clavier.
  const [box, setBox] = useState<{ h: number; top: number } | null>(null)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const on = () => setBox({ h: Math.round(vv.height), top: Math.round(vv.offsetTop) })
    on()
    vv.addEventListener('resize', on)
    vv.addEventListener('scroll', on)
    return () => {
      vv.removeEventListener('resize', on)
      vv.removeEventListener('scroll', on)
    }
  }, [])

  // Prévient les visites guidées que l'éditeur vient de s'ouvrir (la visite « Ajouter une note » en dépend).
  const { nudge } = useTours()
  useEffect(() => { const t = window.setTimeout(nudge, 350); return () => window.clearTimeout(t) }, [nudge])

  return (
    <GuideCtx.Provider value={{ open: guideOpen, toggle: () => setGuideOpen((v) => !v), animal: profile?.memo_animal ?? null, name: memoName }}>
    <div className={'editor' + (titleFocus ? ' title-focus' : '')} data-tour={p.tourKey} style={box ? { height: box.h, top: box.top } : undefined} role="dialog" aria-modal="true" aria-label={p.titlePlaceholder}>
      <div className="ed-top">
        <button type="button" className="ed-back" onClick={p.onBack} aria-label="Retour">
          <Icon name="back" size={22} stroke={2.2} />
          <span>{p.backLabel}</span>
        </button>
        {p.status && <span className="ed-status">{p.status}</span>}
        {p.onDraft && <button type="button" data-tour="editor-draft" className={'ed-draft' + (p.hideDone ? ' solo' : '')} onClick={p.onDraft} disabled={p.draftDisabled}>Brouillon</button>}
        {!p.hideDone && <button type="button" data-tour="editor-done" className="ed-done" onClick={p.onDone} disabled={p.doneDisabled}>{p.doneLabel}</button>}
      </div>

      <div className="ed-main">
        <textarea
          ref={titleRef}
          data-tour="editor-title"
          className="ed-title"
          rows={1}
          maxLength={80}
          placeholder={p.titlePlaceholder}
          value={p.title}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="sentences"
          spellCheck={false}
          enterKeyHint="next"
          onChange={(e) => { const v = e.target.value; p.onTitle(v.includes('\n') ? v.replace(/\n/g, ' ') : v) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); document.querySelector<HTMLTextAreaElement>('.ed-body')?.focus() } }}
          aria-label={p.titlePlaceholder}
          onFocus={() => setTitleFocus(true)}
          onBlur={() => setTitleFocus(false)}
        />
        {p.dateText && <span className="ed-date">{p.dateText}</span>}
        {!flow ? (
          <textarea
            data-tour="editor-body" className="ed-body" placeholder={p.bodyPlaceholder} value={p.body} onChange={(e) => { caret = { seg: 0, pos: e.target.selectionStart ?? 0 }; p.onBody(e.target.value) }} aria-label="Texte"
            onSelect={(e) => { caret = { seg: 0, pos: e.currentTarget.selectionStart ?? 0 } }}
            onClick={(e) => { caret = { seg: 0, pos: e.currentTarget.selectionStart ?? 0 } }}
          />
        ) : (
          <div className="ed-flow" data-tour="editor-body">
            {segs.map((x, i) => {
              if (x.k === 'text') {
                const last = i === segs.length - 1
                return <AutoText key={last ? 'last-text' : 't' + i} className={i === 0 ? 'ed-body' : ''} value={x.lines.join('\n')} onChange={(v) => setSeg(i, v.split('\n'))} onSelect={(pos) => { caret = { seg: i, pos } }} />
              }
              if (x.k === 'table') return <TableBlock key={'b' + i} lines={x.lines} onChange={(l) => p.onBody(replaceBlock(p.body, i, l))} />
              return x.fig
                ? <FigBlock key={'b' + i} fig={x.fig} onEdit={() => setEditing({ seg: i, fig: x.fig as Fig })} onDelete={() => p.onBody(replaceBlock(p.body, i, []))} />
                : null
            })}
            {lastIsBlock && <AutoText key="last-text" value="" onChange={(v) => p.onBody(p.body + '\n' + v)} onSelect={(pos) => { caret = { seg: segs.length, pos } }} />}
          </div>
        )}
        {editing && (
          <BlockSheet
            open
            kind={editing.fig.t as BlockKind}
            initial={editing.fig}
            onClose={() => setEditing(null)}
            onSave={(lines) => { if (lineToFig(lines[0])) { p.onBody(replaceBlock(p.body, editing.seg, lines)); track(editing.fig.t + '_edited') } setEditing(null) }}
            onDelete={() => { p.onBody(replaceBlock(p.body, editing.seg, [])); setEditing(null) }}
          />
        )}
      </div>

      <div className="ed-extra-wrap">
        {p.hint && (
          <>
            <button type="button" className={'ed-info' + (hintOpen ? ' open' : '')} onClick={() => setHintOpen((v) => !v)} aria-expanded={hintOpen} aria-label="À savoir sur le mode hors connexion">!</button>
            {hintOpen && <div className="ed-info-card" role="status" onClick={() => setHintOpen(false)}>{p.hint}</div>}
          </>
        )}
        <div className="ed-extra">
          {p.banner}
          {guideOpen && (
            <div className="ed-guide-box">
              <textarea value={p.guide} onChange={(e) => p.onGuide(e.target.value)} placeholder="Ex. Complète avec des exemples. Ou, sans notes : explique-moi le chapitre sur la décolonisation." aria-label={`Consignes pour ${memoName}`} />
              {p.guideExtra}
              <span className="muted">{p.guideHelp}</span>
            </div>
          )}
        </div>
      </div>

      {p.bar}
    </div>
    </GuideCtx.Provider>
  )
}

/** Barre d'outils fixe : Photo, Dicter, Enregistrer et le bouton « + » à droite. */
export function EditorBar({ onPhoto, onDictate, dictating, dictateDisabled, onRecord, recordDisabled, onPlus }: {
  onPhoto: () => void
  onDictate: () => void
  dictating: boolean
  dictateDisabled?: boolean
  onRecord: () => void
  recordDisabled?: boolean
  onPlus: () => void
}) {
  const g = useContext(GuideCtx)
  return (
    <div className="ed-bar" data-tour="editor-bar">
      <button type="button" className="ed-chip" onClick={onPhoto}><Icon name="photo" size={18} />Photo</button>
      <button type="button" className={'ed-chip ed-mic' + (dictating ? ' on' : '')} onClick={onDictate} disabled={dictateDisabled} aria-pressed={dictating} aria-label={dictating ? 'Arrêter la dictée' : 'Dicter'}><Icon name="mic" size={20} /></button>
      <button type="button" className="ed-chip" onClick={onRecord} disabled={recordDisabled}><Icon name="audio" size={18} />Enregistrer</button>
      {g && (
        <button type="button" data-tour="editor-guide" className={'ed-guide-ico' + (g.open ? ' on' : '')} onClick={g.toggle} aria-expanded={g.open} aria-label={`Consignes pour ${g.name} (facultatif)`}>
          <MemoAvatar animal={g.animal} size={24} />
          <span>Consignes</span>
        </button>
      )}
      <button type="button" data-tour="editor-plus" className="ed-plus" onClick={onPlus} aria-label="Ajouter : tableau, graphique, document…"><Icon name="plus" size={24} stroke={2.3} /></button>
    </div>
  )
}

/** Feuille « Ajouter » : d'abord les blocs (Tableau, Graphique, Formes, Diagramme), puis les documents (PDF, Audio, Vidéo).
 *  Pour insérer des blocs, passe `body` et `onBody` (le texte de la note) : le bloc est écrit à la position du curseur. */
export function AddDocSheet({ open, onClose, maxMb, onPdf, onAudio, onVideo, body, onBody }: { open: boolean; onClose: () => void; maxMb: number; onPdf: () => void; onAudio: () => void; onVideo: () => void; body?: string; onBody?: (v: string) => void }) {
  const [kind, setKind] = useState<BlockKind | null>(null)
  const canInsert = typeof body === 'string' && !!onBody
  function save(lines: string[]) {
    if (!canInsert || !kind) return
    const segs = splitSegments(body as string)
    const at = caret && segs[caret.seg]?.k === 'text' ? caret : undefined
    onBody!(insertBlock(body as string, lines, at))
    track(kind + '_inserted')
    caret = null
    setKind(null)
  }
  return (
    <>
      <BottomSheet open={open} onClose={onClose} title={canInsert ? 'Ajouter' : 'Ajouter un document'}>
        {canInsert && (
          <RowGroup label="Insérer dans la note" tour="editor-blocks">
            {BLOCK_ROWS.map((r) => <Row key={r.kind} icon={r.icon} title={r.title} sub={r.sub} onClick={() => { onClose(); setKind(r.kind) }} />)}
          </RowGroup>
        )}
        <RowGroup label={canInsert ? 'Ajouter un document' : undefined}>
          <Row icon="pdf" title="PDF" sub="Je lis le texte de ton cours" onClick={() => { onClose(); onPdf() }} />
          <Row icon="audio" title="Audio" sub={`MP3, M4A, WAV · ${maxMb} Mo maximum`} onClick={() => { onClose(); onAudio() }} />
          <Row icon="video" title="Vidéo" sub="Je garde la voix et je la transcris" onClick={() => { onClose(); onVideo() }} />
        </RowGroup>
      </BottomSheet>
      {kind && <BlockSheet open kind={kind} onClose={() => setKind(null)} onSave={save} />}
    </>
  )
}

/* ------------------------------ Enregistrement ------------------------------ */

export function useRecorder(o: { maxBytes: number; onFile: (f: File) => void; onError: (m: string) => void }) {
  const [state, setState] = useState<'idle' | 'rec' | 'paused'>('idle')
  const [secs, setSecs] = useState(0)
  const [nearLimit, setNearLimit] = useState(false)
  const rec = useRef<MediaRecorder | null>(null)
  const bytes = useRef(0)
  const discard = useRef(false)
  const cb = useRef(o)
  cb.current = o

  useEffect(() => {
    if (state !== 'rec') return
    const t = window.setInterval(() => setSecs((s) => s + 1), 1000)
    return () => window.clearInterval(t)
  }, [state])

  useEffect(() => () => {
    discard.current = true
    const r = rec.current
    if (r && r.state !== 'inactive') r.stop()
    r?.stream.getTracks().forEach((t) => t.stop())
  }, [])

  async function start() {
    if (state !== 'idle') return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      cb.current.onError("L'enregistrement n'est pas disponible sur ce navigateur. Essaie avec Chrome.")
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks: Blob[] = []
      const r = new MediaRecorder(stream)
      bytes.current = 0
      discard.current = false
      r.ondataavailable = (e) => {
        if (!e.data.size) return
        chunks.push(e.data)
        bytes.current += e.data.size
        const max = cb.current.maxBytes
        if (bytes.current > max * 0.8) setNearLimit(true)
        if (bytes.current > max * 0.95 && r.state !== 'inactive') r.stop()
      }
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        setState('idle')
        setSecs(0)
        setNearLimit(false)
        if (discard.current) return
        const type = r.mimeType || 'audio/webm'
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
        const file = new File(chunks, `enregistrement.${ext}`, { type })
        if (file.size) cb.current.onFile(file)
      }
      rec.current = r
      r.start(1000)
      setSecs(0)
      setState('rec')
    } catch {
      cb.current.onError('Le micro est bloqué. Autorise-le dans les réglages du navigateur, puis réessaie.')
    }
  }
  function pause() { if (rec.current?.state === 'recording') { rec.current.pause(); setState('paused') } }
  function resume() { if (rec.current?.state === 'paused') { rec.current.resume(); setState('rec') } }
  function stop() { discard.current = false; if (rec.current && rec.current.state !== 'inactive') rec.current.stop() }
  function cancel() { discard.current = true; if (rec.current && rec.current.state !== 'inactive') rec.current.stop() }

  return { state, secs, nearLimit, start, pause, resume, stop, cancel }
}

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

/** Feuille sombre : point rouge, chrono, barres de son, « Pause » et « Arrêter et transcrire ». */
export function RecordingSheet({ open, onClose, rec, maxMb }: { open: boolean; onClose: () => void; rec: ReturnType<typeof useRecorder>; maxMb: number }) {
  const active = rec.state !== 'idle'
  const heights = [0.5, 0.9, 0.6, 1, 0.7, 0.85, 0.45, 0.95, 0.6, 0.8, 0.5, 0.75]
  return (
    <BottomSheet open={open} onClose={() => { if (!active) onClose() }} dark title="Enregistrement">
      <div className="rec-live">
        <span className={'rec-dot' + (rec.state === 'rec' ? ' live' : '')} aria-hidden="true" />
        {rec.state === 'paused' ? 'En pause' : active ? 'Enregistrement en cours' : 'Prêt à enregistrer'}
      </div>
      <div className="rec-time" role="timer" aria-live="off">{clock(rec.secs)}</div>
      <div className={'rec-bars' + (rec.state === 'rec' ? ' on' : '')} aria-hidden="true">
        {heights.map((h, i) => <i key={i} style={{ animationDelay: `${(i * 0.09).toFixed(2)}s`, height: `${Math.round(h * 100)}%` }} />)}
      </div>
      {rec.nearLimit && <div className="rec-warn" role="status">Tu approches de la limite de {maxMb} Mo. L’enregistrement s’arrêtera tout seul juste avant.</div>}
      {active ? (
        <>
          <div style={{ display: 'flex', gap: 10 }}>
            <PillButton variant="outline" onClick={rec.state === 'rec' ? rec.pause : rec.resume}>
              <Icon name={rec.state === 'rec' ? 'pause' : 'play'} size={18} />{rec.state === 'rec' ? 'Pause' : 'Reprendre'}
            </PillButton>
            <PillButton onClick={() => { rec.stop(); onClose() }}>Arrêter et transcrire</PillButton>
          </div>
          <button type="button" className="link" style={{ alignSelf: 'center', textDecoration: 'none', color: 'var(--text-3)', minHeight: 44 }} onClick={() => { rec.cancel(); onClose() }}>Annuler l’enregistrement</button>
        </>
      ) : (
        <PillButton onClick={() => void rec.start()}><Icon name="mic" size={20} />Démarrer</PillButton>
      )}
    </BottomSheet>
  )
}
