import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { authErrorMessage, isRateLimitError } from '../lib/authErrors'
import Logo from '../components/Logo'
import PasswordInput from '../components/PasswordInput'

// Client-side cooldown after a server 429. A UX hint only — Supabase enforces the real
// per-IP limit server-side; this just stops the user from hammering a locked endpoint and
// tells them when to retry. A reload bypasses it, but the server simply 429s again and the
// cooldown re-arms, so the experience self-heals.
const COOLDOWN_SECONDS = 30

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const navigate = useNavigate()

  // tick the cooldown down to zero, one second at a time; cleans up on unmount/retick
  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  async function handleSubmit(e) {
    e.preventDefault()
    if (loading || cooldown > 0) return
    setError('')
    setLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) {
        // Supabase returns a generic "Invalid login credentials" (no enumeration);
        // mapped to our own copy so the UI never renders a vendor string verbatim.
        if (isRateLimitError(signInError)) setCooldown(COOLDOWN_SECONDS)
        setError(authErrorMessage(signInError))
        return
      }
      navigate('/', { replace: true })
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <form onSubmit={handleSubmit} noValidate className="card w-full max-w-sm p-8 animate-pop-in">
        <Logo className="mb-5 h-12 w-auto" />
        <h2 className="text-lg font-semibold">Back to the Network</h2>
        <p className="mb-5 text-sm text-muted">Sign in to continue.</p>

        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">
            {error}
          </div>
        )}

        <div className="mb-3.5 flex flex-col gap-1.5">
          <label htmlFor="email" className="text-xs font-medium text-muted">Email</label>
          <input
            id="email" type="email" className="input" value={email}
            placeholder="you@example.com" autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="mb-2 flex flex-col gap-1.5">
          <label htmlFor="password" className="text-xs font-medium text-muted">Password</label>
          <PasswordInput
            id="password" value={password} placeholder="Your password"
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="mb-4 text-right">
          <Link to="/forgot-password" className="text-xs font-semibold text-accent hover:underline">
            Forgot password?
          </Link>
        </div>

        <button type="submit" disabled={loading || cooldown > 0} className="btn-primary w-full">
          {cooldown > 0 ? `Try again in ${cooldown}s` : loading ? 'Signing in...' : 'Log in'}
        </button>

        <p className="mt-4 text-center text-sm text-muted">
          Need an account?{' '}
          <Link to="/register" className="font-semibold text-accent hover:underline">Register</Link>
        </p>
      </form>
    </div>
  )
}
