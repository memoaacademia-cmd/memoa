import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BottomSheet, ErrorBox, Icon, MemoAvatar, PageHead, PillButton, PillInput, Row, RowGroup, Spinner, useAction, useLoad } from '../components/ui'
import { DELETE_WORD, deleteMyAccount, downloadMyData } from '../lib/account'
import { friendlyError, getLibraryAuthors, getSubscription, listActivity, listCourses, listPayments, PRICE_LABEL, saveProfile, signOut, startPayment, checkPayment, uploadAvatar } from '../lib/api'
import { useAuth } from '../lib/auth'
import { initialsOf, officialName } from '../lib/names'
import { NOTIFICATIONS_ENABLED, PARTNER_PROGRAM_ENABLED, PAYMENT_ENABLED, VAPID_PUBLIC_KEY } from '../lib/features'
import { disablePush, enablePush, isSubscribed, syncPush } from '../lib/push'
import { getPref, usePref } from '../lib/prefs'
import { useAvatar } from '../lib/avatar'
import { dateFr, daysLeft, isActive } from '../lib/subscription'
import FreePts from '../components/FreePts'
import ReferralCodeField from '../components/ReferralCodeField'
import { TRIAL_DAYS, usePlan } from '../lib/plan'
import { FreeVsPremium, PointsGuide, SubscriptionTerms, TrialInfo } from '../components/PlanInfo'
import { currentStreak } from '../lib/streak'
import { plaqueFor } from '../lib/plaque'
import type { LibAuthor } from '../lib/types'
import { track } from '../lib/track'


