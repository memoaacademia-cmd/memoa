import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Brand, ErrorBox, Icon, Logo, MemoHero, PillButton, PillInput, useAction } from '../components/ui'
import { requestPasswordReset, resendConfirmation, setPasswordAndPhone, signIn, signInWithGoogle, signUp, updatePassword } from '../lib/api'
import { useAuth } from '../lib/auth'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const cleanPhone = (v: string) => v.replace(/[^0-9]/g, '').replace(/^243/, '').replace(/^0/, '')

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.6a4.8 4.8 0 0 1-2.1 3.1v2.6h3.4c2-1.8 3.1-4.5 3.1-7.5z" />
      <path fill="#34A853" d="M12 22c2.8 0 5.2-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.7v2.7A10 10 0 0 0 12 22z" />
      <path fill="#FBBC05" d="M6.2 13.6a6 6 0 0 1 0-3.8V7.1H2.7a10 10 0 0 0 0 9.2z" />
      <path fill="#EA4335" d="M12 6c1.5 0 2.9.5 4 1.6l3-3A10 10 0 0 0 2.7 7.1l3.5 2.7C7 7.800 9.300 6 12 6z" />
    </svg>
  )
}

function Header({ title, text }: { title: string; text: string }) {
  return (
    <>
      <div style={{ margin: '56px 0 12px' }}>
        <Brand size={64} center />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'center' }}>
        <h1 className="h1 big">{title}</h1>
        <p className="lead">{text}</p>
      </div>
    </>
  )
}

/* Se connecter : email + mot de passe uniquement (pas de Google ici, par décision produit). */
export function Login() {
  const nav = useNavigate()
  const { refresh } = useAuth()
  const { busy, error, setError, run } = useAction()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!EMAIL_RE.test(email.trim())) return setError('Entre une adresse email valide.')
    if (!password) return setError('Entre ton mot de passe.')
    const ok = await run(async () => {
      await signIn(email.trim().toLowerCase(), password)
      await refresh()
      return true
    })
    if (ok) nav('/', { replace: true })
  }

  return (
    <main className="page auth" style={{ gap: 16 }}>
      <div>
        <button type="button" className="icon-btn round" aria-label="Retour" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/creer-un-compte'))}>
          <Icon name="back" stroke={2.2} />
        </button>
      </div>
      {/* Choix de langue : décoratif pour l'instant (la traduction vient plus tard dans le plan). */}
      <div style={{ alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: 'var(--text-2)' }}>
        Français <Icon name="chevdown" size={16} />
      </div>
      <div style={{ alignSelf: 'center', width: 76, height: 76, borderRadius: '50%', background: 'var(--surface-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '8px 0 4px' }}>
        <Logo size={44} />
      </div>
      <h1 className="h1 big" style={{ textAlign: 'center', margin: '0 0 8px' }}>Content de te revoir</h1>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
        <PillInput id="email" type="email" autoComplete="email" placeholder="Adresse e-mail" aria-label="Adresse e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <PillInput id="mdp" type="password" autoComplete="current-password" placeholder="Mot de passe" aria-label="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} />
        <ErrorBox message={error} />
        <PillButton type="submit" size="lg" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</PillButton>
        <div style={{ textAlign: 'center' }}>
          <Link className="link" style={{ textDecoration: 'none', display: 'inline-block', padding: '10px 8px' }} to="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
        </div>
      </form>
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 24 }}>
        <PillButton variant="outline" size="lg" to="/creer-un-compte">Créer un compte</PillButton>
        <span style={{ textAlign: 'center', fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: 18, letterSpacing: '-0.03em', color: 'var(--text-3)' }}>memoa</span>
      </div>
    </main>
  )
}

