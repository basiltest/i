import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (resetError) {
        setError(resetError.message)
        return
      }
      // Generic success regardless of whether the account exists (no enumeration).
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="card w-full max-w-sm p-8 text-center animate-pop-in">
          <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-full bg-success/15 text-success text-xl font-bold">
            ✓
          </div>
          <h2 className="text-lg font-semibold">Check your email</h2>
          <p className="mt-1 text-sm text-muted">
            If an account exists for{' '}
            <span className="font-semibold text-ink">{email}</span>, a password
            reset link is on its way.
          </p>
          <Link to="/login" className="mt-5 inline-block text-sm font-semibold text-accent hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <form onSubmit={handleSubmit} noValidate className="card w-full max-w-sm p-8 animate-pop-in">
        <Logo className="mb-5 h-12 w-auto" />
        <h2 className="text-lg font-semibold">Reset your password</h2>
        <p className="mb-5 text-sm text-muted">We will email you a link to set a new one.</p>

        {error && (
          <div className="mb-4 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">
            {error}
          </div>
        )}

        <div className="mb-4 flex flex-col gap-1.5">
          <label htmlFor="email" className="text-xs font-medium text-muted">Email</label>
          <input
            id="email" type="email" className="input" value={email}
            placeholder="you@example.com" autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Sending...' : 'Send reset link'}
        </button>

        <p className="mt-4 text-center text-sm text-muted">
          Remembered it?{' '}
          <Link to="/login" className="font-semibold text-accent hover:underline">Log in</Link>
        </p>
      </form>
    </div>
  )
}
