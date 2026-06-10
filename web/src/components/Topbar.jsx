import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, Menu, User, Settings as SettingsIcon, LogOut } from 'lucide-react'
import Logo from './Logo'
import { supabase } from '../lib/supabase'
import { typeDot } from '../lib/calendar'

export default function Topbar({ onMenu }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const [soon, setSoon] = useState([])
  const profRef = useRef(null)
  const bellRef = useRef(null)

  // close dropdowns on outside click
  useEffect(() => {
    function onDoc(e) {
      if (profRef.current && !profRef.current.contains(e.target)) setMenuOpen(false)
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // nearby events (next 7 days) drive the notification bell
  useEffect(() => {
    const now = new Date()
    const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    supabase
      .from('events')
      .select('id, title, type, starts_at')
      .gte('starts_at', now.toISOString())
      .lte('starts_at', week.toISOString())
      .order('starts_at')
      .limit(8)
      .then(({ data }) => setSoon(data || []))
  }, [])

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-card">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <button onClick={onMenu} className="-ml-1 rounded-full p-2 text-muted hover:bg-black/5 hover:text-ink lg:hidden" aria-label="Open navigation">
          <Menu size={22} />
        </button>
        <Link to="/" aria-label="Home" className="flex items-center gap-2.5">
          <Logo className="h-7 w-auto" />
          <span className="hidden text-base font-bold tracking-tight sm:block">ICFAI Founders Network</span>
        </Link>

        <div className="ml-auto flex items-center gap-1">
          {/* notifications: nearby calendar events */}
          <div className="relative" ref={bellRef}>
            <button onClick={() => setBellOpen((v) => !v)} className="relative rounded-full p-2 text-muted hover:bg-black/5 hover:text-ink" aria-label="Notifications">
              <Bell size={20} />
              {soon.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-card" />}
            </button>
            {bellOpen && (
              <div className="absolute right-0 mt-2 w-72 overflow-hidden rounded-xl border border-line bg-card shadow-pop">
                <div className="border-b border-line px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-muted">Upcoming this week</div>
                {soon.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-muted">No events in the next 7 days.</div>
                ) : (
                  <ul className="max-h-80 overflow-y-auto py-1">
                    {soon.map((ev) => (
                      <li key={ev.id}>
                        <button
                          onClick={() => { setBellOpen(false); navigate('/calendar') }}
                          className="flex w-full items-start gap-2 px-4 py-2 text-left hover:bg-black/5"
                        >
                          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${typeDot(ev.type)}`} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-ink">{ev.title}</span>
                            <span className="block text-xs text-muted">
                              {new Date(ev.starts_at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                              {' · '}
                              {new Date(ev.starts_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* profile */}
          <div className="relative" ref={profRef}>
            <button onClick={() => setMenuOpen((v) => !v)} className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-accent transition hover:ring-2 hover:ring-accent/40" aria-label="Account">
              <User size={18} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-xl border border-line bg-card py-1 shadow-pop">
                <MenuItem icon={User} label="View profile" onClick={() => { setMenuOpen(false); navigate('/profile') }} />
                <MenuItem icon={SettingsIcon} label="Settings" onClick={() => { setMenuOpen(false); navigate('/settings') }} />
                <div className="my-1 border-t border-line" />
                <MenuItem icon={LogOut} label="Log out" onClick={() => supabase.auth.signOut()} />
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function MenuItem({ icon: Ic, label, onClick }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink hover:bg-black/5">
      <Ic size={16} className="text-muted" />
      {label}
    </button>
  )
}
