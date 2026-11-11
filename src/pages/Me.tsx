import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BackLink, ErrorBox, Icon, Spinner, useAction, useLoad } from '../components/ui'
import { hasPremium, listActivity, listCourses, listPayments, PRICE_LABEL, saveProfile, signOut, startPayment, uploadAvatar } from '../lib/api'
import { useAuth } from '../lib/auth'
import { initialsOf } from '../lib/names'
import { VAPID_PUBLIC_KEY } from '../lib/features'
import { disablePush, enablePush, isSubscribed } from '../lib/push'
import { usePref } from '../lib/prefs'
import { currentStreak } from '../lib/streak'

const LANGUAGES: [string, string][] = [['fr', 'Français'], ['en', 'English']]

export function Me() {
  const { user, profile, refresh } = useAuth()
  const { error, run } = useAction()
  const act = useLoad(() => listActivity(user?.id ?? ''), [user?.id])
  const file = useRef<HTMLInputElement>(null)
  const streak = currentStreak(act.data ?? [])
  const initials = initialsOf(profile)

  async function pick(f: File | undefined) {
    if (!f || !user) return
    await run(async () => {
      const url = await uploadAvatar(user.id, f)
      await saveProfile(user.id, { avatar_url: url })
      await refresh()
    })
  }

  const courses = useLoad(() => listCourses(user?.id ?? ''), [user?.id])
  const prem = useLoad(() => hasPremium(user?.id ?? ''), [user?.id])
  const nCourses = courses.data?.length ?? 0
  const nNotes = (courses.data ?? []).reduce((n, c) => n + c.notes_count, 0)
  const uni = profile?.university?.match(/\(([^)]+)\)/)?.[1] ?? profile?.university
  const where = [uni, profile?.faculty, profile?.promotion].filter(Boolean).join(' · ')
  const Row = ({ to, icon, label, value }: { to: string; icon: string; label: string; value?: string }) => (
    <Link to={to} className="me-row"><Icon name={icon} size={20} /><span>{label}</span>{value && <span className="v">{value}</span>}<Icon name="chevright" size={18} /></Link>
  )

  return (
    <main className="page" style={{ gap: 18 }}>
      <section style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button type="button" className="hm-memo-av" style={{ width: 72, height: 72, padding: 0 }} onClick={() => file.current?.click()} aria-label="Changer ma photo (facultatif)">
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span className="h2">{initials}</span>}
        </button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <h1 className="h1" style={{ margin: 0, fontSize: 24 }}>{profile?.first_name || profile?.full_name}</h1>
          <span className="muted">{where}</span>
          <span className="muted">Ton Memo : {profile?.memo_name ?? 'Memo'}</span>
        </div>
      </section>
      <ErrorBox message={error} />

      <section className="me-stats" aria-label="Mes chiffres">
        <div><b>{streak}</b><span>{streak > 1 ? 'jours de suite' : 'jour de suite'}</span></div>
        <i aria-hidden="true" />
        <div><b>{nCourses}</b><span>cours</span></div>
        <i aria-hidden="true" />
        <div><b>{nNotes}</b><span>{nNotes > 1 ? 'notes' : 'note'}</span></div>
      </section>

      <section className="me-premium" aria-label="Premium">
        <span className="me-premium-pill">PREMIUM</span>
        <strong>Étudie sans te poser de limites</strong>
        <span className="sub">Notes IA, TP, audio et résumés avec une utilisation généreuse. Paiement par Orange Money, Airtel Money ou M-Pesa.</span>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
          <div><span className="price">{PRICE_LABEL.USD}</span> <span className="sub">/ 30 jours</span><br /><span className="sub">ou {PRICE_LABEL.CDF}</span></div>
          <Link to="/premium" className="btn amber small" style={{ borderRadius: 22 }}>{prem.data ? 'Mon abonnement' : 'Passer à Premium'}</Link>
        </div>
      </section>

      <div className="me-sec">COMPTE</div>
      <div className="me-grp">
        <Row to="/inscription?edit=1" icon="user" label="Mon profil" value="Modifier" />
        <Row to="/adoption?change=1" icon="star" label="Mon Memo" value="Changer" />
        <Row to="/parametres" icon="gear" label="Notifications, apparence et langue" />
      </div>
      <div className="me-sec">AIDE</div>
      <div className="me-grp">
        <Row to="/aide" icon="chat" label="Centre d’aide" />
        <Row to="/signaler" icon="text" label="Signaler un problème" />
        <Row to="/avis" icon="star" label="Donner mon avis" />
      </div>
      <div className="me-sec">À PROPOS</div>
      <div className="me-grp">
        <Row to="/confidentialite" icon="pdf" label="Confidentialité" />
        <Row to="/conditions" icon="pdf" label="Conditions d’utilisation" />
        <Row to="/a-propos" icon="home" label="À propos de Memoa" />
      </div>
    </main>
  )
}

