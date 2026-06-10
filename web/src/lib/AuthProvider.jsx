import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

// Holds the current Supabase session for the whole app. `loading` is true until the
// initial session check resolves, so guards do not flash before we know who you are.
// Also loads the caller's own profiles row (role drives admin UI).
const AuthContext = createContext({ session: null, loading: true, profile: null, isAdmin: false })

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    // 1. read the persisted session once on load (Supabase keeps it in localStorage)
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    // 2. keep it live: fires on sign in, sign out, token refresh, and email confirm
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  // own profile row (RLS: read own). Role here is display-only; the server
  // re-checks is_admin() inside every admin RPC.
  const uid = session?.user?.id
  useEffect(() => {
    if (!uid) { setProfile(null); return }
    let active = true
    supabase.from('profiles').select('*').eq('id', uid).single().then(({ data }) => {
      if (active) setProfile(data || null)
    })
    return () => { active = false }
  }, [uid])

  return (
    <AuthContext.Provider value={{ session, loading, profile, isAdmin: profile?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
