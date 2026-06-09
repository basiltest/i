import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

// Holds the current Supabase session for the whole app. `loading` is true until the
// initial session check resolves, so guards do not flash before we know who you are.
const AuthContext = createContext({ session: null, loading: true })

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

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

  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
