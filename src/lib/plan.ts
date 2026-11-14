// État du compte pour l'AFFICHAGE des offres (lecture seule). Rien n'est écrit, rien n'est consommé, aucun backend n'est modifié.
//
// Le serveur ne dit pas « essai » tout court : il répond au solde de points (fetchPoints) par
//   - un solde  → offre Free (essai terminé, points gratuits du jour) ;
//   - null      → essai en cours OU Premium actif.
// On les distingue avec l'abonnement (getSubscription / isActive) :
//   abonnement actif → premium ; solde reçu → free (ou expired si un ancien abonnement est terminé) ;
//   pas d'abonnement actif ET réponse « null » du serveur → essai en cours.
// Si une des deux réponses manque (hors connexion, erreur), l'état est « unknown » : on n'invente rien.
import { useEffect, useState } from 'react'
import { fetchPoints, getSubscription, type PointsInfo } from './api'
import { useAuth } from './auth'
import { isConfigured } from './supabase'
import { isActive } from './subscription'

export type PlanState = 'unknown' | 'free' | 'trial' | 'premium' | 'expired'

export interface Plan {
  state: PlanState
  /** Fin de l'abonnement (premium : date de fin ; expired : date à laquelle il s'est terminé). */
  expiresAt?: string
  /** Solde de points du jour (offre Free et abonnement expiré seulement). */
  points: PointsInfo | null
}

/* ---------------------------------------------------------------------------------------------
   Règles affichées. Elles REPRENNENT celles du serveur (supabase/functions/ai-gateway/index.ts et
   payments-webhook/index.ts) : TRIAL_DAYS, AI_FREE_POINTS, COURSE_POINTS, NOTE_POINTS, TP_POINTS, POINTS,
   PAGE_CHARS, CHAT_PAID, DAYS_PER_PAYMENT. Si le serveur change, mettre à jour ce bloc.
   Les tarifs viennent de PRICE_LABEL (api.ts).
--------------------------------------------------------------------------------------------- */
export const TRIAL_DAYS = 5
export const FREE_POINTS_PER_DAY = 20
export const PREMIUM_DAYS = 30
/** Prix « de base » affiché barré : l'affichage seulement. Le montant réellement payé reste fixé par le serveur (PRICE_LABEL = prix promotionnel). */
export const BASE_PRICE_LABEL = { USD: '9,99 USD', CDF: '22 000 FC' } as const
export const POINT_COSTS: { label: string; cost: string }[] = [
  { label: 'Poser des questions à l’assistant', cost: '1 point pour 2 messages' },
  { label: 'Un quiz de révision', cost: '1 point' },
  { label: 'Transcrire un audio dans une note', cost: '3 points' },
  { label: 'Créer un cours avec l’IA', cost: '15 points, 18 depuis un audio' },
  { label: 'Créer ou ajouter une note', cost: '15 points fixes, 18 depuis un audio' },
  { label: 'Résumer des notes', cost: '4 à 20 points selon la longueur' },
  { label: 'Un TP complet (plan, ajustements, rédaction)', cost: '10 points en tout' }
]

let inflight: { uid: string; at: number; p: Promise<Plan> } | null = null

export function compute(uid: string): Promise<Plan> {
  // Une seule lecture partagée si l'Accueil, le profil et la page Premium demandent en même temps.
  if (inflight && inflight.uid === uid && Date.now() - inflight.at < 4000) return inflight.p
  const p = (async (): Promise<Plan> => {
    const [sub, pts] = await Promise.allSettled([getSubscription(uid), fetchPoints()])
    if (sub.status === 'rejected') return { state: 'unknown', points: null }
    const s = sub.value
    if (s && isActive(s.expires_at)) return { state: 'premium', expiresAt: s.expires_at, points: null }
    const points = pts.status === 'fulfilled' ? pts.value : null
    if (pts.status === 'rejected') return { state: 'unknown', points: null, expiresAt: s?.expires_at }
    if (points) return { state: s ? 'expired' : 'free', expiresAt: s?.expires_at, points }
    // Mode démo (aucun serveur) : pas d'essai ni de points à décrire.
    if (!isConfigured) return { state: s ? 'expired' : 'free', expiresAt: s?.expires_at, points: null }
    return { state: 'trial', expiresAt: s?.expires_at, points: null }
  })()
  inflight = { uid, at: Date.now(), p }
  return p
}

export function usePlan(): Plan {
  const { user } = useAuth()
  const uid = user?.id
  const [plan, setPlan] = useState<Plan>({ state: 'unknown', points: null })
  useEffect(() => {
    if (!uid) return
    let alive = true
    compute(uid).then((v) => { if (alive) setPlan(v) }).catch(() => { /* hors connexion : état inconnu */ })
    return () => { alive = false }
  }, [uid])
  return plan
}