/* Créer un compte : seul endroit où « Continuer avec Google » apparaît. */
export function Signup() {
  const nav = useNavigate()
  const { refresh } = useAuth()
  const { busy, error, setError, run } = useAction()
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const mail = email.trim().toLowerCase()
    if (!EMAIL_RE.test(mail)) return setError('Entre une adresse email valide.')
    const tel = cleanPhone(phone)
    if (!/^[0-9]{9}$/.test(tel)) return setError('Entre ton numéro à 9 chiffres (sans le +243).')
    if (password.length < 8) return setError('Le mot de passe doit contenir au moins 8 caractères.')
    const res = await run(() => signUp(mail, password, '+243' + tel))
    if (!res) return
    if (res.needsConfirmation) nav('/confirmation', { state: { email: mail }, replace: true })
    else {
      await refresh()
      nav('/bienvenue', { replace: true })
    }
  }

  async function google() {
    const ok = await run(async () => {
      await signInWithGoogle()
      await refresh()
      return true
    })
    if (ok) nav('/google-suite', { replace: true })
  }

  return (
    <main className="page auth">
      <MemoHero height={150} bubble="Salut ! Moi, c’est Memo. On crée ton compte ?" />
      <h1 className="h1 big" style={{ margin: 0 }}>Crée ton compte</h1>
      <p className="lead" style={{ margin: 0 }}>Ton numéro active ton essai gratuit de 5 jours. Un seul essai par numéro.</p>
      <button type="button" className="btn ghost" onClick={google} disabled={busy} style={{ background: '#fff', color: '#0e1a2b', borderColor: '#b7c4be' }}>
        <GoogleG /> Continuer avec Google
      </button>
      <div className="muted" style={{ textAlign: 'center' }}>ou avec ton email</div>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="email" placeholder="ex. jean.kasongo@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="tel">Numéro de téléphone</label>
          <div className="phone"><span>+243</span><input id="tel" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="8X XXX XX XX" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        </div>
        <div className="field">
          <label htmlFor="mdp">Mot de passe</label>
          <input id="mdp" className="input" type="password" autoComplete="new-password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} />
          <span className="muted">8 caractères minimum.</span>
        </div>
        <ErrorBox message={error} />
        <button className="btn primary-light" type="submit" disabled={busy}>{busy ? 'Création…' : 'Créer mon compte'}</button>
      </form>
      <p className="muted" style={{ textAlign: 'center' }}>
        Déjà un compte ? <Link className="link" to="/connexion">Se connecter</Link>
      </p>
    </main>
  )
}

function strength(p: string): { pct: number; label: string } {
  let s = 0
  if (p.length >= 8) s++
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++
  if (/[0-9]/.test(p)) s++
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 12) s++
  return { pct: s * 25, label: ['Trop court', 'Faible', 'Correct', 'Bon', 'Solide'][s] }
}

/* Après Google : créer un mot de passe + ajouter le numéro, pour se reconnecter avec email + mot de passe. */
export function GoogleNext() {
  const nav = useNavigate()
  const { user, loading } = useAuth()
  const { busy, error, setError, run } = useAction()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [phone, setPhone] = useState('')
  const st = strength(password)

  useEffect(() => {
    if (!loading && !user) nav('/creer-un-compte', { replace: true })
  }, [loading, user, nav])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setError('Le mot de passe doit contenir au moins 8 caractères.')
    if (password !== confirm) return setError('Les deux mots de passe ne sont pas identiques.')
    const tel = cleanPhone(phone)
    if (!/^[0-9]{9}$/.test(tel)) return setError('Entre ton numéro à 9 chiffres (sans le +243).')
    const ok = await run(async () => {
      await setPasswordAndPhone(password, '+243' + tel)
      return true
    })
    if (ok) nav('/inscription', { replace: true })
  }

  return (
    <main className="page auth">
      <Header title="Sécurise ton compte" text="Crée un mot de passe : la prochaine fois, tu te connecteras avec ton email et ce mot de passe." />
      {user && <div className="card" style={{ flexDirection: 'row', alignItems: 'center' }}><GoogleG /><span>{user.email}</span></div>}
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
        <div className="field">
          <label htmlFor="mdp">Crée un mot de passe</label>
          <input id="mdp" className="input" type="password" autoComplete="new-password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="bar" aria-hidden="true"><i style={{ width: st.pct + '%', background: st.pct < 50 ? '#b3261e' : st.pct < 75 ? '#f2a33a' : '#0b5d54' }} /></div>
          <span className="muted">{password ? st.label : '8 caractères minimum.'}</span>
        </div>
        <div className="field">
          <label htmlFor="mdp2">Confirme le mot de passe</label>
          <input id="mdp2" className="input" type="password" autoComplete="new-password" placeholder="Répète le mot de passe" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="tel">Numéro de téléphone</label>
          <div className="phone"><span>+243</span><input id="tel" type="tel" inputMode="numeric" placeholder="8X XXX XX XX" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        </div>
        <ErrorBox message={error} />
        <button className="btn primary-light" type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Continuer'}</button>
      </form>
    </main>
  )
}

