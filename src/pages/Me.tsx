import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BottomSheet, ErrorBox, Icon, PageHead, PillButton, Row, RowGroup, Spinner, useAction, useLoad } from '../components/ui'
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
  return (
    <main className="page" style={{ gap: 18 }}>
      <section style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button type="button" className="hm-memo-av" style={{ width: 72, height: 72, padding: 0 }} onClick={() => file.current?.click()} aria-label="Changer ma photo (facultatif)">
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span className="h2">{initials}</span>}
        </button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <h1 className="h1" style={{ margin: 0, fontSize: 24 }}>{profile?.full_name || profile?.first_name}</h1>
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
          <Link to="/premium" className="pill-btn sm" style={{ background: '#f2a33a', color: '#0e1a2b' }}>{prem.data ? 'Mon abonnement' : 'Passer à Premium'}</Link>
        </div>
      </section>

      <RowGroup label="Compte">
        <Row icon="user" title="Mon profil" right="Modifier" to="/inscription?edit=1" />
        <Row icon="star" title="Mon Memo" right="Changer" to="/adoption?change=1" />
        <Row icon="gear" title="Réglages" sub="Notifications, apparence et langue" to="/parametres" />
      </RowGroup>
      <RowGroup label="Aide">
        <Row icon="chat" title="Centre d’aide" to="/aide" />
        <Row icon="text" title="Signaler un problème" to="/signaler" />
        <Row icon="star" title="Donner mon avis" to="/avis" />
      </RowGroup>
      <RowGroup label="À propos">
        <Row icon="pdf" title="Confidentialité" to="/confidentialite" />
        <Row icon="pdf" title="Conditions d’utilisation" to="/conditions" />
        <Row icon="home" title="À propos de Memoa" to="/a-propos" />
      </RowGroup>
    </main>
  )
}

