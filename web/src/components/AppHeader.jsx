import { Link, NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Logo from './Logo'

// Top bar for authed pages: logo home + Profile/Settings + log out.
export default function AppHeader() {
  const link = ({ isActive }) =>
    `font-semibold ${isActive ? 'text-ink' : 'text-muted hover:text-ink'}`

  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex max-w-3xl items-center gap-5 px-4 py-3">
        <Link to="/" aria-label="Home">
          <Logo className="h-7 w-auto" />
        </Link>
        <nav className="ml-auto flex items-center gap-5 text-sm">
          <NavLink to="/profile" className={link}>Profile</NavLink>
          <NavLink to="/settings" className={link}>Settings</NavLink>
          <button onClick={() => supabase.auth.signOut()} className="font-semibold text-muted hover:text-ink">
            Log out
          </button>
        </nav>
      </div>
    </header>
  )
}
