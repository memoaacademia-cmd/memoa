import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { track } from '../lib/track'
import { ErrorBox, Icon, PillButton, Spinner, useAction, useLoad, Empty } from '../components/ui'
import { allFaculties, CATALOGUE, PROMOTIONS, universityLabel } from '../data/academic'
import { askAI, deleteDocForever, docDownloadUrl, getLibraryAuthors, getLibrarySocial, listDocs, listMyTrashedDocs, publishDoc, REPORT_REASONS, reportDoc, setDocTrashed, toggleFavorite, TRASH_DAYS } from '../lib/api'
import { useAuth } from '../lib/auth'
import { plaqueFor } from '../lib/plaque'
import DocCover from '../components/DocCover'
import { AuthorSheet, PlaqueAvatar } from '../components/AuthorBadge'
import type { LibAuthor, LibDoc, LibSocial } from '../lib/types'

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
  useEffect(() => { track('library_view') }, [])
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

  // Étoiles et profils publics des auteurs : si la mise à jour de la base (0030) n'est pas encore faite, les nombres d'étoiles restent à zéro.
  const idsKey = (data ?? []).map((d) => d.id).join(',')
  const ownersKey = [...new Set((data ?? []).map((d) => d.owner_id))].join(',')
  const social = useLoad(() => getLibrarySocial(idsKey ? idsKey.split(',') : []).catch(() => ({} as Record<string, LibSocial>)), [idsKey])
  const authors = useLoad(() => getLibraryAuthors(ownersKey ? ownersKey.split(',') : []).catch(() => ({} as Record<string, LibAuthor>)), [ownersKey])
  // Étoiles : le nombre d'étoiles d'un document = le nombre d'étudiants qui l'ont mis en favori. (Corrections affichées tout de suite, avant la réponse du serveur.)
  const [starOv, setStarOv] = useState<Record<string, { on: boolean; count: number }>>({})
  const [openAuthor, setOpenAuthor] = useState<LibAuthor | null>(null)
  const starOf = (d: LibDoc) => starOv[d.id] ?? { on: !!d.is_favorite, count: social.data?.[d.id]?.like_count ?? 0 }

  // Tant qu'un de tes documents est « en vérification », la liste se rafraîchit toute seule : le badge disparaît dès la publication.
  const reloadRef = useRef(reload)
  reloadRef.current = reload
  const waiting = !!user && !!data && data.some((d) => d.status === 'pending' && d.owner_id === user.id && Date.now() - new Date(d.created_at).getTime() < 5 * 60_000)
  useEffect(() => {
    if (!waiting) return
    const t = setInterval(() => reloadRef.current(), 15_000)
    return () => clearInterval(t)
  }, [waiting])

  // Un de tes documents est encore « en vérification » (coupure réseau au dépôt) : on relance la vérification, deux fois au maximum par document.
  const retried = useRef(new Map<string, number>())
  useEffect(() => {
    if (!user || !data) return
    const todo = data.filter((d) => d.status === 'pending' && d.owner_id === user.id && (retried.current.get(d.id) ?? 0) < 2 && Date.now() - new Date(d.created_at).getTime() < 24 * 3600_000)
    if (!todo.length) return
    todo.forEach((d) => retried.current.set(d.id, (retried.current.get(d.id) ?? 0) + 1))
    void (async () => {
      for (const d of todo) { try { await askAI({ task: 'review_doc', docId: d.id, prompt: 'verification' }) } catch { /* réessayé à la prochaine ouverture */ } }
      reloadRef.current()
    })()
  }, [data, user])

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
    const cur = starOf(d)
    const on = !cur.on
    setStarOv((o) => ({ ...o, [d.id]: { on, count: Math.max(0, cur.count + (on ? 1 : -1)) } }))
    const ok = await act.run(async () => { await toggleFavorite(user.id, d.id, on); return true })
    if (!ok) { setStarOv((o) => ({ ...o, [d.id]: cur })); return }
    reload(); social.reload(); authors.reload()
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
        <PillButton size="sm" tour="lib-publish" onClick={() => setPublishing((v) => !v)}><Icon name="upload" size={18} /> Publier</PillButton>
      </div>

      <div className="hm-search" role="search" data-tour="lib-search">
        <span className="ico"><Icon name="search" size={20} /></span>
        <input
          type="search"
          aria-label="Rechercher dans la Librairie"
          placeholder="Chercher un document, un cours…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="row" data-tour="lib-filters">
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
      {loading && !data ? <Spinner /> : !shown.length ? (
        <Empty
          title={filtered ? 'Aucun document ne correspond' : "Aucun document pour l'instant"}
          text={filtered ? 'Essaie un autre mot, ou touche « Tout afficher ».' : 'Sois le premier à partager un document avec les étudiants.'}
        />
      ) : (
        <div data-tour="lib-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {shown.map((d) => (
            <article key={d.id} className="lib-card">
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <DocCover filePath={d.file_path} type={d.doc_type} title={d.title} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <strong style={{ fontSize: 15, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{d.title}</strong>
                  <span className="muted" style={{ fontSize: 13 }}>{[d.faculty, d.promotion, d.department].filter(Boolean).join(' · ')}</span>
                  {d.course_title && <span className="muted" style={{ fontSize: 12 }}>{d.course_title}</span>}
                  {d.university && <span className="muted" style={{ fontSize: 12 }}>{universityLabel(d.university)}</span>}
                  {d.status === 'rejected' && <span className="badge amber" style={{ alignSelf: 'flex-start' }}>Retiré après vérification</span>}
                  {d.status === 'pending' && <span className="badge amber" style={{ alignSelf: 'flex-start' }}>En vérification… (1 à 2 minutes)</span>}
                </div>
                {(() => {
                  const st = starOf(d)
                  return (
                    <button type="button" className="lib-star" aria-pressed={st.on} aria-label={st.on ? 'Retirer mon étoile' : 'Donner une étoile'} onClick={() => void fav(d)} data-tour={d.id === shown[0]?.id ? 'lib-star' : undefined}>
                      <Icon name="star" size={22} color={st.on ? '#f2a33a' : '#9db0aa'} />
                      {st.count > 0 && <span>{st.count}</span>}
                    </button>
                  )
                })()}
              </div>
              {(() => {
                const a = authors.data?.[d.owner_id]
                const st = starOf(d)
                const first = d.id === shown[0]?.id
                return (
                  <div className="lib-author-row">
                    {a ? (
                      <>
                        <PlaqueAvatar src={a.avatar_url} name={a.public_name || a.memo_name} size={40} plaque={plaqueFor(authors.data?.[d.owner_id]?.best_likes ?? st.count)} onClick={() => setOpenAuthor(a)} tour={first ? 'lib-author' : undefined} />
                        <button type="button" className="lib-author-name" onClick={() => setOpenAuthor(a)}>
                          <b>{a.public_name || a.memo_name}</b>
                          <span>{a.promotion}</span>
                        </button>
                      </>
                    ) : <span style={{ flex: 1 }} />}
                  </div>
                )
              })()}
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
            <section className="rg" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }} aria-label="Documents supprimés">
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
      <AuthorSheet author={openAuthor} onClose={() => setOpenAuthor(null)} />
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
  const [phase, setPhase] = useState<'send' | 'check'>('send')
  const deps = fac === 'autre' ? [] : departmentsOf(fac)
  const writeDep = fac === 'autre' || dep === 'autre'

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!user || !profile) return
    const faculty = fac === 'autre' ? facTxt.trim() : fac
    if (!faculty) return setError('Indique la faculté concernée.')
    const department = writeDep ? depTxt.trim() : dep
    setPhase('send')
    const ok = await run(async () => {
      const id = await publishDoc(user.id, { title, doc_type: type, university: profile.university, faculty, department, promotion: promo, course_title: course.trim() }, file)
      // Vérification par le serveur (il lit lui-même le fichier) : il publie le document, ou le refuse s'il est clairement n'importe quoi.
      // Si cet appel échoue (réseau), le document reste « en vérification » et la vérification est relancée à la prochaine ouverture de la Librairie.
      if (id) {
        setPhase('check')
        try { await Promise.race([askAI({ task: 'review_doc', docId: id, prompt: 'verification' }), new Promise((r) => setTimeout(r, 45_000))]) } catch { /* relancé plus tard */ }
      }
      return true
    })
    if (ok) onDone()
  }

  return (
    <form onSubmit={submit} className="rg" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }} noValidate>
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
      {busy && <Spinner label={phase === 'check' ? 'Vérification de ton document en cours… quelques secondes, garde cette page ouverte.' : 'Envoi du fichier…'} />}
      <PillButton type="submit" disabled={busy}>{busy ? (phase === 'check' ? 'Vérification…' : 'Envoi…') : 'Publier'}</PillButton>
    </form>
  )
}
