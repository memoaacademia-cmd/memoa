import { useEffect, useRef, useState } from 'react'
import { BottomSheet, ErrorBox, Icon, PillButton, PillInput, RowGroup, Spinner, useAction, useLoad } from './ui'
import { friendlyError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { officialName } from '../lib/names'
import { OPERATORS, PARTNER_PROGRAM_ENABLED, daysUntil, getPartnerDashboard, requestPartner, requestPayout, usd, type Operator, type PartnerDashboard, type PartnerType, type PayoutRow } from '../lib/partner'
import { copyText, partnerLink } from '../lib/referral'
import { track } from '../lib/track'

type Active = Extract<PartnerDashboard, { status: 'active' }>

/** Pièce d'or (icône du bloc « Mes gains »). */
function Coin({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ flex: 'none' }}>
      <circle cx="16" cy="16" r="14" fill="#f2b84a" stroke="#b9801a" strokeWidth="2" />
      <circle cx="16" cy="16" r="10" fill="none" stroke="#fbe29a" strokeWidth="1.5" />
      <text x="16" y="21.5" textAnchor="middle" fontSize="15" fontWeight="800" fill="#6b4600" fontFamily="Sora, system-ui, sans-serif">$</text>
    </svg>
  )
}

/** Nombre qui « roule » doucement vers sa nouvelle valeur quand elle change (pas à la première apparition, pas si l'animation est réduite). */
function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(value)
  const [bump, setBump] = useState(false)
  const from = useRef(value)
  useEffect(() => {
    if (value === from.current) return
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) { from.current = value; setShown(value); return }
    const start = from.current
    const t0 = performance.now()
    const DUR = 700
    let raf = 0
    setBump(true)
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / DUR)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(start + (value - start) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
      else { from.current = value; setShown(value); window.setTimeout(() => setBump(false), 200) }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <span className={bump ? 'partner-bump' : undefined}>{format(shown)}</span>
}

const TYPE_LABEL: Record<PartnerType, string> = { cp: 'CP (chef de promotion)', influenceur: 'Influenceur' }

/** Numéro saisi → format propre (+243…). Renvoie '' si ça ne ressemble pas à un numéro. */
function cleanPhone(raw: string): string {
  let p = raw.replace(/[\s.\-()]/g, '')
  if (/^0\d{9}$/.test(p)) p = '+243' + p.slice(1)
  else if (/^243\d{9}$/.test(p)) p = '+' + p
  else if (/^00243\d{9}$/.test(p)) p = '+' + p.slice(2)
  return /^\+?[0-9]{9,15}$/.test(p) ? p : ''
}

/** Carte « Programme partenaire » de l'onglet Moi. 3 états : pas partenaire, demande en attente, partenaire actif. */
export default function PartnerSection() {
  return PARTNER_PROGRAM_ENABLED ? <PartnerSectionInner /> : null
}

