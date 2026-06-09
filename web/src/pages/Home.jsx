import { useAuth } from '../lib/AuthProvider'

export default function Home() {
  const { session } = useAuth()

  return (
    <div>
      <h1 className="text-2xl font-bold">Welcome to the ICFAI Founders Network</h1>
      <p className="mt-1 text-sm text-muted">
        Signed in as <span className="font-semibold text-ink">{session?.user?.email}</span>.
      </p>
      <p className="mt-8 text-sm text-faint">The feed, pipeline, and the rest of the app land here next.</p>
    </div>
  )
}
