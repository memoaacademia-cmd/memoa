import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import RichText from '../components/RichText'
import { BottomSheet, ErrorBox, Icon, MemoAvatar, PillInput, Row, RowGroup, Spinner, useAction, useLoad } from '../components/ui'
import { askAI, listConversations, listCourses, listMessages, searchNotes, type NoteHit } from '../lib/api'
import { useAuth } from '../lib/auth'
import { readPhotoText } from '../lib/ocr'
import { extractPdfText } from '../lib/pdfimport'
import { canDictate, canSpeak, speak, startDictation, stopSpeaking, useVoice, type Dictation } from '../lib/speech'
import type { Message } from '../lib/types'
import { WEB_SEARCH_ENABLED } from '../lib/features'

const SUGGESTIONS = ['Résume ce cours', 'Donne-moi des exemples', 'Fais-moi un quiz de 5 questions']

export default function Assistant() {
  const { user, profile } = useAuth()
  const courses = useLoad(() => listCourses(user?.id ?? ''), [user?.id])
  const convs = useLoad(listConversations, [])
  const { busy, error, setError, run } = useAction()
  const [courseId, setCourseId] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [web, setWeb] = useState(WEB_SEARCH_ENABLED)
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
  }, [messages, busy])

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

  function toggleMic() {
    if (listening) { dict.current?.stop(); return }
    setError(null)
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
    if (!prompt || busy) return
    setText('')
    const joined = attach
    setAttach(null)
    setMessages((m) => [...m, { id: 'u' + Date.now(), role: 'user', content: (joined ? `${joined.name}\n` : '') + prompt, created_at: '' }])
    const r = await run(() => askAI({ task: 'chat', prompt, courseId: courseId || null, conversationId, web, attachment: joined?.text }))
    if (r) {
      setConversationId(r.conversationId)
      setMessages((m) => [...m, { id: 'a' + Date.now(), role: 'assistant', content: r.reply, created_at: '' }])
      convs.reload()
    }
  }
  function submit(e: FormEvent) { e.preventDefault(); void send(text) }

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
        <button type="button" className="as-course" onClick={() => setSheet('course')} aria-label="Choisir le cours">
          <span>{courseName ?? 'Aucun cours'}</span>
          <Icon name="chevdown" size={18} />
        </button>
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
        {busy && <div className="as-ai muted">Réflexion…</div>}
      </div>

      <form className="as-comp" onSubmit={submit}>
        <ErrorBox message={error} />
        {(attach || reading) && (
          <div>
            {reading ? <span className="muted">{reading}</span> : attach && <span className="attach-chip"><Icon name="pdf" size={16} /><span>{attach.name}</span><button type="button" className="link" style={{ textDecoration: 'none' }} onClick={() => setAttach(null)} aria-label="Retirer le fichier joint"><Icon name="close" size={16} /></button></span>}
          </div>
        )}
        <div className="as-pills">
          <button type="button" className={'pill' + (courseId ? ' on' : '')} onClick={() => setSheet('course')} aria-pressed={!!courseId}>Mes notes</button>
          {WEB_SEARCH_ENABLED && <button type="button" role="switch" aria-checked={web} className={'pill' + (web ? ' on' : '')} onClick={() => setWeb((v) => !v)}>Web : {web ? 'oui' : 'non'}</button>}
        </div>
        <div className="as-field">
          <button type="button" className="as-round" onClick={() => setSheet('plus')} aria-label="Joindre une photo ou un document"><Icon name="plus" /></button>
          <label htmlFor="q" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Ta question</label>
          <input id="q" className="as-input" placeholder="Pose ta question à Memo" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
          {canDictate() && <button type="button" className={'as-round' + (listening ? ' on' : '')} onClick={toggleMic} aria-label={listening ? 'Arrêter la dictée' : 'Dicter ma question'}><Icon name="mic" /></button>}
          <button type="submit" className="as-round go" aria-label="Envoyer" disabled={busy}><Icon name="send" stroke={2} /></button>
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