/* Email de confirmation (inscription classique). */
export function Confirmation({ email }: { email: string }) {
  const nav = useNavigate()
  const { refresh, user } = useAuth()
  const { busy, error, run } = useAction()
  const [wait, setWait] = useState(45)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  useEffect(() => {
    if (user) nav('/inscription', { replace: true })
  }, [user, nav])

  async function resend() {
    const ok = await run(async () => {
      await resendConfirmation(email)
      return true
    })
    if (ok) {
      setSent(true)
      setWait(45)
    }
  }

  return (
    <main className="page auth">
      <Header title="Vérifie ta boîte mail" text={email ? `Nous avons envoyé un lien de confirmation à ${email}.` : 'Nous avons envoyé un lien de confirmation à ton adresse.'} />
      <a className="btn primary-light" href="https://mail.google.com" target="_blank" rel="noreferrer">Ouvrir Gmail</a>
      <button className="btn ghost" type="button" disabled={wait > 0 || busy} onClick={resend}>
        {wait > 0 ? `Renvoyer l'email (${wait} s)` : "Renvoyer l'email"}
      </button>
      {sent && <div className="notice">Email renvoyé. Pense à regarder dans les courriers indésirables.</div>}
      <ErrorBox message={error} />
      <button className="btn ghost" type="button" onClick={() => void refresh()}>J'ai confirmé mon email</button>
      <p className="muted" style={{ textAlign: 'center' }}>Après confirmation, tu reviens ici et on continue.</p>
    </main>
  )
}

/* Mot de passe oublié : envoie un lien par email. */
export function ForgotPassword() {
  const { busy, error, setError, run } = useAction()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const mail = email.trim().toLowerCase()
    if (!EMAIL_RE.test(mail)) return setError('Entre une adresse email valide.')
    const ok = await run(async () => {
      await requestPasswordReset(mail)
      return true
    })
    if (ok) setSent(true)
  }

  return (
    <main className="page auth">
      <Header title="Mot de passe oublié" text="Entre ton email : on t'envoie un lien pour en choisir un nouveau." />
      {sent ? (
        <>
          <div className="notice">Si un compte existe avec cet email, un lien vient d'être envoyé. Pense à regarder dans les courriers indésirables.</div>
          <a className="btn primary-light" href="https://mail.google.com" target="_blank" rel="noreferrer">Ouvrir Gmail</a>
        </>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="email" placeholder="ex. jean.kasongo@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <ErrorBox message={error} />
          <button className="btn primary-light" type="submit" disabled={busy}>{busy ? 'Envoi…' : 'Envoyer le lien'}</button>
        </form>
      )}
      <p className="muted" style={{ textAlign: 'center' }}>
        <Link className="link" to="/connexion">Retour à la connexion</Link>
      </p>
    </main>
  )
}

/* Arrivée par le lien reçu par email : choisir le nouveau mot de passe. */
export function NewPassword() {
  const nav = useNavigate()
  const { user, loading, recovery, endRecovery } = useAuth()
  const { busy, error, setError, run } = useAction()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const st = strength(password)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setError('Le mot de passe doit contenir au moins 8 caractères.')
    if (password !== confirm) return setError('Les deux mots de passe ne sont pas identiques.')
    const ok = await run(async () => {
      await updatePassword(password)
      return true
    })
    if (ok) {
      endRecovery()
      nav('/', { replace: true })
    }
  }

  // Lien expiré, déjà utilisé, ou page ouverte sans passer par l'email.
  if (!loading && (!user || !recovery)) {
    return (
      <main className="page auth">
        <Header title="Lien non valide" text="Ce lien a expiré ou a déjà été utilisé. Demande-en un nouveau." />
        <Link className="btn primary-light" to="/mot-de-passe-oublie" replace>Recevoir un nouveau lien</Link>
        <p className="muted" style={{ textAlign: 'center' }}><Link className="link" to="/connexion">Retour à la connexion</Link></p>
      </main>
    )
  }

  return (
    <main className="page auth">
      <Header title="Nouveau mot de passe" text="Choisis un mot de passe que tu retiendras." />
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
        <div className="field">
          <label htmlFor="mdp">Nouveau mot de passe</label>
          <input id="mdp" className="input" type="password" autoComplete="new-password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="bar" aria-hidden="true"><i style={{ width: st.pct + '%', background: st.pct < 50 ? '#b3261e' : st.pct < 75 ? '#f2a33a' : '#0b5d54' }} /></div>
          <span className="muted">{password ? st.label : '8 caractères minimum.'}</span>
        </div>
        <div className="field">
          <label htmlFor="mdp2">Confirme le mot de passe</label>
          <input id="mdp2" className="input" type="password" autoComplete="new-password" placeholder="Répète le mot de passe" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <ErrorBox message={error} />
        <button className="btn primary-light" type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
      </form>
    </main>
  )
}
