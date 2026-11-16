import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Empty, ErrorBox, Icon, PageHead, PillButton, Spinner, useAction } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useOnline } from '../lib/online'
import { answerCard, dueCards, generateCards, isDue, markReviewDay, MAX_PER_SESSION, useCardList, type Card } from '../lib/review'
import { track } from '../lib/track'
import { downloadBlob, makeReviewCardImage, shareReviewCard } from '../lib/cardimage'
import { countdownLabel, daysUntil, KIND_LABEL, priorityByCourse, upcoming, useExams } from '../lib/exams'

/** Cartes de révision : « À réviser aujourd’hui » (toutes les cours) ou celles d’un cours (/revision/:courseId). Marche sans connexion avec les cartes déjà créées. */
export default function Review() {
  const { courseId } = useParams()
  const { user, profile } = useAuth()
  const uid = user?.id ?? ''
  const memo = profile?.memo_name || 'Memo' // le prénom que l'étudiant a donné à son Memo
  const online = useOnline()
  const { cards, ready } = useCardList(uid)
  const { busy, error, setError, run } = useAction()
  const { exams } = useExams(uid || undefined)
  const prio = priorityByCourse(exams)
  const [session, setSession] = useState<Card[] | null>(null)
  const [i, setI] = useState(0)
  const [shown, setShown] = useState(false)
  const [knew, setKnew] = useState(0)
  const [again, setAgain] = useState(0)
  const [made, setMade] = useState<number | null>(null)
  const [first, setFirst] = useState(true)

  const mine = courseId ? cards.filter((c) => c.course_id === courseId) : cards
  const due = mine.filter((c) => isDue(c))
  const courseTitle = courseId ? mine[0]?.course_title : undefined
  const back = courseId ? `/sac/${courseId}` : '/'
  // Examen proche parmi les cours qui ont des cartes à réviser : leurs cartes passent en premier.
  const urgent = due.filter((c) => prio[c.course_id] !== undefined).sort((a, b) => prio[a.course_id] - prio[b.course_id])[0]

  const urgentLabel = urgent ? KIND_LABEL[upcoming(exams).find((e) => e.course_id === urgent.course_id && daysUntil(e.exam_date) === prio[urgent.course_id])?.kind ?? 'exam'] : ''

  function start() {
    const list = dueCards(cards, courseId, undefined, prio).slice(0, MAX_PER_SESSION)
    if (!list.length) return
    setSession(list); setShareMsg(null); setI(0); setShown(false); setKnew(0); setAgain(0); setFirst(true)
    track('cards_session_started', { count: list.length, scope: courseId ? 'cours' : 'tout' })
  }

  async function answer(ok: boolean) {
    if (!session) return
    const card = session[i]
    if (first) { setFirst(false); void markReviewDay(uid) } // réviser compte pour la série dès la première réponse
    await answerCard(uid, card, ok)
    const k = knew + (ok ? 1 : 0)
    const a = again + (ok ? 0 : 1)
    setKnew(k); setAgain(a)
    if (i + 1 >= session.length) {
      track('cards_session_done', { count: session.length, knew: k })
      setI(session.length)
    } else { setI(i + 1); setShown(false); setShareMsg(null) }
  }

  const [shareMsg, setShareMsg] = useState<string | null>(null)
  /** « share » : partage direct (WhatsApp…) ; « save » : image enregistrée dans le téléphone. */
  async function exportCard(c: Card, mode: 'share' | 'save') {
    setShareMsg(null)
    try {
      const blob = await makeReviewCardImage(c, memo, profile?.memo_animal ?? null)
      if (mode === 'save') { downloadBlob(blob, 'carte-memoa.png'); setShareMsg('Carte enregistrée : tu la retrouves dans tes téléchargements ou ta galerie.') } else {
        const r = await shareReviewCard(blob, `${c.course_title} — carte de révision Memoa`)
        if (r === 'saved') setShareMsg('Le partage direct n’est pas possible ici : la carte a été enregistrée, partage-la depuis ta galerie.')
      }
      track('card_exported', { mode })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setShareMsg((e as Error).message)
    }
  }

  async function generate() {
    if (!courseId) return
    setMade(null)
    const n = await run(() => generateCards(uid, courseId, memo))
    if (typeof n === 'number') setMade(n)
  }

  const genBtn = courseId && (
    <PillButton variant={mine.length ? 'outline' : 'solid'} onClick={() => void generate()} disabled={busy || !online}>
      <Icon name="sparkle" size={20} />{busy ? `${memo} prépare tes cartes…` : mine.length ? 'Créer d’autres cartes' : `Créer des cartes avec ${memo}`}
    </PillButton>
  )

  // ---- Séance en cours ----
  if (session && i < session.length) {
    const c = session[i]
    return (
      <main className="page">
        <PageHead to={back} title="Réviser" />
        <div className="rv-progress" role="status" aria-label={`Carte ${i + 1} sur ${session.length}`}>
          <i style={{ width: `${(i / session.length) * 100}%` }} />
        </div>
        <span className="muted rv-meta">{c.course_title} · carte {i + 1} sur {session.length}</span>
        <div className={'rv-flip' + (shown ? ' on' : '')} key={c.id}>
          <button type="button" className="rv-flip-in" onClick={() => setShown((v) => !v)} aria-label={shown ? 'Revoir la question' : 'Retourner la carte pour voir la réponse'}>
            <span className="rv-face rv-front" aria-hidden={shown}>
              <small>QUESTION</small>
              <strong>{c.question}</strong>
              <em>Touche la carte pour la retourner</em>
            </span>
            <span className="rv-face rv-back" aria-hidden={!shown}>
              <small>RÉPONSE</small>
              <strong>{c.answer}</strong>
            </span>
          </button>
        </div>
        {!shown ? (
          <PillButton size="lg" onClick={() => setShown(true)}>Voir la réponse</PillButton>
        ) : (
          <div className="rv-actions">
            <PillButton size="lg" variant="outline" onClick={() => void answer(false)}>À revoir</PillButton>
            <PillButton size="lg" onClick={() => void answer(true)}><Icon name="check" size={20} stroke={2.4} />Je savais</PillButton>
          </div>
        )}
        <div className="rv-actions">
          <PillButton variant="outline" onClick={() => void exportCard(c, 'share')}><Icon name="upload" size={18} />Partager</PillButton>
          <PillButton variant="outline" onClick={() => void exportCard(c, 'save')}><Icon name="download" size={18} />Enregistrer</PillButton>
        </div>
        {shareMsg && <span className="muted" role="status">{shareMsg}</span>}
        {!online && <span className="muted" role="status">Sans connexion : tes réponses sont gardées et envoyées au retour du réseau.</span>}
      </main>
    )
  }

  // ---- Séance terminée ----
  if (session) {
    const left = dueCards(cards, courseId, undefined, prio).length
    return (
      <main className="page">
        <PageHead to={back} title="Séance terminée" />
        <section className="card rv-done">
          <span className="rv-badge" aria-hidden="true"><Icon name="check" size={34} stroke={2.6} /></span>
          <strong className="h2" style={{ margin: 0 }}>{knew === session.length ? 'Sans faute, bravo !' : knew * 2 >= session.length ? 'Beau travail !' : 'Bien joué, tu as fait le plus dur !'}</strong>
          <span>{session.length} {session.length > 1 ? 'cartes revues' : 'carte revue'} aujourd’hui.</span>
          <div className="rv-stats">
            <div><b>{knew}</b><span>{knew > 1 ? 'je savais' : 'je savais'}</span></div>
            <div><b>{again}</b><span>à revoir</span></div>
          </div>
          <span className="rv-flame"><Icon name="flame" size={16} /> Ta série du jour est validée.</span>
          <span className="muted">{again > 0 ? `Les ${again} cartes à revoir reviennent demain. ` : ''}Celles que tu connais reviennent plus tard, de plus en plus espacées : c’est comme ça qu’on retient longtemps.</span>
        </section>
        {left > 0 && <PillButton size="lg" onClick={start}>Continuer ({left} {left > 1 ? 'cartes restantes' : 'carte restante'})</PillButton>}
        <PillButton size="lg" variant={left > 0 ? 'outline' : 'solid'} to={back}>{courseId ? 'Retour au cours' : 'Retour à l’accueil'}</PillButton>
      </main>
    )
  }

  // ---- Accueil de la révision ----
  return (
    <main className="page">
      <PageHead to={back} title={courseTitle ? `Cartes · ${courseTitle}` : 'À réviser aujourd’hui'} />
      <ErrorBox message={error} />
      {urgent && !session && <div className="notice" role="status">{urgentLabel} {countdownLabel(prio[urgent.course_id]).toLowerCase()} : on révise « {urgent.course_title} » en premier, et on finit ses cartes avant de passer à un autre cours.</div>}
      {made !== null && <div className="notice" role="status">{made} {made > 1 ? 'nouvelles cartes sont prêtes' : 'nouvelle carte est prête'}.</div>}
      {!ready && !mine.length ? <Spinner label="Chargement de tes cartes…" /> : due.length > 0 ? (
        <>
          <section className="card rv-card">
            <strong className="h2" style={{ margin: 0 }}>{due.length} {due.length > 1 ? 'cartes à réviser' : 'carte à réviser'}</strong>
            <span className="muted">Une question, tu réponds dans ta tête, puis tu vois la réponse. Séance de {Math.min(due.length, MAX_PER_SESSION)} cartes au plus.</span>
          </section>
          <PillButton size="lg" onClick={start}>Commencer</PillButton>
          {genBtn}
        </>
      ) : mine.length > 0 ? (
        <>
          <Empty title="Rien à réviser pour le moment" text="Tu es à jour. Les prochaines cartes reviendront à leur date, et ta série continue dès que tu révises." />
          {genBtn}
        </>
      ) : courseId ? (
        <>
          <Empty title="Pas encore de cartes" text={`${memo} lit les notes de ce cours et prépare des cartes question / réponse. Ça coûte 1 point (comme un quiz) ; réviser est gratuit.`} />
          {genBtn}
        </>
      ) : (
        <Empty title="Pas encore de cartes" text={`Ouvre un cours et choisis « Cartes de révision » : ${memo} les prépare à partir de tes notes.`}>
          <Link to="/sac" className="pill-btn sm">Voir mes cours</Link>
        </Empty>
      )}
      {!online && courseId && <span className="muted" role="status">Créer des cartes demande une connexion ; réviser celles qui existent déjà marche sans.</span>}
    </main>
  )
}
