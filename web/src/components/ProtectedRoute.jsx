import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthProvider'
import Logo from './Logo'
import Spinner from './Spinner'

// Gate for authed-only routes. While the initial session check runs, show a branded
// full-page loader (not a blank screen). No session means bounce to login.
export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-page">
        <div className="flex flex-col items-center gap-4">
          <Logo className="h-10 w-auto" />
          <Spinner size={24} />
        </div>
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return children
}
