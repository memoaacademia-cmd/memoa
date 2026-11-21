import { useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { takeDeletedNotice } from '../lib/account'
import { Link, useNavigate } from 'react-router-dom'
import { Brand, ErrorBox, Icon, Logo, PillButton, PillInput, useAction } from '../components/ui'
import { requestPasswordReset, resendConfirmation, signIn, signInWithGoogle, signUp, updatePassword, verifyRecoveryCode, verifySignupCode } from '../lib/api'
import { useAuth } from '../lib/auth'
import { CodeInput } from '../components/ReferralCodeField'
import { PARTNER_PROGRAM_ENABLED } from '../lib/features'
import { cleanPhone, PHONE_ERROR } from '../lib/phone'
import { clearStoredRef, getStoredRef, normalizeCode, setStoredRef, type RefSource } from '../lib/referral'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/* Champ mot de passe avec bouton œil : un appui montre le mot de passe, un autre appui le recache. */
function PasswordField({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [shown, setShown] = useState(false)
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* key : on recrée le champ à chaque bascule. Sur iPhone, changer seulement `type` sur un champ actif laisse le texte masqué. */}
      <input key={shown ? 'text' : 'password'} autoCapitalize="off" autoCorrect="off" spellCheck={false} {...props} className={className} type={shown ? 'text' : 'password'} style={{ ...props.style, paddingRight: 56 }} />
      <button
        type="button"
        // iPhone : sans ceci, le premier appui ferme le clavier, la page bouge et le clic est perdu.
        onPointerDown={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? 'Cacher le mot de passe' : 'Afficher le mot de passe'}
        aria-pressed={shown}
        style={{ position: 'absolute', top: '50%', right: 6, transform: 'translateY(-50%)', width: 44, height: 44, border: 0, background: 'transparent', color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {shown && <path d="M4 4 L20 20" />}
        </svg>
      </button>
    </div>
  )
}

/* Code à 6 chiffres : six cases séparées, avec un chiffre d'exemple grisé dans chacune. Gère la saisie, le collage et le code proposé par le téléphone. */
function OtpInput({ value, onChange, label = 'Code à 6 chiffres' }: { value: string; onChange: (v: string) => void; label?: string }) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  // Valeur « vivante » : mise à jour tout de suite (avant le prochain rendu), sinon la case suivante croit encore que le code est plus court et renvoie le curseur en arrière.
  const cur = useRef(value)
  cur.current = value
  const focus = (i: number) => { const el = refs.current[Math.max(0, Math.min(5, i))]; if (el) { el.focus(); el.select() } }
  const set = (v: string) => { const n = v.replace(/[^0-9]/g, '').slice(0, 6); cur.current = n; onChange(n); return n }
  function change(i: number, raw: string) {
    const v = cur.current
    let d = raw.replace(/[^0-9]/g, '')
    if (!d) { // case vidée (retour arrière sur certains claviers de téléphone)
      const n = set(v.slice(0, i) + v.slice(i + 1))
      focus(Math.min(i, n.length))
      return
    }
    const old = v[i] ?? ''
    // Une case déjà remplie qui reçoit un chiffre de plus : on garde le nouveau chiffre.
    if (old && d.length === 2) d = d.replace(old, '') || d.slice(-1)
    const n = set(d.length === 1 ? v.slice(0, i) + d + v.slice(i + 1) : (v.slice(0, i) + d))
    // Un chiffre : on passe tout de suite à la case suivante. Plusieurs (collage, code du téléphone) : après le dernier chiffre.
    focus(d.length === 1 ? i + 1 : n.length)
  }
  function key(i: number, e: ReactKeyboardEvent<HTMLInputElement>) {
    const v = cur.current
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (v[i]) { set(v.slice(0, i) + v.slice(i + 1)); focus(i) }
      else if (i > 0) { set(v.slice(0, i - 1) + v.slice(i)); focus(i - 1) }
    } else if (e.key === 'ArrowLeft') { e.preventDefault(); focus(i - 1) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); focus(i + 1) }
  }
  return (
    <div className="otp" role="group" aria-label={label}>
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          className={value[i] ? 'filled' : ''}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          placeholder={String(i + 1)}
          value={value[i] ?? ''}
          aria-label={`Chiffre ${i + 1} sur 6`}
          onChange={(e) => change(i, e.target.value)}
          onKeyDown={(e) => key(i, e)}
          // On ne peut pas laisser de trou : un appui sur une case vide mène à la première case libre.
          onFocus={(e) => { const n = cur.current.length; if (i > n) focus(n); else e.currentTarget.select() }}
          onPaste={(e) => { const t = e.clipboardData.getData('text').replace(/[^0-9]/g, ''); if (t) { e.preventDefault(); const n = set(t); focus(n.length) } }}
        />
      ))}
    </div>
  )
}

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

