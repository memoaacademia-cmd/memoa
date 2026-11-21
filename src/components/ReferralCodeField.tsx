import { useEffect, useState } from 'react'
import { PillButton, PillInput, ErrorBox } from './ui'
import { attachMessage, attachReferral, getReferralStatus, PARTNER_PROGRAM_ENABLED } from '../lib/partner'
import { clearStoredRef, getStoredRef, normalizeCode, readClipboardCode, type RefSource } from '../lib/referral'

/** Champ de code + bouton « Coller mon code » (visible seulement tant que le champ est vide).
 *  Le presse-papiers n'est lu que sur un appui de l'étudiant, et le champ n'est rempli que si le contenu ressemble à un code (PRENOM-XXXX). */
export function CodeInput({ value, onChange, onSource, id = 'ref-code', disabled }: {
  value: string
  onChange: (v: string) => void
  /** D'où vient le code : 'clipboard' quand il a été collé par le bouton, 'manual' quand il est tapé. */
  onSource?: (s: RefSource) => void
  id?: string
  disabled?: boolean
}) {
  const [msg, setMsg] = useState('')

  async function paste() {
    setMsg('')
    const r = await readClipboardCode()
    if (r.code) { onChange(r.code); onSource?.('clipboard'); return }
    setMsg(r.denied ? 'Ton téléphone n’a pas autorisé le collage. Tape ton code à la main.' : 'Aucun code trouvé dans ce que tu as copié. Tape ton code à la main.')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <PillInput
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => { onChange(e.target.value.toUpperCase()); onSource?.('manual'); setMsg('') }}
        placeholder="ex. JOEL-K7X2"
        aria-label="Code partenaire"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={14}
      />
      {!value.trim() && (
        <button type="button" className="link" style={{ alignSelf: 'flex-start', textDecoration: 'none', padding: '6px 2px', minHeight: 36 }} onClick={() => void paste()} disabled={disabled}>
          Coller mon code
        </button>
      )}
      {msg && <span className="muted" role="status">{msg}</span>}
    </div>
  )
}

/** Réglages : « Code partenaire », visible seulement tant que l'étudiant n'a pas de parrain, pas de paiement et moins de 7 jours d'ancienneté
 *  (le serveur décide : referral_status). Même fonction serveur que l'inscription (attach_referral), avec la source « manual ». */
export default function ReferralCodeField() {
  const [state, setState] = useState<'loading' | 'show' | 'hide'>('loading')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!PARTNER_PROGRAM_ENABLED) { setState('hide'); return }
    let alive = true
    getReferralStatus()
      .then((s) => {
        if (!alive) return
        setState(s.eligible ? 'show' : 'hide')
        const stored = getStoredRef()
        if (s.eligible && stored) setCode(stored.code)
      })
      .catch(() => { if (alive) setState('hide') }) // erreur réseau : on ne montre rien plutôt qu'un champ qui échouerait
    return () => { alive = false }
  }, [])

  async function submit() {
    const c = normalizeCode(code)
    if (!c) { setError('Ce code n’a pas la bonne forme. Exemple : JOEL-K7X2.'); return }
    setBusy(true)
    setError(null)
    const r = await attachReferral(c, 'manual')
    setBusy(false)
    if (r === 'ok') { clearStoredRef(); setDone(true); setState('hide'); return }
    if (r === 'deja_parraine' || r === 'trop_tard') { clearStoredRef(); setState('hide') }
    setError(attachMessage(r))
  }

  if (done) return <div className="notice" role="status">Code partenaire enregistré. Merci !</div>
  if (state !== 'show') return null
  return (
    <section className="card" aria-label="Code partenaire">
      <strong className="h2">Code partenaire</strong>
      <span className="muted">Quelqu’un t’a parlé de Memoa ? Entre son code. Tu peux le faire pendant tes 7 premiers jours, avant ton premier paiement. Il ne pourra plus être changé.</span>
      <CodeInput value={code} onChange={setCode} id="ref-code-settings" disabled={busy} />
      <ErrorBox message={error} />
      <PillButton size="sm" onClick={() => void submit()} disabled={busy || !code.trim()}>{busy ? 'Un instant…' : 'Valider le code'}</PillButton>
    </section>
  )
}
