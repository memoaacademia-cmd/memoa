import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BackLink, Empty, ErrorBox, Icon, Spinner, useAction, useLoad } from '../components/ui'
import { addNote, askAI, createCourse, getCourse, listCourses, listNotes } from '../lib/api'
import { useAuth } from '../lib/auth'

const SOURCES = [
  { id: 'texte', label: 'Texte', icon: 'text', ready: true },
  { id: 'voix', label: 'Voix', icon: 'mic', ready: false },
  { id: 'audio', label: 'Audio', icon: 'audio', ready: false },
  { id: 'video', label: 'Vidéo', icon: 'video', ready: false },
  { id: 'pdf', label: 'PDF', icon: 'pdf', ready: false },
  { id: 'photo', label: 'Photo', icon: 'photo', ready: false }
]

/* Onglet « Cours » : sert uniquement à créer un cours. Une fois créé, il est rangé dans le sac à dos. */
export function NewCourse() {
  const nav = useNavigate()
  const { user } = useAuth()
  const { busy, error, setError, run } = useAction()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [step, setStep] = useState('')

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
          const r = await askAI({ task: 'structure_notes', prompt: content.trim() })
          if (r.reply.trim()) structured = r.reply.trim()
        } catch {
          /* l'IA est facultative ici : on garde le texte tel quel plutôt que de perdre la note */
        }
        await addNote(user.id, course.id, 'Notes de départ', structured, 'texte')
      }
      return course.id
    })
    setStep('')
    if (id) nav(`/sac/${id}`)
  }

  return (
    <main className="page">
      <div className="topbar" style={{ justifyContent: 'space-between' }}>
        <h1 className="h1">Nouveau cours</h1>
        <Link to="/sac" className="btn ghost small">Mon sac à dos</Link>
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
            <button key={s.id} type="button" disabled={!s.ready} className={'tile' + (s.ready ? '' : ' soon')} style={{ minHeight: 92, alignItems: 'center', justifyContent: 'center', gap: 6, borderColor: s.ready ? '#3ccfb4' : undefined }}>
              <Icon name={s.icon} size={26} color="#3ccfb4" />
              <span style={{ fontWeight: 600, fontSize: 14 }}>{s.label}</span>
              {!s.ready && <span className="muted" style={{ fontSize: 11 }}>Bientôt</span>}
            </button>
          ))}
        </div>

        <div className="field">
          <label htmlFor="contenu">Colle ou écris tes notes (facultatif)</label>
          <textarea id="contenu" className="textarea" rows={7} placeholder="Tu peux aussi créer le cours vide et ajouter des notes plus tard." value={content} onChange={(e) => setContent(e.target.value)} />
        </div>

        <ErrorBox message={error} />
        <button className="btn" type="submit" disabled={busy}>{busy ? step || 'Un instant…' : 'Créer mon cours'}</button>
        <span className="muted" style={{ textAlign: 'center' }}>Il sera rangé dans ton sac à dos.</span>
      </form>
    </main>
  )
}

/* Sac à dos : l'étagère de tous les cours, chacun nommé. */
export function Backpack() {
  const { user } = useAuth()
  const { data, loading, error } = useLoad(() => listCourses(user?.id ?? ''), [user?.id])
  return (
    <main className="page">
      <BackLink to="/cours" title="Mon sac à dos" />
      <ErrorBox message={error} />
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
    </main>
  )
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() + '.md'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* Un cours du sac à dos : toutes les actions sont ici (notes, TP, révision, téléchargement). */
export function CourseDetail() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const course = useLoad(() => getCourse(id), [id])
  const notes = useLoad(() => listNotes(id), [id])
  const { busy, error, setError, run } = useAction()
  const [adding, setAdding] = useState(false)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteText, setNoteText] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [quiz, setQuiz] = useState<string | null>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    const ok = await run(async () => {
      await addNote(user.id, id, noteTitle, noteText.trim())
      return true
    })
    if (ok) {
      setNoteTitle(''); setNoteText(''); setAdding(false); notes.reload(); course.reload()
    }
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
        <button type="button" className="tile" onClick={() => download(course.data!.title, `# ${course.data!.title}\n\n` + all.map((n) => `## ${n.title}\n\n${n.content}`).join('\n\n'))} disabled={!all.length}><Icon name="download" size={26} color="#3ccfb4" /><span className="h2">Télécharger</span></button>
        <button type="button" className="tile soon" disabled><Icon name="headphones" size={26} color="#3ccfb4" /><span className="h2">Podcast</span><span className="muted">Bientôt</span></button>
      </div>

      <ErrorBox message={error} />

      {adding && (
        <form onSubmit={save} className="card" noValidate>
          <div className="field"><label htmlFor="nt">Titre</label><input id="nt" className="input" maxLength={80} placeholder="Ex. Chapitre 2" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} /></div>
          <div className="field"><label htmlFor="nc">Ta note</label><textarea id="nc" className="textarea" rows={6} value={noteText} onChange={(e) => setNoteText(e.target.value)} /></div>
          <button className="btn" type="submit" disabled={busy}>Enregistrer la note</button>
        </form>
      )}

      {quiz && <section className="card"><span className="label-mono">Révision</span><div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{quiz}</div></section>}

      <span className="label-mono">Mes notes</span>
      {notes.loading ? <Spinner /> : !all.length ? (
        <Empty title="Aucune note pour l'instant" text="Ajoute une note pour commencer à enrichir ce cours." />
      ) : all.map((n) => (
        <article key={n.id} className="card">
          <button type="button" className="link" style={{ textAlign: 'left', color: 'var(--text)', textDecoration: 'none' }} onClick={() => setOpen(open === n.id ? null : n.id)} aria-expanded={open === n.id}>
            <span className="h2">{n.title}</span><br />
            <span className="muted">{new Date(n.created_at).toLocaleDateString('fr-FR')} · {open === n.id ? 'Masquer' : 'Lire'}</span>
          </button>
          {open === n.id && <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{n.content}</div>}
        </article>
      ))}
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
  async function write() {
    const r = await run(() => askAI({ task: 'tp_write', courseId: id, prompt: `Titre : ${title}\nConsignes : ${brief}\nPlan validé :\n${plan}` }))
    if (r) setDoc(r.reply)
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
            <span className="t" style={{ fontSize: 16 }}>{profile?.university}</span>
            <span className="s">{profile?.faculty}</span>
            <span className="s">Département : {profile?.department} · {profile?.promotion} · {profile?.vacation}</span>
            <hr />
            <span className="t">{title}</span>
            <span className="s">Cours : {course.data?.title}</span>
            <span className="s">Présenté par : {profile?.full_name}</span>
            <span className="s">Année académique {year}</span>
          </div>
          <div className="doc-out">{doc}</div>
          <div className="notice no-print">Relis et vérifie le document avant de le remettre. Les sources citées doivent être contrôlées.</div>
          <button className="btn ghost no-print" type="button" onClick={() => window.print()}>Imprimer / enregistrer en PDF</button>
        </>
      )}
    </main>
  )
}
