import { Link } from 'react-router-dom'
import { Icon, MemoAvatar, useLoad } from '../components/ui'
import { listActivity, listCourses } from '../lib/api'
import { useAuth } from '../lib/auth'
import { firstNameOf } from '../lib/names'
import { currentStreak, factOfTheDay, lastWeek, memoMood, streakTitle } from '../lib/streak'

export default function Home() {
  const { user, profile } = useAuth()
  const uid = user?.id ?? ''
  const act = useLoad(() => listActivity(uid), [uid])
  const courses = useLoad(() => listCourses(uid), [uid])
  const days = act.data ?? []
  const streak = currentStreak(days)
  const mood = memoMood(days)
  const first = firstNameOf(profile) || 'toi'
  const last = courses.data?.[0]

  return (
    <main className="page">
      <div>
        <span className="label-mono">{profile?.university?.match(/\(([^)]+)\)/)?.[1] ?? profile?.university} · {profile?.promotion}</span>
        <h1 className="h1" style={{ marginTop: 4 }}>Bonjour {first}</h1>
      </div>

      <section className="card hero" aria-label="Ton Memo">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ opacity: mood.state === 'energique' ? 1 : mood.state === 'faible' ? 0.8 : 0.6 }}>
            <MemoAvatar animal={profile?.memo_animal ?? null} size={84} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="h2">{profile?.memo_name ?? 'Memo'}</span>
            <span className="muted" style={{ color: '#d6e2dd' }}>{mood.text}</span>
            <span className="badge amber" style={{ alignSelf: 'flex-start' }}>
              {streak} {streak > 1 ? 'jours' : 'jour'} · {streakTitle(streak)}
            </span>
          </div>
        </div>
        <div className="week" aria-label="Tes 7 derniers jours">
          {lastWeek(days).map((d, i) => (
            <div key={i} className={'day' + (d.on ? ' on' : '')}><i />{d.label}</div>
          ))}
        </div>
      </section>

      {last && (
        <Link to={`/sac/${last.id}`} className="card">
          <span className="label-mono">Reprendre</span>
          <strong className="h2">{last.title}</strong>
          <span className="muted">{last.notes_count} {last.notes_count > 1 ? 'notes' : 'note'} dans ton sac à dos</span>
        </Link>
      )}

      <div className="grid2">
        <Link to="/cours" className="tile"><Icon name="plus" size={26} color="#3ccfb4" /><span className="h2">Nouveau cours</span></Link>
        <Link to="/sac" className="tile"><Icon name="book" size={26} color="#3ccfb4" /><span className="h2">Mon sac à dos</span></Link>
        <Link to="/librairie" className="tile"><Icon name="shelf" size={26} color="#3ccfb4" /><span className="h2">Librairie</span></Link>
        <Link to="/assistant" className="tile"><Icon name="chat" size={26} color="#3ccfb4" /><span className="h2">Poser une question</span></Link>
      </div>

      <section className="card" aria-label="Le savais-tu ?">
        <span className="label-mono">Le savais-tu ?</span>
        <span style={{ lineHeight: 1.45 }}>{factOfTheDay()}</span>
      </section>
    </main>
  )
}