function PartnerSectionInner() {
  const { user } = useAuth()
  const dash = useLoad<PartnerDashboard>(getPartnerDashboard, [user?.id])

  // Mise à jour au retour sur l'application (pas de temps réel complexe).
  useEffect(() => {
    const on = () => { if (document.visibilityState === 'visible') dash.reload() }
    document.addEventListener('visibilitychange', on)
    window.addEventListener('focus', on)
    return () => { document.removeEventListener('visibilitychange', on); window.removeEventListener('focus', on) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const d = dash.data

  if (!d) {
    if (dash.loading) return <section className="partner-card" aria-label="Programme partenaire"><Spinner /></section>
    return (
      <section className="partner-card" aria-label="Programme partenaire">
        <strong className="partner-title">Programme partenaire</strong>
        <span className="muted">{dash.error ?? 'Impossible de charger pour le moment.'}</span>
        <PillButton size="sm" variant="outline" onClick={dash.reload}>Réessayer</PillButton>
      </section>
    )
  }
  if (d.status === 'active') return <ActivePartner d={d} reload={dash.reload} stale={!!dash.error} />
  return <RequestPartner d={d} onDone={dash.reload} />
}

/* ---------------------------------- États 1 et 2 : pas partenaire / demande en attente ---------------------------------- */

function RequestPartner({ d, onDone }: { d: Exclude<PartnerDashboard, { status: 'active' }>; onDone: () => void }) {
  const { profile } = useAuth()
  const { busy, error, setError, run } = useAction()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<PartnerType>('cp')

  if (d.status === 'pending') {
    return (
      <section className="partner-card" aria-label="Programme partenaire">
        <strong className="partner-title">Programme partenaire</strong>
        <span className="partner-pill">DEMANDE EN COURS</span>
        <span>On examine ta demande, tu seras prévenu.</span>
      </section>
    )
  }
  if (d.status === 'suspended') {
    return (
      <section className="partner-card" aria-label="Programme partenaire">
        <strong className="partner-title">Programme partenaire</strong>
        <span className="muted">Ton compte partenaire est suspendu. Écris-nous depuis « Un retour ? » pour en savoir plus.</span>
      </section>
    )
  }

  async function send() {
    const n = name.trim().replace(/\s+/g, ' ')
    if (n.length < 2) return setError('Écris ton nom complet.')
    const r = await run(() => requestPartner(type, n))
    if (r === undefined) return
    if (r === 'pending' || r === 'deja_actif') { track('partner_requested', { type }); setOpen(false); onDone(); return }
    setError(r === 'suspendu' ? 'Ton compte partenaire est suspendu.' : 'Vérifie ton nom et ton choix, puis réessaie.')
  }

  return (
    <section className="partner-card" aria-label="Programme partenaire">
      <strong className="partner-title">Programme partenaire</strong>
      {d.status === 'rejected' && <span className="muted">Ta précédente demande n’a pas été retenue. Tu peux en refaire une.</span>}
      <span>Gagne <b>1 $</b> pour chaque étudiant que tu amènes et qui s’abonne.</span>
      {!open ? (
        <PillButton size="sm" onClick={() => { setName((n) => n || officialName(profile) || profile?.full_name || ''); setOpen(true) }}>Devenir partenaire</PillButton>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <PillInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom complet" aria-label="Nom complet" autoComplete="name" maxLength={100} disabled={busy} />
          <div role="radiogroup" aria-label="Type de partenaire" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['cp', 'influenceur'] as PartnerType[]).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={type === t} className={'pill' + (type === t ? ' on' : '')} onClick={() => setType(t)} disabled={busy}>{TYPE_LABEL[t]}</button>
            ))}
          </div>
          <ErrorBox message={error} />
          <div style={{ display: 'flex', gap: 10 }}>
            <PillButton variant="outline" size="sm" onClick={() => { setOpen(false); setError(null) }} disabled={busy}>Annuler</PillButton>
            <PillButton size="sm" onClick={() => void send()} disabled={busy}>{busy ? 'Envoi…' : 'Envoyer'}</PillButton>
          </div>
        </div>
      )}
    </section>
  )
}

/* ---------------------------------- État 3 : partenaire actif ---------------------------------- */

const PAYOUT_STATUS: Record<PayoutRow['status'], [string, string]> = { requested: ['Demandé', 'badge amber'], paid: ['Payé', 'badge'], rejected: ['Refusé', 'badge red'] }

