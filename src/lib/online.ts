import { useEffect, useState } from 'react'

/** Vrai quand le téléphone a du réseau. Se met à jour tout seul quand le réseau part ou revient. */
export function useOnline(): boolean {
  const [on, setOn] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const up = () => setOn(true)
    const down = () => setOn(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return on
}

export const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine)

export const OFFLINE_MSG = 'Pas de connexion : cette action a besoin du réseau. Garde ta note en brouillon et reviens quand le réseau est de retour.'
