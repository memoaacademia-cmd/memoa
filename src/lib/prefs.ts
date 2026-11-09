import { useEffect, useState } from 'react'

// Préférences purement locales à l'appareil (thème, économie de données, notifications).
const PREFIX = 'memoa-pref-'

export function getPref(key: string, fallback: string): string {
  try {
    return localStorage.getItem(PREFIX + key) ?? fallback
  } catch {
    return fallback
  }
}

export function setPref(key: string, value: string) {
  try {
    localStorage.setItem(PREFIX + key, value)
  } catch {
    /* stockage indisponible : la préférence vaut pour la session seulement */
  }
  window.dispatchEvent(new Event('memoa-pref'))
}

export function usePref(key: string, fallback: string): [string, (v: string) => void] {
  const [v, setV] = useState(() => getPref(key, fallback))
  useEffect(() => {
    const on = () => setV(getPref(key, fallback))
    window.addEventListener('memoa-pref', on)
    return () => window.removeEventListener('memoa-pref', on)
  }, [key, fallback])
  return [v, (x) => setPref(key, x)]
}
