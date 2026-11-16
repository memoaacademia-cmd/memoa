import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import RichText from '../components/RichText'
import ChatImage from '../components/ChatImage'
import { BottomSheet, ErrorBox, Icon, MemoAvatar, Row, RowGroup, Spinner, useAction, useLoad } from '../components/ui'
import { askAI, fetchPoints, listConversations, listCourses, listMessages, type PointsInfo } from '../lib/api'
import { useAuth } from '../lib/auth'
import { isImageRequest, parseImageMessage, plainMessage } from '../lib/imagegen'
import { pendingState, runChatAction, type TpDraft } from '../lib/chatActions'
import { useTpJob } from '../lib/tpjob'
import { chatRun, clearPending, markPending, recoverChat, resetChat, setChat, useChat, getChat, type ChatMsg } from '../lib/chatstate'
import { readPhotoText } from '../lib/ocr'
import { extractPdfText } from '../lib/pdfimport'
import { canDictate, canSpeak, speak, startDictation, stopSpeaking, useVoice, type Dictation } from '../lib/speech'
import type { Message } from '../lib/types'
import { WEB_SEARCH_ENABLED } from '../lib/features'

const SUGGESTIONS = ['Résume ce cours', 'Donne-moi des exemples', 'Fais-moi un quiz de 5 questions']

