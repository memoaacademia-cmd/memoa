import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import RichText from '../components/RichText'
import { BottomSheet, ErrorBox, Icon, MemoAvatar, PillInput, Row, RowGroup, Spinner, useAction, useLoad } from '../components/ui'
import { askAI, fetchPoints, listConversations, listCourses, listMessages, searchNotes, type NoteHit, type PointsInfo } from '../lib/api'
import { useAuth } from '../lib/auth'
import { readPhotoText } from '../lib/ocr'
import { extractPdfText } from '../lib/pdfimport'
import { canDictate, canSpeak, speak, startDictation, stopSpeaking, useVoice, type Dictation } from '../lib/speech'
import type { Message } from '../lib/types'
import { WEB_SEARCH_ENABLED } from '../lib/features'

const SUGGESTIONS = ['Résume ce cours', 'Donne-moi des exemples', 'Fais-moi un quiz de 5 questions']

/** « 6 h 59 » : temps restant avant minuit (heure de Kinshasa), quand les 20 points reviennent. */
function countdown(ms: number): string {
  const m = Math.max(0, Math.ceil(ms / 60_000))
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`
}

export default function Assistant() {
  const { user, profile } = useAuth()
  // Points gratuits : solde (ou compte à rebours à zéro). null pendant l'essai et avec Premium : rien n'est affiché.
  const [pts, setPts] = useState<PointsInfo | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const courses = useLoad(() => listCourses(user?.id ?? ''), [user?.id])
  const convs = useLoad(listConversations, [])
  const { error, setError, run } = useAction()
  const [thinking, setThinking] = useState(false)
  const cancelled = useRef(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const beforeDict = useRef('')
  const [courseId, setCourseId] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [web, setWeb] = useState(false) // éteinte par défaut : l'étudiant l'active quand il en a besoin
  const [attach, setAttach] = useState<{ name: string; text: string } | null>(null)
  const [reading, setReading] = useState('')
  const [sheet, setSheet] = useState<null | 'menu' | 'course' | 'plus' | 'search'>(null)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<NoteHit[] | null>(null)
  const [copied, setCopied] = useState('')
  const photoRef = useRef<HTMLInputElement>(null)
  const docRef = useRef<HTMLInputElement>(null)
  const msgsRef = useRef<HTMLDivElement>(null)
  const speakingId = useVoice()?.id ?? null
  const dict = useRef<Dictation | null>(null)
  // Quand le clavier s'ouvre, tout l'écran se réduit à la zone visible : la barre de saisie reste collée au clavier.
  const [box, setBox] = useState<{ h: number; top: number } | null>(null)
  const [kb, setKb] = useState(false)

  useEffect(() => () => { dict.current?.stop() }, [])
  useEffect(() => { void fetchPoints().then(setPts).catch(() => { /* hors connexion : pas de solde */ }) }, [])
  // À zéro : le compte à rebours avance chaque seconde ; à la fin, on relit le solde (les 20 points sont revenus).
  const resetMs = pts?.resetAt ? new Date(pts.resetAt).getTime() : 0
  useEffect(() => {
    if (!resetMs) return
    const t = window.setInterval(() => {
      setNow(Date.now())
      if (Date.now() >= resetMs) void fetchPoints().then(setPts).catch(() => { /* on réessaiera */ })
    }, 1000)
    return () => window.clearInterval(t)
  }, [resetMs])
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const on = () => {
      const open = window.innerHeight - vv.height > 120
      setKb(open)
      setBox(open ? { h: Math.round(vv.height), top: Math.round(vv.offsetTop) } : null)
    }
    on()
    vv.addEventListener('resize', on)
    vv.addEventListener('scroll', on)
    return () => { vv.removeEventListener('resize', on); vv.removeEventListener('scroll', on) }
  }, [])

  // Seuls les messages défilent : on descend en bas quand un message arrive.
  useEffect(() => {
    const el = msgsRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, thinking])

  // Recherche dans les notes (loupe).
  useEffect(() => {
    if (sheet !== 'search') return
    const term = q.trim()
    if (term.length < 2 || !user) { setHits(null); return }
    let alive = true
    const t = window.setTimeout(() => {
      searchNotes(user.id, term).then((r) => { if (alive) setHits(r) }).catch(() => { if (alive) setHits([]) })
    }, 250)
    return () => { alive = false; window.clearTimeout(t) }
  }, [q, sheet, user])

  function startMic() {
    setError(null)
    beforeDict.current = text
    const d = startDictation(
      (t) => setText((x) => (x ? x + ' ' : '') + t),
      (err) => {
        setListening(false)
        if (err === 'not-allowed' || err === 'service-not-allowed') setError('Le micro est bloqué. Autorise-le dans les réglages du navigateur, puis réessaie.')
      }
    )
    if (!d) return setError("La dictée n'est pas disponible sur ce navigateur. Essaie avec Chrome.")
    dict.current = d
    setListening(true)
  }
  /** Arrête l'écoute en gardant le texte déjà dicté. */
  function stopMic() { dict.current?.stop(); setListening(false) }
  /** Croix : arrête l'écoute et efface ce qui vient d'être dicté. */
  function cancelMic() { stopMic(); setText(beforeDict.current) }
  /** Le champ grandit vers le bas avec le texte, puis défile à l'intérieur au-delà de 6 lignes. */
  function grow() {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 150) + 'px'
  }
  useEffect(grow, [text])
  async function pickFile(f: File | undefined, kind: 'photo' | 'doc') {
    if (!f) return
    setReading(kind === 'photo' ? 'Lecture de la photo…' : 'Lecture du document…')
    const t = await run(async () => {
      if (kind === 'photo' || f.type.startsWith('image/')) return readPhotoText(f, setReading)
      if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) return extractPdfText(f)
      return (await f.text()).trim()
    })
    setReading('')
    if (t === undefined) return
    if (t.length < 10) return setError("Je n'ai pas pu lire de texte dans ce fichier. Essaie une photo plus nette ou un PDF non scanné.")
    setAttach({ name: f.name || 'photo', text: t.slice(0, 6500) })
  }
  function readAloud(m: Message) {
    if (speakingId === m.id) { stopSpeaking(); return }
    if (!speak(m.content, undefined, { label: 'Réponse de Memo', id: m.id }))
      setError("La lecture à voix haute n'est pas disponible sur ce navigateur.")
  }
  async function copy(m: Message) {
    try { await navigator.clipboard.writeText(m.content); setCopied(m.id); window.setTimeout(() => setCopied(''), 1500) } catch { /* copie refusée : rien à faire */ }
  }

  async function send(question: string) {
    const prompt = question.trim()
    if (!prompt || thinking) return
    if (listening) stopMic()
    setText('')
    const joined = attach
    setAttach(null)
    cancelled.current = false
    setMessages((m) => [...m, { id: 'u' + Date.now(), role: 'user', content: (joined ? `${joined.name}\n` : '') + prompt, created_at: '' }])
    setThinking(true)
    const r = await run(() => askAI({ task: 'chat', prompt, courseId: courseId || null, conversationId, web, attachment: joined?.text }))
    // Si l'étudiant a appuyé sur stop pendant ce temps, la réponse est simplement ignorée.
    if (cancelled.current) return
    setThinking(false)
    if (r) {
      if (r.points !== undefined) setPts(r.points)
      setConversationId(r.conversationId)
      setMessages((m) => [...m, { id: 'a' + Date.now(), role: 'assistant', content: r.reply, created_at: '' }])
      convs.reload()
    }
  }
  function stopThinking() { cancelled.current = true; setThinking(false); setError(null) }
  function submit(e: FormEvent) { e.preventDefault(); void send(text) }
  function onKey(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    // Sur ordinateur : Entrée envoie, Maj+Entrée saute une ligne. Sur téléphone : Entrée saute une ligne.
    if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) { e.preventDefault(); void send(text) }
  }

  async function openConv(id: string) {
    const msgs = await run(() => listMessages(id))
    if (msgs) { setConversationId(id); setMessages(msgs); setSheet(null) }
  }
  function fresh() { setConversationId(null); setMessages([]); setError(null); setSheet(null) }

  const courseName = (courses.data ?? []).find((c) => c.id === courseId)?.title

  return (
    <main className={'as-root' + (kb ? ' kb' : '')} style={box ? { height: box.h, top: box.top } : undefined}>
      <div className="as-head">
        <button type="button" className="icon-btn round" onClick={() => setSheet('menu')} aria-label="Menu : historique et nouvelle conversation"><Icon name="menu" /></button>
        <span className="as-title-wrap">
          <span className="as-title">{profile?.memo_name ?? 'Memo'}</span>
          {pts && (
            <span className={'pts-chip' + (pts.left <= 0 ? ' zero' : '')} role="status" aria-label={pts.left <= 0 ? 'Plus de points. Ils reviennent à minuit, heure de Kinshasa.' : `${pts.left} points restants aujourd’hui. Ils reviennent à 20 chaque jour à minuit, heure de Kinshasa.`}>
              <Icon name="bolt" size={14} />
              {pts.left > 0 || !resetMs ? pts.left : countdown(resetMs - now)}
            </span>
          )}
        </span>
        <button type="button" className="icon-btn round" onClick={() => { setQ(''); setHits(null); setSheet('search') }} aria-label="Chercher dans mes notes"><Icon name="search" /></button>
      </div>

      <div className="as-msgs" ref={msgsRef} aria-live="polite">
        {!messages.length && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '28px 8px', textAlign: 'center' }}>
            <span className="hm-memo-av" style={{ width: 72, height: 72 }}><MemoAvatar animal={profile?.memo_animal ?? null} size={50} /></span>
            <strong className="h2">{profile?.memo_name ?? 'Memo'}</strong>
            <span className="muted">{courseId ? 'Je m’appuie sur les notes de ce cours.' : 'Choisis un cours pour que je m’appuie sur tes notes, ou pose-moi une question libre.'}</span>
            {!!courseId && <div className="as-pills" style={{ justifyContent: 'center' }}>{SUGGESTIONS.map((s) => <button key={s} type="button" className="pill" onClick={() => void send(s)}>{s}</button>)}</div>}
          </div>
        )}
        {messages.map((m) => m.role === 'user' ? (
          <div key={m.id} className="as-user">{m.content}</div>
        ) : (
          <div key={m.id} className="as-ai">
            <RichText text={m.content} />
            <div className="as-acts">
              <button type="button" className="speak-btn" style={{ margin: 0 }} onClick={() => void copy(m)} aria-label="Copier la réponse"><Icon name={copied === m.id ? 'check' : 'copy'} size={18} /></button>
              {canSpeak() && <button type="button" className={'speak-btn' + (speakingId === m.id ? ' on' : '')} style={{ margin: 0 }} onClick={() => readAloud(m)} aria-label={speakingId === m.id ? 'Arrêter la lecture' : 'Écouter la réponse'} aria-pressed={speakingId === m.id}><Icon name={speakingId === m.id ? 'stop' : 'speaker'} size={18} /></button>}
            </div>
          </div>
        ))}
        {thinking && <div className="as-ai muted">Réflexion…</div>}
      </div>

      <form className="as-comp" onSubmit={submit}>
        <ErrorBox message={error} />
        {(attach || reading) && (
          <div>
            {reading ? <span className="muted">{reading}</span> : attach && <span className="attach-chip"><Icon name="pdf" size={16} /><span>{attach.name}</span><button type="button" className="link" style={{ textDecoration: 'none' }} onClick={() => setAttach(null)} aria-label="Retirer le fichier joint"><Icon name="close" size={16} /></button></span>}
          </div>
        )}
        <div className={'as-bar' + (listening ? ' live' : '')}>
          <label htmlFor="q" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Ta question</label>
          <textarea
            id="q"
            ref={taRef}
            className="as-ta"
            rows={1}
            placeholder={listening ? 'Je t’écoute…' : 'Pose ta question à Memo'}
            maxLength={6000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            onFocus={() => { if (listening) stopMic() }}
          />
          <div className="as-tools">
            <button type="button" className="as-ico" onClick={() => setSheet('plus')} aria-label="Joindre une photo ou un document"><Icon name="plus" size={22} /></button>
            <button type="button" className={'as-ico' + (courseId ? ' on' : '')} onClick={() => setSheet('course')} aria-pressed={!!courseId} aria-label={courseId ? `Mes notes : ${courseName ?? 'cours choisi'}` : 'Mes notes : choisir un cours'}>
              <Icon name="book" size={20} />
              {courseId && courseName && <span className="as-ico-t">{courseName}</span>}
            </button>
            {WEB_SEARCH_ENABLED && (
              <button type="button" role="switch" aria-checked={web} className={'as-ico' + (web ? ' on' : '')} onClick={() => setWeb((v) => !v)} aria-label="Recherche sur le web">
                <Icon name="globe" size={20} />
              </button>
            )}
            <span style={{ flex: 1 }} />
            {thinking ? (
              <button type="button" className="as-act go" onClick={stopThinking} aria-label="Arrêter la réponse"><Icon name="stop" size={18} stroke={2.4} /></button>
            ) : listening ? (
              <>
                <button type="button" className="as-act" onClick={cancelMic} aria-label="Annuler la dictée"><Icon name="close" size={20} stroke={2.2} /></button>
                <button type="submit" className="as-act go" aria-label="Envoyer" disabled={!text.trim()}><Icon name="arrowup" size={20} stroke={2.4} /></button>
              </>
            ) : text.trim() ? (
              <button type="submit" className="as-act go" aria-label="Envoyer"><Icon name="arrowup" size={20} stroke={2.4} /></button>
            ) : canDictate() ? (
              <button type="button" className="as-act" onClick={startMic} aria-label="Dicter ma question"><Icon name="mic" size={20} /></button>
            ) : null}
          </div>
        </div>
      </form>

      {/* Sélecteurs de fichiers : toujours présents, ouverts directement par un appui. */}
      <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => { void pickFile(e.target.files?.[0], 'photo'); e.target.value = '' }} />
      <input ref={docRef} type="file" accept="application/pdf,text/plain,.txt,.md,image/*" hidden onChange={(e) => { void pickFile(e.target.files?.[0], 'doc'); e.target.value = '' }} />

      <BottomSheet open={sheet === 'menu'} onClose={() => setSheet(null)} title="Conversations">
        <RowGroup>
          <Row icon="plus" title="Nouvelle conversation" onClick={fresh} chevron={false} />
          {convs.loading ? <div className="rg-empty">Chargement…</div> : !convs.data?.length ? <div className="rg-empty">Aucune conversation pour l’instant.</div> : convs.data.map((c) => (
            <Row key={c.id} icon="chat" title={c.title || 'Conversation'} right={new Date(c.created_at).toLocaleDateString('fr-FR')} onClick={() => void openConv(c.id)} chevron={false} />
          ))}
        </RowGroup>
      </BottomSheet>

      <BottomSheet open={sheet === 'course'} onClose={() => setSheet(null)} title="Sur quel cours ?">
        {courses.loading ? <Spinner /> : (
          <RowGroup>
            <button type="button" className="rg-row" onClick={() => { setCourseId(''); setSheet(null) }}>
              <span className="rg-body"><span className="rg-title">Aucun cours en particulier</span></span>
              <span className={'radio' + (!courseId ? ' on' : '')} />
            </button>
            {(courses.data ?? []).map((c) => (
              <button key={c.id} type="button" className="rg-row" onClick={() => { setCourseId(c.id); setSheet(null) }}>
                <span className="rg-body"><span className="rg-title">{c.title}</span><span className="rg-sub">{c.notes_count} {c.notes_count > 1 ? 'notes' : 'note'}</span></span>
                <span className={'radio' + (courseId === c.id ? ' on' : '')} />
              </button>
            ))}
          </RowGroup>
        )}
      </BottomSheet>

      <BottomSheet open={sheet === 'plus'} onClose={() => setSheet(null)} title="Joindre">
        <RowGroup>
          <Row icon="photo" title="Photo ou appareil" sub="Je lis le texte de l’image" onClick={() => { setSheet(null); photoRef.current?.click() }} />
          <Row icon="pdf" title="Document" sub="PDF ou texte" onClick={() => { setSheet(null); docRef.current?.click() }} />
        </RowGroup>
      </BottomSheet>

      <BottomSheet open={sheet === 'search'} onClose={() => setSheet(null)} title="Chercher dans mes notes">
        <PillInput type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Un mot, un titre…" aria-label="Chercher dans mes notes" autoFocus />
        {hits !== null && (
          hits.length ? (
            <RowGroup>
              {hits.map((h) => <Row key={h.id} icon="text" title={h.title || 'Note'} sub={h.snippet} to={`/sac/${h.course_id}`} />)}
            </RowGroup>
          ) : <div className="rg-empty">Aucune note ne correspond.</div>
        )}
        <Link to="/sac" className="link" style={{ alignSelf: 'center', textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Voir tous mes cours</Link>
      </BottomSheet>
    </main>
  )
}
