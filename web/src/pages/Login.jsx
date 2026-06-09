import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)

    if (signInError) {
      // Supabase already returns a generic "Invalid login credentials" (no enumeration).
      setError(signInError.message)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <form onSubmit={handleSubmit} noValidate className="card w-full max-w-sm p-8 animate-pop-in">
        <img src="/icfai-founders.svg" alt="ICFAI Founders Network" className="mb-5 h-12 w-auto" />
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
            placeholder="name@ifheindia.org" autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="mb-4 flex flex-col gap-1.5">
          <label htmlFor="password" className="text-xs font-medium text-muted">Password</label>
          <input
            id="password" type="password" className="input" value={password}
            placeholder="Your password" autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
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
