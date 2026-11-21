import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brand, ErrorBox, useAction } from '../components/ui'
import { CodeInput } from '../components/ReferralCodeField'
import { savePhone } from '../lib/api'
import { useAuth } from '../lib/auth'
import { PARTNER_PROGRAM_ENABLED } from '../lib/features'
import { cleanPhone, needsPhoneStep, PHONE_ERROR } from '../lib/phone'
import { clearStoredRef, getStoredRef, normalizeCode, setStoredRef, type RefSource } from '../lib/referral'

/* Page vue après « Continuer avec Google » : numéro de téléphone (obligatoire) + code partenaire (facultatif), puis « Présente-toi ».
   Le code vient du lien d'invitation (gardé sur le téléphone), du bouton « Coller mon code » (iPhone) ou du collage automatique (Android). */
export default function PhoneStep() {
  const nav = useNavigate()
  const { user, profile, refresh } = useAuth()
  const { busy, error, setError, run } = useAction()
  const [phone, setPhone] = useState(() => user?.phone ?? '')
  const [refCode, setRefCode] = useState(() => (PARTNER_PROGRAM_ENABLED ? getStoredRef()?.code ?? '' : ''))
  const [refSource, setRefSource] = useState<RefSource>(() => getStoredRef()?.source ?? 'manual')

  // Numéro déjà connu (ou page rouverte par erreur) : on continue.
  useEffect(() => {
    if (user && !needsPhoneStep(user, profile)) nav(profile?.university ? '/' : '/inscription', { replace: true })
  }, [user, profile, nav])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    const clean = cleanPhone(phone)
    if (!clean) return setError(PHONE_ERROR)
    if (PARTNER_PROGRAM_ENABLED) {
      if (!refCode.trim()) clearStoredRef() // champ laissé vide exprès : aucun code
      else {
        const c = normalizeCode(refCode)
        if (!c) return setError('Ce code n’a pas la bonne forme (exemple : JOEL-K7X2). Efface-le pour continuer sans code.')
        setStoredRef(c, refSource) // envoyé au serveur par ReferralAttach dès que le numéro est enregistré
      }
    }
    const ok = await run(async () => {
      await savePhone(user.id, clean)
      await refresh()
      return true
    })
    if (ok) nav('/inscription', { replace: true })
  }

  return (
    <main className="page auth">
      <div style={{ margin: '40px 0 4px' }}>
        <Brand size={44} />
      </div>
      <h1 className="h1 big" style={{ margin: 0, textAlign: 'center' }}>Un dernier détail</h1>
      <p className="lead" style={{ margin: 0, textAlign: 'center' }}>Ton numéro de téléphone, pour sécuriser ton compte.</p>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
        <div className="field">
          <label htmlFor="tel">Numéro de téléphone</label>
          <input id="tel" className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="ex. 0812345678" value={phone} onChange={(e) => { setPhone(e.target.value); setError(null) }} />
        </div>
        {PARTNER_PROGRAM_ENABLED && (
          <div className="field">
            <label htmlFor="ref-code">Code partenaire (facultatif)</label>
            <CodeInput value={refCode} onChange={(v) => { setRefCode(v); setError(null) }} onSource={setRefSource} autoRead />
          </div>
        )}
        <ErrorBox message={error} />
        <button className="btn primary-light" type="submit" disabled={busy || !cleanPhone(phone)}>{busy ? 'Enregistrement…' : 'Continuer'}</button>
      </form>
    </main>
  )
}
