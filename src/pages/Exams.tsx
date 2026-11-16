import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty, ErrorBox, Icon, PageHead, PillButton, Row, RowGroup, Spinner, useAction, useLoad } from '../components/ui'
import ExamEditor from '../components/ExamEditor'
import { listCourses } from '../lib/api'
import { useAuth } from '../lib/auth'
import { countdownLabel, daysUntil, DEFAULT_REMINDERS, fmtDate, KIND_LABEL, loadReminderDays, REMINDER_CHOICES, saveReminderDays, shortCountdown, upcoming, useExams, type Exam } from '../lib/exams'
import { isSubscribed } from '../lib/push'

/** « Mes examens » : tous les examens, les jours de rappel et l'import depuis l'horaire. (Sur l'Accueil, seul l'examen le plus proche est montré.) */
export default function Exams() {
  const { user } = useAuth()
  const uid = user?.id ?? ''
  const { exams, ready } = useExams(uid || undefined)
  const courses = useLoad(() => listCourses(uid), [uid])
  const [edit, setEdit] = useState<Exam | null>(null)
  const [adding, setAdding] = useState(false)
  const [days, setDays] = useState<number[]>(DEFAULT_REMINDERS)
  const [push, setPush] = useState<boolean | null>(null)
  const [showPast, setShowPast] = useState(false)
  const { error, setError, run } = useAction()

  useEffect(() => { if (uid) void loadReminderDays(uid).then(setDays) }, [uid])
  useEffect(() => { void isSubscribed().then(setPush).catch(() => setPush(false)) }, [])

  const list = courses.data ?? []
  const next = upcoming(exams)
  const past = exams.filter((e) => daysUntil(e.exam_date) < 0).sort((a, b) => b.exam_date.localeCompare(a.exam_date)).slice(0, 8)
  const courseName = (e: Exam) => (e.course_id ? list.find((c) => c.id === e.course_id)?.title : undefined)

  async function toggle(d: number) {
    const nextDays = days.includes(d) ? days.filter((x) => x !== d) : [...days, d]
    setDays(nextDays)
    const ok = await run(async () => { await saveReminderDays(uid, nextDays); return true })
    if (!ok) setDays(days)
  }

  return (
    <main className="page">
      <PageHead to="/" title="Mes examens et TP" />
      <ErrorBox message={error} />
      <div className="ex-actions">
        <PillButton onClick={() => setAdding(true)}><Icon name="plus" size={20} stroke={2.4} />Ajouter une date</PillButton>
        <PillButton variant="outline" to="/examens/horaire"><Icon name="photo" size={20} />Importer mon horaire</PillButton>
      </div>

      {!ready && !exams.length ? <Spinner label="Chargement de tes examens…" /> : next.length ? (
        <RowGroup label="À venir">
          {next.map((e, i) => (
            <Row key={e.id} tour={i === 0 ? 'exam-first' : undefined} icon="clock" title={e.title} sub={`${KIND_LABEL[e.kind]} · ${countdownLabel(daysUntil(e.exam_date)).toLowerCase()} · ${fmtDate(e.exam_date)}${e.exam_time ? ` à ${e.exam_time}` : ''}${e.room ? ` · ${e.room}` : ''}${courseName(e) && courseName(e) !== e.title ? ` · ${courseName(e)}` : ''}`} right={shortCountdown(daysUntil(e.exam_date))} onClick={() => setEdit(e)} />
          ))}
        </RowGroup>
      ) : (
        <Empty title="Aucun examen pour le moment" text="Ajoute une date, ou envoie une photo de ton horaire : Memo lit les examens et tu vérifies avant d’enregistrer." />
      )}

      <section data-tour="exam-reminders" className="card ex-remind">
        <strong className="h2" style={{ margin: 0 }}>Rappels</strong>
        <span className="muted">Memo te prévient par notification avant chaque examen, interrogation ou remise de TP. Choisis quand :</span>
        <div className="ex-chips" role="group" aria-label="Jours de rappel">
          {REMINDER_CHOICES.map((c) => (
            <button key={c.days} type="button" className={'pill' + (days.includes(c.days) ? ' on' : '')} aria-pressed={days.includes(c.days)} onClick={() => void toggle(c.days)}>{c.label}</button>
          ))}
        </div>
        {push === false && <span className="muted" role="status">Les notifications sont éteintes sur ce téléphone : active-les dans <Link to="/parametres">Réglages</Link> pour recevoir les rappels.</span>}
      </section>

      {past.length > 0 && (
        <section>
          <button type="button" className="link" onClick={() => setShowPast((v) => !v)} aria-expanded={showPast}>{showPast ? 'Masquer' : 'Voir'} les examens passés ({past.length})</button>
          {showPast && <RowGroup>{past.map((e) => <Row key={e.id} icon="check" title={e.title} sub={`${KIND_LABEL[e.kind]} · ${fmtDate(e.exam_date)}`} onClick={() => setEdit(e)} />)}</RowGroup>}
        </section>
      )}

      <ExamEditor open={adding} onClose={() => setAdding(false)} uid={uid} courses={list} />
      <ExamEditor open={!!edit} onClose={() => setEdit(null)} uid={uid} courses={list} exam={edit} />
    </main>
  )
}
