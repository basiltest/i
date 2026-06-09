import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import Topbar from './Topbar'
import SideNav from './SideNav'

// Authed app shell: sticky topbar + left rail (desktop) / drawer (mobile) + page Outlet.
export default function Layout() {
  const [navOpen, setNavOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => setNavOpen(false), [pathname]) // close drawer on navigation

  return (
    <div className="min-h-screen bg-page text-ink">
      <Topbar onMenu={() => setNavOpen(true)} />

      {/* mobile drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setNavOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[80%] overflow-y-auto border-r border-line bg-card p-4 shadow-xl">
            <div className="mb-3 flex justify-end">
              <button onClick={() => setNavOpen(false)} className="rounded-full p-2 text-muted hover:bg-black/5" aria-label="Close navigation">
                <X size={20} />
              </button>
            </div>
            <SideNav onNavigate={() => setNavOpen(false)} />
          </div>
        </div>
      )}

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-[72px]">
            <SideNav />
          </div>
        </aside>
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
