import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, Logo, MemoAvatar, MemoHero, Steps } from '../components/ui'
import { useAuth } from '../lib/auth'
import { firstNameOf } from '../lib/names'
import { enablePush, needsInstallFirst, pushSupported } from '../lib/push'

function Skip({ to }: { to: string }) {
  const nav = useNavigate()
  return <button type="button" className="link" style={{ textDecoration: 'none', color: 'var(--text-2)', padding: 10 }} onClick={() => nav(to, { replace: true })}>Passer</button>
}

/* Présentation de l'appli par le Memo de l'étudiant : une fois son animal adopté et nommé, il lui fait visiter Memoa. */
const tour = (me: string, first: string): { icon: string; tag: string; text: string }[] => [
  { icon: 'sparkle', tag: 'Salut !', text: `Salut ${first} ! Moi, c’est ${me}, ton compagnon d’étude. Je te fais visiter Memoa en une minute.` },
  { icon: 'text', tag: 'Tes cours', text: 'Ici, tu crées tes cours : écris, dicte ou photographie tes notes. Je les range dans ton sac à dos, cours par cours.' },
  { icon: 'sparkle', tag: 'Notes et résumés', text: 'Je mets tes notes en forme, je les complète si tu veux, et je t’en fais un résumé clair à relire avant l’examen.' },
  { icon: 'quiz', tag: 'Réviser', text: 'Je te pose des quiz tirés de tes propres notes, avec la correction. Et un autre quiz, avec de nouvelles questions, quand tu veux.' },
  { icon: 'book', tag: 'Assistant TP', text: 'Un travail pratique à rendre ? On fait le plan ensemble, je rédige, et tu télécharges un PDF avec la page de garde de ton université.' },
  { icon: 'shelf', tag: 'Librairie', text: 'Retrouve les documents partagés par ta promotion, et partage les tiens pour aider les autres.' },
  { icon: 'chat', tag: 'Parle-moi', text: 'Dans l’assistant, pose-moi tes questions : je m’appuie sur tes notes. Je peux aussi te lire un cours à voix haute.' },
  { icon: 'sparkle', tag: 'À toi de jouer', text: `Ensuite, je te guiderai page par page : une petite visite à ta première arrivée sur chaque écran. Tu pourras la revoir quand tu veux depuis « Moi ».` }
]

export function Presentation() {
  const nav = useNavigate()
  const { profile } = useAuth()
  const me = profile?.memo_name || 'Memo'
  const first = firstNameOf(profile) || 'toi'
  const cards = tour(me, first)
  const [i, setI] = useState(0)
  const [x0, setX0] = useState<number | null>(null)
  const last = i === cards.length - 1
  const done = () => nav('/essai', { replace: true })
  const go = (n: number) => setI(Math.max(0, Math.min(cards.length - 1, n)))
  return (
    <main className="step-page">
      <div className="step-top"><span /><button type="button" className="link" style={{ textDecoration: 'none', color: 'var(--text-2)', padding: 10 }} onClick={done}>Passer</button></div>
      <div
        className="intro-viewport"
        onTouchStart={(e) => setX0(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (x0 === null) return
          const dx = e.changedTouches[0].clientX - x0
          setX0(null)
          if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1))
        }}
      >
        <div className="intro-track" style={{ transform: `translateX(-${i * 100}%)` }}>
          {cards.map((c, k) => (
            <section key={c.tag} className="intro-card pres" aria-hidden={k !== i} aria-roledescription="carte" aria-label={`${k + 1} sur ${cards.length}`}>
              <span className="pres-av"><MemoAvatar animal={profile?.memo_animal ?? null} size={112} /></span>
              <div className="pres-bubble">
                <span className="pres-tag"><Icon name={c.icon} size={16} stroke={2} />{c.tag}</span>
                <p>{c.text}</p>
                <i aria-hidden="true" />
              </div>
            </section>
          ))}
        </div>
      </div>
      <div className="intro-dots" role="img" aria-label={`Carte ${i + 1} sur ${cards.length}`}>
        {cards.map((c, k) => <i key={c.tag} className={k === i ? 'on' : ''} />)}
      </div>
      <button type="button" className="pill-btn" onClick={() => (last ? done() : go(i + 1))}>{last ? 'C’est parti' : 'Suivant'}</button>
    </main>
  )
}

/* Étape 3 sur 4 : l'essai de 5 jours */
export function TrialStep() {
  const nav = useNavigate()
  const items = ['IA complète : notes, quiz, TP, audio et résumés', 'Sans carte bancaire', 'Ensuite, 20 points gratuits chaque jour à minuit']
  return (
    <main className="step-page">
      <div className="step-top"><span /><Skip to="/notifications-etape" /></div>
      <Steps n={3} />
      <MemoHero height={210} bubble="5 jours d’IA complète, offerts !" />
      <h1 className="h1 big" style={{ margin: 0 }}>Ton essai gratuit</h1>
      {items.map((t) => <div key={t} className="check-row"><span className="ck"><Icon name="check" size={16} stroke={2.4} /></span><span>{t}</span></div>)}
      <div style={{ flex: 1 }} />
      <span className="muted" style={{ textAlign: 'center' }}>L’essai est lié à ton numéro de téléphone.</span>
      <button type="button" className="pill-btn" onClick={() => nav('/notifications-etape', { replace: true })}>Démarrer mon essai</button>
    </main>
  )
}

/* Étape 4 sur 4 : notifications */
export function NotifStep() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const home = () => nav('/', { replace: true })

  async function accept() {
    if (!user) return home()
    setBusy(true)
    const r = await enablePush(user.id)
    setBusy(false)
    if (r.ok) home(); else setMsg(r.message)
  }

  return (
    <main className="step-page">
      <div className="step-top"><span /><Skip to="/" /></div>
      <Steps n={4} />
      <div className="notif-mock" aria-hidden="true">
        <span className="time">17:00</span>
        <div className="toast">
          <span className="app"><Logo size={27} /></span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', color: '#0b5d54' }}>MEMOA</span>
            <strong style={{ fontSize: 14 }}>Le savais-tu ?</strong>
            <span style={{ fontSize: 13, color: '#3f4f49' }}>Un fait à découvrir</span>
          </div>
        </div>
      </div>
      <h1 className="h1 big" style={{ margin: 0 }}>Une surprise chaque jour à 17 h</h1>
      <p className="lead">Un fait à découvrir, une seule notification. Tu peux l’arrêter quand tu veux.</p>
      {needsInstallFirst() && <span className="muted">Sur iPhone, ajoute d’abord Memoa à ton écran d’accueil.</span>}
      {msg && <div className="notice" role="alert">{msg}</div>}
      <div style={{ flex: 1 }} />
      {pushSupported() && <button type="button" className="pill-btn" onClick={() => void accept()} disabled={busy}><Icon name="chat" size={20} />{busy ? 'Un instant…' : 'Activer les notifications'}</button>}
      <button type="button" className="pill-btn ghost" onClick={home}>{pushSupported() ? 'Plus tard' : 'Continuer'}</button>
    </main>
  )
}
