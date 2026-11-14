import { useNavigate } from 'react-router-dom'
import { PageHead, PillButton, Row, RowGroup } from '../components/ui'
import { useTours } from '../components/Tour'
import { listCourses } from '../lib/api'
import { useAuth } from '../lib/auth'
import { fillTour, TOURS, type TourDef } from '../lib/tours'

/* Liste des visites guidées : l'étudiant voit lesquelles il a faites et peut en relancer n'importe laquelle. */
export default function Tours() {
  const { user, profile } = useAuth()
  const { progress, restart, resetAll } = useTours()
  const nav = useNavigate()
  const vars = { first: '', memo: profile?.memo_name || 'Memo' }
  const state = (t: TourDef) => (progress[t.id] === 'done' ? 'Terminée' : progress[t.id] === 'skipped' ? 'Passée' : 'À voir')

  async function replay(t: TourDef) {
    let to: string | undefined
    // La visite d'un cours se joue dans un cours : on ouvre le plus récent s'il y en a un.
    if (t.id === 'course') {
      try {
        const list = await listCourses(user?.id ?? '')
        if (list[0]) to = `/sac/${list[0].id}`
      } catch { /* pas de réseau : on retombe sur la liste des cours */ }
    }
    restart(t.id, to)
  }

  return (
    <main className="page" style={{ gap: 18 }}>
      <PageHead to="/moi" title="Visites guidées" />
      <p className="lead">Une visite se lance toute seule la première fois que tu ouvres une page. Tu peux la revoir ici quand tu veux.</p>
      <RowGroup label="Les visites">
        {TOURS.map((t) => (
          <Row key={t.id} icon="sparkle" title={t.title} sub={`${fillTour(t.sub, vars)} · ${state(t)}`} right="Revoir" onClick={() => void replay(t)} />
        ))}
      </RowGroup>
      <PillButton variant="outline" onClick={() => { resetAll(); nav('/') }}>Tout revoir depuis l’accueil</PillButton>
      <span className="muted" style={{ textAlign: 'center' }}>La visite d’un cours s’ouvre dans ton cours le plus récent. Sans cours, elle se lance à ton premier cours.</span>
    </main>
  )
}
