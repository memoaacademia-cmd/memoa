// Solde de points partagé : l'Accueil et l'Assistant montrent le même nombre, mis à jour après chaque demande à l'IA.
import { useEffect, useState } from 'react'
import { fetchPoints, type PointsInfo } from './api'

export const POINTS_EVENT = 'memoa-points'

/** Solde actuel. null = essai gratuit ou Premium (rien à afficher), ou pas encore connu. */
export function usePoints(): PointsInfo | null {
  const [p, setP] = useState<PointsInfo | null>(null)
  useEffect(() => {
    let alive = true
    const load = () => { void fetchPoints().then((v) => { if (alive) setP(v) }).catch(() => { /* hors connexion : pas de solde */ }) }
    load()
    const on = (e: Event) => setP((e as CustomEvent<PointsInfo | null>).detail ?? null)
    window.addEventListener(POINTS_EVENT, on)
    window.addEventListener('online', load)
    return () => {
      alive = false
      window.removeEventListener(POINTS_EVENT, on)
      window.removeEventListener('online', load)
    }
  }, [])
  return p
}
