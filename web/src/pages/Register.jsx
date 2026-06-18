import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Upload, FileText, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import { MEMBER_TYPES } from '../lib/options'

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const STUDENT_DOMAIN = 'ifheindia.org'
const GENERIC_ERR = 'Something went wrong. Please try again.'
const MAX_CERT_MB = 5
const CERT_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

// Public sign-up is now a REQUEST: it goes to the super-admin queue (register-request edge
// function), not a direct account. The admin approves (account + emailed credentials) or
// disapproves. No password is set here.
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.onerror = () => reject(new Error('read failed'))
    r.readAsDataURL(file)
  })
}

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', member_type: '', other_text: '', website: '' })
  const [cert, setCert] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const fileRef = useRef(null)

  function clearFile() {
    setCert(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const isStudentDomain = form.email.trim().toLowerCase().split('@')[1] === STUDENT_DOMAIN
  const certRequired = !isStudentDomain

  function onFile(e) {
    setError('')
    const f = e.target.files?.[0] || null
    if (f) {
      if (!CERT_TYPES.includes(f.type)) { setError('Certificate must be a PDF, JPG, or PNG.'); e.target.value = ''; return }
      if (f.size > MAX_CERT_MB * 1024 * 1024) { setError(`Certificate must be ${MAX_CERT_MB} MB or smaller.`); e.target.value = ''; return }
    }
    setCert(f)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.name.trim().length < 2) return setError('Enter your full name.')
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError('Enter a valid email.')
    if (!form.member_type) return setError('Pick what you are registering as.')
    if (certRequired && !cert) return setError('A graduate certificate is required for your email.')

    setLoading(true)
    try {
      let certPayload = null
      if (cert) certPayload = { filename: cert.name, contentType: cert.type, dataBase64: await fileToBase64(cert) }

      const { data, error: fnErr } = await supabase.functions.invoke('register-request', {
        body: {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          member_type: form.member_type,
          other_text: form.other_text.trim(),
          website: form.website, // honeypot
          cert: certPayload,
        },
      })
      if (fnErr) {
        let msg = fnErr.message
        try { msg = (await fnErr.context?.json())?.error || msg } catch { /* ignore */ }
        return setError(msg === 'Failed to send a request to the Edge Function' ? 'Could not reach the registration service. Try again shortly.' : msg || GENERIC_ERR)
      }
      if (data?.error) return setError(data.error)
      setDone(true)
    } catch {
      setError(GENERIC_ERR)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="card w-full max-w-sm p-8 text-center animate-pop-in">
          <div aria-hidden="true" className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-full bg-success/15 text-success text-xl font-bold">✓</div>
          <h2 className="text-lg font-semibold">Request received</h2>
          <p className="mt-1 break-words text-sm text-muted">
            Thanks, <span className="font-semibold text-ink">{form.name.trim()}</span>. Our team will review your request and email <span className="font-semibold text-ink">{form.email.trim()}</span> with the outcome.
          </p>
          <p className="mt-3 text-sm text-muted">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-accent hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen grid place-items-center px-6 py-10">
      <form onSubmit={handleSubmit} noValidate className="card w-full max-w-sm p-8 animate-pop-in">
        <Logo className="mb-5 h-12 w-auto" />
        <h2 className="text-lg font-semibold">Request access</h2>
        <p className="mb-5 text-sm text-muted">Tell us about you. An admin reviews every request before your account is created.</p>

        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">{error}</div>
        )}

        {/* honeypot: hidden from humans, bots fill it */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
          value={form.website} onChange={set('website')}
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />

        <div className="mb-3.5 flex flex-col gap-1.5">
          <label htmlFor="name" className="text-xs font-medium text-muted">Full name</label>
          <input id="name" className="input" maxLength={50} value={form.name} onChange={set('name')} placeholder="Jane Doe" />
        </div>

        <div className="mb-3.5 flex flex-col gap-1.5">
          <label htmlFor="email" className="text-xs font-medium text-muted">Email</label>
          <input id="email" type="email" className="input" maxLength={254} value={form.email} autoComplete="email" onChange={set('email')} placeholder="you@example.com" />
        </div>

        <div className="mb-3.5 flex flex-col gap-1.5">
          <label htmlFor="phone" className="text-xs font-medium text-muted">Phone <span className="text-faint">(optional)</span></label>
          <input id="phone" type="tel" className="input" maxLength={20} value={form.phone} autoComplete="tel" onChange={set('phone')} placeholder="+91 ..." />
        </div>

        <div className="mb-3.5 flex flex-col gap-1.5">
          <label htmlFor="member_type" className="text-xs font-medium text-muted">Registering as</label>
          <select id="member_type" className="input" value={form.member_type} onChange={set('member_type')}>
            <option value="">Select...</option>
            {MEMBER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {form.member_type === 'Other' && (
          <div className="mb-3.5 flex flex-col gap-1.5">
            <label htmlFor="other_text" className="text-xs font-medium text-muted">Tell us more <span className="text-faint">(optional)</span></label>
            <input id="other_text" className="input" maxLength={120} value={form.other_text} onChange={set('other_text')} placeholder="What describes you" />
          </div>
        )}

        <div className="mb-4 flex flex-col gap-1.5">
          <label htmlFor="cert" className="text-xs font-medium text-muted">
            Last graduate certificate {certRequired ? <span className="text-down">*</span> : <span className="text-faint">(optional)</span>}
          </label>
          <input ref={fileRef} id="cert" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={onFile} className="hidden" />
          {cert ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-line bg-page px-3 py-2.5">
              <FileText size={18} className="shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">{cert.name}</div>
                <div className="text-xs text-muted">{formatSize(cert.size)}</div>
              </div>
              <button type="button" onClick={clearFile} aria-label="Remove file"
                className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-black/5 hover:text-down">
                <X size={16} />
              </button>
            </div>
          ) : (
            <label htmlFor="cert"
              className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-card px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:border-accent/50 hover:bg-accent-soft/40 hover:text-ink">
              <Upload size={16} /> Choose a file
            </label>
          )}
          <span className="text-xs text-faint">
            {isStudentDomain ? `Optional for @${STUDENT_DOMAIN} emails.` : 'PDF, JPG, or PNG, up to 5 MB.'}
          </span>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Submitting...' : 'Submit request'}
        </button>

        <p className="mt-4 text-center text-sm text-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-accent hover:underline">Log in</Link>
        </p>
      </form>
    </div>
  )
}
