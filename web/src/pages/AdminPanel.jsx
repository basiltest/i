import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Award, Users, SlidersHorizontal } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthProvider'
import { REGIONS, SECTORS, DOMAINS } from '../lib/options'
import RoleBadge from '../components/RoleBadge'
import Spinner from '../components/Spinner'
import { timeAgo } from '../lib/format'

const ROLES = [
  { v: 'student', label: 'Student' },
  { v: 'mentor', label: 'Mentor' },
  { v: 'admin', label: 'Admin' },
]
const GENERIC_ERR = 'Something went wrong. Please try again.'

export default function AdminPanel() {
  const { session, profile, isAdmin } = useAuth()
  const uid = session?.user?.id

  const [tab, setTab] = useState('members') // 'members' | 'success'
  const [members, setMembers] = useState([])
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [feedLocked, setFeedLocked] = useState(false)
  const [editMember, setEditMember] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [m, q, s] = await Promise.all([
      supabase.rpc('admin_members'),
      supabase.rpc('admin_success_queue'),
      supabase.from('app_settings').select('feed_locked').single(),
    ])
    if (m.error || q.error) {
      console.error(m.error || q.error)
      setError(GENERIC_ERR)
    } else {
      setMembers(m.data || [])
      setQueue(q.data || [])
      setFeedLocked(!!s.data?.feed_locked)
    }
    setLoading(false)
  }, [])

  async function toggleFeedLock() {
    const next = !feedLocked
    const { error: e } = await supabase.rpc('admin_set_feed_locked', { p_locked: next })
    if (e) { console.error(e); return setError(GENERIC_ERR) }
    setFeedLocked(next)
  }

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  // profile not loaded yet -> wait; loaded and not admin -> bounce to the feed
  if (profile && !isAdmin) return <Navigate to="/" replace />
  if (!profile) return <div className="flex items-center gap-2 text-sm text-muted"><Spinner /> Checking access...</div>

  async function setRole(userId, role) {
    setBusyId(userId)
    const { error: e } = await supabase.rpc('admin_set_role', { p_user: userId, p_role: role })
    setBusyId(null)
    if (e) { console.error(e); return setError(GENERIC_ERR) }
    setMembers((prev) => prev.map((m) => (m.id === userId ? { ...m, role } : m)))
  }

  async function reviewSuccess(postId, approve) {
    setBusyId(postId)
    const { error: e } = await supabase.rpc('admin_review_success', { p_id: postId, p_approve: approve })
    setBusyId(null)
    if (e) { console.error(e); return setError(GENERIC_ERR) }
    setQueue((prev) => prev.filter((r) => r.id !== postId))
  }

  async function toggleBan(m) {
    const ban = !m.banned
    if (ban && !window.confirm(`Ban ${m.name || m.email}? They will be logged out and the email cannot re-register.`)) return
    setBusyId(m.id)
    const { error: e } = ban
      ? await supabase.rpc('admin_ban_user', { p_user: m.id, p_reason: null })
      : await supabase.rpc('admin_unban_user', { p_user: m.id })
    setBusyId(null)
    if (e) { console.error(e); return setError(GENERIC_ERR) }
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, banned: ban } : x)))
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-extrabold">Admin Panel</h1>
      <p className="mt-0.5 text-sm text-muted">Member roles, moderation, and badge approvals.</p>

      {/* tabs */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setTab('members')}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
            tab === 'members' ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink hover:bg-black/5'
          }`}
        >
          <Users size={15} /> Members ({members.length})
        </button>
        <button
          onClick={() => setTab('success')}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
            tab === 'success' ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink hover:bg-black/5'
          }`}
        >
          <Award size={15} /> #Success requests ({queue.length})
        </button>
        <button
          onClick={() => setTab('settings')}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
            tab === 'settings' ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink hover:bg-black/5'
          }`}
        >
          <SlidersHorizontal size={15} /> Settings
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">{error}</div>
      )}

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted"><Spinner /> Loading...</div>
      ) : tab === 'members' ? (
        <div className="card mt-4 divide-y divide-line">
          {members.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent">
                {(m.name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold">{m.name || 'Unnamed'}</span>
                  <RoleBadge role={m.role} />
                  {m.banned && <span className="rounded-full bg-down/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-down">Banned</span>}
                  {m.id === uid && <span className="text-xs text-faint">(you)</span>}
                </div>
                <div className="truncate text-xs text-muted">{m.email}{m.startup ? ` · ${m.startup}` : ''}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {m.id === uid ? (
                  <span className="text-xs text-faint">Cannot change own role</span>
                ) : (
                  <>
                    <select
                      className="input w-auto py-1.5 text-sm"
                      value={m.role}
                      disabled={busyId === m.id}
                      onChange={(e) => setRole(m.id, e.target.value)}
                    >
                      {ROLES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
                    </select>
                    <button className="btn-outline px-3 py-1.5 text-xs" onClick={() => setEditMember(m)}>Edit</button>
                    <button
                      className={`btn px-3 py-1.5 text-xs ${m.banned ? 'btn-outline' : 'border border-down/40 text-down hover:bg-down/10'}`}
                      disabled={busyId === m.id}
                      onClick={() => toggleBan(m)}
                    >
                      {m.banned ? 'Unban' : 'Ban'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : tab === 'settings' ? (
        <div className="card mt-4 divide-y divide-line">
          <div className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">Feed posting</div>
              <div className="text-xs text-muted">
                When off, members cannot create posts in the feed. Admins can still post.
              </div>
            </div>
            <button
              onClick={toggleFeedLock}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
                feedLocked ? 'border-down/40 bg-down/10 text-down' : 'border-success/40 bg-success/10 text-success'
              }`}
            >
              {feedLocked ? 'Posting is OFF' : 'Posting is ON'}
            </button>
          </div>
        </div>
      ) : queue.length === 0 ? (
        <div className="card mt-4 p-8 text-center">
          <p className="font-semibold">No pending #Success requests.</p>
          <p className="mt-1 text-sm text-muted">Authors request the badge from their post's menu.</p>
        </div>
      ) : (
        <div className="card mt-4 divide-y divide-line">
          {queue.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <Link to={`/post/${r.id}`} className="block truncate text-sm font-bold hover:underline">{r.title}</Link>
                <div className="text-xs text-muted">{r.author_name} · {timeAgo(r.created_at)}</div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  className="btn-primary px-3 py-1.5 text-xs"
                  disabled={busyId === r.id}
                  onClick={() => reviewSuccess(r.id, true)}
                >
                  Approve
                </button>
                <button
                  className="btn-outline px-3 py-1.5 text-xs"
                  disabled={busyId === r.id}
                  onClick={() => reviewSuccess(r.id, false)}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editMember && (
        <AdminEditProfileModal
          member={editMember}
          onClose={() => setEditMember(null)}
          onSaved={(patch) => {
            setMembers((prev) => prev.map((m) => (m.id === editMember.id ? { ...m, ...patch } : m)))
            setEditMember(null)
          }}
        />
      )}
    </div>
  )
}