function SwitchRow({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <div className="rg-row" style={{ cursor: 'default' }}>
      <span className="rg-body"><span className="rg-title" id={'sw-' + label}>{label}</span></span>
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

  const [pick, setPick] = useState<null | 'lang' | 'theme'>(null)
  const langName = LANGUAGES.find(([c]) => c === lang)?.[1] ?? 'Français'

  return (
    <main className="page" style={{ gap: 18 }}>
      <PageHead to="/moi" title="Réglages" />

      <RowGroup label="Apparence et langue">
        <Row icon="gear" title="Langue" right={langName} onClick={() => setPick('lang')} />
        <Row icon="star" title="Thème" right={theme === 'dark' ? 'Sombre' : 'Clair'} onClick={() => setPick('theme')} />
      </RowGroup>
      {lang !== 'fr' && <div className="notice">Memoa est pour l'instant écrit en français. Ton choix est gardé : la traduction en anglais arrive bientôt.</div>}

      <RowGroup label="Notifications et données">
        {VAPID_PUBLIC_KEY && <SwitchRow label="Notifications « Le savais-tu ? »" on={pushOn} set={(v) => void togglePush(v)} />}
        <SwitchRow label="Économie de données" on={saver === '1'} set={(v) => setSaver(v ? '1' : '0')} />
      </RowGroup>
      {pushMsg && <div className="notice" role="alert">{pushMsg}</div>}

      <RowGroup label="Aide et informations">
        <Row icon="chat" title="Centre d'aide" to="/aide" />
        <Row icon="text" title="Signaler un problème" to="/signaler" />
        <Row icon="star" title="Noter l'application" to="/avis" />
        <Row icon="upload" title="Partager Memoa" onClick={() => void share()} chevron={false} />
        <Row icon="pdf" title="Politique de confidentialité" to="/confidentialite" />
        <Row icon="pdf" title="Conditions d'utilisation" to="/conditions" />
        <Row icon="home" title="À propos de Memoa" to="/a-propos" />
      </RowGroup>
      {shared && <div className="notice">Lien copié. Colle-le dans WhatsApp ou ailleurs.</div>}

      <RowGroup label="Compte">
        <Row title="E-mail" right={user?.email ?? '—'} chevron={false} />
        <Row title="Téléphone" right={profile?.phone ?? user?.phone ?? '—'} chevron={false} />
        <Row icon="crown" title="Abonnement et paiements" to="/premium" />
      </RowGroup>

      {!confirm ? (
        <PillButton variant="outline" onClick={() => setConfirm(true)}>Se déconnecter</PillButton>
      ) : (
        <div style={{ display: 'flex', gap: 10 }}>
          <PillButton variant="outline" onClick={() => setConfirm(false)}>Annuler</PillButton>
          <PillButton onClick={() => void logout()}>Confirmer</PillButton>
        </div>
      )}

      <BottomSheet open={pick === 'lang'} onClose={() => setPick(null)} title="Langue de l'application">
        <RowGroup>
          {LANGUAGES.map(([code, name]) => (
            <button key={code} type="button" className="rg-row" onClick={() => { setLang(code); setPick(null) }}>
              <span className="rg-body"><span className="rg-title">{name}</span></span>
              <span className={'radio' + (lang === code ? ' on' : '')} />
            </button>
          ))}
        </RowGroup>
      </BottomSheet>
      <BottomSheet open={pick === 'theme'} onClose={() => setPick(null)} title="Thème">
        <RowGroup>
          {[['dark', 'Sombre'], ['light', 'Clair']].map(([v, l]) => (
            <button key={v} type="button" className="rg-row" role="radio" aria-checked={theme === v} onClick={() => { setTheme(v); setPick(null) }}>
              <span className="rg-body"><span className="rg-title">{l}</span></span>
              <span className={'radio' + (theme === v ? ' on' : '')} />
            </button>
          ))}
        </RowGroup>
      </BottomSheet>
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
    <main className="page" style={{ gap: 18 }}>
      <PageHead to="/moi" title="Memoa Premium" />
      <section className="prem-hero">
        <span className="label-mono" style={{ color: '#f2a33a' }}>Abonnement mensuel · un seul plan</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: 44, lineHeight: 1 }}>{PRICE_LABEL.USD}</span>
          <span style={{ color: '#b9c8c2', fontSize: 16 }}>ou {PRICE_LABEL.CDF}</span>
        </div>
        {prem.data && <span className="badge">Abonnement actif</span>}
        {BENEFITS.map((b) => <div key={b} style={{ display: 'flex', gap: 10 }}><Icon name="check" size={20} color="#3ccfb4" stroke={2.4} /><span style={{ fontSize: 15, lineHeight: 1.4 }}>{b}</span></div>)}
      </section>

      <RowGroup label="Payer par Mobile Money">
        {OPERATORS.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={op === o.id} className="rg-row" onClick={() => setOp(o.id)}>
            <span className="dot" style={{ background: o.dot }} />
            <span className="rg-body"><span className="rg-title">{o.name}</span></span>
            <span className={'radio' + (op === o.id ? ' on' : '')} />
          </button>
        ))}
      </RowGroup>
      <div className="chips" role="radiogroup" aria-label="Devise">
        {(['USD', 'CDF'] as const).map((c) => <button key={c} type="button" role="radio" aria-checked={cur === c} className={'pill' + (cur === c ? ' on' : '')} onClick={() => setCur(c)}>{PRICE_LABEL[c]}</button>)}
      </div>
      <div className="phone"><span>+243</span><input id="mm" type="tel" inputMode="numeric" placeholder="Numéro Mobile Money · 8X XXX XX XX" aria-label="Numéro Mobile Money" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      <ErrorBox message={error} />
      {info && <div className="notice">{info}</div>}
      <PillButton size="lg" onClick={() => void go()} disabled={busy}>{busy ? 'Un instant…' : `Payer maintenant · ${PRICE_LABEL[cur]}`}</PillButton>
      <span className="muted" style={{ textAlign: 'center' }}>Tu valides le paiement sur ton téléphone. Aucune donnée bancaire n'est stockée dans l'app.</span>

      <RowGroup label="Historique des paiements">
        {pay.loading ? <div className="rg-empty">Chargement…</div> : !pay.data?.length ? <div className="rg-empty">Aucun paiement pour l'instant.</div> : pay.data.map((p) => {
          const [lab, cls] = STATUS[p.status] ?? ['—', 'badge']
          const amount = p.currency === 'USD' ? p.amount.toFixed(2).replace('.', ',') + ' USD' : p.amount.toLocaleString('fr-FR') + ' FC'
          return (
            <div key={p.id} className="rg-row" style={{ cursor: 'default' }}>
              <span className="rg-body">
                <span className="rg-title">{OPERATORS.find((o) => o.id === p.provider)?.name ?? p.provider}</span>
                <span className="rg-sub">{new Date(p.created_at).toLocaleDateString('fr-FR')} · {p.provider_ref ?? '—'}</span>
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                <strong style={{ fontSize: 14 }}>{amount}</strong>
                <span className={cls}>{lab}</span>
              </span>
            </div>
          )
        })}
      </RowGroup>
    </main>
  )
}
