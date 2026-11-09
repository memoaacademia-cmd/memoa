import { useState, type FormEvent } from 'react'
import { ErrorBox, Icon, Spinner, useAction, useLoad, Empty } from '../components/ui'
import { allFaculties, facultiesFor, PROMOTIONS } from '../data/academic'
import { docDownloadUrl, listDocs, publishDoc, toggleFavorite } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { LibDoc } from '../lib/types'

const TYPES = ['Cours', 'TP', 'Examen', 'Résumé', 'Autre']

/* Librairie : rangée par promotion (L1 … Doctorat). Dans une promotion, tous les documents de toutes les
   facultés ; un filtre facultatif par faculté. Pas de niveau « département », par décision produit. */
export default function Library() {
  const { user, profile } = useAuth()
  const [promo, setPromo] = useState<string>(profile?.promotion ?? 'L1')
  const [fac, setFac] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const { data, loading, error, reload } = useLoad(() => listDocs(promo, fac), [promo, fac])
  const act = useAction()

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

      <div className="chips" role="tablist" aria-label="Promotion">
        {PROMOTIONS.map((p) => (
          <button key={p} type="button" role="tab" aria-selected={promo === p} className={'pill' + (promo === p ? ' on' : '')} onClick={() => setPromo(p)}>{p}</button>
        ))}
      </div>
      <div className="chips" aria-label="Filtrer par faculté">
        <button type="button" className={'pill' + (fac === null ? ' on' : '')} onClick={() => setFac(null)}>Toutes les facultés</button>
        {facultiesFor(profile?.university).map((f) => (
          <button key={f} type="button" className={'pill' + (fac === f ? ' on' : '')} onClick={() => setFac(f)}>{f.replace(/^(Faculté|École) (de la |de l’|de l'|du |des |de )?/, '')}</button>
        ))}
      </div>

      {publishing && <PublishForm defaultPromo={promo} onDone={() => { setPublishing(false); reload() }} />}

      <ErrorBox message={error ?? act.error} />
      {loading ? <Spinner /> : !data?.length ? (
        <Empty title={`Aucun document en ${promo} pour l'instant`} text="Sois le premier à partager un document avec les étudiants de ta promotion." />
      ) : (
        <div className="grid2">
          {data.map((d) => (
            <article key={d.id} className="tile" style={{ gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <span className="badge">{d.doc_type}</span>
                <button type="button" className="icon-btn" style={{ width: 36, height: 36, border: 0 }} aria-pressed={!!d.is_favorite} aria-label={d.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} onClick={() => fav(d)}>
                  <Icon name="star" size={20} color={d.is_favorite ? '#f2a33a' : '#9db0aa'} />
                </button>
              </div>
              <strong className="h2">{d.title}</strong>
              <span className="muted">{d.course_title || d.faculty}</span>
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
  const [file, setFile] = useState<File | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!user || !profile) return
    const faculty = fac === 'autre' ? facTxt.trim() : fac
    if (!faculty) return setError('Indique la faculté concernée.')
    const ok = await run(async () => {
      await publishDoc(user.id, { title, doc_type: type, university: profile.university, faculty, promotion: promo, course_title: course.trim() }, file)
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
        <select id="pf" className="select" value={fac} onChange={(e) => setFac(e.target.value)}>
          {known.map((f) => <option key={f} value={f}>{f}</option>)}
          <option value="autre">Autre faculté (je l'écris moi-même)</option>
        </select>
        {fac === 'autre' && <input className="input" aria-label="Nom de la faculté" placeholder="Écris le nom de la faculté" value={facTxt} onChange={(e) => setFacTxt(e.target.value)} />}
      </div>
      <div className="field"><label htmlFor="pfile">Fichier PDF (20 Mo max)</label><input id="pfile" type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
      <div className="notice">Ne publie que des documents que tu as le droit de partager. Un administrateur Memoa vérifie chaque document avant sa mise en ligne.</div>
      <ErrorBox message={error} />
      <button className="btn" type="submit" disabled={busy}>{busy ? 'Envoi…' : 'Publier'}</button>
    </form>
  )
}
