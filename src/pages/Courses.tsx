import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import RichText from '../components/RichText'
import { BackLink, Empty, ErrorBox, Icon, Spinner, useAction, useLoad } from '../components/ui'
import { addNote, askAI, createCourse, getCourse, listCourses, listNotes, listTrashedCourses, setCourseTrashed, transcribeAudio, TRASH_DAYS } from '../lib/api'
import { useAuth } from '../lib/auth'
import { logoUrlFor, universityLabel } from '../data/academic'
import { buildCoursePdf, buildTpPdf, stripAiNoise } from '../lib/pdf'
import { readPhotoText } from '../lib/ocr'
import { extractPdfText } from '../lib/pdfimport'
import { canDictate, canSpeak, speak, startDictation, stopSpeaking, type Dictation } from '../lib/speech'
import type { Note } from '../lib/types'

// On ne montre que les sources qui marchent ; audio, vidéo et photo viendront quand elles seront prêtes.
const SOURCES = [
  { id: 'texte', label: 'Texte', icon: 'text' },
  { id: 'voix', label: 'Dictée', icon: 'mic' },
  { id: 'pdf', label: 'PDF', icon: 'pdf' },
  { id: 'photo', label: 'Photo', icon: 'photo' },
  { id: 'audio', label: 'Audio', icon: 'audio' }
]

// « Ajouter une note » propose toutes les méthodes : on y ajoute l'enregistrement direct et la vidéo (réduite à sa voix par la transcription).
const NOTE_SOURCES = [
  { id: 'texte', label: 'Texte', icon: 'text' },
  { id: 'voix', label: 'Dictée', icon: 'mic' },
  { id: 'enreg', label: 'Enregistrer', icon: 'mic' },
  { id: 'audio', label: 'Audio', icon: 'audio' },
  { id: 'video', label: 'Vidéo', icon: 'video' },
  { id: 'pdf', label: 'PDF', icon: 'pdf' },
  { id: 'photo', label: 'Photo', icon: 'photo' }
]
const MAX_MEDIA_MB = 20