function ActivePartner({ d, reload, stale }: { d: Active; reload: () => void; stale: boolean }) {
  const link = partnerLink(d.code)
  const [copied, setCopied] = useState<'link' | 'code' | ''>('')
  const [sheet, setSheet] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  const missing = Math.max(0, d.min_payout_usd - d.withdrawable_usd)
  const canClaim = d.withdrawable_usd >= d.min_payout_usd && !d.has_open_payout

  async function copy(what: 'link' | 'code') {
    const ok = await copyText(what === 'link' ? link : d.code)
    setCopied(ok ? what : '')
    if (ok) window.setTimeout(() => setCopied(''), 2200)
  }
  async function share() {
    const data = { title: 'Memoa', text: 'Installe Memoa, l’appli pour réviser plus intelligemment. Mon code : ' + d.code, url: link }
    try {
      if (typeof navigator.share === 'function') await navigator.share(data)
      else await copy('link')
    } catch (e) {
      if ((e as Error).name !== 'AbortError') await copy('link')
    }
  }

  return (
    <section className="partner-card" aria-label="Programme partenaire">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <strong className="partner-title">Programme partenaire</strong>
        <span className="partner-pill">{d.type === 'cp' ? 'CP' : 'INFLUENCEUR'}</span>
      </div>
      {stale && <span className="muted" role="status">Connexion instable : les chiffres affichés peuvent ne pas être à jour.</span>}

      {/* (a) Code et lien */}
      <div className="partner-box">
        <span className="muted">Ton code partenaire</span>
        <strong className="partner-code">{d.code}</strong>
        <span className="muted" style={{ wordBreak: 'break-all' }}>{link}</span>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <PillButton size="sm" variant="outline" onClick={() => void copy('link')}><Icon name="copy" size={18} />{copied === 'link' ? 'Lien copié' : 'Copier le lien'}</PillButton>
          <PillButton size="sm" onClick={() => void share()}><Icon name="upload" size={18} />Partager</PillButton>
        </div>
      </div>

      {/* (b) Compteurs */}
      <div className="me-stats" role="group" aria-label="Mes filleuls">
        <div><b><CountUp value={d.signups} format={(n) => String(Math.round(n))} /></b><span>Inscrits via ton lien</span></div>
        <i aria-hidden="true" />
        <div><b><CountUp value={d.payers} format={(n) => String(Math.round(n))} /></b><span>Abonnés payants</span></div>
      </div>

      {/* (c) Mes gains */}
      <div className="partner-gains" aria-label="Mes gains">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Coin size={34} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="muted">Total gagné</span>
            <strong className="partner-amount"><CountUp value={d.total_usd} format={usd} /></strong>
          </div>
        </div>
        <div className="partner-lines">
          <div><span>Solde retirable</span><b><CountUp value={d.withdrawable_usd} format={usd} /></b></div>
          {d.pending_usd > 0 && <div><span>En attente (disponibles dans {daysUntil(d.next_available_at)} {daysUntil(d.next_available_at) > 1 ? 'jours' : 'jour'})</span><b><CountUp value={d.pending_usd} format={usd} /></b></div>}
          {d.requested_usd > 0 && <div><span>Retrait demandé</span><b>{usd(d.requested_usd)}</b></div>}
          {d.paid_usd > 0 && <div><span>Déjà payé</span><b>{usd(d.paid_usd)}</b></div>}
        </div>
      </div>

      {/* (d) Réclamer */}
      {d.has_open_payout ? (
        <div className="notice" role="status">Ton retrait est en cours de traitement. Tu seras payé par Mobile Money.</div>
      ) : (
        <>
          <PillButton disabled={!canClaim} onClick={() => { setInfo(null); setSheet(true) }}>Réclamer mes gains</PillButton>
          {!canClaim && <span className="muted" style={{ textAlign: 'center' }}>Encore {usd(missing)} pour retirer.</span>}
        </>
      )}
      {info && <div className="notice" role="status">{info}</div>}

      {/* (e) Historique */}
      <RowGroup label="Mes retraits">
        {d.payouts.length === 0 ? <div className="rg-empty">Aucun retrait pour l’instant.</div> : d.payouts.map((p) => {
          const [lab, cls] = PAYOUT_STATUS[p.status]
          return (
            <div key={p.id} className="rg-row" style={{ cursor: 'default' }}>
              <span className="rg-body">
                <span className="rg-title">{usd(p.amount_usd)} · {OPERATORS.find((o) => o.id === p.operator)?.name ?? p.operator}</span>
                <span className="rg-sub">{new Date(p.requested_at).toLocaleDateString('fr-FR')}{p.status === 'paid' && p.reference ? ` · réf. ${p.reference}` : ''}{p.status === 'rejected' && p.reject_reason ? ` · ${p.reject_reason}` : ''}</span>
              </span>
              <span className={cls}>{lab}</span>
            </div>
          )
        })}
      </RowGroup>

      {/* (f) Règles */}
      <span className="muted">Les gains sont disponibles {d.hold_days} jours après le paiement de ton filleul. Retrait dès {usd(d.min_payout_usd).replace(',00', '')}. Paiement par Mobile Money, frais à notre charge.</span>

      <PayoutSheet d={d} open={sheet} onClose={() => setSheet(false)} onDone={(msg) => { setSheet(false); setInfo(msg); reload() }} />
    </section>
  )
}

