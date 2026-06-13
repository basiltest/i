import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthProvider'
import { REGIONS, SECTORS, DOMAINS } from '../lib/options'
import Logo from '../components/Logo'

export default function Onboarding() {
  const navigate = useNavigate()
  const { session, profile, refreshProfile } = useAuth()
  const email = session?.user?.email

  const [form, setForm] = useState({
    name: '', startup: '', region: '', sector: '', domain: '',
    phone: '', linkedin: '', bio: '', incubation_interest: false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [seeded, setSeeded] = useState(false)

  // seed name from the profile once it loads (then let the user edit freely)
  useEffect(() => {
    if (profile && !seeded) {
      setForm((f) => ({ ...f, name: profile.name || '' }))
      setSeeded(true)
    }
  }, [profile, seeded])

  // already onboarded -> nothing to do here
  if (profile?.onboarded) return <Navigate to="/" replace />

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setError('')
    const name = form.name.trim()
    const phone = form.phone.trim()
    const linkedin = form.linkedin.trim()
    if (!name) return setError('Your name is required.')
    if (name.length > 80) return setError('Name must be 80 characters or fewer.')
    if (!form.region) return setError('Pick your region.')
    if (!form.sector) return setError('Pick your sector.')
    if (!form.domain) return setError('Pick your domain.')
    if (phone && !/^[+\d][\d\s().-]{5,19}$/.test(phone)) return setError('Enter a valid phone number.')
    if (linkedin && !/^https?:\/\/\S+$/i.test(linkedin)) return setError('LinkedIn must be a full URL (https://...).')

    setSaving(true)
    const { error: e2 } = await supabase.from('profiles').update({
      name,
      startup: form.startup.trim() || null,
      region: form.region,
      sector: form.sector,
      domain: form.domain,
      phone: phone || null,
      linkedin: linkedin || null,
      bio: form.bio.trim() || null,
      incubation_interest: form.incubation_interest,
      onboarded: true,
    }).eq('id', session.user.id)
    if (e2) { console.error(e2); setSaving(false); return setError('Something went wrong. Please try again.') }
    await refreshProfile()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-page px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="flex flex-col items-center text-center">
          <Logo className="h-9 w-auto" />
          <h1 className="mt-5 text-2xl font-extrabold">Welcome to ICFAI Founders Network</h1>
          <p className="mt-1 text-sm text-muted">Tell us a bit about you so the right people can find you. Takes a minute.</p>
        </div>

        <form onSubmit={submit} className="card mt-6 p-6">
          {error && <div role="alert" className="mb-4 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">{error}</div>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full name *">
              <input className="input" maxLength={80} value={form.name} onChange={set('name')} placeholder="Your name" />
            </Field>
            <Field label="Email (locked)">
              <input className="input bg-page text-faint" value={email || ''} disabled />
            </Field>
            <Field label="Region *">
              <select className="input" value={form.region} onChange={set('region')}>
                <option value="">Select region</option>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Sector *">
              <select className="input" value={form.sector} onChange={set('sector')}>
                <option value="">Select sector</option>
                {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Domain *">
              <select className="input" value={form.domain} onChange={set('domain')}>
                <option value="">Select domain</option>
                {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Startup (optional)">
              <input className="input" maxLength={80} value={form.startup} onChange={set('startup')} placeholder="Your startup name" />
            </Field>
            <Field label="Phone (optional)">
              <input className="input" maxLength={20} value={form.phone} onChange={set('phone')} />
            </Field>
            <Field label="LinkedIn (optional)">
              <input className="input" maxLength={200} value={form.linkedin} onChange={set('linkedin')} placeholder="https://linkedin.com/in/..." />
            </Field>
            <div className="sm:col-span-2">
              <Field label={`About (${form.bio.length}/160)`}>
                <textarea className="input min-h-[70px] resize-y" maxLength={160} value={form.bio} onChange={set('bio')} placeholder="One line about what you are building or looking for" />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
              <input type="checkbox" checked={form.incubation_interest} onChange={(e) => setForm({ ...form, incubation_interest: e.target.checked })} />
              I am interested in incubation
            </label>
          </div>

          <button type="submit" className="btn-primary mt-6 w-full" disabled={saving}>
            {saving ? 'Saving...' : 'Get started'}
          </button>
          <p className="mt-3 text-center text-xs text-faint">You can edit all of this later in your Profile and Settings.</p>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}
