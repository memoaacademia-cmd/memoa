import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getCurrentUser, getProfile, onAuthChange, touchToday, type AuthUser } from './api'
import type { Profile } from './types'

interface AuthState {
  user: AuthUser | null
  profile: Profile | null
  loading: boolean
  /** Vrai quand l'étudiant arrive par le lien « mot de passe oublié » et doit choisir un nouveau mot de passe. */
  recovery: boolean
  endRecovery: () => void
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthState>({ user: null, profile: null, loading: true, recovery: false, endRecovery: () => {}, refresh: async () => {} })

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

  const endRecovery = useCallback(() => {
    writeRecovery(false)
    setRecovery(false)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const u = await getCurrentUser()
      setUser(u)
      const p = u ? await getProfile(u.id) : null
      setProfile(p)
      if (u && p?.memo_animal) void touchToday(u.id)
    } catch {
      setUser(null)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    return onAuthChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        writeRecovery(true)
        setRecovery(true)
      } else if (event === 'SIGNED_OUT') {
        writeRecovery(false)
        setRecovery(false)
      }
      void refresh()
    })
  }, [refresh])

  const value = useMemo(() => ({ user, profile, loading, recovery, endRecovery, refresh }), [user, profile, loading, recovery, endRecovery, refresh])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