/* Bouton « Continuer avec Google » : le même sur « Se connecter » et « Créer un compte ». Après Google, l'étudiant passe d'abord par la page « Téléphone » (numéro + code partenaire), puis « Présente-toi ». */
function GoogleButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button type="button" className="btn ghost" onClick={onClick} disabled={busy} style={{ background: '#fff', color: '#0e1a2b', borderColor: '#b7c4be' }}>
      <GoogleG /> Continuer avec Google
    </button>
  )
}

function Header({ title, text }: { title: string; text: string }) {
  return (
    <>
      <div style={{ margin: '56px 0 12px' }}>
        <Brand size={44} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'center' }}>
        <h1 className="h1 big">{title}</h1>
        <p className="lead">{text}</p>
      </div>
    </>
  )
}

/* Se connecter : Google, ou email + mot de passe. */
export function Login() {
  const nav = useNavigate()
  const { refresh } = useAuth()
  const { busy, error, setError, run } = useAction()
  const [deleted] = useState(takeDeletedNotice)
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

  async function google() {
    const ok = await run(async () => {
      await signInWithGoogle()
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
      <div style={{ alignSelf: 'center', width: 76, height: 76, borderRadius: '50%', background: 'var(--surface-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '8px 0 4px' }}>
        <Logo size={44} />
      </div>
      {deleted && <div className="notice" role="status">Ton compte a été supprimé, avec tes données. Merci d’avoir essayé Memoa.</div>}
      <h1 className="h1 big" style={{ textAlign: 'center', margin: '0 0 8px' }}>Content de te revoir</h1>
      <GoogleButton busy={busy} onClick={google} />
      <div className="muted" style={{ textAlign: 'center' }}>ou avec ton email</div>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
        <PillInput id="email" type="email" autoComplete="email" placeholder="Adresse e-mail" aria-label="Adresse e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordField id="mdp" className="pill-input" autoComplete="current-password" placeholder="Mot de passe" aria-label="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} />
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

/* Créer un compte : Google (numéro demandé ensuite sur la page « Téléphone »), ou email + mot de passe + numéro + code partenaire facultatif. */
export function Signup() {
  const nav = useNavigate()
  const { refresh } = useAuth()
  const { busy, error, setError, run } = useAction()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [accepted, setAccepted] = useState(false)
  // Code partenaire (facultatif) : prérempli si un code est déjà connu (lien, installation, saisie précédente).
  const [refCode, setRefCode] = useState(() => (PARTNER_PROGRAM_ENABLED ? getStoredRef()?.code ?? '' : ''))
  const [refSource, setRefSource] = useState<RefSource>(() => getStoredRef()?.source ?? 'manual')
  const BAD_REF = 'Ce code n’a pas la bonne forme (exemple : JOEL-K7X2). Efface-le pour continuer sans code.'
  /** Garde le code choisi sur le téléphone : il sera envoyé au serveur juste après la connexion (voir ReferralAttach). Renvoie false si le texte est mal formé. */
  function keepRef(): boolean {
    if (!PARTNER_PROGRAM_ENABLED) return true
    if (!refCode.trim()) { clearStoredRef(); return true } // champ vidé exprès : on n'enverra aucun code
    const c = normalizeCode(refCode)
    if (!c) return false
    setStoredRef(c, refSource)
    return true
  }
  const MUST_ACCEPT = 'Coche la case pour accepter les conditions d’utilisation et la politique de confidentialité.'

  async function submit(e: FormEvent) {
    e.preventDefault()
    const mail = email.trim().toLowerCase()
    if (!EMAIL_RE.test(mail)) return setError('Entre une adresse email valide.')
    if (password.length < 8) return setError('Le mot de passe doit contenir au moins 8 caractères.')
    const cleanTel = cleanPhone(phone)
    if (!cleanTel) return setError(PHONE_ERROR)
    if (!accepted) return setError(MUST_ACCEPT)
    if (!keepRef()) return setError(BAD_REF)
    const res = await run(() => signUp(mail, password, cleanTel))
    if (!res) return
    if (res.needsConfirmation) nav('/confirmation', { state: { email: mail }, replace: true })
    else {
      await refresh()
      nav('/inscription', { replace: true })
    }
  }

  async function google() {
    if (!accepted) return setError(MUST_ACCEPT)
    if (!keepRef()) return setError(BAD_REF)
    const ok = await run(async () => {
      await signInWithGoogle()
      await refresh()
      return true
    })
    if (ok) nav('/', { replace: true })
  }

  return (
    <main className="page auth">
      <div style={{ margin: '40px 0 4px' }}>
        <Brand size={44} />
      </div>
      <h1 className="h1 big" style={{ margin: 0, textAlign: 'center' }}>Crée ton compte</h1>
      <p className="lead" style={{ margin: 0, textAlign: 'center' }}>Quelques secondes suffisent pour commencer.</p>
      <GoogleButton busy={busy} onClick={google} />
      <div className="muted" style={{ textAlign: 'center' }}>ou avec ton email</div>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="email" placeholder="ex. jean.kasongo@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="mdp">Mot de passe</label>
          <PasswordField id="mdp" className="input" autoComplete="new-password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} />
          <span className="muted">8 caractères minimum.</span>
        </div>
        <div className="field">
          <label htmlFor="tel">Numéro de téléphone</label>
          <input id="tel" className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="ex. 0812345678" value={phone} onChange={(e) => { setPhone(e.target.value); setError(null) }} />
        </div>
        {PARTNER_PROGRAM_ENABLED && (
          <div className="field">
            <label htmlFor="ref-code">Code partenaire (facultatif)</label>
            <CodeInput value={refCode} onChange={(v) => { setRefCode(v); setError(null) }} onSource={setRefSource} />
          </div>
        )}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, lineHeight: 1.4, cursor: 'pointer' }}>
          <input type="checkbox" checked={accepted} onChange={(e) => { setAccepted(e.target.checked); if (e.target.checked) setError('') }} style={{ width: 20, height: 20, flexShrink: 0, marginTop: 1, accentColor: 'var(--btn)' }} />
          <span>
            J’accepte les <a className="link" href="#/legal/conditions" target="_blank" rel="noopener">conditions d’utilisation</a> et la <a className="link" href="#/legal/confidentialite" target="_blank" rel="noopener">politique de confidentialité</a> de Memoa.
          </span>
        </label>
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

/* Vérification de l'email : le code à 6 chiffres, « Confirmer » (le code part aussi tout seul au 6e chiffre) et « Renvoyer le code ». */
export function Confirmation({ email }: { email: string }) {
  const nav = useNavigate()
  const { refresh, user } = useAuth()
  const { busy, error, setError, run } = useAction()
  const [wait, setWait] = useState(45)
  const [sent, setSent] = useState(false)
  const [mail, setMail] = useState(email)
  const [code, setCode] = useState('')
  // Dernier code déjà envoyé : un code refusé n'est pas renvoyé en boucle, il faut le modifier ou toucher « Confirmer ».
  const tried = useRef('')

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
      await resendConfirmation(mail.trim())
      return true
    })
    if (ok) {
      setSent(true)
      setWait(45)
      setCode('')
      tried.current = ''
    }
  }

  async function validate(e?: FormEvent) {
    e?.preventDefault()
    if (busy || !mail.trim() || !/^[0-9]{6}$/.test(code)) return
    tried.current = code
    const ok = await run(async () => {
      await verifySignupCode(mail, code)
      await refresh()
      return true
    })
    if (ok) nav('/inscription', { replace: true })
  }

  // Confirmation automatique dès que le 6e chiffre est tapé (ou collé).
  useEffect(() => {
    if (code.length === 6 && code !== tried.current && mail.trim()) void validate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  return (
    <main className="page auth">
      <div style={{ alignSelf: 'center', width: 76, height: 76, borderRadius: '50%', background: 'var(--surface-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '56px 0 4px' }}>
        <Logo size={44} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'center' }}>
        <h1 className="h1 big" style={{ margin: 0 }}>Vérifie ta boîte mail</h1>
        <p className="lead">{mail ? `Nous avons envoyé un code à ${mail}. Tape-le ici : tu restes dans l'application.` : 'Nous avons envoyé un code à ton adresse. Tape-le ici : tu restes dans l\u2019application.'}</p>
      </div>
      <form onSubmit={validate} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!email && <PillInput type="email" autoComplete="email" placeholder="Ton email" value={mail} onChange={(e) => setMail(e.target.value)} />}
        <OtpInput value={code} onChange={(v) => { setCode(v); setError(null) }} />
        <ErrorBox message={error} />
        <PillButton type="submit" size="lg" disabled={busy || code.length !== 6 || !mail.trim()}>{busy ? 'Vérification…' : 'Confirmer'}</PillButton>
      </form>
      <button className="btn ghost" type="button" disabled={wait > 0 || busy} onClick={resend}>
        {wait > 0 ? `Renvoyer le code (${wait} s)` : 'Renvoyer le code'}
      </button>
      {sent && <div className="notice">Nouveau code envoyé. Utilise le dernier reçu, et regarde aussi dans les courriers indésirables.</div>}
    </main>
  )
}

/* Mot de passe oublié : envoie un code à 6 chiffres par email (le lien reçu fonctionne toujours aussi). */
export function ForgotPassword() {
  const nav = useNavigate()
  const { startRecovery, endRecovery, refresh } = useAuth()
  const { busy, error, setError, run } = useAction()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [wait, setWait] = useState(0)
  const [again, setAgain] = useState(false)

  useEffect(() => {
    if (wait <= 0) return
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000)
    return () => window.clearTimeout(t)
  }, [wait])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const mail = email.trim().toLowerCase()
    if (!EMAIL_RE.test(mail)) return setError('Entre une adresse email valide.')
    const ok = await run(async () => {
      await requestPasswordReset(mail)
      return true
    })
    if (ok) { setSent(true); setWait(60); setCode('') }
  }

  async function resend() {
    if (wait > 0 || busy) return
    const ok = await run(async () => { await requestPasswordReset(email.trim().toLowerCase()); return true })
    if (ok) { setAgain(true); setWait(60); setCode('') }
  }

  async function validate(e: FormEvent) {
    e.preventDefault()
    if (!/^[0-9]{6}$/.test(code)) return setError('Le code a 6 chiffres.')
    // On passe en mode « nouveau mot de passe » AVANT la validation : sinon l'appli t'enverrait un instant vers l'accueil.
    startRecovery()
    const ok = await run(async () => {
      await verifyRecoveryCode(email.trim().toLowerCase(), code)
      await refresh()
      return true
    })
    if (ok) nav('/nouveau-mot-de-passe', { replace: true })
    else endRecovery()
  }

  return (
    <main className="page auth">
      <Header title="Mot de passe oublié" text={sent ? `On a envoyé un code à 6 chiffres à ${email.trim().toLowerCase()}. Tape-le ici pour choisir un nouveau mot de passe.` : "Entre ton email : on t'envoie un code pour en choisir un nouveau."} />
      {sent ? (
        <>
          <form onSubmit={validate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
            <OtpInput value={code} onChange={(v) => { setCode(v); setError(null) }} />
            <ErrorBox message={error} />
            <button className="btn primary-light" type="submit" disabled={busy || code.length !== 6}>{busy ? 'Vérification…' : 'Valider le code'}</button>
          </form>
          <button className="btn ghost" type="button" disabled={wait > 0 || busy} onClick={resend}>{wait > 0 ? `Renvoyer le code (${wait} s)` : 'Renvoyer le code'}</button>
          {again && <div className="notice">Nouveau code envoyé. Utilise le dernier reçu.</div>}
          <p className="muted" style={{ textAlign: 'center' }}>Si un compte existe avec cet email, le code arrive en quelques instants. Regarde aussi dans les courriers indésirables.</p>
        </>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="email" placeholder="ex. jean.kasongo@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <ErrorBox message={error} />
          <button className="btn primary-light" type="submit" disabled={busy}>{busy ? 'Envoi…' : 'Envoyer le code'}</button>
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
        <Header title="Lien non valide" text="Ce code ou ce lien a expiré ou a déjà été utilisé. Demandes-en un nouveau." />
        <Link className="btn primary-light" to="/mot-de-passe-oublie" replace>Recevoir un nouveau code</Link>
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
          <PasswordField id="mdp" className="input" autoComplete="new-password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="bar" aria-hidden="true"><i style={{ width: st.pct + '%', background: st.pct < 50 ? '#b3261e' : st.pct < 75 ? '#f2a33a' : '#0b5d54' }} /></div>
          <span className="muted">{password ? st.label : '8 caractères minimum.'}</span>
        </div>
        <div className="field">
          <label htmlFor="mdp2">Confirme le mot de passe</label>
          <PasswordField id="mdp2" className="input" autoComplete="new-password" placeholder="Répète le mot de passe" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <ErrorBox message={error} />
        <button className="btn primary-light" type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
      </form>
    </main>
  )
}
