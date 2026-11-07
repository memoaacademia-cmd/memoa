import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ErrorBox, Icon, MemoAvatar, Spinner, useAction, useLoad } from '../components/ui'
import { askAI, listConversations, listCourses, listMessages } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Message } from '../lib/types'

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

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }) }, [messages, busy])

  async function send(q: string) {
    const prompt = q.trim()
    if (!prompt || busy) return
    setText('')
    setMessages((m) => [...m, { id: 'u' + Date.now(), role: 'user', content: prompt, created_at: '' }])
    const r = await run(() => askAI({ task: 'chat', prompt, courseId: courseId || null, conversationId }))
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
    <main className="page" style={{ paddingBottom: 170 }}>
      <div className="topbar" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MemoAvatar animal={profile?.memo_animal ?? null} size={40} />
          <div><div className="h1" style={{ fontSize: 20, lineHeight: '24px' }}>Assistant</div><span className="muted">avec {profile?.memo_name ?? 'Memo'}</span></div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn ghost small" onClick={() => setHistory((v) => !v)}><Icon name="clock" size={18} /> Historique</button>
          <button type="button" className="icon-btn" style={{ background: '#3ccfb4', border: 0 }} onClick={fresh} aria-label="Nouvelle conversation"><Icon name="plus" size={20} color="#0b1513" stroke={2.4} /></button>
        </div>
      </div>

      <div className="field">
        <label htmlFor="ctx" className="muted">Contexte</label>
        <select id="ctx" className="select" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">Aucun cours en particulier</option>
          {(courses.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>

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
          {!messages.length && <div className="chips" style={{ flexWrap: 'wrap' }}>{SUGGESTIONS.map((s) => <button key={s} type="button" className="pill" onClick={() => send(s)}>{s}</button>)}</div>}
          {messages.map((m) => <div key={m.id} className={'bubble ' + (m.role === 'user' ? 'user' : 'ai')}>{m.content}</div>)}
          {busy && <div className="bubble ai muted">Réflexion…</div>}
          <div ref={bottom} />
        </div>
      )}
      <ErrorBox message={error} />

      <form onSubmit={submit} style={{ position: 'fixed', bottom: 78, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 440, padding: '10px 20px', display: 'flex', gap: 10, background: 'var(--bg)' }}>
        <label htmlFor="q" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Ta question</label>
        <input id="q" className="input" style={{ borderRadius: 26 }} placeholder="Pose une question sur ton cours" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="icon-btn" style={{ width: 52, height: 52, borderRadius: '50%', background: '#3ccfb4', border: 0 }} aria-label="Envoyer" disabled={busy}><Icon name="send" color="#0b1513" stroke={2} /></button>
      </form>
    </main>
  )
}
