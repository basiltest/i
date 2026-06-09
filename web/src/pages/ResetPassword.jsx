import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthProvider'
import Logo from '../components/Logo'

export default function ResetPassword() {
  const { session, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')

    setBusy(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        return
      }
      setDone(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  // The reset link signs the user into a temporary recovery session. Wait for that to resolve.
  if (loading) return null

  // No session means they landed here without a valid reset link (or it expired).
  if (!session && !done) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="card w-full max-w-sm p-8 text-center animate-pop-in">
          <h2 className="text-lg font-semibold">Invalid or expired link</h2>
          <p className="mt-1 text-sm text-muted">
            Open the reset link from your email, or request a new one.
          </p>
          <Link to="/forgot-password" className="mt-5 inline-block text-sm font-semibold text-accent hover:underline">
            Request a new link
          </Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="card w-full max-w-sm p-8 text-center animate-pop-in">
          <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-full bg-success/15 text-success text-xl font-bold">
            ✓
          </div>
          <h2 className="text-lg font-semibold">Password updated</h2>
          <p className="mt-1 text-sm text-muted">You can continue to the app.</p>
          <button className="btn-primary mt-5 w-full" onClick={() => navigate('/', { replace: true })}>
            Continue
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <form onSubmit={handleSubmit} noValidate className="card w-full max-w-sm p-8 animate-pop-in">
        <Logo className="mb-5 h-12 w-auto" />
        <h2 className="text-lg font-semibold">Set a new password</h2>
        <p className="mb-5 text-sm text-muted">Choose a password you have not used here before.</p>

        {error && (
          <div className="mb-4 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">
            {error}
          </div>
        )}

        <div className="mb-3.5 flex flex-col gap-1.5">
          <label htmlFor="password" className="text-xs font-medium text-muted">New password</label>
          <input
            id="password" type="password" className="input" value={password}
            placeholder="At least 8 characters" autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="mb-4 flex flex-col gap-1.5">
          <label htmlFor="confirm" className="text-xs font-medium text-muted">Confirm password</label>
          <input
            id="confirm" type="password" className="input" value={confirm}
            placeholder="Re-enter password" autoComplete="new-password"
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
