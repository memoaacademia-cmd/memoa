import { useEffect, useState } from 'react'
import { BottomSheet, ErrorBox, PillButton, PillInput, useAction } from './ui'
import { deleteExam, KIND_CHOICES, saveExam, type Exam, type ExamKind } from '../lib/exams'

/** Feuille pour ajouter, modifier ou supprimer un examen. Si `fixedCourse` est donné (page d'un cours), le cours n'est pas à choisir. */
export default function ExamEditor({ open, onClose, uid, courses, exam, fixedCourse }: {
  open: boolean
  onClose: () => void
  uid: string
  courses: { id: string; title: string }[]
  exam?: Exam | null
  fixedCourse?: { id: string; title: string }
}) {
  const { busy, error, setError, run } = useAction()
  const [kind, setKind] = useState<ExamKind>('exam')
  const [courseId, setCourseId] = useState('')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [room, setRoom] = useState('')

  useEffect(() => {
    if (!open) return
    setError(null)
    setKind(exam?.kind ?? 'exam')
    setCourseId(exam?.course_id ?? fixedCourse?.id ?? '')
    setTitle(exam?.title ?? fixedCourse?.title ?? '')
    setDate(exam?.exam_date ?? '')
    setTime(exam?.exam_time ?? '')
    setRoom(exam?.room ?? '')
  }, [open, exam, fixedCourse?.id, fixedCourse?.title, setError])

  function pickCourse(id: string) {
    setCourseId(id)
    const c = courses.find((x) => x.id === id)
    if (c && (!title.trim() || courses.some((x) => x.title === title))) setTitle(c.title)
  }

  async function save() {
    const ok = await run(async () => {
      await saveExam(uid, { id: exam?.id, kind, course_id: courseId || null, title, exam_date: date, exam_time: time || null, room: room || null, source: exam?.source ?? 'manual' })
      return true
    })
    if (ok) onClose()
  }
  async function remove() {
    if (!exam) return
    const ok = await run(async () => { await deleteExam(uid, exam.id); return true })
    if (ok) onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={exam ? 'Modifier l’échéance' : 'Date à retenir'}>
      <div className="ex-form">
        <ErrorBox message={error} />
        <div className="ex-chips" role="group" aria-label="Type">
          {KIND_CHOICES.map((k) => <button key={k.kind} type="button" className={'pill' + (kind === k.kind ? ' on' : '')} aria-pressed={kind === k.kind} onClick={() => setKind(k.kind)}>{k.label}</button>)}
        </div>
        {!fixedCourse && (
          <label className="ex-field">Cours
            <select className="pill-input" value={courseId} onChange={(e) => pickCourse(e.target.value)}>
              <option value="">Aucun cours précis</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </label>
        )}
        {(!fixedCourse) && <label className="ex-field">Nom<PillInput value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Droit des sociétés" /></label>}
        <label className="ex-field">Date<PillInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <div className="ex-two">
          <label className="ex-field">Heure (facultatif)<PillInput type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
          <label className="ex-field">Salle (facultatif)<PillInput value={room} maxLength={80} onChange={(e) => setRoom(e.target.value)} placeholder="Ex. Amphi B" /></label>
        </div>
        <PillButton size="lg" onClick={() => void save()} disabled={busy || !date || !title.trim()}>{busy ? 'Enregistrement…' : 'Enregistrer'}</PillButton>
        {exam && <PillButton size="lg" variant="outline" onClick={() => void remove()} disabled={busy}>Supprimer</PillButton>}
      </div>
    </BottomSheet>
  )
}
