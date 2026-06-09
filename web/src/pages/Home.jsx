import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthProvider'
import AppHeader from '../components/AppHeader'

export default function Home() {
  const { session } = useAuth()

  return (
    <div className="min-h-screen bg-page">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold">Welcome to the ICFAI Founders Network</h1>
        <p className="mt-1 text-sm text-muted">
          Signed in as <span className="font-semibold text-ink">{session?.user?.email}</span>.
        </p>
        <div className="mt-6 flex gap-3">
          <Link to="/profile" className="btn-primary">Your profile</Link>
          <Link to="/settings" className="btn-outline">Settings</Link>
        </div>
        <p className="mt-8 text-sm text-faint">The feed, pipeline, and the rest of the app land here next.</p>
      </main>
    </div>
  )
}
