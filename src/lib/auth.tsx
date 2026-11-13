import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getCurrentUser, getProfile, onAuthChange, touchToday, type AuthUser } from './api'
import type { Profile } from './types'

interface AuthState {
  user: AuthUser | null
  profile: Profile | null
  loading: boolean
  /** Vrai quand l'étudiant arrive par le lien « mot de passe oublié » et doit choisir un nouveau mot de passe. */
  recovery: boolean
  /** Vrai quand le profil n'a pas pu être lu (réseau coupé) : on n'envoie pas l'étudiant vers la connexion. */
  loadFailed: boolean
  endRecovery: () => void
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthState>({ user: null, profile: null, loading: true, recovery: false, loadFailed: false, endRecovery: () => {}, refresh: async () => {} })

const CACHE_KEY = 'memoa-profile-cache'
const readCache = (id: string): Profile | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    const p = raw ? (JSON.parse(raw) as Profile) : null
    return p && p.id === id ? p : null
  } catch {
    return null
  }
}
const writeCache = (p: Profile | null) => {
  try {
    if (p) localStorage.setItem(CACHE_KEY, JSON.stringify(p))
    else localStorage.removeItem(CACHE_KEY)
  } catch {
    /* navigation privée : on ignore */
  }
}

const RECOVERY_KEY = 'memoa-recovery'
const readRecovery = () => {
  try {
    return sessionStorage.getItem(RECOVERY_KEY) === '1'
  } catch {
    return false
  }
}
const writeRecovery = (on: boolean) => {
  try {
    if (on) sessionStorage.setItem(RECOVERY_KEY, '1')
    else sessionStorage.removeItem(RECOVERY_KEY)
  } catch {
    /* navigation privée : on ignore */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(readRecovery)
  const [loadFailed, setLoadFailed] = useState(false)

  const endRecovery = useCallback(() => {
    writeRecovery(false)
    setRecovery(false)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const u = await getCurrentUser()
      if (!u) {
        setUser(null)
        setProfile(null)
        setLoadFailed(false)
        writeCache(null)
        return
      }
      setUser(u)
      // Profil déjà connu : on ouvre l'appli tout de suite avec lui, la mise à jour arrive ensuite.
      const known = readCache(u.id)
      if (known) { setProfile((prev) => prev ?? known); setLoading(false) }
      if (typeof navigator !== 'undefined' && !navigator.onLine && known) { setLoadFailed(true); return }
      try {
        const p = await getProfile(u.id)
        setProfile(p)
        writeCache(p)
        setLoadFailed(false)
        if (p?.memo_animal) void touchToday(u.id)
      } catch {
        // Réseau coupé ou serveur lent : on NE déconnecte PAS l'étudiant. On garde le profil connu (ou celui du dernier passage).
        setProfile((prev) => prev ?? readCache(u.id))
        setLoadFailed(true)
      }
    } catch {
      /* lecture de la session impossible : on garde l'état actuel */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const onOnline = () => void refresh()
    window.addEventListener('online', onOnline)
    const off = onAuthChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        writeRecovery(true)
        setRecovery(true)
      } else if (event === 'SIGNED_OUT') {
        writeRecovery(false)
        setRecovery(false)
      }
      void refresh()
    })
    return () => {
      window.removeEventListener('online', onOnline)
      off()
    }
  }, [refresh])

  const value = useMemo(() => ({ user, profile, loading, recovery, loadFailed, endRecovery, refresh }), [user, profile, loading, recovery, loadFailed, endRecovery, refresh])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
