import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getCurrentUser, getProfile, onAuthChange, touchToday, type AuthUser } from './api'
import type { Profile } from './types'

interface AuthState {
  user: AuthUser | null
  profile: Profile | null
  loading: boolean
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthState>({ user: null, profile: null, loading: true, refresh: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

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
    return onAuthChange(() => void refresh())
  }, [refresh])

  const value = useMemo(() => ({ user, profile, loading, refresh }), [user, profile, loading, refresh])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