/* Carte Premium du profil : une seule carte, dont le contenu suit l'état réel du compte. */
function PremiumCard({ plan }: { plan: ReturnType<typeof usePlan> }) {
  const { state, expiresAt, points } = plan
  // « Carte Premium vue » : une fois que l'état du compte est connu.
  useEffect(() => { if (state !== 'unknown') track('premium_view', { where: 'moi', state }) }, [state])
  const active = state === 'premium' && !!expiresAt
  const left = expiresAt ? daysLeft(expiresAt) : 0
  const pill = { unknown: 'PREMIUM', free: 'OFFRE FREE', trial: 'ESSAI GRATUIT', premium: 'PREMIUM ACTIF', expired: 'PREMIUM TERMINÉ' }[state]
  const cta = { unknown: 'Passer à Premium', free: 'Passer à Premium', trial: 'Voir les offres', premium: 'Mon abonnement', expired: 'Renouveler Premium' }[state]
  return (
    <section data-tour="me-premium" className={'me-premium ' + (active ? 'active' : state === 'unknown' ? '' : state)} aria-label="Premium">
      <span className="me-premium-pill">{pill}</span>
      {active && expiresAt ? (
        <>
          <strong>Valable jusqu’au {dateFr(expiresAt)}</strong>
          <span className="sub">{left <= 1 ? 'Il reste moins d’un jour' : `Il reste ${left} jours`}. Utilisation généreuse de l’IA, sans compte à rebours de points.</span>
        </>
      ) : state === 'trial' ? (
        <>
          <strong>Ton essai de {TRIAL_DAYS} jours est en cours</strong>
          <span className="sub">Toute l’IA de Memoa est offerte pendant l’essai, sans carte bancaire. Ensuite : <FreePts /> points gratuits par jour, ou Premium si tu veux aller plus loin.</span>
        </>
      ) : state === 'free' ? (
        <>
          <strong>Tu es en offre Free</strong>
          <span className="sub"><FreePts /> points d’IA gratuits chaque jour, renouvelés à minuit. Premium enlève cette limite.</span>
        </>
      ) : state === 'expired' && expiresAt ? (
        <>
          <strong>Ton abonnement s’est terminé le {dateFr(expiresAt)}</strong>
          <span className="sub">Tu es repassé en offre Free (<FreePts /> points par jour). Recharge pour retrouver Premium.</span>
        </>
      ) : (
        <>
          <strong>Étudie sans te poser de limites</strong>
          <span className="sub">Notes IA, TP, audio et résumés avec une utilisation généreuse. Paiement par Orange Money, Airtel Money ou M-Pesa.</span>
        </>
      )}
      {points && (state === 'free' || state === 'expired') && (
        <span className="me-pts" role="status"><span className="gold-bolt"><Icon name="bolt" size={16} /></span><b>{points.left}</b> / {points.max} points aujourd’hui</span>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        {active ? <span className="sub">Prolonge quand tu veux : les jours s’ajoutent.</span> : (
          <div><span className="price">{PRICE_LABEL.USD}</span><br /><span className="sub">pour 30 jours · ou {PRICE_LABEL.CDF}</span></div>
        )}
        <Link to="/premium" className={'pill-btn sm ' + (active ? 'me-prem-link' : 'gold-btn')}>{cta}</Link>
      </div>
    </section>
  )
}

export function Me() {
  const { user, profile, refresh } = useAuth()
  const { error, run } = useAction()
  const act = useLoad(() => listActivity(user?.id ?? ''), [user?.id])
  const file = useRef<HTMLInputElement>(null)
  const streak = currentStreak(act.data ?? [])
  const initials = initialsOf(profile)
  const avatarSrc = useAvatar(profile?.avatar_url)
  // Ma plaque (si la mise à jour de la base n'est pas faite, rien ne s'affiche : la page marche quand même).
  const me = useLoad<Record<string, LibAuthor>>(() => (user ? getLibraryAuthors([user.id]).catch(() => ({} as Record<string, LibAuthor>)) : Promise.resolve({} as Record<string, LibAuthor>)), [user?.id])
  const myPlaque = plaqueFor(me.data?.[user?.id ?? '']?.best_likes ?? 0)

  async function pick(f: File | undefined) {
    if (!f || !user) return
    await run(async () => {
      const url = await uploadAvatar(user.id, f)
      await saveProfile(user.id, { avatar_url: url })
      await refresh()
    })
  }

  const courses = useLoad(() => listCourses(user?.id ?? ''), [user?.id])
  const plan = usePlan()
  const nCourses = courses.data?.length ?? 0
  const nNotes = (courses.data ?? []).reduce((n, c) => n + c.notes_count, 0)
  const uni = profile?.university?.match(/\(([^)]+)\)/)?.[1] ?? profile?.university
  const where = [uni, profile?.faculty, profile?.promotion].filter(Boolean).join(' · ')
  return (
    <main className="page" style={{ gap: 18 }}>
      <section style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button type="button" className="hm-memo-av" style={{ width: 72, height: 72, padding: 0 }} onClick={() => file.current?.click()} aria-label="Changer ma photo (facultatif)">
          {avatarSrc ? <img src={avatarSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span className="h2">{initials}</span>}
        </button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <h1 className="h1" style={{ margin: 0, fontSize: 24 }}>{officialName(profile) || profile?.first_name}</h1>
          <span className="muted">{where}</span>
          <span className="muted">Ton Memo : {profile?.memo_name ?? 'Memo'}</span>
          {myPlaque && <span className="muted">Plaque {myPlaque.label} dans la Librairie</span>}
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

      <PremiumCard plan={plan} />

      <RowGroup label="Compte">
        <Row tour="me-profile" icon="user" title="Mon profil" right="Modifier" to="/inscription?edit=1" />
        <Row tour="me-memo" iconNode={<MemoAvatar animal={profile?.memo_animal ?? 'hibou'} size={30} />} title="Mon Memo" right="Changer" to="/adoption?change=1" />
        <Row tour="me-settings" icon="gear" title="Réglages" sub="Notifications, thème, déconnexion et plus" to="/parametres" />
        {PARTNER_PROGRAM_ENABLED && <Row icon="star" title="Programme partenaire" sub="Gagne 1 $ par étudiant qui s’abonne" to="/partenaire" />}
      </RowGroup>
      <RowGroup label="Aide">
        <Row tour="me-tours" icon="sparkle" title="Visites guidées" sub="Revoir les explications de chaque page" to="/visites" />
        <Row icon="chat" title="Centre d’aide" to="/aide" />
        <Row icon="text" title="Un retour ?" sub="Signaler un problème ou donner ton avis" to="/signaler" />
      </RowGroup>
      <RowGroup label="À propos">
        <Row icon="pdf" title="Confidentialité" to="/confidentialite" />
        <Row icon="pdf" title="Conditions d’utilisation" to="/conditions" />
        <Row icon="home" title="À propos de Memoa" to="/a-propos" />
      </RowGroup>
    </main>
  )
}

function SwitchRow({ label, on, set, sub }: { label: string; on: boolean; set: (v: boolean) => void; sub?: string }) {
  return (
    <div className="rg-row" style={{ cursor: 'default' }}>
      <span className="rg-body"><span className="rg-title" id={'sw-' + label}>{label}</span>{sub && <span className="rg-sub">{sub}</span>}</span>
      <button type="button" role="switch" aria-checked={on} aria-labelledby={'sw-' + label} className="switch" onClick={() => set(!on)} />
    </div>
  )
}

export function Settings() {
  const nav = useNavigate()
  const { user, profile } = useAuth()
  const [theme, setTheme] = usePref('theme', 'light')
  const [pushOn, setPushOn] = useState(false)
  const [pushMsg, setPushMsg] = useState<string | null>(null)

  useEffect(() => {
    // On répare d'abord un abonnement perdu, puis on affiche l'état réel. Si l'étudiant avait activé les notifications ici
    // et qu'elles ne peuvent plus l'être sans lui, on le dit au lieu de laisser l'interrupteur décoché sans explication.
    let alive = true
    void (async () => {
      if (user) await syncPush(user.id)
      const on = await isSubscribed()
      if (!alive) return
      setPushOn(on)
      if (!on && getPref('notif', '') === '1') setPushMsg('Les notifications ont été coupées sur ce téléphone par ton navigateur (cela arrive après un nettoyage des données ou une longue absence). Touche l’interrupteur pour les réactiver.')
    })()
    return () => { alive = false }
  }, [user])
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
  // Compte : export des données et suppression.
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState<string | null>(null)
  const [delOpen, setDelOpen] = useState(false)
  const [word, setWord] = useState('')
  const [delBusy, setDelBusy] = useState(false)
  const [delErr, setDelErr] = useState<string | null>(null)
  const wordOk = word.trim().toUpperCase() === DELETE_WORD

  async function exportData() {
    if (!user || exporting) return
    setExporting(true)
    setExportMsg(null)
    try {
      await downloadMyData(user.id, user.email)
      setExportMsg('Ton fichier est prêt : cherche-le dans tes téléchargements.')
    } catch (e) {
      setExportMsg(friendlyError(e))
    } finally {
      setExporting(false)
    }
  }

  async function removeAccount() {
    if (!user || !wordOk || delBusy) return
    setDelBusy(true)
    setDelErr(null)
    try {
      await deleteMyAccount(user.id, word)
      nav('/connexion', { replace: true })
    } catch (e) {
      setDelErr(friendlyError(e))
      setDelBusy(false)
    }
  }

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

  const [pick, setPick] = useState<null | 'theme'>(null)

  return (
    <main className="page" style={{ gap: 18 }}>
      <PageHead to="/moi" title="Réglages" />

      <RowGroup label="Apparence">
        <Row icon="sparkle" title="Thème" right={theme === 'dark' ? 'Sombre' : 'Clair'} onClick={() => setPick('theme')} />
      </RowGroup>

      <RowGroup label="Notifications">
        {NOTIFICATIONS_ENABLED && VAPID_PUBLIC_KEY && <SwitchRow label="Notifications" sub="« Le savais-tu ? », brouillons, cartes de révision" on={pushOn} set={(v) => void togglePush(v)} />}
      </RowGroup>
      {pushMsg && <div className="notice" role="alert">{pushMsg}</div>}

      <RowGroup label="Partager">
        <Row icon="upload" title="Partager Memoa" onClick={() => void share()} chevron={false} />
      </RowGroup>
      {shared && <div className="notice">Lien copié. Colle-le dans WhatsApp ou ailleurs.</div>}

      <ReferralCodeField />

      <RowGroup label="Compte">
        <Row title="E-mail" right={user?.email ?? '—'} chevron={false} />
        <Row title="Téléphone" right={profile?.phone ?? user?.phone ?? '—'} chevron={false} />
        <Row icon="crown" title="Abonnement et paiements" to="/premium" />
        <Row icon="download" title="Exporter mes données" sub="Un seul fichier avec ton profil, tes cours, tes notes, tes brouillons et tes favoris" onClick={() => void exportData()} disabled={exporting} chevron={false} right={exporting ? 'Un instant…' : undefined} />
        <button type="button" className="rg-row" onClick={() => { setWord(''); setDelErr(null); setDelOpen(true) }} style={{ color: 'var(--danger)' }}>
          <span className="rg-ico"><Icon name="trash" size={22} /></span>
          <span className="rg-body"><span className="rg-title">Supprimer mon compte</span></span>
        </button>
      </RowGroup>
      {exportMsg && <div className="notice" role="status">{exportMsg}</div>}

      {!confirm ? (
        <PillButton variant="outline" onClick={() => setConfirm(true)}>Se déconnecter</PillButton>
      ) : (
        <div style={{ display: 'flex', gap: 10 }}>
          <PillButton variant="outline" onClick={() => setConfirm(false)}>Annuler</PillButton>
          <PillButton onClick={() => void logout()}>Confirmer</PillButton>
        </div>
      )}

      <BottomSheet open={delOpen} onClose={() => { if (!delBusy) setDelOpen(false) }} title="Supprimer mon compte">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 4px 8px' }}>
          <p className="lead" style={{ margin: 0 }}>Cette action est définitive. Voici ce qui se passe :</p>
          <ul className="plan-checks">
            <li><Icon name="check" size={16} stroke={2.4} /><span>Ton profil, tes cours, tes notes, tes conversations avec l’assistant et ta photo sont effacés.</span></li>
            <li><Icon name="check" size={16} stroke={2.4} /><span>Si tu as Premium, il est perdu : il n’y a pas de remboursement.</span></li>
            <li><Icon name="check" size={16} stroke={2.4} /><span>Les documents que tu as publiés dans la Librairie restent pour les autres étudiants, sans ton nom.</span></li>
            <li><Icon name="check" size={16} stroke={2.4} /><span>Les paiements sont gardés pour la comptabilité, sans aucun lien avec toi.</span></li>
            <li><Icon name="check" size={16} stroke={2.4} /><span>Ton numéro ne pourra pas relancer un nouvel essai gratuit.</span></li>
          </ul>
          <span className="muted">Pour garder une copie de tes données, utilise d’abord « Exporter mes données ».</span>
          <label htmlFor="del-word" style={{ fontWeight: 700 }}>Pour confirmer, écris {DELETE_WORD}</label>
          <PillInput id="del-word" value={word} onChange={(e) => setWord(e.target.value)} autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false} placeholder={DELETE_WORD} disabled={delBusy} />
          <ErrorBox message={delErr} />
          <div style={{ display: 'flex', gap: 10 }}>
            <PillButton variant="outline" onClick={() => setDelOpen(false)} disabled={delBusy}>Annuler</PillButton>
            <PillButton onClick={() => void removeAccount()} disabled={!wordOk || delBusy}>{delBusy ? 'Suppression…' : 'Supprimer pour de bon'}</PillButton>
          </div>
        </div>
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
  { id: 'orange', name: 'Orange Money', dot: '#f2762e', logo: 'pay-orange.png' },
  { id: 'airtel', name: 'Airtel Money', dot: '#e5202e', logo: 'pay-airtel.png' },
  { id: 'mpesa', name: 'M-Pesa', dot: '#3fb950', logo: 'pay-mpesa.png' },
  { id: 'chariow', name: 'Paiement en ligne', dot: '#1f7a6d', logo: '' }
]
const STATUS: Record<string, [string, string]> = { paid: ['Payé', 'badge'], pending: ['En attente', 'badge amber'], failed: ['Échoué', 'badge red'] }
const BENEFITS = [
  "Cours générés à partir d'un audio, d'un PDF ou d'une photo",
  'Notes IA, résumés, quiz et cartes de révision',
  'Assistant TP avec export PDF et page de garde',
  'Assistant IA qui connaît ton cours',
  'Page de garde dorée, sans la mention « Créé avec Memoa »',
  'Utilisation généreuse, avec une limite anti-abus'
]

export function Premium() {
  const { user } = useAuth()
  const pay = useLoad(listPayments, [])
  const sub = useLoad(() => getSubscription(user?.id ?? ''), [user?.id])
  const exp = sub.data?.expires_at
  const active = !!exp && isActive(exp)
  const ended = !!exp && !active
  const left = exp ? daysLeft(exp) : 0
  const plan = usePlan()
  useEffect(() => { if (plan.state !== 'unknown') track('premium_view', { where: 'page', state: plan.state }) }, [plan.state])
  const { busy, error, setError, run } = useAction()
  const [info, setInfo] = useState<string | null>(null)
  const [waiting, setWaiting] = useState(() => /[?&]paiement=retour/.test(window.location.search))
  const hasPending = !!pay.data?.some((p) => p.provider === 'chariow' && p.status === 'pending')

  async function go() {
    setInfo(null)
    const r = await run(() => startPayment())
    if (!r) return
    if (r.url) openPayment(r.url) // page de paiement dans un nouvel onglet
    else { setInfo(r.message ?? null); pay.reload() }
  }

  // On ouvre la page de paiement complète dans un nouvel onglet.
  function openPayment(url: string) {
    const w = window.open(url, '_blank', 'noopener')
    if (!w) { window.location.assign(url); return } // nouvel onglet bloqué par le navigateur : on ouvre dans cet onglet, le retour dans l'app marche pareil
    setInfo("Le paiement s'est ouvert dans un nouvel onglet. Une fois payé, reviens ici : ton Premium s'active tout seul, ou appuie sur « Vérifier mon paiement ».")
    pay.reload()
  }

  // Retour de la page de paiement (?paiement=retour) : « Activation en cours… » → on interroge le serveur jusqu'à l'activation.
  useEffect(() => {
    if (!waiting) return
    try { window.history.replaceState(null, '', window.location.pathname + window.location.hash) } catch { /* sans importance */ }
    let alive = true
    ;(async () => {
      for (let i = 0; i < 40 && alive; i++) { // ~2 minutes
        try {
          const r = await checkPayment()
          if (r.active) { if (alive) { setWaiting(false); setInfo('Paiement reçu : ton Premium est activé. Merci !'); sub.reload(); pay.reload() } return }
        } catch { /* réseau : on réessaie */ }
        await new Promise((res) => setTimeout(res, 3000))
      }
      if (alive) { setWaiting(false); setInfo("Ton paiement n'est pas encore confirmé. S'il est validé, ton Premium s'activera tout seul dans quelques minutes ; sinon, appuie sur « Vérifier mon paiement ».") ; pay.reload() }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting])

  async function verify() {
    setInfo(null)
    const r = await run(() => checkPayment())
    if (!r) return
    if (r.active) { setInfo('Paiement reçu : ton Premium est activé. Merci !'); sub.reload() }
    else setInfo("Pas encore confirmé par le paiement. Si tu viens de payer, patiente une minute puis réessaie.")
    pay.reload()
  }

  return (
    <main className="page" style={{ gap: 18 }}>
      <PageHead to="/moi" title="Memoa Premium" />
      {active && exp && (
        <section className="prem-gold" aria-label="Premium actif">
          <span className="pg-pill">PREMIUM ACTIF</span>
          <strong className="pg-date">Valable jusqu’au {dateFr(exp)}</strong>
          <span className="pg-sub">{left <= 1 ? 'Il reste moins d’un jour' : `Il reste ${left} jours`}</span>
          <span className="pg-sub">Utilisation généreuse de l’IA, sans compte à rebours de points.</span>
        </section>
      )}
      {ended && exp && <div className="notice" role="status">Ton abonnement Premium s’est terminé le {dateFr(exp)}. Recharge pour retrouver Memoa Premium.</div>}
      {!active && (
      <section className="prem-hero">
        <span className="label-mono" style={{ color: '#f2a33a' }}>Abonnement mensuel · un seul plan</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: 44, lineHeight: 1 }}>{PRICE_LABEL.USD}</span>
          <span style={{ color: '#b9c8c2', fontSize: 16 }}>ou {PRICE_LABEL.CDF}</span>
        </div>
        {BENEFITS.map((b) => <div key={b} style={{ display: 'flex', gap: 10 }}><Icon name="check" size={20} color="#3ccfb4" stroke={2.4} /><span style={{ fontSize: 15, lineHeight: 1.4 }}>{b}</span></div>)}
        <button type="button" className="pill-btn sm prem-pay-go" onClick={() => document.getElementById('pay')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Choisir mon paiement</button>
      </section>
      )}

      {!active && <FreeVsPremium />}
      {!active && <PointsGuide />}
      {!active && <TrialInfo state={plan.state} />}
      <SubscriptionTerms />

      <div id="pay" style={{ display: 'flex', flexDirection: 'column', gap: 18, scrollMarginTop: 12 }}>

      {waiting && <div className="notice" role="status">Activation en cours… Ne ferme pas cette page, ton Premium s’active dès que le paiement est confirmé.</div>}
      <ErrorBox message={error} />
      {info && <div className="notice">{info}</div>}
      {PAYMENT_ENABLED && <PillButton size="lg" onClick={() => void go()} disabled={busy || waiting}>{busy ? 'Un instant…' : `${active ? 'Prolonger' : "S'abonner"} · ${PRICE_LABEL.USD}`}</PillButton>}
      {hasPending && !waiting && <button type="button" className="pill-btn sm" onClick={() => void verify()} disabled={busy}>J’ai payé · Vérifier mon paiement</button>}
      <span className="muted" style={{ textAlign: 'center' }}>Tu choisis ton moyen de paiement sur la page sécurisée, puis tu reviens ici automatiquement. Aucune donnée bancaire n'est stockée dans l'app.</span>
      </div>

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
