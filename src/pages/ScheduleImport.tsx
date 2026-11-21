import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Empty, ErrorBox, Icon, PageHead, PillButton, PillInput, useAction, useLoad } from '../components/ui'
import { askAI, listCourses } from '../lib/api'
import { useAuth } from '../lib/auth'
import { dateWarning, fmtDate, KIND_CHOICES, parseSchedule, saveExamsBulk, type ScheduleRow } from '../lib/exams'
import { useOnline } from '../lib/online'
import { readPhotoText } from '../lib/ocr'
import { extractPdfText } from '../lib/pdfimport'
import { track } from '../lib/track'

/** Importer l'horaire : photo ou PDF → Memo lit les examens → l'étudiant VÉRIFIE et corrige chaque ligne → enregistrement.
 *  Rien n'est enregistré sans cette vérification : une IA peut se tromper de date, et un mauvais rappel serait pire que pas de rappel. */
export default function ScheduleImport() {
  const { user, profile } = useAuth()
  const uid = user?.id ?? ''
  const memo = profile?.memo_name || 'Memo'
  const nav = useNavigate()
  const online = useOnline()
  const courses = useLoad(() => listCourses(uid), [uid])
  const { busy, error, setError, run } = useAction()
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState<ScheduleRow[] | null>(null)
  const [group, setGroup] = useState('')
  const photoRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLInputElement>(null)
  const list = courses.data ?? []

  async function pick(f: File | undefined, kind: 'photo' | 'pdf') {
    if (!f) return
    setRows(null); setGroup('')
    const out = await run(async () => {
      setStatus(kind === 'photo' ? 'Lecture de la photo…' : 'Lecture du PDF…')
      const text = kind === 'photo' ? await readPhotoText(f, setStatus, memo) : await extractPdfText(f, 12)
      if (text.trim().length < 20) throw new Error('Je n’ai pas pu lire de texte dans ce fichier. Essaie une photo plus nette, bien cadrée, ou un PDF non scanné.')
      setStatus(`${memo} cherche les examens…`)
      track('schedule_uploaded', { kind })
      const r = await askAI({ task: 'schedule', prompt: text.trim().slice(0, 7500) })
      const parsed = parseSchedule(r.reply, list)
      if (!parsed.length) throw new Error('Je n’ai trouvé aucun examen dans ce document. Tu peux les ajouter à la main depuis « Mes examens ».')
      return parsed
    })
    setStatus('')
    if (out) setRows(out)
  }

  const patch = (i: number, p: Partial<ScheduleRow>) => setRows((r) => (r ? r.map((x, k) => (k === i ? { ...x, ...p } : x)) : r))
  // Horaire avec plusieurs groupes (ex. L1 LMD A et L1 LMD B) : l'étudiant choisit le sien, les lignes des autres groupes sont écartées.
  const groups = [...new Set((rows ?? []).map((r) => r.group).filter(Boolean))]
  const shown = (rows ?? []).map((r, i) => ({ r, i })).filter(({ r }) => groups.length < 2 || !r.group || r.group === group)
  const chosen = shown.map((x) => x.r).filter((r) => r.include)
  const incomplete = chosen.some((r) => !r.exam_date || !r.title.trim())

  async function save() {
    if (!rows || (groups.length > 1 && !group)) return
    const n = await run(() => saveExamsBulk(uid, chosen.map((r) => ({ kind: r.kind, course_id: r.course_id, title: r.title, exam_date: r.exam_date, exam_time: r.exam_time || null, room: r.room || null, source: 'schedule' as const }))))
    if (typeof n === 'number') {
      window.dispatchEvent(new CustomEvent('memoa-notice', { detail: n ? `${n} ${n > 1 ? 'examens enregistrés' : 'examen enregistré'}. Les rappels se déclenchent tout seuls.` : 'Ces examens étaient déjà enregistrés.' }))
      nav('/examens')
    }
  }

  return (
    <main className="page">
      <PageHead to="/examens" title="Importer mon horaire" />
      <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0], 'photo'); e.target.value = '' }} />
      <input ref={pdfRef} type="file" accept="application/pdf" hidden onChange={(e) => { void pick(e.target.files?.[0], 'pdf'); e.target.value = '' }} />
      <ErrorBox message={error} />

      {!rows && (
        <>
          <Empty title="Envoie ton horaire d’examens" text={`${memo} lit les examens (photo ou PDF), puis tu vérifies chaque ligne avant l’enregistrement. Ça coûte 1 point si tu n’es pas en Premium ou en essai.`} />
          <PillButton size="lg" onClick={() => photoRef.current?.click()} disabled={busy || !online}><Icon name="photo" size={22} />Prendre ou choisir une photo</PillButton>
          <PillButton size="lg" variant="outline" onClick={() => pdfRef.current?.click()} disabled={busy || !online}><Icon name="pdf" size={22} />Choisir un PDF</PillButton>
          {status && <span className="muted" role="status">{status}</span>}
          {!online && <span className="muted" role="status">Une connexion internet est nécessaire pour lire l’horaire.</span>}
        </>
      )}

      {rows && (
        <>
          <div className="notice" role="status">{memo} a trouvé {shown.length} {shown.length > 1 ? 'examens' : 'examen'}. <b>Vérifie chaque date</b> : une lecture automatique peut se tromper. Décoche ce que tu ne veux pas garder.</div>
          {groups.length > 1 && (
            <section className="card ex-remind">
              <strong className="h2" style={{ margin: 0 }}>Ton groupe</strong>
              <span className="muted">Cet horaire contient plusieurs groupes avec des heures différentes. Choisis le tien :</span>
              <div className="ex-chips" role="group" aria-label="Groupe">
                {groups.map((g) => <button key={g} type="button" className={'pill' + (group === g ? ' on' : '')} aria-pressed={group === g} onClick={() => setGroup(g)}>{g}</button>)}
              </div>
            </section>
          )}
          {(groups.length < 2 || group) && shown.map(({ r, i }) => {
            const warn = r.include ? dateWarning(r.exam_date) : null
            return (
              <section key={i} className={'card ex-row' + (r.include ? '' : ' off')}>
                <label className="ex-check"><input type="checkbox" checked={r.include} onChange={(e) => patch(i, { include: e.target.checked })} /> <span>Garder cet examen</span></label>
                <div className="ex-chips" role="group" aria-label="Type">
                  {KIND_CHOICES.map((k) => <button key={k.kind} type="button" className={'pill' + (r.kind === k.kind ? ' on' : '')} aria-pressed={r.kind === k.kind} onClick={() => patch(i, { kind: k.kind })}>{k.label}</button>)}
                </div>
                <label className="ex-field">Nom<PillInput value={r.title} maxLength={120} onChange={(e) => patch(i, { title: e.target.value })} /></label>
                <label className="ex-field">Cours dans Memoa
                  <select className="pill-input" value={r.course_id ?? ''} onChange={(e) => patch(i, { course_id: e.target.value || null })}>
                    <option value="">Aucun cours précis</option>
                    {list.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </label>
                <div className="ex-two">
                  <label className="ex-field">Date<PillInput type="date" value={r.exam_date} onChange={(e) => patch(i, { exam_date: e.target.value, include: r.exam_date ? r.include : !!e.target.value })} /></label>
                  <label className="ex-field">Heure<PillInput type="time" value={r.exam_time} onChange={(e) => patch(i, { exam_time: e.target.value })} /></label>
                </div>
                <label className="ex-field">Salle<PillInput value={r.room} maxLength={80} onChange={(e) => patch(i, { room: e.target.value })} /></label>
                {r.include && r.exam_date && <span className="muted">Lu comme : {fmtDate(r.exam_date)}</span>}
                {warn && <span className="ex-warn" role="alert">{warn}</span>}
              </section>
            )
          })}
          <PillButton size="lg" onClick={() => void save()} disabled={busy || !chosen.length || incomplete || (groups.length > 1 && !group)}>{busy ? 'Enregistrement…' : `Enregistrer ${chosen.length} ${chosen.length > 1 ? 'examens' : 'examen'}`}</PillButton>
          {incomplete && <span className="muted" role="status">Complète la date de chaque examen gardé, ou décoche-le.</span>}
          <PillButton size="lg" variant="outline" onClick={() => setRows(null)} disabled={busy}>Recommencer avec un autre fichier</PillButton>
        </>
      )}
      <Link to="/examens" className="muted" style={{ textAlign: 'center' }}>Retour à mes examens</Link>
    </main>
  )
}