const IMAGE_NO = 'Je ne peux pas créer d’images pour le moment. Par contre, je peux t’aider avec tes notes, tes cours, des quiz ou des résumés. Et le bouton + de l’éditeur de notes te permet d’ajouter un tableau, une forme, un diagramme ou un graphique.'

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
  // L'état du chat vit hors de la page (lib/chatstate) : quitter l'Assistant n'arrête pas la réponse, on la retrouve en revenant.
  const [thinking, setThinking] = useChat('thinking')
  const mounted = useRef(true)
  const hiddenRef = useRef(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const beforeDict = useRef('')
  const [courseId, setCourseId] = useChat('courseId')
  const [conversationId, setConversationId] = useChat('conversationId')
  const [messages, setMessages] = useChat('messages')
  // TP en préparation dans le chat, et message en cours de modification (index dans la liste).
  const [tp, setTp] = useChat('tp')
  const [editing, setEditing] = useChat('editing')
  const [acting, setActing] = useChat('acting')
  const tpJob = useTpJob(tp?.courseId ?? '')
  const announced = useRef('')
  const [text, setText] = useChat('draft')
  const [listening, setListening] = useState(false)
  const [web, setWeb] = useChat('web') // éteinte par défaut : l'étudiant l'active quand il en a besoin
  const [attach, setAttach] = useChat('attach')
  const [reading, setReading] = useState('')
  const [sheet, setSheet] = useState<null | 'menu' | 'course' | 'plus'>(null)
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
  // Le chat reste en mémoire tant que l'appli est ouverte (même en arrière-plan). Si un autre compte se connecte sur cet appareil, on repart de zéro.
  useEffect(() => {
    if (!user) return
    const owner = getChat().owner
    if (owner === null) setChat({ owner: user.id })
    else if (owner !== user.id) resetChat(user.id)
  }, [user?.id])
  // Page quittée : la demande en cours continue dans lib/chatstate. En revenant (ou en rouvrant l'appli), on retrouve la réponse dans l'historique.
  useEffect(() => {
    mounted.current = true
    const back = () => { if (document.hidden) { hiddenRef.current = true } else if (!getChat().thinking) void recoverChat(() => convs.reload()) }
    document.addEventListener('visibilitychange', back)
    void recoverChat(() => convs.reload())
    return () => { mounted.current = false; document.removeEventListener('visibilitychange', back) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { void fetchPoints().then(setPts).catch(() => { /* hors connexion : pas de solde */ }) }, [])
  // Une action lancée depuis le chat (cours, quiz, TP…) met le solde à jour ailleurs que dans la réponse du chat.
  useEffect(() => {
    const on = (e: Event) => setPts((e as CustomEvent<PointsInfo | null>).detail ?? null)
    window.addEventListener('memoa-points', on)
    return () => window.removeEventListener('memoa-points', on)
  }, [])
  // Le TP lancé depuis le chat est prêt (ou a échoué) alors que l'étudiant est toujours sur cette page : Memo le dit ici.
  useEffect(() => {
    if (!tp?.writing || !tpJob) return
    if (tpJob.result !== null && announced.current !== tp.courseId + ':ok') {
      announced.current = tp.courseId + ':ok'
      setMessages((m) => [...m, { id: 'x' + Date.now(), role: 'assistant', local: true, created_at: '', content: `Ton TP « ${tp.title} » est prêt ! Va dans le cours « ${tp.courseTitle} » › Assistant TP : tu le trouveras déjà rédigé, prêt à télécharger en PDF avec sa page de garde.`, link: { to: `/tp/${tp.courseId}`, label: 'Ouvrir l’Assistant TP' }, fact: `TP « ${tp.title} » rédigé : prêt dans l'Assistant TP du cours.`, tpSnap: null }])
      setTp(null)
    } else if (tpJob.error && !tpJob.running && announced.current !== tp.courseId + ':err') {
      announced.current = tp.courseId + ':err'
      setMessages((m) => [...m, { id: 'x' + Date.now(), role: 'assistant', local: true, created_at: '', content: `La rédaction de ton TP « ${tp.title} » s’est arrêtée : ${tpJob.error} Ouvre l’Assistant TP du cours pour la reprendre, sans point en plus.`, link: { to: `/tp/${tp.courseId}`, label: 'Ouvrir l’Assistant TP' } }])
    }
  }, [tp, tpJob])
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
    setAttach({ name: f.name || 'photo', text: t.slice(0, 20000) })
  }
  function readAloud(m: Message) {
    if (speakingId === m.id) { stopSpeaking(); return }
    if (!speak(plainMessage(m.content), undefined, { label: `Réponse de ${profile?.memo_name || 'Memo'}`, id: m.id }))
      setError("La lecture à voix haute n'est pas disponible sur ce navigateur.")
  }
  async function copy(m: Message) {
    try { await navigator.clipboard.writeText(plainMessage(m.content)); setCopied(m.id); window.setTimeout(() => setCopied(''), 1500) } catch { /* copie refusée : rien à faire */ }
  }

  /** Touche le crayon : le message revient dans le champ ; en envoyant, il remplace ce message et tout ce qui le suit. */
  function startEdit(i: number) {
    const m = messages[i]
    if (!m || m.role !== 'user' || thinking) return
    setEditing(i)
    setText(m.raw ?? m.content)
    setAttach(m.att ?? null)
    setError(null)
    window.setTimeout(() => taRef.current?.focus(), 0)
  }
  function cancelEdit() { setEditing(null); setText(''); setAttach(null) }

  async function send(question: string) {
    const prompt = question.trim()
    if (!prompt || thinking) return
    if (listening) stopMic()
    const joined = attach
    // Modification d'un message déjà envoyé : on repart de ce point. Le serveur remplace ce message et la suite (et compte un nouveau message).
    const wasEditing = editing !== null
    const base = editing !== null ? messages.slice(0, editing) : messages
    let tpNow = tp
    let editFrom: string | null = null
    if (editing !== null) {
      tpNow = [...base].reverse().find((m) => m.tpSnap !== undefined)?.tpSnap ?? null
      if (conversationId) {
        const nth = base.filter((m) => m.role === 'user' && !m.local).length
        const rows = await run(() => listMessages(conversationId))
        if (rows === undefined) return
        editFrom = rows.filter((m) => m.role === 'user')[nth]?.id ?? null
      }
    }
    setText('')
    setAttach(null)
    setEditing(null)
    const gen = ++chatRun.gen // une réponse qui arrive après « stop » ou après un autre envoi est ignorée
    hiddenRef.current = false
    const userMsg: ChatMsg = { id: 'u' + Date.now(), role: 'user', content: (joined ? `${joined.name}\n` : '') + prompt, created_at: '', raw: prompt, att: joined ?? undefined }
    // Memo ne crée pas d'images : il le dit tout de suite, sans appeler le serveur (rien n'est consommé).
    if (!joined && !wasEditing && isImageRequest(prompt)) {
      setMessages([...base, { ...userMsg, local: true }, { id: 'a' + Date.now(), role: 'assistant', local: true, created_at: '', content: IMAGE_NO }])
      return
    }
    setMessages([...base, userMsg])
    if (wasEditing) setTp(tpNow)
    setThinking(true)
    markPending(conversationId, base.filter((m) => !m.local).length) // si l'appli est fermée avant la réponse, on la retrouvera dans l'historique
    const r = await run(() => askAI({
      task: 'chat', prompt, courseId: courseId || null, conversationId, web, attachment: joined?.text, editFrom,
      pending: pendingState(tpNow, base.map((m) => m.fact).filter((f): f is string => !!f)) || undefined
    }))
    // Si l'étudiant a appuyé sur stop pendant ce temps, la réponse est simplement ignorée.
    if (gen !== chatRun.gen) return
    if (!r) {
      setThinking(false)
      // L'appli était en veille pendant l'envoi : la réponse est peut-être déjà enregistrée, on la cherche dans l'historique.
      if (hiddenRef.current) { setError(null); void recoverChat(() => convs.reload()) } else clearPending()
      return
    }
    clearPending()
    if ('points' in r && r.points !== undefined) setPts(r.points)
    setConversationId(r.conversationId)
    setMessages((m) => [...m, { id: 'a' + Date.now(), role: 'assistant', content: r.reply, created_at: '' }])
    convs.reload()
    if (!r.action || !user) { setThinking(false); return }
    // Memo demande une action (créer un cours, quiz, TP…) : elle est exécutée ici, avec ses propres points ; le résultat est dit dans le chat.
    setActing(true)
    const out = await runChatAction(r.action, { userId: user.id, courses: courses.data ?? [], courseId, attachment: joined?.text, message: prompt, tp: tpNow })
    setActing(false)
    setThinking(false)
    if (out.tp !== undefined) setTp(out.tp)
    if (out.reload) courses.reload()
    const first = out.text.split('\n')[0].slice(0, 160)
    setMessages((m) => [...m, {
      id: 'x' + Date.now(), role: 'assistant', local: true, created_at: '', content: out.text,
      link: out.link ?? (out.premium ? { to: '/premium', label: 'Voir Premium' } : undefined),
      fact: first, tpSnap: out.tp
    }])
  }
  function stopThinking() { chatRun.gen++; clearPending(); setThinking(false); setActing(false); setError(null) }
  function submit(e: FormEvent) { e.preventDefault(); void send(text) }
  function onKey(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    // Sur ordinateur : Entrée envoie, Maj+Entrée saute une ligne. Sur téléphone : Entrée saute une ligne.
    if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) { e.preventDefault(); void send(text) }
  }

  async function openConv(id: string) {
    const msgs = await run(() => listMessages(id))
    if (msgs) { chatRun.gen++; clearPending(); setThinking(false); setActing(false); setConversationId(id); setMessages(msgs); setTp(null); setEditing(null); setSheet(null) }
  }
  function fresh() { chatRun.gen++; clearPending(); setThinking(false); setActing(false); setConversationId(null); setMessages([]); setTp(null); setEditing(null); setError(null); setSheet(null) }

  const courseName = (courses.data ?? []).find((c) => c.id === courseId)?.title

  return (
    <main className={'as-root' + (kb ? ' kb' : '')} style={box ? { height: box.h, top: box.top } : undefined}>
      <div className="as-head">
        <button type="button" data-tour="as-menu" className="icon-btn round" onClick={() => setSheet('menu')} aria-label="Menu : historique et nouvelle conversation"><Icon name="menu" /></button>
        <span className="as-title-wrap">
          <span className="as-title">{profile?.memo_name ?? 'Memo'}</span>
          {pts && (
            <span className={'pts-chip free' + (pts.left <= 0 ? ' zero' : '')} role="status" aria-label={pts.left <= 0 ? 'Plus de points. Ils reviennent à minuit, heure de Kinshasa.' : `${pts.left} points restants aujourd’hui. Ils reviennent à 20 chaque jour à minuit, heure de Kinshasa.`}>
              <span className="gold-bolt"><Icon name="bolt" size={14} /></span>
              {pts.left > 0 || !resetMs ? pts.left : countdown(resetMs - now)}
            </span>
          )}
        </span>
        <button type="button" className="icon-btn round" onClick={fresh} aria-label="Nouvelle conversation"><Icon name="newchat" /></button>
      </div>

      <div className="as-msgs" ref={msgsRef} aria-live="polite">
        {!messages.length && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '28px 8px', textAlign: 'center' }}>
            <span className="hm-memo-av" style={{ width: 72, height: 72 }}><MemoAvatar animal={profile?.memo_animal ?? null} size={50} /></span>
            <strong className="h2">{profile?.memo_name ?? 'Memo'}</strong>
            <span className="muted">{courseId ? 'Je m’appuie sur les notes de ce cours.' : 'Choisis un cours pour que je m’appuie sur tes notes, ou pose-moi une question libre.'}</span>
            <span className="muted" style={{ fontSize: 13 }}>Je peux aussi créer un cours, ajouter une note, faire un quiz ou un résumé, et préparer un TP : demande-moi ici.</span>
            {!!courseId && <div className="as-pills" style={{ justifyContent: 'center' }}>{SUGGESTIONS.map((s) => <button key={s} type="button" className="pill" onClick={() => void send(s)}>{s}</button>)}</div>}
          </div>
        )}
        {messages.map((m, i) => m.role === 'user' ? (
          <div key={m.id} className="as-user-wrap">
            {!thinking && <button type="button" className="as-edit" onClick={() => startEdit(i)} aria-label="Modifier ce message"><Icon name="pencil" size={16} /></button>}
            <div className="as-user">{m.content}</div>
          </div>
        ) : (
          <div key={m.id} className="as-ai">
            {(() => {
              const img = parseImageMessage(m.content)
              return img ? <><ChatImage path={img.path} />{img.text && <RichText text={img.text} />}</> : <RichText text={m.content} />
            })()}
            {m.link && <Link to={m.link.to} className="pill-btn sm as-link">{m.link.label}</Link>}
            <div className="as-acts">
              <button type="button" className="speak-btn" style={{ margin: 0 }} onClick={() => void copy(m)} aria-label="Copier la réponse"><Icon name={copied === m.id ? 'check' : 'copy'} size={18} /></button>
              {canSpeak() && <button type="button" className={'speak-btn' + (speakingId === m.id ? ' on' : '')} style={{ margin: 0 }} onClick={() => readAloud(m)} aria-label={speakingId === m.id ? 'Arrêter la lecture' : 'Écouter la réponse'} aria-pressed={speakingId === m.id}><Icon name={speakingId === m.id ? 'stop' : 'speaker'} size={18} /></button>}
            </div>
          </div>
        ))}
        {thinking && <div className="as-ai muted">{acting ? `${profile?.memo_name || 'Memo'} s’en occupe…` : 'Réflexion…'}</div>}
      </div>

      <form className="as-comp" onSubmit={submit}>
        <ErrorBox message={error} />
        {editing !== null && (
          <div className="as-editing" role="status">
            <span>Tu modifies ton message : {profile?.memo_name || 'Memo'} repart de ce point. Cela compte comme un nouveau message.</span>
            <button type="button" className="link" style={{ textDecoration: 'none' }} onClick={cancelEdit}>Annuler</button>
          </div>
        )}
        {(attach || reading) && (
          <div>
            {reading ? <span className="muted">{reading}</span> : attach && <span className="attach-chip"><Icon name="pdf" size={16} /><span>{attach.name}</span><button type="button" className="link" style={{ textDecoration: 'none' }} onClick={() => setAttach(null)} aria-label="Retirer le fichier joint"><Icon name="close" size={16} /></button></span>}
          </div>
        )}
        <div data-tour="as-composer" className={'as-bar' + (listening ? ' live' : '')}>
          <label htmlFor="q" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Ta question</label>
          <textarea
            id="q"
            ref={taRef}
            className="as-ta"
            rows={1}
            placeholder={listening ? 'Je t’écoute…' : 'Pose ta question à Memo'}
            maxLength={40000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            onFocus={() => { if (listening) stopMic() }}
          />
          <div className="as-tools">
            <button type="button" className="as-ico" onClick={() => setSheet('plus')} aria-label="Joindre une photo ou un document"><Icon name="plus" size={22} /></button>
            <button type="button" data-tour="as-course" className={'as-ico' + (courseId ? ' on' : '')} onClick={() => setSheet('course')} aria-pressed={!!courseId} aria-label={courseId ? `Mes notes : ${courseName ?? 'cours choisi'}` : 'Mes notes : choisir un cours'}>
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
    </main>
  )
}
