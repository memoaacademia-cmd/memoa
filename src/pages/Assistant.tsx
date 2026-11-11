import { useEffect, useRef, useState, type FormEvent } from 'react'
import RichText from '../components/RichText'
import { ErrorBox, Icon, MemoAvatar, Spinner, useAction, useLoad } from '../components/ui'
import { askAI, listConversations, listCourses, listMessages } from '../lib/api'
import { useAuth } from '../lib/auth'
import { readPhotoText } from '../lib/ocr'
import { extractPdfText } from '../lib/pdfimport'
import { canDictate, canSpeak, speak, startDictation, stopSpeaking, useVoice, type Dictation } from '../lib/speech'
import type { Message } from '../lib/types'
import { WEB_SEARCH_ENABLED } from '../lib/features'

/** Passe à true quand le secret SEARCH_API_KEY (Tavily) est présent dans Supabase : le bouton réapparaît. */

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
  const [history, setHistory] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)
  const [listening, setListening] = useState(false)
  const [web, setWeb] = useState(WEB_SEARCH_ENABLED)
  const [attach, setAttach] = useState<{ name: string; text: string } | null>(null)
  const [menu, setMenu] = useState(false)
  const [reading, setReading] = useState('')
  const photoRef = useRef<HTMLInputElement>(null)
  const docRef = useRef<HTMLInputElement>(null)
  const speakingId = useVoice()?.id ?? null
  const dict = useRef<Dictation | null>(null)

  useEffect(() => () => { dict.current?.stop() }, [])

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
    setMenu(false)
    if (!f) return
    setReading(kind === 'photo' ? 'Lecture de la photo…' : 'Lecture du document…')
    const text = await run(async () => {
      if (kind === 'photo' || f.type.startsWith('image/')) return readPhotoText(f, setReading)
      if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) return extractPdfText(f)
      return (await f.text()).trim()
    })
    setReading('')
    if (text === undefined) return
    if (text.length < 10) return setError("Je n'ai pas pu lire de texte dans ce fichier. Essaie une photo plus nette ou un PDF non scanné.")
    setAttach({ name: f.name || 'photo', text: text.slice(0, 6500) })
  }
  function readAloud(m: Message) {
    if (speakingId === m.id) { stopSpeaking(); return }
    if (!speak(m.content, undefined, { label: 'Réponse de Memo', id: m.id }))
      setError("La lecture à voix haute n'est pas disponible sur ce navigateur.")
  }

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }) }, [messages, busy])

  async function send(q: string) {
    const prompt = q.trim()
    if (!prompt || busy) return
    setText('')
    const joined = attach
    setAttach(null)
    setMessages((m) => [...m, { id: 'u' + Date.now(), role: 'user', content: (joined ? `📎 ${joined.name}\n` : '') + prompt, created_at: '' }])
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
    if (msgs) { setConversationId(id); setMessages(msgs); setHistory(false) }
  }
  function fresh() { setConversationId(null); setMessages([]); setError(null); setHistory(false) }

  return (
    <main className="page" style={{ paddingBottom: 200 }}>
      <div className="topbar" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span className="hm-memo-av" style={{ width: 44, height: 44 }}><MemoAvatar animal={profile?.memo_animal ?? null} size={30} /></span>
          <div style={{ minWidth: 0 }}><div className="h1" style={{ fontSize: 17, lineHeight: '22px', fontWeight: 800 }}>{profile?.memo_name ?? 'Memo'}</div><span className="muted" style={{ fontSize: 12 }}>Assistant d’étude</span></div>
        </div>
        <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
          <button type="button" className="icon-btn" onClick={() => setHistory((v) => !v)} aria-label="Historique des conversations"><Icon name="clock" size={20} /></button>
          <button type="button" className="icon-btn" style={{ background: 'var(--btn)', border: 0 }} onClick={fresh} aria-label="Nouvelle conversation"><Icon name="plus" size={20} color="var(--btn-text)" stroke={2.4} /></button>
        </div>
      </div>

      <div className="field">
        <label htmlFor="ctx" className="muted">Contexte</label>
        <select id="ctx" className="select" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">Aucun cours en particulier</option>
          {(courses.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>

      {WEB_SEARCH_ENABLED && <div className="chips">
        <button type="button" role="switch" aria-checked={web} className={'pill' + (web ? ' on' : '')} onClick={() => setWeb((v) => !v)}>Recherche web : {web ? 'oui' : 'non'}</button>
      </div>}

      {history ? (
        <section className="card" aria-label="Historique des conversations">
          <span className="label-mono">Conversations</span>
          {convs.loading ? <Spinner /> : !convs.data?.length ? <span className="muted">Aucune conversation pour l'instant.</span> : convs.data.map((c) => (
            <button key={c.id} type="button" className="list-row" style={{ background: 'none', border: 0, textAlign: 'left', width: '100%' }} onClick={() => openConv(c.id)}>
              <span>{c.title || 'Conversation'}</span><span className="muted">{new Date(c.created_at).toLocaleDateString('fr-FR')}</span>
            </button>
          ))}
        </section>
      ) : (
        <div className="chat" aria-live="polite">
          {!messages.length && !courseId && <span className="muted">Choisis un cours ci-dessus pour que je m'appuie sur tes notes, ou pose-moi une question libre.</span>}
          {!messages.length && !!courseId && <div className="chips" style={{ flexWrap: 'wrap' }}>{SUGGESTIONS.map((s) => <button key={s} type="button" className="pill" onClick={() => send(s)}>{s}</button>)}</div>}
          {messages.map((m) => (
            <div key={m.id} className={'bubble ' + (m.role === 'user' ? 'user' : 'ai')}>
              {m.role !== 'user' && <span className="hm-memo-av ai-av"><MemoAvatar animal={profile?.memo_animal ?? null} size={20} /></span>}
              {m.role === 'user' ? m.content : <div style={{ minWidth: 0 }}><RichText text={m.content} /></div>}
              {m.role !== 'user' && canSpeak() && (
                <div><button type="button" className={'speak-btn' + (speakingId === m.id ? ' on' : '')} onClick={() => readAloud(m)} aria-label={speakingId === m.id ? 'Arrêter la lecture' : 'Écouter la réponse'} aria-pressed={speakingId === m.id}><Icon name={speakingId === m.id ? 'stop' : 'speaker'} size={18} /></button></div>
              )}
            </div>
          ))}
          {busy && <div className="bubble ai muted">Réflexion…</div>}
          <div ref={bottom} />
        </div>
      )}
      <ErrorBox message={error} />

      <form onSubmit={submit} style={{ position: 'fixed', bottom: 78, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 440, padding: '10px 20px', display: 'flex', flexWrap: 'wrap', gap: 10, background: 'var(--bg)' }}>
        {(attach || reading) && (
          <div style={{ width: '100%' }}>
            {reading ? <span className="muted">{reading}</span> : attach && <span className="attach-chip"><Icon name="pdf" size={16} /><span>{attach.name}</span><button type="button" className="link" style={{ textDecoration: 'none' }} onClick={() => setAttach(null)} aria-label="Retirer le fichier joint">✕</button></span>}
          </div>
        )}
        <div style={{ position: 'relative', flex: 'none' }}>
          <button type="button" className="icon-btn" style={{ width: 52, height: 52, borderRadius: '50%' }} onClick={() => setMenu((v) => !v)} aria-label="Joindre une photo ou un document" aria-expanded={menu}><Icon name="plus" /></button>
          {menu && (
            <div className="card" style={{ position: 'absolute', bottom: 62, left: 0, width: 210, padding: 8, gap: 2, zIndex: 20 }}>
              <button type="button" className="list-row" style={{ background: 'none', border: 0, textAlign: 'left' }} onClick={() => photoRef.current?.click()}><Icon name="photo" size={20} /><span>Photo ou appareil</span></button>
              <button type="button" className="list-row" style={{ background: 'none', border: 0, textAlign: 'left' }} onClick={() => docRef.current?.click()}><Icon name="pdf" size={20} /><span>Document (PDF, texte)</span></button>
            </div>
          )}
        </div>
        <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => { void pickFile(e.target.files?.[0], 'photo'); e.target.value = '' }} />
        <input ref={docRef} type="file" accept="application/pdf,text/plain,.txt,.md,image/*" hidden onChange={(e) => { void pickFile(e.target.files?.[0], 'doc'); e.target.value = '' }} />
        <label htmlFor="q" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Ta question</label>
        <input id="q" className="input" style={{ borderRadius: 26, minWidth: 0, flex: '1 1 0' }} placeholder="Pose une question" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
        {canDictate() && <button type="button" className="icon-btn" style={{ width: 52, height: 52, borderRadius: '50%', flex: 'none', background: listening ? 'var(--braise)' : undefined }} onClick={toggleMic} aria-label={listening ? 'Arrêter la dictée' : 'Dicter ma question'}><Icon name="mic" /></button>}
        <button type="submit" className="icon-btn" style={{ width: 52, height: 52, borderRadius: '50%', flex: 'none', background: 'var(--btn)', border: 0 }} aria-label="Envoyer" disabled={busy}><Icon name="send" color="var(--btn-text)" stroke={2} /></button>
      </form>
    </main>
  )
}