/* Onglet « Cours » : sert uniquement à créer un cours. Une fois créé, il est rangé dans le sac à dos. */
export function NewCourse() {
  const nav = useNavigate()
  const { user } = useAuth()
  const { busy, error, setError, run } = useAction()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [step, setStep] = useState('')
  const [source, setSource] = useState('texte')
  const [listening, setListening] = useState(false)
  const dict = useRef<Dictation | null>(null)
  const pdfInput = useRef<HTMLInputElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const audioInput = useRef<HTMLInputElement>(null)

  useEffect(() => () => { dict.current?.stop() }, [])

  function toggleDictation() {
    if (listening) { dict.current?.stop(); return }
    setError(null)
    const d = startDictation(
      (t) => setContent((c) => (c ? c + ' ' : '') + t),
      (err) => {
        setListening(false)
        if (err === 'not-allowed' || err === 'service-not-allowed') setError("Le micro est bloqué. Autorise-le dans les réglages du navigateur, puis réessaie.")
      }
    )
    if (!d) return setError("La dictée n'est pas disponible sur ce navigateur. Essaie avec Chrome.")
    dict.current = d
    setListening(true)
  }

  async function pickPdf(f: File | undefined) {
    if (!f) return
    if (f.size > 15 * 1024 * 1024) return setError('Ce PDF est trop lourd (15 Mo maximum).')
    setStep('Lecture du PDF…')
    const text = await run(() => extractPdfText(f))
    setStep('')
    if (text === undefined) return
    if (text.length < 20) return setError("Ce PDF ne contient pas de texte lisible (il est peut-être scanné). Essaie un autre PDF ou colle le texte.")
    setContent(text.slice(0, 60000))
    if (!title.trim()) setTitle(f.name.replace(/\.pdf$/i, '').slice(0, 80))
  }

  async function pickPhoto(f: File | undefined) {
    if (!f) return
    const text = await run(() => readPhotoText(f, setStep))
    setStep('')
    if (text === undefined) return
    if (text.length < 15) return setError("Je n'arrive pas à lire de texte sur cette photo. Prends-la bien droite, avec de la lumière, ou choisis un texte imprimé.")
    setContent((c) => (c ? c + '\n\n' : '') + text.slice(0, 60000))
  }

  async function pickAudio(f: File | undefined) {
    if (!f) return
    if (f.size > 20 * 1024 * 1024) return setError('Cet audio est trop lourd (20 Mo maximum). Coupe-le en plusieurs parties.')
    setStep('Transcription en cours… cela peut prendre une minute.')
    const text = await run(() => transcribeAudio(f))
    setStep('')
    if (text === undefined) return
    setContent((c) => (c ? c + '\n\n' : '') + text.slice(0, 60000))
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, '').slice(0, 80))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!title.trim()) return setError('Donne un nom à ton cours.')
    const id = await run(async () => {
      setStep('Création du cours…')
      const course = await createCourse(user.id, title)
      if (content.trim()) {
        setStep('Mise en forme de tes notes…')
        let structured = content.trim()
        try {
          if (content.trim().length > 7500) throw new Error('trop long pour la mise en forme IA')
          const r = await askAI({ task: 'structure_notes', prompt: content.trim() })
          if (r.reply.trim()) structured = r.reply.trim()
        } catch {
          /* l'IA est facultative ici : on garde le texte tel quel plutôt que de perdre la note */
        }
        await addNote(user.id, course.id, 'Notes de départ', structured.slice(0, 60000), source === 'pdf' ? 'pdf' : source === 'voix' ? 'voix' : source === 'photo' ? 'photo' : source === 'audio' ? 'audio' : 'texte')
      }
      return course.id
    })
    setStep('')
    if (id) nav(`/sac/${id}`)
  }

  return (
    <main className="page">
      <div className="topbar" style={{ justifyContent: 'space-between', gap: 8 }}>
        <h1 className="h1" style={{ whiteSpace: 'nowrap' }}>Nouveau cours</h1>
        <Link to="/sac" className="btn ghost small" style={{ whiteSpace: 'nowrap', flex: 'none' }}>Sac à dos</Link>
      </div>
      <p className="lead">Crée ton cours : il sera rangé dans ton sac à dos, où tu pourras l'enrichir et faire tes TP.</p>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
        <div className="field">
          <label htmlFor="titre">Nom du cours</label>
          <input id="titre" className="input" placeholder="Ex. Histoire de la langue française" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <span className="label-mono">Source</span>
        <div className="grid3">
          {SOURCES.map((s) => (
            <button key={s.id} type="button" className="tile" aria-pressed={source === s.id} style={{ minHeight: 92, alignItems: 'center', justifyContent: 'center', gap: 6, borderColor: source === s.id ? 'var(--btn)' : undefined }} onClick={() => { setSource(s.id); if (s.id === 'pdf') pdfInput.current?.click(); if (s.id === 'photo') photoInput.current?.click(); if (s.id === 'audio') audioInput.current?.click() }}>
              <Icon name={s.icon} size={26} color="var(--book)" />
              <span style={{ fontWeight: 600, fontSize: 14 }}>{s.label}</span>
            </button>
          ))}
        </div>
        <input ref={pdfInput} type="file" accept="application/pdf" hidden onChange={(e) => { void pickPdf(e.target.files?.[0]); e.target.value = '' }} />

        <input ref={photoInput} type="file" accept="image/*" hidden onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = '' }} />
        <input ref={audioInput} type="file" accept="audio/*" hidden onChange={(e) => { void pickAudio(e.target.files?.[0]); e.target.value = '' }} />
        {source === 'audio' && <div className="notice">Choisis l'enregistrement de ton cours (MP3, M4A, WAV… 20 Mo maximum). Je le transforme en texte, puis tu peux le relire avant de créer le cours. <button type="button" className="link" onClick={() => audioInput.current?.click()}>Choisir un audio</button></div>}
        {source === 'photo' && <div className="notice">Je lis le texte imprimé ou bien écrit. L'écriture à la main est lue moins bien : relis et corrige avant de créer le cours. <button type="button" className="link" onClick={() => photoInput.current?.click()}>Ajouter une photo</button></div>}

        {source === 'voix' && canDictate() && (
          <button type="button" className={'btn ' + (listening ? 'amber' : 'ghost')} onClick={toggleDictation}>
            <Icon name="mic" size={20} /> {listening ? 'J’écoute… touche pour arrêter' : 'Commencer la dictée'}
          </button>
        )}
        {source === 'voix' && !canDictate() && <div className="notice">La dictée n'est pas disponible sur ce navigateur. Ouvre Memoa avec Chrome.</div>}

        <div className="field">
          <label htmlFor="contenu">{source === 'pdf' ? 'Texte lu dans ton PDF (tu peux le corriger)' : source === 'photo' ? 'Texte lu sur ta photo (tu peux le corriger)' : source === 'audio' ? 'Texte de ton audio (tu peux le corriger)' : source === 'voix' ? 'Ce que tu as dicté (tu peux le corriger)' : 'Colle ou écris tes notes (facultatif)'}</label>
          <textarea id="contenu" className="textarea" rows={7} placeholder="Tu peux aussi créer le cours vide et ajouter des notes plus tard." value={content} onChange={(e) => setContent(e.target.value)} />
        </div>

        <ErrorBox message={error} />
        <div className="sticky-action">
          <button className="btn" type="submit" disabled={busy}>{busy ? step || 'Un instant…' : 'Créer mon cours'}</button>
          <span className="muted" style={{ textAlign: 'center' }}>Il sera rangé dans ton sac à dos.</span>
        </div>
      </form>
    </main>
  )
}

/* Sac à dos : l'étagère de tous les cours, chacun nommé. Corbeille de 30 jours pour les cours supprimés. */
export function Backpack() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useLoad(() => listCourses(user?.id ?? ''), [user?.id])
  const trash = useLoad(listTrashedCourses, [])
  const { busy, error: actionError, run } = useAction()
  const [showTrash, setShowTrash] = useState(false)
  const trashed = trash.data ?? []

  async function restore(id: string) {
    const ok = await run(async () => { await setCourseTrashed(id, false); return true })
    if (ok) { trash.reload(); reload() }
  }
  const daysLeft = (d?: string | null) => Math.max(0, TRASH_DAYS - Math.floor((Date.now() - new Date(d ?? Date.now()).getTime()) / 86400000))

  return (
    <main className="page">
      <BackLink to="/cours" title="Mon sac à dos" />
      <ErrorBox message={error || actionError} />
      {loading ? <Spinner /> : !data?.length ? (
        <Empty title="Ton sac à dos est vide" text="Crée ton premier cours : il sera rangé ici.">
          <Link to="/cours" className="btn small">Créer un cours</Link>
        </Empty>
      ) : (
        <div className="shelf">
          {data.map((c) => (
            <Link key={c.id} to={`/sac/${c.id}`} className="book">
              <b>{c.title}</b>
              <span className="muted">{c.notes_count} {c.notes_count > 1 ? 'notes' : 'note'}</span>
            </Link>
          ))}
        </div>
      )}
      {trashed.length > 0 && (
        <>
          <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setShowTrash((v) => !v)} aria-expanded={showTrash}>
            Corbeille ({trashed.length}) · {showTrash ? 'Masquer' : 'Voir'}
          </button>
          {showTrash && (
            <section className="card" aria-label="Cours supprimés">
              <span className="muted">Un cours supprimé reste ici {TRASH_DAYS} jours, puis il est effacé pour de bon.</span>
              {trashed.map((c) => (
                <div key={c.id} className="list-row" style={{ justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ minWidth: 0 }}><b>{c.title}</b><br /><span className="muted">{daysLeft(c.deleted_at)} j restants</span></span>
                  <button type="button" className="btn ghost small" disabled={busy} onClick={() => void restore(c.id)}>Restaurer</button>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  )
}

function fileName(name: string) {
  return (name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'cours') + '.pdf'
}
function saveBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName(name)
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/* Un cours du sac à dos : toutes les actions sont ici (notes, TP, révision, téléchargement). */
export function CourseDetail() {
  const { id = '' } = useParams()
  const { user, profile } = useAuth()
  const profileName = profile?.full_name ?? ''
  const course = useLoad(() => getCourse(id), [id])
  const notes = useLoad(() => listNotes(id), [id])
  const { busy, error, setError, run } = useAction()
  const [adding, setAdding] = useState(false)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteText, setNoteText] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [quiz, setQuiz] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const nav = useNavigate()
  const [noteSource, setNoteSource] = useState('texte')
  const [noteStep, setNoteStep] = useState('')
  const [listening, setListening] = useState(false)
  const [recording, setRecording] = useState(false)
  const dict = useRef<Dictation | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const pdfRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => { stopSpeaking(); dict.current?.stop(); recorder.current?.stream.getTracks().forEach((t) => t.stop()) }, [])

  function appendText(t: string) { setNoteText((x) => (x ? x + '\n\n' : '') + t.slice(0, 60000)) }

  function toggleDictation() {
    if (listening) { dict.current?.stop(); return }
    setError(null)
    const d = startDictation(
      (t) => setNoteText((x) => (x ? x + ' ' : '') + t),
      (err) => {
        setListening(false)
        if (err === 'not-allowed' || err === 'service-not-allowed') setError("Le micro est bloqué. Autorise-le dans les réglages du navigateur, puis réessaie.")
      }
    )
    if (!d) return setError("La dictée n'est pas disponible sur ce navigateur. Essaie avec Chrome.")
    dict.current = d
    setListening(true)
  }

  async function transcribeFile(f: File, kind: 'audio' | 'video') {
    if (f.size > MAX_MEDIA_MB * 1024 * 1024) return setError(`Ce fichier est trop lourd (${MAX_MEDIA_MB} Mo maximum). ${kind === 'video' ? 'Essaie une vidéo plus courte.' : 'Coupe-le en plusieurs parties.'}`)
    setNoteStep('Transcription en cours… cela peut prendre une minute.')
    const text = await run(() => transcribeAudio(f))
    setNoteStep('')
    if (text === undefined) return
    appendText(text)
    if (!noteTitle.trim()) setNoteTitle(f.name.replace(/\.[^.]+$/, '').slice(0, 80))
  }

  async function toggleRecording() {
    if (recording) { recorder.current?.stop(); return }
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return setError("L'enregistrement n'est pas disponible sur ce navigateur. Essaie avec Chrome.")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks: Blob[] = []
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        setRecording(false)
        const type = rec.mimeType || 'audio/webm'
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
        const file = new File(chunks, `enregistrement.${ext}`, { type })
        if (file.size) void transcribeFile(file, 'audio')
      }
      recorder.current = rec
      rec.start()
      setRecording(true)
    } catch {
      setError("Le micro est bloqué. Autorise-le dans les réglages du navigateur, puis réessaie.")
    }
  }

  async function pickPdf(f: File | undefined) {
    if (!f) return
    if (f.size > 15 * 1024 * 1024) return setError('Ce PDF est trop lourd (15 Mo maximum).')
    setNoteStep('Lecture du PDF…')
    const text = await run(() => extractPdfText(f))
    setNoteStep('')
    if (text === undefined) return
    if (text.length < 20) return setError("Ce PDF ne contient pas de texte lisible (il est peut-être scanné). Essaie un autre PDF ou colle le texte.")
    appendText(text)
    if (!noteTitle.trim()) setNoteTitle(f.name.replace(/\.pdf$/i, '').slice(0, 80))
  }

  async function pickPhoto(f: File | undefined) {
    if (!f) return
    const text = await run(() => readPhotoText(f, setNoteStep))
    setNoteStep('')
    if (text === undefined) return
    if (text.length < 15) return setError("Je n'arrive pas à lire de texte sur cette photo. Prends-la bien droite, avec de la lumière, ou choisis un texte imprimé.")
    appendText(text)
  }

  function chooseSource(id: string) {
    setNoteSource(id)
    setError(null)
    if (id === 'pdf') pdfRef.current?.click()
    if (id === 'photo') photoRef.current?.click()
    if (id === 'audio') audioRef.current?.click()
    if (id === 'video') videoRef.current?.click()
  }

  async function trashCourse() {
    if (!window.confirm(`Supprimer « ${course.data?.title ?? 'ce cours'} » ? Tu pourras le restaurer pendant ${TRASH_DAYS} jours depuis la corbeille du sac à dos.`)) return
    const ok = await run(async () => { await setCourseTrashed(id, true); return true })
    if (ok) nav('/sac')
  }

  function listen() {
    if (reading) { stopSpeaking(); setReading(false); return }
    const all = notes.data ?? []
    if (!all.length) return
    const ok = speak((course.data?.title ?? '') + '. ' + all.map((n) => n.title + '. ' + n.content).join('\n'), () => setReading(false))
    if (!ok) return setError("La lecture à voix haute n'est pas disponible sur ce navigateur.")
    setReading(true)
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    dict.current?.stop()
    const src = noteSource === 'enreg' ? 'audio' : noteSource === 'video' ? 'audio' : noteSource === 'voix' ? 'voix' : noteSource
    const ok = await run(async () => {
      await addNote(user.id, id, noteTitle, noteText.trim(), src)
      return true
    })
    if (ok) {
      setNoteTitle(''); setNoteText(''); setNoteSource('texte'); setAdding(false); notes.reload(); course.reload()
    }
  }

  async function pdf(mode: 'read' | 'save') {
    if (!course.data || !notes.data?.length) return
    // La fenêtre de lecture s'ouvre tout de suite (sinon le téléphone la bloque), puis reçoit le PDF.
    const w = mode === 'read' ? window.open('', '_blank') : null
    const blob = await run(() => buildCoursePdf(course.data!.title, profileName, notes.data as Note[]))
    if (!blob) { w?.close(); return }
    if (w) {
      const url = URL.createObjectURL(blob)
      w.location.href = url
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } else saveBlob(course.data.title, blob)
  }

  async function revise() {
    if (!notes.data?.length) return setError("Ajoute d'abord une note pour pouvoir réviser.")
    const r = await run(() => askAI({ task: 'quiz', courseId: id, prompt: 'Fais-moi un quiz de 5 questions sur ce cours, avec les réponses à la fin.' }))
    if (r) setQuiz(r.reply)
  }

  if (course.loading) return <main className="page"><Spinner /></main>
  if (!course.data) return <main className="page"><BackLink to="/sac" title="Cours introuvable" /><Empty title="Ce cours n'existe pas" text="Il a peut-être été supprimé." /></main>

  const all = notes.data ?? []
  return (
    <main className="page">
      <BackLink to="/sac" title={course.data.title} />
      <div className="grid2">
        <button type="button" className="tile" onClick={() => setAdding((v) => !v)}><Icon name="plus" size={26} color="#3ccfb4" /><span className="h2">Ajouter une note</span></button>
        <Link to={`/tp/${id}`} className="tile"><Icon name="pdf" size={26} color="#3ccfb4" /><span className="h2">Assistant TP</span></Link>
        <button type="button" className="tile" onClick={revise} disabled={busy}><Icon name="check" size={26} color="#3ccfb4" /><span className="h2">{busy ? 'Un instant…' : 'Réviser'}</span></button>
        <button type="button" className="tile" onClick={() => void pdf('read')} disabled={!all.length || busy}><Icon name="pdf" size={26} color="#3ccfb4" /><span className="h2">Lire le PDF</span></button>
        <button type="button" className="tile" onClick={() => void pdf('save')} disabled={!all.length || busy}><Icon name="download" size={26} color="#3ccfb4" /><span className="h2">Télécharger</span></button>
        {canSpeak() && <button type="button" className="tile" onClick={listen} disabled={!all.length}><Icon name="headphones" size={26} color="#3ccfb4" /><span className="h2">{reading ? 'Arrêter' : 'Écouter'}</span></button>}
      </div>

      <ErrorBox message={error} />

      {adding && (
        <form onSubmit={save} className="card" noValidate>
          <span className="label-mono">Comment veux-tu ajouter ta note ?</span>
          <div className="grid3">
            {NOTE_SOURCES.map((o) => (
              <button key={o.id} type="button" className="tile" aria-pressed={noteSource === o.id} style={{ minHeight: 84, alignItems: 'center', justifyContent: 'center', gap: 6, borderColor: noteSource === o.id ? 'var(--btn)' : undefined }} onClick={() => chooseSource(o.id)}>
                <Icon name={o.icon} size={24} color="var(--book)" />
                <span style={{ fontWeight: 600, fontSize: 13 }}>{o.label}</span>
              </button>
            ))}
          </div>
          <input ref={pdfRef} type="file" accept="application/pdf" hidden onChange={(e) => { void pickPdf(e.target.files?.[0]); e.target.value = '' }} />
          <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = '' }} />
          <input ref={audioRef} type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void transcribeFile(f, 'audio'); e.target.value = '' }} />
          <input ref={videoRef} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void transcribeFile(f, 'video'); e.target.value = '' }} />

          {noteSource === 'voix' && (canDictate()
            ? <button type="button" className={'btn ' + (listening ? 'amber' : 'ghost')} onClick={toggleDictation}><Icon name="mic" size={20} /> {listening ? 'J’écoute… touche pour arrêter' : 'Commencer la dictée'}</button>
            : <div className="notice">La dictée n'est pas disponible sur ce navigateur. Ouvre Memoa avec Chrome.</div>)}
          {noteSource === 'enreg' && <button type="button" className={'btn ' + (recording ? 'amber' : 'ghost')} onClick={() => void toggleRecording()} disabled={!!noteStep}><Icon name="mic" size={20} /> {recording ? 'Enregistrement… touche pour arrêter' : 'Démarrer l’enregistrement'}</button>}
          {noteSource === 'audio' && <div className="notice">Choisis un enregistrement (MP3, M4A, WAV… {MAX_MEDIA_MB} Mo maximum). <button type="button" className="link" onClick={() => audioRef.current?.click()}>Choisir un audio</button></div>}
          {noteSource === 'video' && <div className="notice">Je garde uniquement la voix de la vidéo et je la transforme en texte ({MAX_MEDIA_MB} Mo maximum : préfère une vidéo courte). <button type="button" className="link" onClick={() => videoRef.current?.click()}>Choisir une vidéo</button></div>}
          {noteSource === 'photo' && <div className="notice">Je lis le texte imprimé ou bien écrit. L'écriture à la main est lue moins bien : relis et corrige. <button type="button" className="link" onClick={() => photoRef.current?.click()}>Ajouter une photo</button></div>}
          {noteStep && <span className="muted">{noteStep}</span>}

          <div className="field"><label htmlFor="nt">Titre</label><input id="nt" className="input" maxLength={80} placeholder="Ex. Chapitre 2" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} /></div>
          <div className="field"><label htmlFor="nc">Ta note (tu peux la corriger)</label><textarea id="nc" className="textarea" rows={6} value={noteText} onChange={(e) => setNoteText(e.target.value)} /></div>
          <button className="btn" type="submit" disabled={busy || recording}>Enregistrer la note</button>
        </form>
      )}

      {quiz && <section className="card"><span className="label-mono">Révision</span><div style={{ lineHeight: 1.5 }}><RichText text={quiz} /></div></section>}

      <span className="label-mono">Mes notes</span>
      {notes.loading ? <Spinner /> : !all.length ? (
        <Empty title="Aucune note pour l'instant" text="Ajoute une note pour commencer à enrichir ce cours." />
      ) : all.map((n) => (
        <article key={n.id} className="card">
          <button type="button" className="link" style={{ textAlign: 'left', color: 'var(--text)', textDecoration: 'none' }} onClick={() => setOpen(open === n.id ? null : n.id)} aria-expanded={open === n.id}>
            <span className="h2">{n.title}</span><br />
            <span className="muted">{new Date(n.created_at).toLocaleDateString('fr-FR')} · {open === n.id ? 'Masquer' : 'Lire'}</span>
          </button>
          {open === n.id && <div style={{ lineHeight: 1.5 }}><RichText text={n.content} /></div>}
        </article>
      ))}

      <button type="button" className="link" style={{ alignSelf: 'center', marginTop: 16, color: 'var(--danger, #c0392b)' }} onClick={() => void trashCourse()} disabled={busy}>Supprimer ce cours</button>
    </main>
  )
}

