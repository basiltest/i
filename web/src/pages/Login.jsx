import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) {
        // Supabase returns a generic "Invalid login credentials" (no enumeration).
        setError(signInError.message)
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
        <h2 className="text-lg font-semibold">Welcome back</h2>
        <p className="mb-5 text-sm text-muted">Sign in to your account.</p>

        {error && (
          <div className="mb-4 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">
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
          <input
            id="password" type="password" className="input" value={password}
            placeholder="Your password" autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="mb-4 text-right">
          <Link to="/forgot-password" className="text-xs font-semibold text-accent hover:underline">
            Forgot password?
          </Link>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Signing in...' : 'Log in'}
        </button>

        <p className="mt-4 text-center text-sm text-muted">
          Need an account?{' '}
          <Link to="/register" className="font-semibold text-accent hover:underline">Register</Link>
        </p>
      </form>
    </div>
  )
}
