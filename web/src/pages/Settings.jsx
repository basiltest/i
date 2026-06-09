import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthProvider'
import AppHeader from '../components/AppHeader'
import RoleBadge from '../components/RoleBadge'

export default function Settings() {
  const { session } = useAuth()
  const email = session?.user?.email
  const userId = session?.user?.id

  const [profile, setProfile] = useState(null)
  const [isDark, setIsDark] = useState(
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  )

  useEffect(() => {
    if (!userId) return
    let active = true
    supabase.from('profiles').select('name, role').eq('id', userId).single().then(({ data }) => {
      if (active) setProfile(data)
    })
    return () => { active = false }
  }, [userId])

  function toggleTheme() {
    const dark = document.documentElement.classList.toggle('dark')
    localStorage.setItem('theme', dark ? 'dark' : 'light')
    setIsDark(dark)
  }

  return (
    <div className="min-h-screen bg-page">
      <AppHeader />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <h1 className="text-xl font-bold">Settings</h1>

        {/* Account */}
        <section className="card p-5">
          <h2 className="mb-3 text-base font-bold">Account</h2>
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-lg font-bold text-accent">
              {(profile?.name || email || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold">{profile?.name || 'Unnamed'}</span>
                {profile?.role && <RoleBadge role={profile.role} />}
              </div>
              <div className="truncate text-sm text-muted">{email}</div>
            </div>
            <Link to="/profile" className="btn-outline ml-auto px-3 py-1.5 text-xs">Edit in Profile</Link>
          </div>
          <p className="mt-3 text-xs text-faint">
            Email and role are managed by IFN. A Super Admin can change a member's role.
          </p>
        </section>

        {/* Appearance */}
        <section className="card p-5">
          <h2 className="mb-3 text-base font-bold">Appearance</h2>
          <div className="flex items-center gap-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold">Dark mode</div>
              <div className="text-xs text-muted">{isDark ? 'On' : 'Off'}</div>
            </div>
            <Toggle on={isDark} onClick={toggleTheme} />
          </div>
        </section>

        {/* Danger zone */}
        <section className="card border-down/30 p-5">
          <h2 className="mb-1 text-base font-bold text-down">Danger zone</h2>
          <p className="mb-3 text-sm text-muted">Sign out of this device.</p>
          <button className="btn-outline text-down" onClick={() => supabase.auth.signOut()}>Log out</button>
        </section>
      </main>
    </div>
  )
}

function Toggle({ on, onClick }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className={`ml-auto inline-flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors ${on ? 'bg-accent' : 'bg-line'}`}
    >
      <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}