/* Assistant TP : sujet → plan validé → document complet avec page de garde. */
export function TpAssistant() {
  const { id = '' } = useParams()
  const { profile } = useAuth()
  const course = useLoad(() => getCourse(id), [id])
  const { busy, error, setError, run } = useAction()
  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [plan, setPlan] = useState<string | null>(null)
  const [doc, setDoc] = useState<string | null>(null)
  const year = (() => { const y = new Date().getFullYear(), m = new Date().getMonth(); return m >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}` })()

  async function makePlan() {
    if (!title.trim() || !brief.trim()) return setError("Écris le titre et l'énoncé du TP.")
    const r = await run(() => askAI({ task: 'tp_plan', courseId: id, prompt: `Titre : ${title}\nConsignes : ${brief}` }))
    if (r) { setPlan(r.reply); setDoc(null) }
  }
  async function downloadTp() {
    if (!doc || !profile) return
    const blob = await run(() => buildTpPdf({
      university: profile.university, faculty: profile.faculty, department: profile.department,
      promotion: profile.promotion, vacation: profile.vacation || undefined, logoUrl: logoUrlFor(profile.university),
      title, course: course.data?.title ?? '', student: profile.full_name, year
    }, doc))
    if (blob) saveBlob(title || 'TP', blob)
  }
  async function write() {
    const r = await run(() => askAI({ task: 'tp_write', courseId: id, prompt: `Titre : ${title}\nConsignes : ${brief}\nPlan validé :\n${plan}` }))
    if (r) setDoc(stripAiNoise(r.reply))
  }

  return (
    <main className="page">
      <div className="no-print"><BackLink to={`/sac/${id}`} title="Assistant TP" /></div>
      <p className="lead no-print">Cours : <strong>{course.data?.title ?? '…'}</strong></p>

      <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="field"><label htmlFor="tpt">Titre du travail</label><input id="tpt" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. TP 1 · Le substrat gaulois" /></div>
        <div className="field"><label htmlFor="tpc">Énoncé et consignes</label><textarea id="tpc" className="textarea" rows={5} value={brief} onChange={(e) => setBrief(e.target.value)} /></div>
        <ErrorBox message={error} />
        <button className="btn" type="button" onClick={makePlan} disabled={busy}>{busy && !plan ? 'Un instant…' : 'Proposer un plan'}</button>
      </div>

      {plan && (
        <section className="card no-print">
          <span className="label-mono">Plan proposé</span>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{plan}</div>
          <button className="btn amber" type="button" onClick={write} disabled={busy}>{busy ? 'Rédaction en cours…' : 'Valider et rédiger le TP'}</button>
        </section>
      )}

      {doc && (
        <>
          <div className="cover">
            <small>République démocratique du Congo</small>
            <span className="t" style={{ fontSize: 16 }}>{profile?.university ? universityLabel(profile.university) : ''}</span>
            {logoUrlFor(profile?.university) && <img src={logoUrlFor(profile?.university)!} alt="" style={{ height: 72, maxWidth: 140, objectFit: 'contain', margin: '6px 0' }} />}
            <span className="s">{profile?.faculty}</span>
            <span className="s">Département : {profile?.department} · {profile?.promotion}{profile?.vacation ? ` · ${profile.vacation}` : ''}</span>
            <hr />
            <span className="t">{title}</span>
            <span className="s">Cours : {course.data?.title}</span>
            <span className="s">Présenté par : {profile?.full_name}</span>
            <span className="s">Année académique {year}</span>
          </div>
          <div className="doc-out">{doc}</div>
          <div className="notice no-print">Relis et vérifie le document avant de le remettre. Les sources citées doivent être contrôlées.</div>
          <button className="btn no-print" type="button" disabled={busy} onClick={downloadTp}>{busy ? 'Un instant…' : 'Télécharger le PDF du TP'}</button>
        </>
      )}
    </main>
  )
}
