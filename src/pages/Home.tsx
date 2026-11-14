import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon, MemoAvatar, useLoad } from '../components/ui'
import FactCard from '../components/FactCard'
import { listActivity, listCourses, searchNotes, type NoteHit } from '../lib/api'
import { useAuth } from '../lib/auth'
import { firstNameOf } from '../lib/names'
import { currentStreak, lastWeek, memoMood } from '../lib/streak'
import { usePoints } from '../lib/points'
import { useAvatar } from '../lib/avatar'
import { usePlan } from '../lib/plan'
import { usePref } from '../lib/prefs'
import { Price } from '../components/PlanInfo'

const COURSE_COLORS = ['#0B5D54', '#22345A', '#A5600A', '#9A4A32']

function Spine({ color }: { color: string }) {
  return <div className="hm-spine" style={{ background: color }} aria-hidden="true"><i /><i /></div>
}

export default function Home() {
  const { user, profile } = useAuth()
  const uid = user?.id ?? ''
  const act = useLoad(() => listActivity(uid), [uid])
  const courses = useLoad(() => listCourses(uid), [uid])
  const days = act.data ?? []
  const streak = currentStreak(days)
  const pts = usePoints()
  const plan = usePlan()
  const [promoDay, setPromoDay] = usePref('home-promo-day', '')
  const today = new Date().toDateString()
  const showPromo = (plan.state === 'free' || plan.state === 'expired') && promoDay !== today
  const promoTitle = plan.state === 'expired' ? 'Retrouve Premium' : (pts && pts.left <= 0) ? 'Plus de points aujourd’hui ?' : 'Plus d’IA avec Premium'
  const promoSub = plan.state === 'expired' ? <>Ton abonnement est terminé · <Price cur="USD" /></> : (pts && pts.left <= 0) ? 'Premium te laisse continuer sans attendre minuit' : <>Sans compte à rebours de points · <Price cur="USD" /></>
  const mood = memoMood(days)
  const avatarSrc = useAvatar(profile?.avatar_url)
  const first = firstNameOf(profile) || 'toi'
  const list = courses.data ?? []
  const last = list[0]
  const memoName = profile?.memo_name ?? 'Memo'

  const [q, setQ] = useState('')
  const [hits, setHits] = useState<NoteHit[] | null>(null)
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setHits(null); return }
    let alive = true
    const t = setTimeout(() => {
      searchNotes(uid, term).then((r) => { if (alive) setHits(r) }).catch(() => { if (alive) setHits([]) })
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [q, uid])

  const uni = profile?.university?.match(/\(([^)]+)\)/)?.[1] ?? profile?.university
  const eyebrow = [uni, profile?.faculty, profile?.promotion].filter(Boolean).join(' · ')
  const week = lastWeek(days)
  const courseTitle = (id: string) => list.find((c) => c.id === id)?.title ?? 'Cours'

  return (
    <main className="page" style={{ gap: 18 }}>
      <div className="hm-top">
        <span className="hm-brand">memoa</span>
        <div className="hm-right">
          {pts && (
            <span data-tour="home-points" className={'pts-chip free' + (pts.left <= 0 ? ' zero' : '')} role="status" aria-label={`${pts.left} points restants aujourd’hui (renouvelés chaque jour à minuit, heure de Kinshasa)`}>
              <span className="gold-bolt"><Icon name="bolt" size={14} /></span>{pts.left}
            </span>
          )}
          <Link to="/moi" className="hm-avatar" aria-label="Mon profil">
            {avatarSrc ? <img src={avatarSrc} alt="" /> : first.slice(0, 1).toUpperCase()}
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="hm-eyebrow">{eyebrow}</span>
        <h1 className="h1 big" style={{ margin: 0 }}>Salut, {first}</h1>
      </div>

      <div className="hm-search" role="search" data-tour="home-search">
        <span className="ico"><Icon name="search" size={20} /></span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cherche dans tes notes" aria-label="Chercher dans tes notes" />
      </div>
      {hits && (hits.length
        ? <div className="hm-hits">{hits.map((h) => (
            <Link key={h.id} to={`/sac/${h.course_id}`} className="hm-hit"><b>{h.title}</b><span>{courseTitle(h.course_id)} · {h.snippet}</span></Link>
          ))}</div>
        : <div className="muted" role="status">Aucune note ne correspond.</div>)}

      {last && (
        <Link to={`/sac/${last.id}`} className="hm-resume" data-tour="home-resume">
          <Spine color={COURSE_COLORS[0]} />
          <div className="hm-resume-body">
            <small>REPRENDRE</small>
            <strong>{last.title}</strong>
            <span>{last.notes_count} {last.notes_count > 1 ? 'notes' : 'note'}</span>
          </div>
          <span className="hm-play" aria-hidden="true"><Icon name="play" size={20} /></span>
        </Link>
      )}

      {list.length > 0 && (
        <section data-tour="home-courses" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="hm-sec-head"><h2>Tes cours</h2><Link to="/sac">Tout voir</Link></div>
          <div className="hm-rail">
            {list.map((c, i) => (
              <Link key={c.id} to={`/sac/${c.id}`} className="hm-course" style={{ background: COURSE_COLORS[i % COURSE_COLORS.length] }}>
                <div className="bars" aria-hidden="true"><i /><i /><i /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <strong>{c.title}</strong>
                  <span>{c.notes_count} {c.notes_count > 1 ? 'notes' : 'note'}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="hm-memo" aria-label="Ton Memo" data-tour="home-memo">
        <div className="hm-memo-top">
          <span className="hm-memo-av"><MemoAvatar animal={profile?.memo_animal ?? null} size={42} /></span>
          <div style={{ minWidth: 0 }}>
            <strong>
              {streak > 0 ? `${streak} ${streak > 1 ? 'jours' : 'jour'} de suite` : 'Commence ta série'}
              <span className="hm-flame" aria-label={`${streak} jours de suite`}><Icon name="flame" size={14} />{streak}</span>
            </strong>
            <span>{memoName} · {mood.text}</span>
          </div>
        </div>
        <div className="hm-week" aria-label="Tes 7 derniers jours">
          {week.map((d, i) => {
            const today = i === week.length - 1 && !d.on
            return (
              <div key={i} className="hm-day">
                <span className={'hm-dot' + (d.on ? ' done' : today ? ' today' : '')}>{d.on && <Icon name="check" size={16} stroke={2.4} />}</span>
                {d.label}
              </div>
            )
          })}
        </div>
      </section>

      <div data-tour="home-fact"><FactCard memoName={memoName} animal={profile?.memo_animal ?? null} /></div>

      {showPromo && (
        <aside className="hm-promo" aria-label="Premium">
          <Link to="/premium" className="hm-promo-link">
            <span className="hm-promo-ico" aria-hidden="true"><Icon name="crown" size={18} stroke={2} /></span>
            <span className="hm-promo-txt"><strong>{promoTitle}</strong><span>{promoSub}</span></span>
            <Icon name="chevright" size={18} />
          </Link>
          <button type="button" className="hm-promo-x" aria-label="Masquer pour aujourd’hui" onClick={() => setPromoDay(today)}><Icon name="close" size={16} /></button>
        </aside>
      )}
    </main>
  )
}
