import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BackLink, ErrorBox, Icon, MemoAvatar, Spinner, useAction, useLoad } from '../components/ui'
import { hasPremium, listActivity, listPayments, PRICES, saveProfile, signOut, startPayment, uploadAvatar } from '../lib/api'
import { useAuth } from '../lib/auth'
import { initialsOf } from '../lib/names'
import { usePref } from '../lib/prefs'
import { currentStreak, streakTitle } from '../lib/streak'

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

  const rows: [string, string | undefined][] = [
    ['Université', profile?.university], ['Faculté', profile?.faculty], ['Département', profile?.department],
    ['Promotion', profile?.promotion], ['Vacation', profile?.vacation || 'Non précisée']
  ]

  return (
    <main className="page">
      <h1 className="h1">Moi</h1>
      <section className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <button type="button" className="icon-btn" style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', padding: 0 }} onClick={() => file.current?.click()} aria-label="Changer ma photo (facultatif)">
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span className="h2">{initials}</span>}
        </button>
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <strong className="h2">{profile?.full_name}</strong>
          <span className="muted" style={{ overflowWrap: 'anywhere' }}>{user?.email}</span>
          <span className="muted">Photo facultative</span>
        </div>
      </section>
      <ErrorBox message={error} />

      <section className="card" aria-label="Mon parcours">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="label-mono">Mon parcours</span>
          <Link to="/inscription?edit=1" className="link">Modifier</Link>
        </div>
        {rows.map(([k, v]) => <div key={k} className="list-row"><span className="muted">{k}</span><span style={{ textAlign: 'right', fontWeight: 500 }}>{v}</span></div>)}
      </section>

      <div className="grid2">
        <Link to="/premium" className="tile"><Icon name="crown" size={26} color="#f2a33a" /><span><span className="h2">Abonnement</span><br /><span style={{ color: '#3ccfb4', fontWeight: 600, fontSize: 14 }}>Passer à Premium</span></span></Link>
        <Link to="/parametres" className="tile"><Icon name="gear" size={26} /><span><span className="h2">Paramètres</span><br /><span className="muted">Langue, thème, compte</span></span></Link>
      </div>
      <section className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <MemoAvatar animal={profile?.memo_animal ?? null} size={56} />
        <div><strong className="h2">Flammes</strong><br /><span className="muted">{streak} {streak > 1 ? 'jours' : 'jour'} de suite · {streakTitle(streak)}</span></div>
      </section>
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
  const [theme, setTheme] = usePref('theme', 'dark')
  const [notif, setNotif] = usePref('notif', '1')
  const [saver, setSaver] = usePref('datasaver', '0')
  const [confirm, setConfirm] = useState(false)

  async function logout() { await signOut(); nav('/connexion', { replace: true }) }

  return (
    <main className="page">
      <BackLink to="/moi" title="Paramètres" />
      <section className="card"><span className="label-mono">Langue</span>
        {[['Français', true], ['English', false], ['Lingala', false], ['Swahili', false]].map(([l, ok]) => (
          <div key={String(l)} className="list-row"><span>{l}</span>{ok ? <span className="badge">Actuelle</span> : <span className="muted">Bientôt</span>}</div>
        ))}
      </section>
      <section className="card"><span className="label-mono">Thème</span>
        <div className="chips" role="radiogroup" aria-label="Thème">
          {[['dark', 'Sombre'], ['light', 'Clair']].map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={theme === v} className={'pill' + (theme === v ? ' on' : '')} onClick={() => setTheme(v)}>{l}</button>)}
        </div>
      </section>
      <section className="card"><span className="label-mono">Notifications et données</span>
        <Switch label="Notifications « Le savais-tu ? »" on={notif === '1'} set={(v) => setNotif(v ? '1' : '0')} />
        <Switch label="Économie de données" on={saver === '1'} set={(v) => setSaver(v ? '1' : '0')} />
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
          <span style={{ fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: 44, lineHeight: 1 }}>4,50 USD</span>
          <span className="muted" style={{ color: '#b9c8c2', fontSize: 16 }}>ou 10 500 FC</span>
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
        {(['USD', 'CDF'] as const).map((c) => <button key={c} type="button" role="radio" aria-checked={cur === c} className={'pill' + (cur === c ? ' on' : '')} onClick={() => setCur(c)}>{c === 'USD' ? '4,50 USD' : '10 500 FC'}</button>)}
      </div>
      <div className="field"><label htmlFor="mm">Numéro Mobile Money</label><div className="phone"><span>+243</span><input id="mm" type="tel" inputMode="numeric" placeholder="8X XXX XX XX" value={phone} onChange={(e) => setPhone(e.target.value)} /></div></div>
      <ErrorBox message={error} />
      {info && <div className="notice">{info}</div>}
      <button type="button" className="btn amber" onClick={go} disabled={busy}>{busy ? 'Un instant…' : `Payer maintenant · ${cur === 'USD' ? PRICES.USD + ' USD' : PRICES.CDF + ' FC'}`}</button>
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
