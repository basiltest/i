import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    // client-side validation (UX only; server does the authoritative checks)
    if (!name.trim()) return setError('Please enter your name.')
    if (name.trim().length > 80) return setError('Name must be 80 characters or fewer.')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Please enter a valid email.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')

    setLoading(true)
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: name.trim() }, // -> raw_user_meta_data -> trigger -> profiles.name
          emailRedirectTo: `${window.location.origin}/login`,
        },
      })
      if (signUpError) {
        setError(signUpError.message)
        return
      }
      setDone(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="card w-full max-w-sm p-8 text-center animate-pop-in">
          <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-full bg-success/15 text-success text-xl font-bold">
            ✓
          </div>
          <h2 className="text-lg font-semibold">Check your email</h2>
          <p className="mt-1 text-sm text-muted">
            We sent a confirmation link to <span className="font-semibold text-ink">{email}</span>.
            Open it to verify your account, then log in.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <form onSubmit={handleSubmit} noValidate className="card w-full max-w-sm p-8 animate-pop-in">
        <Logo className="mb-5 h-12 w-auto" />
        <h2 className="text-lg font-semibold">Create your account</h2>
        <p className="mb-5 text-sm text-muted">Join the ICFAI Founders Network.</p>

        {error && (
          <div className="mb-4 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">
            {error}
          </div>
        )}

        <div className="mb-3.5 flex flex-col gap-1.5">
          <label htmlFor="name" className="text-xs font-medium text-muted">Full name</label>
          <input id="name" type="text" className="input" maxLength={80} value={name} placeholder="Alex Chen"
            autoComplete="name" onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="mb-3.5 flex flex-col gap-1.5">
          <label htmlFor="email" className="text-xs font-medium text-muted">Email</label>
          <input id="email" type="email" className="input" value={email} placeholder="you@example.com"
            autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="mb-4 flex flex-col gap-1.5">
          <label htmlFor="password" className="text-xs font-medium text-muted">Password</label>
          <input id="password" type="password" className="input" value={password}
            placeholder="At least 8 characters" autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)} />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Creating account...' : 'Register'}
        </button>

        <p className="mt-4 text-center text-sm text-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-accent hover:underline">Log in</Link>
        </p>
      </form>
    </div>
  )
}
