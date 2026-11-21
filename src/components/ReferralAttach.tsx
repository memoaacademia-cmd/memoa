import { useEffect, useRef } from 'react'
import { useAuth } from '../lib/auth'
import { attachReferral, PARTNER_PROGRAM_ENABLED } from '../lib/partner'
import { clearStoredRef, getStoredRef, notice } from '../lib/referral'

/** Invisible. Dès qu'un étudiant est connecté (inscription par email, code de confirmation, Google ou simple connexion)
 *  et qu'un code parrain est gardé sur le téléphone, il est envoyé au serveur UNE fois, puis effacé.
 *  Ça ne retarde et ne bloque jamais l'inscription : tout se passe en arrière-plan, et un code refusé donne seulement un petit message. */
export default function ReferralAttach() {
  const { user } = useAuth()
  const uid = user?.id
  const running = useRef(false)

  useEffect(() => {
    if (!PARTNER_PROGRAM_ENABLED || !uid) return
    let alive = true
    async function go() {
      const stored = getStoredRef()
      if (!stored || running.current) return
      running.current = true
      const r = await attachReferral(stored.code, stored.source)
      running.current = false
      // Réseau coupé ou trop d'essais : on GARDE le code, on réessaiera (retour du réseau, prochaine ouverture).
      if (r === 'erreur_reseau' || r === 'trop_de_tentatives' || r === 'non_connecte') return
      clearStoredRef()
      if (!alive) return
      if (r === 'ok') notice('Code partenaire enregistré. Merci !')
      else if (r === 'code_invalide') notice('Code non reconnu, tu pourras le saisir plus tard dans les Réglages.')
      else if (r === 'auto_parrainage') notice('Tu ne peux pas utiliser ton propre code partenaire.')
      // deja_parraine / trop_tard : silencieux (cas normal d'un ancien compte qui se reconnecte avec un vieux code).
    }
    void go()
    const onOnline = () => void go()
    window.addEventListener('online', onOnline)
    return () => { alive = false; window.removeEventListener('online', onOnline) }
  }, [uid])

  return null
}
