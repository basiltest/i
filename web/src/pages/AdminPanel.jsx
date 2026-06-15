import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Award, Users, SlidersHorizontal, Search, Workflow, Trash2, Mail, Copy, Check, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import ModalShell from '../components/ModalShell'
import { useAuth } from '../lib/AuthProvider'
import { REGIONS, SECTORS, DOMAINS } from '../lib/options'
import RoleBadge from '../components/RoleBadge'
import Spinner from '../components/Spinner'
import { timeAgo } from '../lib/format'
import { GATES, waitingChip, STATES, ifnTag } from '../lib/pipeline'

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
  const [pipelineLocked, setPipelineLocked] = useState(false)
  const [editMember, setEditMember] = useState(null)
  const [memberQuery, setMemberQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [m, q, s] = await Promise.all([
      supabase.rpc('admin_members'),
      supabase.rpc('admin_success_queue'),
      supabase.from('app_settings').select('feed_locked, pipeline_locked').single(),
    ])
    if (m.error || q.error) {
      console.error(m.error || q.error)
      setError(GENERIC_ERR)
    } else {
      setMembers(m.data || [])
      setQueue(q.data || [])
      setFeedLocked(!!s.data?.feed_locked)
      setPipelineLocked(!!s.data?.pipeline_locked)
    }
    setLoading(false)
  }, [])

  async function toggleFeedLock() {
    const next = !feedLocked
    const { error: e } = await supabase.rpc('admin_set_feed_locked', { p_locked: next })
    if (e) { console.error(e); return setError('Could not change the feed lock. Try again.') }
    setFeedLocked(next)
  }

  async function togglePipelineLock() {
    const next = !pipelineLocked
    const { error: e } = await supabase.rpc('admin_set_pipeline_locked', { p_locked: next })
    if (e) { console.error(e); return setError('Could not change the pipeline lock. Try again.') }
    setPipelineLocked(next)
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

  const shownMembers = members.filter((m) => {
    const t = memberQuery.trim().toLowerCase()
    if (!t) return true
    return (m.name || '').toLowerCase().includes(t)
      || (m.email || '').toLowerCase().includes(t)
      || (m.startup || '').toLowerCase().includes(t)
  })

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-extrabold">Admin Panel</h1>
      <p className="mt-0.5 text-sm text-muted">Member roles, moderation, and badge approvals.</p>

      {/* tabs */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setTab('members')}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${
            tab === 'members' ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink hover:bg-black/5'
          }`}
        >
          <Users size={15} /> Members ({members.length})
        </button>
        <button
          onClick={() => setTab('pipeline')}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${
            tab === 'pipeline' ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink hover:bg-black/5'
          }`}
        >
          <Workflow size={15} /> Pipeline
        </button>
        <button
          onClick={() => setTab('success')}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${
            tab === 'success' ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink hover:bg-black/5'
          }`}
        >
          <Award size={15} /> #Success requests ({queue.length})
        </button>
        <button
          onClick={() => setTab('invites')}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${
            tab === 'invites' ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink hover:bg-black/5'
          }`}
        >
          <Mail size={15} /> Invites
        </button>
        <button
          onClick={() => setTab('settings')}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${
            tab === 'settings' ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink hover:bg-black/5'
          }`}
        >
          <SlidersHorizontal size={15} /> Settings
        </button>
      </div>

      {error && (
        <div role="alert" className="mt-4 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">{error}</div>
      )}

      {tab === 'invites' ? (
        <InvitesTab />
      ) : loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted"><Spinner /> Loading...</div>
      ) : tab === 'pipeline' ? (
        <PipelineTab />
      ) : tab === 'members' ? (
        <>
        <div className="relative mt-4">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            className="input pl-9"
            value={memberQuery}
            onChange={(e) => setMemberQuery(e.target.value)}
            aria-label="Search members" placeholder="Search members by name, email or startup..."
          />
        </div>
        <div className="card mt-3 divide-y divide-line">
          {shownMembers.length === 0 && (
            <div className="p-6 text-center text-sm text-muted">No members match.</div>
          )}
          {shownMembers.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent">
                {(m.name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold">{m.name || 'Unnamed'}</span>
                  <RoleBadge role={m.role} />
                  {m.banned && <span className="rounded-md bg-down/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-down">Banned</span>}
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
        </>
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
              className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${
                feedLocked ? 'border-down/40 bg-down/10 text-down' : 'border-success/40 bg-success/10 text-success'
              }`}
            >
              {feedLocked ? 'Posting is OFF' : 'Posting is ON'}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">Pipeline submissions</div>
              <div className="text-xs text-muted">
                When closed, members cannot submit new ideas to the pipeline. Existing ideas keep moving.
              </div>
            </div>
            <button
              onClick={togglePipelineLock}
              className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${
                pipelineLocked ? 'border-down/40 bg-down/10 text-down' : 'border-success/40 bg-success/10 text-success'
              }`}
            >
              {pipelineLocked ? 'Submissions CLOSED' : 'Submissions OPEN'}
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

// Pipeline board: inbox-first (exceptions only), funnel counts, filters, bulk assign.
// The happy path is mentor self-pick; this tab exists for everything that falls out of it.
function PipelineTab() {
  const [counts, setCounts] = useState(null)
  const [rows, setRows] = useState([])
  const [mentors, setMentors] = useState([])
  const [view, setView] = useState('inbox') // 'inbox' | 'all'
  const [gate, setGate] = useState('')
  const [state, setState] = useState('')
  const [waiting, setWaiting] = useState('')
  const [sector, setSector] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sel, setSel] = useState(new Set())
  const [bulkMentor, setBulkMentor] = useState('')
  const [bulkReason, setBulkReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [c, m] = await Promise.all([supabase.rpc('admin_pipeline_counts'), supabase.rpc('admin_mentor_load')])
    setCounts(c.data || null)
    setMentors(m.data || [])

    let list = []
    if (view === 'inbox') {
      // exceptions only: needs-admin + unassigned backlog + stale
      const [a, b, s] = await Promise.all([
        supabase.rpc('admin_pipeline_board', { p_waiting: 'admin' }),
        supabase.rpc('admin_pipeline_board', { p_waiting: 'mentor-pool' }),
        supabase.rpc('admin_pipeline_board', { p_stale_days: 14 }),
      ])
      if (a.error || b.error || s.error) { console.error(a.error || b.error || s.error); setError(GENERIC_ERR) }
      const seen = new Set()
      for (const r of [...(a.data || []), ...(b.data || []), ...(s.data || [])]) {
        if (!seen.has(r.id)) { seen.add(r.id); list.push(r) }
      }
      list.sort((x, y) => y.days_in_gate - x.days_in_gate)
    } else {
      const r = await supabase.rpc('admin_pipeline_board', {
        p_gate: gate ? Number(gate) : null,
        p_state: state || null,
        p_waiting: waiting || null,
        p_sector: sector || null,
        p_search: query.trim() || null,
        p_limit: 100,
      })
      if (r.error) { console.error(r.error); setError(GENERIC_ERR) }
      list = r.data || []
    }
    setRows(list)
    setSel(new Set())
    setLoading(false)
  }, [view, gate, state, waiting, sector, query])

  useEffect(() => { load() }, [load])

  async function bulkAssign() {
    if (!bulkMentor || !bulkReason.trim() || sel.size === 0) return
    setBusy(true)
    const { error: e } = await supabase.rpc('admin_bulk_assign', {
      p_ideas: [...sel], p_mentor: bulkMentor, p_reason: bulkReason.trim(),
    })
    setBusy(false)
    if (e) { console.error(e); return setError(e.message || GENERIC_ERR) }
    setBulkReason('')
    load()
  }

  const toggle = (id) => setSel((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  // moderation: remove an application outright. The prompt doubles as the confirm; the
  // reason is mandatory (it rides in the author's/mentor's notification).
  async function deleteIdea(r) {
    const reason = window.prompt(
      `Delete ${ifnTag(r.ifn)} "${r.title}" permanently?\n\nThis removes the application, its submissions, reviews, files and thread for everyone. This cannot be undone.\n\nReason (required, audited):`
    )
    if (reason === null) return
    if (!reason.trim()) return setError('A reason is required for every admin action (it is audited).')
    setBusy(true)
    setError('')
    const { error: e } = await supabase.rpc('admin_delete_pipeline_idea', { p_idea: r.id, p_reason: reason.trim() })
    setBusy(false)
    if (e) { console.error(e); return setError(e.message || GENERIC_ERR) }
    load()
  }

  const byGate = counts?.by_gate || {}

  return (
    <div className="mt-4">
      {/* funnel header */}
      {counts && (
        <div className="card flex flex-wrap items-center gap-x-5 gap-y-1.5 p-3 text-xs">
          {GATES.map((g) => (
            <span key={g.g} title={g.label} className="text-muted">
              G{g.g} <span className="font-bold text-ink">{byGate[g.g] || 0}</span>
            </span>
          ))}
          <span className="text-muted">Unassigned <span className="font-bold text-ink">{counts.unassigned}</span></span>
          <span className="text-muted">Refine <span className="font-bold text-ink">{counts.refine}</span></span>
          <span className="text-muted">Rejected <span className="font-bold text-ink">{counts.rejected}</span></span>
          <span className={counts.stale > 0 ? 'font-bold text-down' : 'text-muted'}>Stale 14d+ {counts.stale}</span>
        </div>
      )}

      {/* view + filters */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setView('inbox')}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${view === 'inbox' ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink hover:bg-black/5'}`}
        >
          Inbox (needs you)
        </button>
        <button
          onClick={() => setView('all')}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${view === 'all' ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink hover:bg-black/5'}`}
        >
          All ideas
        </button>
        {view === 'all' && (
          <>
            <select className="input w-auto py-1.5 text-xs" value={gate} onChange={(e) => setGate(e.target.value)}>
              <option value="">Any gate</option>
              {GATES.map((g) => <option key={g.g} value={g.g}>G{g.g}</option>)}
            </select>
            <select className="input w-auto py-1.5 text-xs" value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">Any state</option>
              <option value="active">Active</option>
              <option value="refine">Refine</option>
              <option value="rejected">Rejected</option>
            </select>
            <select className="input w-auto py-1.5 text-xs" value={waiting} onChange={(e) => setWaiting(e.target.value)}>
              <option value="">Waiting on anyone</option>
              <option value="student">Founder</option>
              <option value="mentor">Mentor</option>
              <option value="mentor-pool">Mentor queue</option>
              <option value="admin">Admin</option>
            </select>
            <select className="input w-auto py-1.5 text-xs" value={sector} onChange={(e) => setSector(e.target.value)}>
              <option value="">All sectors</option>
              {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
              className="input w-44 py-1.5 text-xs"
              aria-label="Search ideas" placeholder="Search title / author / IFN"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </>
        )}
      </div>

      {/* bulk assign */}
      {sel.size > 0 && (
        <div className="card mt-3 flex flex-wrap items-center gap-2 border-accent/30 p-3">
          <span className="text-xs font-bold">{sel.size} selected</span>
          <select className="input w-auto py-1.5 text-xs" value={bulkMentor} onChange={(e) => setBulkMentor(e.target.value)}>
            <option value="">Assign mentor...</option>
            {mentors.map((m) => <option key={m.mentor_id} value={m.mentor_id}>{m.mentor_name} ({m.active_count} active)</option>)}
          </select>
          <input className="input min-w-0 flex-1 py-1.5 text-xs" maxLength={300} placeholder="Reason (required, audited)" value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} />
          <button className="btn-primary px-3 py-1.5 text-xs" onClick={bulkAssign} disabled={busy || !bulkMentor || !bulkReason.trim()}>
            {busy ? 'Assigning...' : 'Assign'}
          </button>
        </div>
      )}

      {error && <div role="alert" className="mt-3 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">{error}</div>}

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted"><Spinner /> Loading...</div>
      ) : rows.length === 0 ? (
        <div className="card mt-3 p-8 text-center">
          <p className="font-semibold">{view === 'inbox' ? 'Inbox zero.' : 'No ideas match.'}</p>
          <p className="mt-1 text-sm text-muted">
            {view === 'inbox' ? 'Nothing needs an admin: no stale ideas, no unassigned backlog.' : 'Loosen the filters above.'}
          </p>
        </div>
      ) : (
        <div className="card mt-3 divide-y divide-line">
          {rows.map((r) => {
            const w = waitingChip(r.waiting_on)
            const st = STATES[r.pipeline_state]
            return (
              <div key={r.id} className="flex items-center gap-3 p-3">
                <input
                  type="checkbox"
                  checked={sel.has(r.id)}
                  onChange={() => toggle(r.id)}
                  aria-label={`Select ${ifnTag(r.ifn)}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-line px-2 py-0.5 text-[11px] font-bold text-muted">{ifnTag(r.ifn)}</span>
                    <Link to={`/pipeline/${r.id}`} className="min-w-0 truncate text-sm font-bold hover:underline">{r.title}</Link>
                    {r.pipeline_state !== 'active' && st && (
                      <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${st.tone}`}>{st.label}</span>
                    )}
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${w.tone}`}>{w.label}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    G{r.gate} · {r.author_name}
                    {r.sector && <> · {r.sector}</>}
                    {r.mentor_name ? <> · mentor {r.mentor_name}</> : <> · no mentor</>}
                    <span className={r.days_in_gate >= 14 && r.pipeline_state === 'active' ? ' font-bold text-down' : ''}>
                      {' '}· {r.days_in_gate}d in gate
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => deleteIdea(r)}
                  disabled={busy}
                  title={`Delete ${ifnTag(r.ifn)} permanently`}
                  aria-label={`Delete ${ifnTag(r.ifn)}`}
                  className="shrink-0 rounded-full p-2 text-muted hover:bg-down/10 hover:text-down"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Invite mentors/admins (any domain). They cannot self-register — the server
// only lets @ifheindia.org students through unless their email has a live invite.
// Paste many addresses at once; each gets its own one-time link to share.
// Pin the link base to VITE_PUBLIC_URL so a link generated on a preview/localhost
// deploy still points at production; fall back to the current origin if unset.
const SITE_URL = import.meta.env.VITE_PUBLIC_URL || window.location.origin
const inviteLink = (token) => `${SITE_URL.replace(/\/$/, '')}/register?invite=${token}`
const parseEmails = (raw) =>
  [...new Set(raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))]

function InvitesTab() {
  const [emails, setEmails] = useState('')
  const [role, setRole] = useState('mentor')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState([]) // rows from the latest generate
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: e } = await supabase.rpc('admin_list_invites')
    if (e) { console.error(e); setError(GENERIC_ERR) }
    setList(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function copy(text, key) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied((c) => (c === key ? '' : c)), 1500)
    } catch { /* clipboard blocked; ignore */ }
  }

  async function generate() {
    setError('')
    const parsed = parseEmails(emails)
    if (parsed.length === 0) return setError('Paste at least one email address.')
    setBusy(true)
    const { data, error: e } = await supabase.rpc('admin_create_invites', { p_emails: parsed, p_role: role })
    setBusy(false)
    if (e) { console.error(e); return setError(e.message || GENERIC_ERR) }
    const rows = data || []
    setCreated(rows)
    setEmails('')
    const skipped = parsed.length - rows.length
    if (rows.length === 0) setError('No valid new invites were created (check the addresses).')
    else if (skipped > 0) setError(`${rows.length} invite${rows.length > 1 ? 's' : ''} created. ${skipped} skipped (invalid or duplicate).`)
    load()
  }

  // Create + email the invites via the send-invites Edge Function (Resend).
  // emailsArg + roleArg let the per-row "Resend email" reuse this for one address
  // while keeping that invite's own role (not the compose dropdown).
  async function sendInvites(emailsArg, roleArg) {
    setError('')
    const parsed = parseEmails(emailsArg ?? emails)
    if (parsed.length === 0) return setError('Paste at least one email address.')
    setBusy(true)
    const { data, error: e } = await supabase.functions.invoke('send-invites', {
      body: { emails: parsed, role: roleArg ?? role },
    })
    setBusy(false)
    if (e) {
      console.error(e)
      // FunctionsHttpError carries the JSON body on .context; fall back to a hint.
      let msg = e.message
      try { msg = (await e.context?.json())?.error || msg } catch { /* keep msg */ }
      return setError(msg === 'Failed to send a request to the Edge Function'
        ? 'Could not reach the email service. Is the send-invites function deployed?'
        : msg || GENERIC_ERR)
    }
    if (data?.error) return setError(data.error)
    if (!emailsArg) setEmails('')
    const failed = data?.failed?.length || 0
    setError(`Emailed ${data?.sent || 0} invite${data?.sent === 1 ? '' : 's'}.${failed ? ` ${failed} failed to send.` : ''}`)
    load()
  }

  const STATUS_TONE = {
    pending: 'bg-accent-soft text-accent',
    accepted: 'bg-success/15 text-success',
    expired: 'bg-line text-muted',
  }

  return (
    <div className="mt-4 space-y-4">
      {/* compose */}
      <div className="card p-4">
        <div className="text-sm font-bold">Invite mentors &amp; admins</div>
        <p className="mt-0.5 text-xs text-muted">
          One email per line (or comma-separated). Everyone in the batch gets the same role and their own link.
        </p>
        <textarea
          className="input mt-3 min-h-[88px] resize-y font-mono text-sm"
          placeholder={'jane@acme.com\nbob@partner.org'}
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select className="input w-auto py-2 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.filter((r) => r.v !== 'student').map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
          </select>
          <button className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm" onClick={() => sendInvites()} disabled={busy || !emails.trim()}>
            <Send size={15} /> {busy ? 'Working...' : 'Send invites'}
          </button>
          <button className="btn-outline px-4 py-2 text-sm" onClick={generate} disabled={busy || !emails.trim()}>
            Generate links only
          </button>
        </div>
        <p className="mt-2 text-xs text-faint">
          <strong>Send invites</strong> emails each link directly. <strong>Generate links only</strong> creates them to copy and share yourself.
        </p>
        {error && (
          <div role="alert" className="mt-3 rounded-lg border border-line bg-black/5 px-3 py-2 text-sm text-muted">{error}</div>
        )}
      </div>

      {/* freshly generated links — easy to copy and hand out now */}
      {created.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold">{created.length} link{created.length > 1 ? 's' : ''} ready</div>
            <button
              className="btn-outline px-3 py-1.5 text-xs"
              onClick={() => copy(created.map((r) => `${r.email}: ${inviteLink(r.token)}`).join('\n'), 'all')}
            >
              {copied === 'all' ? 'Copied!' : 'Copy all'}
            </button>
          </div>
          <div className="mt-3 divide-y divide-line">
            {created.map((r) => (
              <div key={r.token} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{r.email}</div>
                  <div className="truncate text-xs text-muted">{inviteLink(r.token)}</div>
                </div>
                <button
                  className="shrink-0 rounded-lg border border-line p-2 text-muted hover:bg-black/5"
                  onClick={() => copy(inviteLink(r.token), r.token)}
                  aria-label={`Copy link for ${r.email}`}
                >
                  {copied === r.token ? <Check size={15} className="text-success" /> : <Copy size={15} />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* all invites */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted"><Spinner /> Loading...</div>
      ) : list.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">No invites yet.</div>
      ) : (
        <div className="card divide-y divide-line">
          {list.map((iv) => (
            <div key={iv.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{iv.email}</span>
                  <RoleBadge role={iv.role} />
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_TONE[iv.status]}`}>
                    {iv.status}
                  </span>
                </div>
                <div className="truncate text-xs text-muted">
                  {iv.status === 'accepted'
                    ? `Joined ${timeAgo(iv.accepted_at)}`
                    : iv.status === 'expired'
                      ? `Expired ${timeAgo(iv.expires_at)}`
                      : `Expires ${timeAgo(iv.expires_at)} · ${iv.sent_at ? `emailed ${timeAgo(iv.sent_at)}` : 'not emailed'}`}
                  {iv.invited_by_name ? ` · by ${iv.invited_by_name}` : ''}
                </div>
              </div>
              {iv.status === 'pending' && (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    className="btn-outline inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
                    disabled={busy}
                    onClick={() => sendInvites(iv.email, iv.role)}
                  >
                    <Send size={13} /> {iv.sent_at ? 'Resend' : 'Email'}
                  </button>
                  <button className="btn-outline px-3 py-1.5 text-xs" onClick={() => copy(inviteLink(iv.token), iv.id)}>
                    {copied === iv.id ? 'Copied!' : 'Copy link'}
                  </button>
                  <button
                    className="btn px-3 py-1.5 text-xs border border-down/40 text-down hover:bg-down/10"
                    onClick={async () => {
                      if (!window.confirm(`Revoke the invite for ${iv.email}? The link will stop working.`)) return
                      const { error: e } = await supabase.rpc('admin_revoke_invite', { p_id: iv.id })
                      if (e) { console.error(e); return setError(GENERIC_ERR) }
                      load()
                    }}
                  >
                    Revoke
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
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
    if (e) { console.error(e); return setError('Could not save the profile. Check your connection and try again.') }
    onSaved({ name: form.name.trim(), startup: form.startup.trim() })
  }

  return (
    <ModalShell onRequestClose={() => !busy && onClose()} labelledBy="admin-edit-title">
      <h2 id="admin-edit-title" className="text-lg font-bold">Edit profile</h2>
        <p className="mt-0.5 text-xs text-muted">{member.email}</p>
        {error && <div role="alert" className="mt-4 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">{error}</div>}
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
                <Field label="About"><textarea className="input min-h-[70px] resize-y" maxLength={160} value={form.bio} onChange={set('bio')} /></Field>
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
    </ModalShell>
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
