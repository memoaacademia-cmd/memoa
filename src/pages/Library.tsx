import { useMemo, useState, type FormEvent } from 'react'
import { ErrorBox, Icon, Spinner, useAction, useLoad, Empty } from '../components/ui'
import { allFaculties, CATALOGUE, PROMOTIONS, universityLabel } from '../data/academic'
import { docDownloadUrl, listDocs, publishDoc, toggleFavorite } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { LibDoc } from '../lib/types'

const TYPES = ['Cours', 'TP', 'Examen', 'Résumé', 'Autre']

/** Minuscules sans accents : « Résumé » et « resume » se trouvent mutuellement. */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Départements connus d'une faculté (toutes universités confondues). */
function departmentsOf(faculty: string): string[] {
  const set = new Set<string>()
  Object.values(CATALOGUE).forEach((u) => (u[faculty] ?? []).forEach((d) => set.add(d)))
  return [...set].sort((a, b) => a.localeCompare(b, 'fr'))
}

/* Librairie : tout le monde voit tout. Par défaut « Tout » ; on affine avec la recherche, la faculté et la promotion. */
export default function Library() {
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [promo, setPromo] = useState('')
  const [fac, setFac] = useState('')
  const [publishing, setPublishing] = useState(false)
  const { data, loading, error, reload } = useLoad(() => listDocs(promo || null, fac || null), [promo, fac])
  const act = useAction()
  const faculties = useMemo(() => allFaculties(), [])

  const shown = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean)
    if (!words.length) return data ?? []
    return (data ?? []).filter((d) => {
      const hay = norm([d.title, d.course_title, d.faculty, d.department ?? '', d.university, d.doc_type, d.promotion].join(' '))
      return words.every((w) => hay.includes(w))
    })
  }, [data, q])

  const filtered = !!(q.trim() || promo || fac)
  function reset() { setQ(''); setPromo(''); setFac('') }

  async function fav(d: LibDoc) {
    if (!user) return
    await act.run(() => toggleFavorite(user.id, d.id, !d.is_favorite))
    reload()
  }
  async function open(d: LibDoc) {
    const url = await act.run(() => docDownloadUrl(d.file_path))
    if (url) window.open(url, '_blank', 'noopener')
    else if (url === null) act.setError("Ce document n'a pas de fichier à télécharger.")
  }

  return (
    <main className="page">
      <div className="topbar" style={{ justifyContent: 'space-between' }}>
        <h1 className="h1">Librairie</h1>
        <button type="button" className="btn small" onClick={() => setPublishing((v) => !v)}><Icon name="upload" size={18} color="#0b1513" /> Publier</button>
      </div>

      <input
        className="input"
        type="search"
        aria-label="Rechercher dans la Librairie"
        placeholder="Rechercher un titre, un cours, une faculté, un département…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="row">
        <select className="select" aria-label="Faculté" value={fac} onChange={(e) => setFac(e.target.value)}>
          <option value="">Faculté : toutes</option>
          {faculties.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select className="select" aria-label="Promotion" value={promo} onChange={(e) => setPromo(e.target.value)}>
          <option value="">Promotion : toutes</option>
          {PROMOTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="muted">{filtered ? 'Résultats' : 'Tout'} · {shown.length} {shown.length > 1 ? 'documents' : 'document'}</span>
        {filtered && <button type="button" className="link" onClick={reset}>Tout afficher</button>}
      </div>

      {publishing && <PublishForm defaultPromo={promo || 'L1'} onDone={() => { setPublishing(false); reload() }} />}

      <ErrorBox message={error ?? act.error} />
      {loading ? <Spinner /> : !shown.length ? (
        <Empty
          title={filtered ? 'Aucun document ne correspond' : "Aucun document pour l'instant"}
          text={filtered ? 'Essaie un autre mot, ou touche « Tout afficher ».' : 'Sois le premier à partager un document avec les étudiants.'}
        />
      ) : (
        <div className="grid2">
          {shown.map((d) => (
            <article key={d.id} className="tile" style={{ gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="badge">{d.doc_type}</span>
                  <span className="badge">{d.promotion}</span>
                </span>
                <button type="button" className="icon-btn" style={{ width: 36, height: 36, border: 0 }} aria-pressed={!!d.is_favorite} aria-label={d.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} onClick={() => fav(d)}>
                  <Icon name="star" size={20} color={d.is_favorite ? '#f2a33a' : '#9db0aa'} />
                </button>
              </div>
              <strong className="h2">{d.title}</strong>
              {d.course_title && <span className="muted">{d.course_title}</span>}
              <span className="muted" style={{ fontSize: 13 }}>{d.faculty}{d.department ? ' · ' + d.department : ''}</span>
              {d.university && <span className="muted" style={{ fontSize: 13 }}>{universityLabel(d.university)}</span>}
              {d.status === 'pending' && <span className="badge amber">En attente de validation</span>}
              {d.file_path && <button type="button" className="link" onClick={() => open(d)}>Télécharger</button>}
            </article>
          ))}
        </div>
      )}
    </main>
  )
}

function PublishForm({ defaultPromo, onDone }: { defaultPromo: string; onDone: () => void }) {
  const { user, profile } = useAuth()
  const { busy, error, setError, run } = useAction()
  const known = allFaculties()
  const [title, setTitle] = useState('')
  const [type, setType] = useState('Cours')
  const [course, setCourse] = useState('')
  const [promo, setPromo] = useState(defaultPromo)
  const [fac, setFac] = useState(profile && known.includes(profile.faculty) ? profile.faculty : 'autre')
  const [facTxt, setFacTxt] = useState(profile && !known.includes(profile.faculty) ? profile.faculty : '')
  const [dep, setDep] = useState('')
  const [depTxt, setDepTxt] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const deps = fac === 'autre' ? [] : departmentsOf(fac)
  const writeDep = fac === 'autre' || dep === 'autre'

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!user || !profile) return
    const faculty = fac === 'autre' ? facTxt.trim() : fac
    if (!faculty) return setError('Indique la faculté concernée.')
    const department = writeDep ? depTxt.trim() : dep
    const ok = await run(async () => {
      await publishDoc(user.id, { title, doc_type: type, university: profile.university, faculty, department, promotion: promo, course_title: course.trim() }, file)
      return true
    })
    if (ok) onDone()
  }

  return (
    <form onSubmit={submit} className="card" noValidate>
      <span className="label-mono">Publier un document</span>
      <div className="field"><label htmlFor="pt">Titre</label><input id="pt" className="input" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="row">
        <div className="field"><label htmlFor="pty">Type</label><select id="pty" className="select" value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div className="field"><label htmlFor="pp">Promotion</label><select id="pp" className="select" value={promo} onChange={(e) => setPromo(e.target.value)}>{PROMOTIONS.map((p) => <option key={p}>{p}</option>)}</select></div>
      </div>
      <div className="field"><label htmlFor="pc">Cours concerné</label><input id="pc" className="input" maxLength={100} value={course} onChange={(e) => setCourse(e.target.value)} /></div>
      <div className="field">
        <label htmlFor="pf">Faculté</label>
        <select id="pf" className="select" value={fac} onChange={(e) => { setFac(e.target.value); setDep(''); setDepTxt('') }}>
          {known.map((f) => <option key={f} value={f}>{f}</option>)}
          <option value="autre">Autre faculté (je l'écris moi-même)</option>
        </select>
        {fac === 'autre' && <input className="input" aria-label="Nom de la faculté" placeholder="Écris le nom de la faculté" value={facTxt} onChange={(e) => setFacTxt(e.target.value)} />}
      </div>
      <div className="field">
        <label htmlFor="pd">Département (facultatif)</label>
        {fac !== 'autre' && (
          <select id="pd" className="select" value={dep} onChange={(e) => setDep(e.target.value)}>
            <option value="">Je ne précise pas</option>
            {deps.map((d) => <option key={d} value={d}>{d}</option>)}
            <option value="autre">Autre département (je l'écris moi-même)</option>
          </select>
        )}
        {writeDep && <input className="input" aria-label="Nom du département" placeholder="Écris le nom du département" maxLength={160} value={depTxt} onChange={(e) => setDepTxt(e.target.value)} />}
      </div>
      <div className="field"><label htmlFor="pfile">Fichier PDF (20 Mo max)</label><input id="pfile" type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
      <div className="notice">Ne publie que des documents que tu as le droit de partager. Un administrateur Memoa vérifie chaque document avant sa mise en ligne.</div>
      <ErrorBox message={error} />
      <button className="btn" type="submit" disabled={busy}>{busy ? 'Envoi…' : 'Publier'}</button>
    </form>
  )
}
