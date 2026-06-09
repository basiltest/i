import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { REGIONS, SECTORS, DOMAINS } from '../lib/options'

const EMAIL_DOMAIN = '@ifheindia.org'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [region, setRegion] = useState('')
  const [sector, setSector] = useState('')
  const [domain, setDomain] = useState('')
  const [incubationInterest, setIncubationInterest] = useState(false)
  const [linkedin, setLinkedin] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    // client-side validation (UX only, real domain enforcement is server-side, Stage 1f)
    if (!name.trim()) return setError('Please enter your name.')
    if (!email.toLowerCase().endsWith(EMAIL_DOMAIN))
      return setError(`Email must end with ${EMAIL_DOMAIN}.`)
    if (password.length < 8)
      return setError('Password must be at least 8 characters.')
    if (!region || !sector || !domain)
      return setError('Please select your region, sector, and domain.')

    setLoading(true)
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        // All extra fields ride along as metadata, which the handle_new_user trigger
        // writes into the profiles row (role still defaults to student in the DB).
        data: {
          name: name.trim(),
          region,
          sector,
          domain,
          incubation_interest: incubationInterest,
          linkedin: linkedin.trim(),
          phone: phone.trim(),
        },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })
    setLoading(false)

    if (signUpError) setError(signUpError.message)
    else setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="card w-full max-w-md p-8 text-center animate-pop-in">
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
    <div className="min-h-screen grid place-items-center px-6 py-10">
      <form onSubmit={handleSubmit} noValidate className="card w-full max-w-md p-8 animate-pop-in">
        <img src="/icfai-founders.svg" alt="ICFAI Founders Network" className="mb-5 h-12 w-auto" />
        <h2 className="text-lg font-semibold">Create your account</h2>
        <p className="mb-5 text-sm text-muted">Join the ICFAI Founders Network.</p>

        {error && (
          <div className="mb-4 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">
            {error}
          </div>
        )}

        <div className="mb-3.5 flex flex-col gap-1.5">
          <label htmlFor="name" className="text-xs font-medium text-muted">Full name</label>
          <input id="name" type="text" className="input" value={name} placeholder="Alex Chen"
            autoComplete="name" onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="mb-3.5 flex flex-col gap-1.5">
          <label htmlFor="email" className="text-xs font-medium text-muted">Email</label>
          <input id="email" type="email" className="input" value={email} placeholder={`name${EMAIL_DOMAIN}`}
            autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="mb-3.5 flex flex-col gap-1.5">
          <label htmlFor="password" className="text-xs font-medium text-muted">Password</label>
          <input id="password" type="password" className="input" value={password}
            placeholder="At least 8 characters" autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)} />
        </div>

        <div className="mb-3.5 flex flex-col gap-1.5">
          <label htmlFor="region" className="text-xs font-medium text-muted">Region</label>
          <select id="region" className="input" value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="" disabled>Select region</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div className="mb-3.5 grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sector" className="text-xs font-medium text-muted">Sector</label>
            <select id="sector" className="input" value={sector} onChange={(e) => setSector(e.target.value)}>
              <option value="" disabled>Select</option>
              {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="domain" className="text-xs font-medium text-muted">Domain</label>
            <select id="domain" className="input" value={domain} onChange={(e) => setDomain(e.target.value)}>
              <option value="" disabled>Select</option>
              {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div className="mb-3.5 grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="linkedin" className="text-xs font-medium text-muted">LinkedIn (optional)</label>
            <input id="linkedin" type="url" className="input" value={linkedin} placeholder="linkedin.com/in/..."
              autoComplete="url" onChange={(e) => setLinkedin(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="phone" className="text-xs font-medium text-muted">Phone (optional)</label>
            <input id="phone" type="tel" className="input" value={phone} placeholder="+91..."
              autoComplete="tel" onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>

        <label className="mb-4 flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={incubationInterest}
            onChange={(e) => setIncubationInterest(e.target.checked)} />
          Interested in incubation
        </label>

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