function AdminEditProfileModal({ member, onClose, onSaved }) {
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.rpc('admin_get_profile', { p_user: member.id }).then(({ data, error: e }) => {
      if (e || !data?.[0]) { setError(GENERIC_ERR); setForm({}); return }
      const p = data[0]
      setForm({
        name: p.name || '', phone: p.phone || '', bio: p.bio || '', startup: p.startup || '',
        region: p.region || '', sector: p.sector || '', domain: p.domain || '',
        linkedin: p.linkedin || '', incubation_interest: !!p.incubation_interest,
      })
    })
  }, [member.id])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function save() {
    if (!form.name.trim()) return setError('Name is required.')
    setBusy(true)
    const { error: e } = await supabase.rpc('admin_update_profile', {
      p_user: member.id,
      p_name: form.name.trim(),
      p_phone: form.phone.trim() || null,
      p_bio: form.bio.trim() || null,
      p_startup: form.startup.trim() || null,
      p_region: form.region || null,
      p_sector: form.sector || null,
      p_domain: form.domain || null,
      p_linkedin: form.linkedin.trim() || null,
      p_incubation: form.incubation_interest,
    })
    setBusy(false)
    if (e) { console.error(e); return setError(GENERIC_ERR) }
    onSaved({ name: form.name.trim(), startup: form.startup.trim() })
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div className="card relative z-10 my-8 w-full max-w-lg p-6 animate-pop-in">
        <h2 className="text-lg font-bold">Edit profile</h2>
        <p className="mt-0.5 text-xs text-muted">{member.email}</p>
        {error && <div className="mt-4 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">{error}</div>}
        {!form ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted"><Spinner /> Loading...</div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Full name"><input className="input" maxLength={80} value={form.name} onChange={set('name')} /></Field>
              <Field label="Phone"><input className="input" maxLength={20} value={form.phone} onChange={set('phone')} /></Field>
              <Field label="Startup"><input className="input" maxLength={80} value={form.startup} onChange={set('startup')} /></Field>
              <Field label="LinkedIn"><input className="input" maxLength={200} value={form.linkedin} onChange={set('linkedin')} placeholder="https://..." /></Field>
              <Field label="Region">
                <select className="input" value={form.region} onChange={set('region')}>
                  <option value="">Select region</option>
                  {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Sector">
                <select className="input" value={form.sector} onChange={set('sector')}>
                  <option value="">Select sector</option>
                  {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Domain">
                <select className="input" value={form.domain} onChange={set('domain')}>
                  <option value="">Select domain</option>
                  {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="About"><textarea className="input min-h-[70px] resize-y" maxLength={500} value={form.bio} onChange={set('bio')} /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
                <input type="checkbox" checked={form.incubation_interest} onChange={(e) => setForm({ ...form, incubation_interest: e.target.checked })} />
                Interested in incubation
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save changes'}</button>
            </div>
          </>
        )}
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
