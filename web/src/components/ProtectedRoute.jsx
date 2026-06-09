import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthProvider'

// Gate for authed-only routes. While the initial session check runs, render nothing
// (avoids a redirect flash). No session means bounce to login.
export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()

  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  return children
}
