import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Award, Users, SlidersHorizontal } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthProvider'
import RoleBadge from '../components/RoleBadge'
import Spinner from '../components/Spinner'
import { timeAgo } from '../lib/format'

const ROLES = [
  { v: 'student', label: 'Student' },
  { v: 'mentor', label: 'Mentor' },
  { v: 'admin', label: 'Super Admin' },
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
                  {m.id === uid && <span className="text-xs text-faint">(you)</span>}
                </div>
                <div className="truncate text-xs text-muted">{m.email}{m.startup ? ` · ${m.startup}` : ''}</div>
              </div>
              {m.id === uid ? (
                <span className="text-xs text-faint">Cannot change own role</span>
              ) : (
                <select
                  className="input w-auto py-1.5 text-sm"
                  value={m.role}
                  disabled={busyId === m.id}
                  onChange={(e) => setRole(m.id, e.target.value)}
                >
                  {ROLES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
                </select>
              )}
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
    </div>
  )
}
