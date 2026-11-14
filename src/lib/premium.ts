// Lit l'état d'abonnement EXISTANT (lecture seule) pour savoir si l'étudiant est Premium. Ne touche à aucun paiement.
import { useEffect, useState } from 'react'
import { getSubscription } from './api'
import { useAuth } from './auth'
import { isOnline } from './online'
import { isActive } from './subscription'
import { compute as computePlan } from './plan'

const KEY = 'memoa-sub-exp'

function cached(userId: string): boolean {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null') as { u: string; exp: string } | null
    return !!c && c.u === userId && !!c.exp && isActive(c.exp)
  } catch {
    return false
  }
}

/** Vrai si l'abonnement est en cours OU si l'essai gratuit est en cours (l'étudiant en essai goûte à tout Premium : pages de garde dorées,
 *  sans la mention « Créé avec Memoa »). Hors connexion, on s'appuie sur la dernière date d'expiration connue (jamais sur un état inventé) :
 *  l'essai n'est donc reconnu qu'avec une réponse du serveur. Ne change aucun droit serveur : c'est de la présentation de PDF. */
export async function isPremiumNow(userId: string | undefined): Promise<boolean> {
  if (!userId) return false
  if (!isOnline()) return cached(userId)
  try {
    const s = await getSubscription(userId)
    try { localStorage.setItem(KEY, JSON.stringify({ u: userId, exp: s?.expires_at ?? '' })) } catch { /* stockage indisponible */ }
    if (!!s && isActive(s.expires_at)) return true
    return (await computePlan(userId)).state === 'trial'
  } catch {
    return cached(userId)
  }
}

/** Pour l'affichage : false tant que la réponse n'est pas arrivée (au moment du PDF on revérifie avec isPremiumNow). */
export function usePremium(): boolean {
  const { user } = useAuth()
  const uid = user?.id
  const [prem, setPrem] = useState(() => (uid ? cached(uid) : false))
  useEffect(() => {
    let alive = true
    void isPremiumNow(uid).then((v) => alive && setPrem(v))
    return () => { alive = false }
  }, [uid])
  return prem
}
