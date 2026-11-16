import { useState } from 'react'
import { Row } from './ui'
import ExamEditor from './ExamEditor'
import { useAuth } from '../lib/auth'
import { countdownLabel, daysUntil, fmtDate, KIND_LABEL, upcoming, useExams } from '../lib/exams'

/** Ligne « Date d'examen » de la page d'un cours : montre le prochain examen de ce cours et ouvre la feuille de saisie. */
export default function ExamRow({ courseId, courseTitle }: { courseId: string; courseTitle: string }) {
  const { user } = useAuth()
  const uid = user?.id ?? ''
  const { exams } = useExams(uid || undefined)
  const [open, setOpen] = useState(false)
  const mine = exams.filter((e) => e.course_id === courseId)
  const next = upcoming(mine)[0] ?? null
  const last = !next ? mine[mine.length - 1] : null
  const sub = next
    ? `${KIND_LABEL[next.kind]} · ${countdownLabel(daysUntil(next.exam_date)).toLowerCase()} · ${fmtDate(next.exam_date)}${next.exam_time ? ` à ${next.exam_time}` : ''}`
    : last ? `${KIND_LABEL[last.kind]} passé le ${fmtDate(last.exam_date)} · touche pour changer` : 'Examen, interro ou TP : ajoute la date pour les rappels'
  return (
    <>
      <Row tour="course-exam" icon="clock" title="Examen, interro ou TP" sub={sub} onClick={() => setOpen(true)} />
      <ExamEditor open={open} onClose={() => setOpen(false)} uid={uid} courses={[{ id: courseId, title: courseTitle }]} exam={next ?? last} fixedCourse={{ id: courseId, title: courseTitle }} />
    </>
  )
}
