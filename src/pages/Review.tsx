import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Empty, ErrorBox, Icon, PageHead, PillButton, Spinner, useAction } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useOnline } from '../lib/online'
import { answerCard, dueCards, generateCards, isDue, markReviewDay, MAX_PER_SESSION, useCardList, type Card } from '../lib/review'
import { track } from '../lib/track'

/** Cartes de révision : « À réviser aujourd’hui » (toutes les cours) ou celles d’un cours (/revision/:courseId). Marche sans connexion avec les cartes déjà créées. */
export default function Review() {
  const { courseId } = useParams()
  const { user } = useAuth()
  const uid = user?.id ?? ''
  const online = useOnline()
  const { cards, ready } = useCardList(uid)
  const { busy, error, setError, run } = useAction()
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

  function start() {
    const list = dueCards(cards, courseId).slice(0, MAX_PER_SESSION)
    if (!list.length) return
    setSession(list); setI(0); setShown(false); setKnew(0); setAgain(0); setFirst(true)
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
    } else { setI(i + 1); setShown(false) }
  }

  async function generate() {
    if (!courseId) return
    setMade(null)
    const n = await run(() => generateCards(uid, courseId))
    if (typeof n === 'number') setMade(n)
  }

  const genBtn = courseId && (
    <PillButton variant={mine.length ? 'outline' : 'solid'} onClick={() => void generate()} disabled={busy || !online}>
      <Icon name="sparkle" size={20} />{busy ? 'Memo prépare tes cartes…' : mine.length ? 'Créer d’autres cartes' : 'Créer des cartes avec Memo'}
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
        <span className="muted">{c.course_title} · carte {i + 1} sur {session.length}</span>
        <section className="card rv-card" aria-live="polite">
          <strong className="h2" style={{ margin: 0 }}>{c.question}</strong>
          {shown && <p className="rv-answer">{c.answer}</p>}
        </section>
        {!shown ? (
          <PillButton size="lg" onClick={() => setShown(true)}>Voir la réponse</PillButton>
        ) : (
          <div className="rv-actions">
            <PillButton size="lg" variant="outline" onClick={() => void answer(false)}>À revoir</PillButton>
            <PillButton size="lg" onClick={() => void answer(true)}><Icon name="check" size={20} stroke={2.4} />Je savais</PillButton>
          </div>
        )}
        {!online && <span className="muted" role="status">Sans connexion : tes réponses sont gardées et envoyées au retour du réseau.</span>}
      </main>
    )
  }

  // ---- Séance terminée ----
  if (session) {
    const left = dueCards(cards, courseId).length
    return (
      <main className="page">
        <PageHead to={back} title="Séance terminée" />
        <section className="card rv-card">
          <strong className="h2" style={{ margin: 0 }}>Bravo, {session.length} {session.length > 1 ? 'cartes revues' : 'carte revue'}</strong>
          <span>{knew} {knew > 1 ? 'savaient' : 'savais'} · {again} à revoir</span>
          <span className="muted">Les cartes à revoir reviennent demain ; celles que tu connais reviennent plus tard, de plus en plus espacées.</span>
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
          <Empty title="Pas encore de cartes" text="Memo lit les notes de ce cours et prépare des cartes question / réponse. Ça coûte 1 point (comme un quiz) ; réviser est gratuit." />
          {genBtn}
        </>
      ) : (
        <Empty title="Pas encore de cartes" text="Ouvre un cours et choisis « Cartes de révision » : Memo les prépare à partir de tes notes.">
          <Link to="/sac" className="pill-btn sm">Voir mes cours</Link>
        </Empty>
      )}
      {!online && courseId && <span className="muted" role="status">Créer des cartes demande une connexion ; réviser celles qui existent déjà marche sans.</span>}
    </main>
  )
}
