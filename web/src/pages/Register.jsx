import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { authErrorMessage, EXISTING_EMAIL_MESSAGE } from '../lib/authErrors'
import Logo from '../components/Logo'
import PasswordInput from '../components/PasswordInput'

const STUDENT_DOMAIN = 'ifheindia.org'
const ROLE_LABEL = { mentor: 'Mentor', admin: 'Admin', student: 'Student' }

export default function Register() {
  const [params] = useSearchParams()
  const token = params.get('invite')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  // invite: null = none, false = checking, object = resolved ({ email, role, valid })
  const [invite, setInvite] = useState(token ? false : null)

  useEffect(() => {
    if (!token) return
    supabase.rpc('invite_lookup', { p_token: token }).then(({ data }) => {
      const row = data?.[0]
      if (row?.valid) {
        setInvite(row)
        setEmail(row.email) // bound to the invited address
      } else {
        setInvite({ valid: false })
      }
    })
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    // client-side validation (UX only; the server trigger does the authoritative checks).
    // Name is collected later in onboarding (mandatory there), not at registration.
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Please enter a valid email.')
    // Without an invite, only ICFAI students may register. Invited mentors/admins are exempt.
    if (!invite?.valid && email.trim().split('@')[1]?.toLowerCase() !== STUDENT_DOMAIN) {
      return setError(`Registration is for @${STUDENT_DOMAIN} email users only. Other emails need an invite link from an admin.`)
    }
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    // confirm-password guards against a typo in a password the user can't fully see,
    // which would otherwise create an account with an unknown password (silent lockout).
    if (password !== confirm) return setError('Passwords do not match.')

    setLoading(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // Name is captured in onboarding (profiles.name), so none is sent here.
          emailRedirectTo: `${window.location.origin}/login`,
        },
      })
      if (signUpError) {
        setError(authErrorMessage(signUpError))
        return
      }
      // Existing-email detection: with email confirmations on, GoTrue returns a 200 with an
      // empty `identities` array for an already-registered address (anti-enumeration
      // obfuscation). By product decision we surface it explicitly rather than show the
      // "check your email" screen — see the enumeration note in lib/authErrors.js.
      if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setError(EXISTING_EMAIL_MESSAGE)
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
          <div aria-hidden="true" className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-full bg-success/15 text-success text-xl font-bold">
            ✓
          </div>
          <h2 className="text-lg font-semibold">Check your email</h2>
          <p className="mt-1 text-sm text-muted">
            We sent a confirmation link to <span className="font-semibold text-ink">{email}</span>.
            Open it to verify your account, then log in.
          </p>
          <p className="mt-3 text-sm text-muted">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-accent hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    )
  }

  // A token that resolved to an expired/used/unknown invite: dead end, no form.
  if (token && invite && !invite.valid) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="card w-full max-w-sm p-8 text-center animate-pop-in">
          <h2 className="text-lg font-semibold">Invite not valid</h2>
          <p className="mt-1 text-sm text-muted">
            This invite link has expired or already been used. Ask an admin for a fresh one.
          </p>
          <Link to="/login" className="mt-4 inline-block font-semibold text-accent hover:underline">Back to log in</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <form onSubmit={handleSubmit} noValidate className="card w-full max-w-sm p-8 animate-pop-in">
        <Logo className="mb-5 h-12 w-auto" />
        <h2 className="text-lg font-semibold">Create your account</h2>
        <p className="mb-5 text-sm text-muted">
          {invite?.valid ? 'Complete your invited account.' : 'Join the ICFAI Founders Network.'}
        </p>

        {invite?.valid && (
          <div className="mb-4 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent">
            You were invited as <span className="font-semibold">{ROLE_LABEL[invite.role] || invite.role}</span>.
          </div>
        )}

        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">
            {error}
          </div>
        )}

        <div className="mb-3.5 flex flex-col gap-1.5">
          <label htmlFor="email" className="text-xs font-medium text-muted">Email</label>
          <input id="email" type="email" className="input" value={email}
            placeholder={invite?.valid ? '' : `you@${STUDENT_DOMAIN}`}
            readOnly={!!invite?.valid}
            autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
          {!invite?.valid && (
            <span className="text-xs text-faint">Use your @{STUDENT_DOMAIN} email. Other emails need an invite from an admin.</span>
          )}
        </div>

        <div className="mb-3.5 flex flex-col gap-1.5">
          <label htmlFor="password" className="text-xs font-medium text-muted">Password</label>
          <PasswordInput id="password" value={password} placeholder="At least 8 characters"
            autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} />
        </div>

        <div className="mb-4 flex flex-col gap-1.5">
          <label htmlFor="confirm" className="text-xs font-medium text-muted">Confirm password</label>
          <PasswordInput id="confirm" value={confirm} placeholder="Re-enter your password"
            autoComplete="new-password" onChange={(e) => setConfirm(e.target.value)} />
        </div>

        <button type="submit" disabled={loading || invite === false} className="btn-primary w-full">
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