function Switch({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <div className="list-row">
      <span id={'sw-' + label}>{label}</span>
      <button type="button" role="switch" aria-checked={on} aria-labelledby={'sw-' + label} className="switch" onClick={() => set(!on)} />
    </div>
  )
}

export function Settings() {
  const nav = useNavigate()
  const { user, profile } = useAuth()
  const [theme, setTheme] = usePref('theme', 'light')
  const [storedLang, setLang] = usePref('lang', 'fr')
  const lang = LANGUAGES.some(([c]) => c === storedLang) ? storedLang : 'fr'
  const [pushOn, setPushOn] = useState(false)
  const [pushMsg, setPushMsg] = useState<string | null>(null)
  const [saver, setSaver] = usePref('datasaver', '0')

  useEffect(() => { void isSubscribed().then(setPushOn) }, [])
  async function togglePush(want: boolean) {
    setPushMsg(null)
    if (!want) { await disablePush(); setPushOn(false); return }
    if (!user) return
    const r = await enablePush(user.id)
    setPushOn(r.ok)
    if (!r.ok) setPushMsg(r.message)
  }
  const [confirm, setConfirm] = useState(false)
  const [shared, setShared] = useState(false)

  async function share() {
    const url = window.location.origin + window.location.pathname
    const data = { title: 'Memoa', text: 'Memoa : étudie plus intelligemment.', url }
    try {
      if (navigator.share) await navigator.share(data)
      else {
        await navigator.clipboard.writeText(url)
        setShared(true)
      }
    } catch {
      /* partage annulé : rien à faire */
    }
  }

  async function logout() { await signOut(); nav('/connexion', { replace: true }) }

  return (
    <main className="page">
      <BackLink to="/moi" title="Paramètres" />
      <section className="card"><span className="label-mono">Langue</span>
        <div className="field">
          <label htmlFor="lang" className="muted">Langue de l'application</label>
          <select id="lang" className="select" value={lang} onChange={(e) => setLang(e.target.value)}>
            {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </div>
        {lang !== 'fr' && <div className="notice">Memoa est pour l'instant écrit en français. Ton choix est gardé : la traduction en anglais arrive bientôt.</div>}
      </section>
      <section className="card"><span className="label-mono">Thème</span>
        <div className="chips" role="radiogroup" aria-label="Thème">
          {[['dark', 'Sombre'], ['light', 'Clair']].map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={theme === v} className={'pill' + (theme === v ? ' on' : '')} onClick={() => setTheme(v)}>{l}</button>)}
        </div>
      </section>
      <section className="card"><span className="label-mono">Notifications et données</span>
        {VAPID_PUBLIC_KEY && <Switch label="Notifications « Le savais-tu ? »" on={pushOn} set={(v) => void togglePush(v)} />}
        {pushMsg && <div className="notice" role="alert">{pushMsg}</div>}
        <Switch label="Économie de données" on={saver === '1'} set={(v) => setSaver(v ? '1' : '0')} />
      </section>
      <section className="card"><span className="label-mono">Aide et informations</span>
        <Link to="/aide" className="list-row"><span>Centre d'aide</span><Icon name="back" size={18} /></Link>
        <Link to="/signaler" className="list-row"><span>Signaler un problème</span><Icon name="back" size={18} /></Link>
        <Link to="/avis" className="list-row"><span>Noter l'application</span><Icon name="back" size={18} /></Link>
        <button type="button" className="list-row" style={{ background: 'none', border: 0, color: 'inherit', textAlign: 'left', width: '100%' }} onClick={share}><span>Partager Memoa</span><Icon name="upload" size={18} /></button>
        {shared && <div className="notice">Lien copié. Colle-le dans WhatsApp ou ailleurs.</div>}
        <Link to="/confidentialite" className="list-row"><span>Politique de confidentialité</span><Icon name="back" size={18} /></Link>
        <Link to="/conditions" className="list-row"><span>Conditions d'utilisation</span><Icon name="back" size={18} /></Link>
        <Link to="/a-propos" className="list-row"><span>À propos de Memoa</span><Icon name="back" size={18} /></Link>
      </section>
      <section className="card"><span className="label-mono">Compte</span>
        <div className="list-row"><span className="muted">Email</span><span style={{ overflowWrap: 'anywhere', textAlign: 'right' }}>{user?.email}</span></div>
        <div className="list-row"><span className="muted">Téléphone</span><span>{profile?.phone ?? user?.phone ?? '—'}</span></div>
        <Link to="/premium" className="list-row"><span>Abonnement et paiements</span><Icon name="back" size={18} /></Link>
        {!confirm ? <button type="button" className="btn ghost" onClick={() => setConfirm(true)}>Se déconnecter</button> : (
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn ghost" onClick={() => setConfirm(false)}>Annuler</button>
            <button type="button" className="btn amber" onClick={logout}>Confirmer</button>
          </div>
        )}
      </section>
    </main>
  )
}

const OPERATORS = [
  { id: 'orange', name: 'Orange Money', dot: '#f2762e' },
  { id: 'airtel', name: 'Airtel Money', dot: '#e5202e' },
  { id: 'mpesa', name: 'M-Pesa', dot: '#3fb950' }
]
const STATUS: Record<string, [string, string]> = { paid: ['Payé', 'badge'], pending: ['En attente', 'badge amber'], failed: ['Échoué', 'badge red'] }
const BENEFITS = [
  "Cours générés à partir d'un audio, d'un PDF ou d'une photo",
  'Notes IA, résumés, quiz et cartes de révision',
  'Assistant TP avec export PDF et page de garde',
  'Assistant IA qui connaît ton cours',
  'Utilisation généreuse, avec une limite anti-abus'
]

export function Premium() {
  const { user } = useAuth()
  const pay = useLoad(listPayments, [])
  const prem = useLoad(() => hasPremium(user?.id ?? ''), [user?.id])
  const { busy, error, setError, run } = useAction()
  const [op, setOp] = useState('orange')
  const [cur, setCur] = useState<'USD' | 'CDF'>('USD')
  const [phone, setPhone] = useState('')
  const [info, setInfo] = useState<string | null>(null)

  async function go() {
    setInfo(null)
    if (!OPERATORS.some((o) => o.id === op)) return setError('Choisis un opérateur.')
    const r = await run(() => startPayment(op, phone, cur))
    if (r) { setInfo(r.message); pay.reload() }
  }

  return (
    <main className="page">
      <BackLink to="/moi" title="Memoa Premium" />
      <section className="card hero">
        <span className="label-mono" style={{ color: '#f2a33a' }}>Abonnement mensuel</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: 44, lineHeight: 1 }}>{PRICE_LABEL.USD}</span>
          <span className="muted" style={{ color: '#b9c8c2', fontSize: 16 }}>ou {PRICE_LABEL.CDF}</span>
        </div>
        {prem.data && <span className="badge">Abonnement actif</span>}
        {BENEFITS.map((b) => <div key={b} style={{ display: 'flex', gap: 10 }}><Icon name="check" size={20} color="#3ccfb4" stroke={2.4} /><span style={{ fontSize: 15, lineHeight: 1.4 }}>{b}</span></div>)}
      </section>

      <span className="label-mono">Payer par Mobile Money</span>
      <div className="grid3" role="radiogroup" aria-label="Opérateur">
        {OPERATORS.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={op === o.id} className="tile" style={{ minHeight: 76, alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 600, borderWidth: 2, borderColor: op === o.id ? '#3ccfb4' : undefined, background: op === o.id ? 'var(--surface-2)' : undefined }} onClick={() => setOp(o.id)}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: o.dot }} />{o.name}
          </button>
        ))}
      </div>
      <div className="chips" role="radiogroup" aria-label="Devise">
        {(['USD', 'CDF'] as const).map((c) => <button key={c} type="button" role="radio" aria-checked={cur === c} className={'pill' + (cur === c ? ' on' : '')} onClick={() => setCur(c)}>{PRICE_LABEL[c]}</button>)}
      </div>
      <div className="field"><label htmlFor="mm">Numéro Mobile Money</label><div className="phone"><span>+243</span><input id="mm" type="tel" inputMode="numeric" placeholder="8X XXX XX XX" value={phone} onChange={(e) => setPhone(e.target.value)} /></div></div>
      <ErrorBox message={error} />
      {info && <div className="notice">{info}</div>}
      <button type="button" className="btn amber" onClick={go} disabled={busy}>{busy ? 'Un instant…' : `Payer maintenant · ${PRICE_LABEL[cur]}`}</button>
      <span className="muted" style={{ textAlign: 'center' }}>Tu valides le paiement sur ton téléphone. Aucune donnée bancaire n'est stockée dans l'app.</span>

      <span className="label-mono">Historique des paiements</span>
      {pay.loading ? <Spinner /> : !pay.data?.length ? <span className="muted">Aucun paiement pour l'instant.</span> : pay.data.map((p) => {
        const [lab, cls] = STATUS[p.status] ?? ['—', 'badge']
        return (
          <div key={p.id} className="card" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <strong>{OPERATORS.find((o) => o.id === p.provider)?.name ?? p.provider}</strong>
              <span className="muted" style={{ fontFamily: 'var(--font-mono)' }}>{p.provider_ref ?? '—'}</span>
              <span className="muted">{new Date(p.created_at).toLocaleDateString('fr-FR')}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              <strong>{p.currency === 'USD' ? p.amount.toFixed(2).replace('.', ',') + ' USD' : p.amount.toLocaleString('fr-FR') + ' FC'}</strong>
              <span className={cls}>{lab}</span>
            </div>
          </div>
        )
      })}
    </main>
  )
}
