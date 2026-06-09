import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthProvider'

// Placeholder authed landing page. Blank by design for now; the real app shell comes later.
export default function Home() {
  const { session } = useAuth()

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="text-center">
        <img src="/icfai-founders.svg" alt="ICFAI Founders Network" className="mx-auto mb-6 h-10 w-auto" />
        <p className="text-sm text-muted">
          Signed in as <span className="font-semibold text-ink">{session?.user?.email}</span>
        </p>
        <button className="btn-outline mt-4" onClick={() => supabase.auth.signOut()}>
          Log out
        </button>
      </div>
    </div>
  )
}