/* ---------------------------------- Feuille « Réclamer mes gains » ---------------------------------- */

function PayoutSheet({ d, open, onClose, onDone }: { d: Active; open: boolean; onClose: () => void; onDone: (msg: string) => void }) {
  const { busy, error, setError, run } = useAction()
  const [phone, setPhone] = useState(d.payout_phone ?? '')
  const [op, setOp] = useState<Operator | ''>(d.payout_operator ?? '')
  const [step, setStep] = useState<1 | 2>(1)

  // À chaque ouverture : on repart de l'étape 1, avec les coordonnées déjà connues.
  useEffect(() => {
    if (!open) return
    setPhone(d.payout_phone ?? '')
    setOp(d.payout_operator ?? '')
    setStep(1)
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const clean = cleanPhone(phone)
  const opName = OPERATORS.find((o) => o.id === op)?.name ?? ''

  function next() {
    if (!clean) return setError('Entre un numéro Mobile Money valide (ex. 0812345678).')
    if (!op) return setError('Choisis ton opérateur.')
    setError(null)
    setStep(2)
  }

  async function confirm() {
    if (!clean || !op) return
    const r = await run(() => requestPayout(clean, op), (e) => friendlyError(e))
    if (!r) return
    switch (r.result) {
      case 'ok': track('partner_payout_requested'); return onDone(`Demande envoyée : ${usd(r.amount_usd ?? d.withdrawable_usd)}. Tu seras payé par Mobile Money, frais à notre charge.`)
      case 'deja_demande': return onDone('Tu as déjà une demande en cours.')
      case 'sous_seuil': setStep(1); return setError(`Il faut au moins ${usd(r.min_payout_usd ?? d.min_payout_usd)} de solde retirable.`)
      case 'numero_invalide': setStep(1); return setError('Ce numéro n’est pas valide.')
      case 'operateur_invalide': setStep(1); return setError('Choisis ton opérateur.')
      default: setStep(1); return setError('La demande n’a pas pu être faite. Réessaie dans un instant.')
    }
  }

  return (
    <BottomSheet open={open} onClose={() => { if (!busy) onClose() }} title="Réclamer mes gains">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 4px 8px' }}>
        {step === 1 ? (
          <>
            <p className="lead" style={{ margin: 0 }}>Tu retires <b>{usd(d.withdrawable_usd)}</b>. Où doit-on t’envoyer l’argent ?</p>
            <PillInput value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="Numéro Mobile Money" aria-label="Numéro Mobile Money" disabled={busy} />
            <div role="radiogroup" aria-label="Opérateur" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {OPERATORS.map((o) => (
                <button key={o.id} type="button" role="radio" aria-checked={op === o.id} className={'pill' + (op === o.id ? ' on' : '')} onClick={() => setOp(o.id)}>{o.name}</button>
              ))}
            </div>
            <ErrorBox message={error} />
            <PillButton onClick={next}>Continuer</PillButton>
          </>
        ) : (
          <>
            <p className="lead" style={{ margin: 0 }}>Vérifie avant d’envoyer :</p>
            <div className="partner-box">
              <strong className="partner-amount">{usd(d.withdrawable_usd)}</strong>
              <span>{opName} · {clean}</span>
              <span className="muted">Tu reçois le montant complet : les frais Mobile Money sont à notre charge. Si le numéro est faux, l’argent sera perdu.</span>
            </div>
            <ErrorBox message={error} />
            <div style={{ display: 'flex', gap: 10 }}>
              <PillButton variant="outline" onClick={() => setStep(1)} disabled={busy}>Modifier</PillButton>
              <PillButton onClick={() => void confirm()} disabled={busy}>{busy ? 'Envoi…' : 'Confirmer'}</PillButton>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
