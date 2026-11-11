import { useMemo, useState, type FormEvent } from 'react'
import { ErrorBox, Icon, Spinner, useAction, useLoad, Empty } from '../components/ui'
import { allFaculties, CATALOGUE, PROMOTIONS, universityLabel } from '../data/academic'
import { askAI, deleteDocForever, docDownloadUrl, listDocs, listMyTrashedDocs, publishDoc, REPORT_REASONS, reportDoc, setDocTrashed, toggleFavorite, TRASH_DAYS } from '../lib/api'
import { extractPdfText } from '../lib/pdfimport'
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
  const [reporting, setReporting] = useState<string | null>(null)
  const [thanks, setThanks] = useState('')
  const { data, loading, error, reload } = useLoad(() => listDocs(promo || null, fac || null), [promo, fac])
  const trash = useLoad(() => listMyTrashedDocs(user?.id ?? ''), [user?.id])
  const [showTrash, setShowTrash] = useState(false)
  const act = useAction()
  const trashed = trash.data ?? []
  const daysLeft = (d?: string | null) => Math.max(0, TRASH_DAYS - Math.floor((Date.now() - new Date(d ?? Date.now()).getTime()) / 86400000))
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
  /** « Voir » ouvre le PDF dans le navigateur ; « Télécharger » l'enregistre sur le téléphone. */
  async function openDoc(d: LibDoc, mode: 'view' | 'download') {
    const w = mode === 'view' ? window.open('', '_blank') : null // ouverte tout de suite, sinon le téléphone la bloque
    const name = (d.title.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'document') + '.pdf'
    const url = await act.run(() => docDownloadUrl(d.file_path, mode === 'download' ? name : undefined))
    if (!url) {
      w?.close()
      if (url === null) act.setError("Ce document n'a pas de fichier.")
      return
    }
    if (w) w.location.href = url
    else {
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
    }
  }
  async function remove(d: LibDoc) {
    if (!window.confirm(`Supprimer « ${d.title} » de la Librairie ? Les autres étudiants ne le verront plus. Tu pourras le restaurer pendant ${TRASH_DAYS} jours depuis ta corbeille.`)) return
    const ok = await act.run(async () => { await setDocTrashed(d.id, true); return true })
    if (ok) { setThanks('Document supprimé. Il est dans ta corbeille pendant ' + TRASH_DAYS + ' jours.'); reload(); trash.reload() }
  }
  async function restore(d: LibDoc) {
    const ok = await act.run(async () => { await setDocTrashed(d.id, false); return true })
    if (ok) { setThanks('Document restauré : il est de nouveau dans la Librairie.'); reload(); trash.reload() }
  }
  async function eraseNow(d: LibDoc) {
    if (!window.confirm(`Effacer « ${d.title} » pour de bon ? Cette action est définitive.`)) return
    const ok = await act.run(async () => { await deleteDocForever(d); return true })
    if (ok) trash.reload()
  }
  async function report(d: LibDoc, reason: string) {
    if (!user) return
    const ok = await act.run(async () => { await reportDoc(user.id, d.id, reason); return true })
    setReporting(null)
    if (ok) setThanks('Merci : ton signalement est enregistré.')
  }

  return (
    <main className="page">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <h1 className="h1 big" style={{ margin: 0 }}>Librairie</h1>
          <span className="muted">{shown.length} {shown.length > 1 ? 'documents partagés' : 'document partagé'} par des étudiants</span>
        </div>
        <button type="button" className="btn small" style={{ borderRadius: 22, flex: 'none' }} onClick={() => setPublishing((v) => !v)}><Icon name="upload" size={18} /> Publier</button>
      </div>

      <div className="hm-search" role="search">
        <span className="ico"><Icon name="search" size={20} /></span>
        <input
          type="search"
          aria-label="Rechercher dans la Librairie"
          placeholder="Chercher un document, un cours…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
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
      {thanks && <div className="notice" role="status">{thanks}</div>}
      {loading ? <Spinner /> : !shown.length ? (
        <Empty
          title={filtered ? 'Aucun document ne correspond' : "Aucun document pour l'instant"}
          text={filtered ? 'Essaie un autre mot, ou touche « Tout afficher ».' : 'Sois le premier à partager un document avec les étudiants.'}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {shown.map((d) => (
            <article key={d.id} className="lib-card">
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span className="lib-type" aria-hidden="true">{(d.doc_type || 'PDF').slice(0, 3).toUpperCase()}</span>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <strong style={{ fontSize: 15, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{d.title}</strong>
                  <span className="muted" style={{ fontSize: 13 }}>{[d.faculty, d.promotion, d.department].filter(Boolean).join(' · ')}</span>
                  {d.course_title && <span className="muted" style={{ fontSize: 12 }}>{d.course_title}</span>}
                  {d.university && <span className="muted" style={{ fontSize: 12 }}>{universityLabel(d.university)}</span>}
                  {d.status === 'rejected' && <span className="badge amber" style={{ alignSelf: 'flex-start' }}>Retiré après vérification</span>}
                </div>
                <button type="button" className="icon-btn" style={{ width: 40, height: 40, border: 0, flex: 'none' }} aria-pressed={!!d.is_favorite} aria-label={d.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} onClick={() => fav(d)}>
                  <Icon name="star" size={22} color={d.is_favorite ? '#f2a33a' : '#9db0aa'} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {d.file_path && <button type="button" className="lib-act primary" onClick={() => void openDoc(d, 'view')}>Voir</button>}
                {d.file_path && <button type="button" className="lib-act" onClick={() => void openDoc(d, 'download')}><Icon name="download" size={16} /> Télécharger</button>}
                {d.owner_id === user?.id && <button type="button" className="lib-act danger" disabled={act.busy} onClick={() => void remove(d)}>Supprimer</button>}
                {d.owner_id !== user?.id && <button type="button" className="lib-act" onClick={() => { setThanks(''); setReporting(reporting === d.id ? null : d.id) }}>Signaler</button>}
              </div>
              {reporting === d.id && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                  <span className="muted" style={{ fontSize: 13 }}>Pourquoi ?</span>
                  {REPORT_REASONS.map((r) => <button key={r.id} type="button" className="btn ghost small" disabled={act.busy} onClick={() => void report(d, r.id)}>{r.label}</button>)}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {trashed.length > 0 && (
        <>
          <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setShowTrash((v) => !v)} aria-expanded={showTrash}>
            Ma corbeille ({trashed.length}) · {showTrash ? 'Masquer' : 'Voir'}
          </button>
          {showTrash && (
            <section className="card" aria-label="Documents supprimés">
              <span className="muted">Un document supprimé reste ici {TRASH_DAYS} jours, invisible des autres étudiants, puis il est effacé pour de bon.</span>
              {trashed.map((d) => (
                <div key={d.id} className="list-row" style={{ alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ minWidth: 0, flex: '1 1 auto' }}><b>{d.title}</b><br /><span className="muted">{daysLeft(d.deleted_at)} j restants</span></span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 'none' }}>
                    <button type="button" className="btn ghost small" disabled={act.busy} onClick={() => void restore(d)}>Restaurer</button>
                    <button type="button" className="link" style={{ color: 'var(--danger, #c0392b)' }} disabled={act.busy} onClick={() => void eraseNow(d)}>Effacer</button>
                  </span>
                </div>
              ))}
            </section>
          )}
        </>
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
      const id = await publishDoc(user.id, { title, doc_type: type, university: profile.university, faculty, department, promotion: promo, course_title: course.trim() }, file)
      // Vérification légère en arrière-plan : on ne retire le document que s'il est clairement n'importe quoi.
      if (file && id) {
        void (async () => {
          try {
            const text = await extractPdfText(file, 3)
            if (text.length >= 40) await askAI({ task: 'review_doc', docId: id, prompt: text.slice(0, 3000) })
          } catch { /* en cas de doute, le document reste en ligne */ }
        })()
      }
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
      <div className="notice">Ton document est publié tout de suite. Ne partage que ce que tu as le droit de partager : un document clairement hors sujet ou signalé par plusieurs étudiants est retiré.</div>
      <ErrorBox message={error} />
      <button className="btn" type="submit" disabled={busy}>{busy ? 'Envoi…' : 'Publier'}</button>
    </form>
  )
}
