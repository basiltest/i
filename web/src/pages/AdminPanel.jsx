import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Users, SlidersHorizontal, Search, Workflow, UserPlus, Copy, Check, Inbox, ExternalLink, FolderHeart } from 'lucide-react'
import { supabase } from '../lib/supabase'
import ModalShell from '../components/ModalShell'
import Combobox from '../components/Combobox'
import { useAuth } from '../lib/AuthProvider'
import { REGIONS, SECTORS, DOMAINS, MEMBER_TYPES, typeToRole } from '../lib/options'
import RoleBadge from '../components/RoleBadge'
import Spinner from '../components/Spinner'
import { timeAgo } from '../lib/format'
import { GATES, waitingChip, STATES, ifnTag } from '../lib/pipeline'

const ROLES = [
  { v: 'student', label: 'User level' },
  { v: 'mentor', label: 'Mentor level' },
  { v: 'admin', label: 'Admin level' },
]
const GENERIC_ERR = 'Something went wrong. Please try again.'

export default function AdminPanel() {
  const { session, profile, isAdmin } = useAuth()
  const uid = session?.user?.id
  const [searchParams] = useSearchParams()

  const [tab, setTab] = useState(searchParams.get('tab') === 'requests' ? 'requests' : 'members') // 'members' | 'pipeline' | 'add' | 'requests' | 'settings' | 'autopsies'
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [feedLocked, setFeedLocked] = useState(false)
  const [pipelineLocked, setPipelineLocked] = useState(false)
  const [iiecEnabled, setIiecEnabled] = useState(false)
  const [editMember, setEditMember] = useState(null)
  const [memberQuery, setMemberQuery] = useState('')

  // Idea Autopsy specific states
  const [autopsies, setAutopsies] = useState([])
  const [loadingAutopsies, setLoadingAutopsies] = useState(false)

  // Registration requests
  const [requests, setRequests] = useState([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const loadRequests = useCallback(async () => {
    setLoadingRequests(true)
    const { data, error: e } = await supabase.rpc('admin_list_registration_requests')
    if (e) console.error('requests load:', e)
    setRequests(data || [])
    setLoadingRequests(false)
  }, [])
  const pendingRequests = requests.filter((r) => r.status === 'pending').length

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [m, s] = await Promise.all([
      supabase.rpc('admin_members'),
      supabase.from('app_settings').select('feed_locked, pipeline_locked, iiec_enabled').single(),
    ])
    if (m.error) {
      console.error(m.error)
      setError(GENERIC_ERR)
    } else {
      setMembers(m.data || [])
      setFeedLocked(!!s.data?.feed_locked)
      setPipelineLocked(!!s.data?.pipeline_locked)
      setIiecEnabled(!!s.data?.iiec_enabled)
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

  async function toggleIiec() {
    const next = !iiecEnabled
    const { error: e } = await supabase.rpc('admin_set_iiec_enabled', { p_enabled: next })
    if (e) { console.error(e); return setError('Could not change the IIEC option. Try again.') }
    setIiecEnabled(next)
  }

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])
  useEffect(() => { if (isAdmin) loadRequests() }, [isAdmin, loadRequests])

  useEffect(() => {
    if (!isAdmin) return
    async function fetchPendingAutopsies() {
      setLoadingAutopsies(true)
      const { data, error: e } = await supabase
        .from('idea_autopsies')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (e) console.error('Error fetching autopsies:', e.message)
      else setAutopsies(data || [])
      setLoadingAutopsies(false)
    }
    fetchPendingAutopsies()
  }, [isAdmin, tab])

  if (profile && !isAdmin) return <Navigate to="/" replace />
  if (!profile) return <div className="flex items-center gap-2 text-sm text-muted"><Spinner /> Checking access...</div>
  async function setRole(userId, role) {
    setBusyId(userId)
    const { error: e } = await supabase.rpc('admin_set_role', { p_user: userId, p_role: role })
    setBusyId(null)
    if (e) { console.error(e); return setError(GENERIC_ERR) }
    setMembers((prev) => prev.map((m) => (m.id === userId ? { ...m, role } : m)))
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

  async function toggleRestrict(m) {
    const restrict = !m.restricted
    if (restrict && !window.confirm(`Put ${m.name || m.email} in read-only mode? They stay logged in but cannot post, edit, vote, or message until you lift it.`)) return
    setBusyId(m.id)
    const { error: e } = restrict
      ? await supabase.rpc('admin_restrict_user', { p_user: m.id, p_reason: null })
      : await supabase.rpc('admin_unrestrict_user', { p_user: m.id })
    setBusyId(null)
    if (e) { console.error(e); return setError(GENERIC_ERR) }
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, restricted: restrict } : x)))
  }

  async function handleApproveAutopsy(id) {
    setBusyId(id)
    const { error: e } = await supabase.from('idea_autopsies').update({ status: 'approved' }).eq('id', id)
    setBusyId(null)
    if (e) { console.error(e); alert('Failed to approve autopsy.') }
    else setAutopsies((prev) => prev.filter(item => item.id !== id))
  }

  async function handleRejectAutopsy(id) {
    const reason = window.prompt('Enter rejection reason (optional):')
    if (reason === null) return
    setBusyId(id)
    const { error: e } = await supabase.from('idea_autopsies').update({ status: 'rejected', rejection_reason: reason.trim() || null }).eq('id', id)
    setBusyId(null)
    if (e) { console.error(e); alert('Failed to reject autopsy.') }
    else setAutopsies((prev) => prev.filter(item => item.id !== id))
  }

  const shownMembers = members.filter((m) => {
    const t = memberQuery.trim().toLowerCase()
    if (!t) return true
    return (m.name || '').toLowerCase().includes(t) || (m.email || '').toLowerCase().includes(t) || (m.startup || '').toLowerCase().includes(t)
  })

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-extrabold">Admin Panel</h1>
      <p className="mt-0.5 text-sm text-muted">Member roles, moderation, and badge approvals.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => setTab('members')} className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${tab === 'members' ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink hover:bg-black/5'}`}><Users size={15} /> Members ({members.length})</button>
        <button onClick={() => setTab('pipeline')} className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${tab === 'pipeline' ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink hover:bg-black/5'}`}><Workflow size={15} /> Pipeline</button>
        <button onClick={() => setTab('add')} className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${tab === 'add' ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink hover:bg-black/5'}`}><UserPlus size={15} /> Add member</button>
        <button onClick={() => setTab('requests')} className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${tab === 'requests' ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink hover:bg-black/5'}`}><Inbox size={15} /> Requests{pendingRequests > 0 && <span className="h-1.5 w-1.5 rounded-full bg-down" role="status" aria-label={`${pendingRequests} pending requests`} />}</button>
        <button onClick={() => setTab('settings')} className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${tab === 'settings' ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink hover:bg-black/5'}`}><SlidersHorizontal size={15} /> Settings</button>
        <button onClick={() => setTab('autopsies')} className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${tab === 'autopsies' ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink hover:bg-black/5'}`}><FolderHeart size={15} /> Autopsies ({autopsies.length})</button>
      </div>

      {error && <div role="alert" className="mt-4 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">{error}</div>}

      {tab === 'add' ? (
        <CreateMemberTab />
      ) : tab === 'requests' ? (
        <RequestsTab requests={requests} loading={loadingRequests} reload={loadRequests} />
      ) : loading ? (
        <ListSkeleton />
      ) : tab === 'pipeline' ? (
        <PipelineTab />
      ) : tab === 'members' ? (
        <>
        <div className="relative mt-4">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input className="input pl-9" value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} aria-label="Search members" placeholder="Search members by name, email or startup..." />
        </div>
        <div className="card mt-3 divide-y divide-line">
          {shownMembers.length === 0 && <div className="p-6 text-center text-sm text-muted">No members match.</div>}
          {shownMembers.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent">{(m.name || '?').charAt(0).toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold">{m.name || 'Unnamed'}</span>
                  <RoleBadge role={m.role} />
                  {m.banned && <span className="rounded-md bg-down/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-down">Banned</span>}
                  {!m.banned && m.restricted && <span className="rounded-md bg-warn/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warnink">Read-only</span>}
                  {m.id === uid && <span className="text-xs text-faint">(you)</span>}
                </div>
                <div className="truncate text-xs text-muted">{m.email}{m.startup ? ` · ${m.startup}` : ''}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {m.id === uid ? ( <span className="text-xs text-faint">Cannot change own role</span> ) : (
                  <>
                    <select className="input w-auto py-1.5 text-sm" value={m.role} disabled={busyId === m.id} onChange={(e) => setRole(m.id, e.target.value)}>
                      {ROLES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
                    </select>
                    <button className="btn-outline px-3 py-1.5 text-xs" onClick={() => setEditMember(m)}>Edit</button>
                    {!m.banned && (
                      <button className={`btn px-3 py-1.5 text-xs ${m.restricted ? 'btn-outline' : 'border border-warn/40 text-warnink hover:bg-warn/10'}`} disabled={busyId === m.id} onClick={() => toggleRestrict(m)}>{m.restricted ? 'Lift read-only' : 'Read-only'}</button>
                    )}
                    <button className={`btn px-3 py-1.5 text-xs ${m.banned ? 'btn-outline' : 'border border-down/40 text-down hover:bg-down/10'}`} disabled={busyId === m.id} onClick={() => toggleBan(m)}>{m.banned ? 'Unban' : 'Ban'}</button>
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
              <div className="text-xs text-muted">When off, members cannot create posts in the feed. Admins can still post.</div>
            </div>
            <button onClick={toggleFeedLock} className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${feedLocked ? 'border-down/40 bg-down/10 text-down' : 'border-success/40 bg-success/10 text-success'}`}>{feedLocked ? 'Posting is OFF' : 'Posting is ON'}</button>
          </div>
          <div className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">Pipeline submissions</div>
              <div className="text-xs text-muted">When closed, members cannot submit new ideas to the pipeline. Existing ideas keep moving.</div>
            </div>
            <button onClick={togglePipelineLock} className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${pipelineLocked ? 'border-down/40 bg-down/10 text-down' : 'border-success/40 bg-success/10 text-success'}`}>{pipelineLocked ? 'Submissions CLOSED' : 'Submissions OPEN'}</button>
          </div>
          <div className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">IIEC funding requests</div>
              <div className="text-xs text-muted">When on, founders can flag a G5 submission to request IIEC funding. The mentor sees it and takes it to the council.</div>
            </div>
            <button onClick={toggleIiec} className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${iiecEnabled ? 'border-success/40 bg-success/10 text-success' : 'border-line bg-black/5 text-muted'}`}>{iiecEnabled ? 'Option ON' : 'Option OFF'}</button>
          </div>
        </div>
      ) : tab === 'autopsies' ? (
        <div className="mt-4 space-y-4">
          <div className="card p-4">
            <h2 className="text-sm font-bold">Pending Idea Autopsies Review Queue</h2>
            <p className="text-xs text-muted mt-0.5">Verify case studies of failed ideas before publishing them to the public library platform.</p>
          </div>
          {loadingAutopsies ? (
            <ListSkeleton avatar={false} rows={3} className="mt-3" />
          ) : autopsies.length === 0 ? (
            <div className="card p-8 text-center text-sm text-muted">No pending autopsies to review. Good job!</div>
          ) : (
            <div className="card divide-y divide-line">
              {autopsies.map((item) => (
                <div key={item.id} className="p-4 flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-sm font-bold text-ink">{item.project_name}</h3>
                      <div className="text-xs text-muted mt-0.5">Sector: {item.category} · Domain: {item.domain} · Duration: {item.duration || 'N/A'}</div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button className="btn bg-success/15 hover:bg-success/20 text-success text-xs font-bold px-3 py-1.5 rounded-md border border-success/30" disabled={busyId === item.id} onClick={() => handleApproveAutopsy(item.id)}>Approve</button>
                      <button className="btn border border-down/40 text-down hover:bg-down/10 text-xs font-bold px-3 py-1.5 rounded-md" disabled={busyId === item.id} onClick={() => handleRejectAutopsy(item.id)}>Reject</button>
                    </div>
                  </div>
                  <div className="text-xs text-ink bg-black/5 border p-2.5 rounded-md mt-1"><strong>Why it failed:</strong> {item.root_cause}</div>
                  {item.story && <div className="text-xs text-muted italic pl-1"><strong>The Story:</strong> {item.story}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {editMember && (
        <AdminEditProfileModal member={editMember} onClose={() => setEditMember(null)} onSaved={(patch) => { setMembers((prev) => prev.map((m) => (m.id === editMember.id ? { ...m, ...patch } : m))); setEditMember(null) }} />
      )}
    </div>
  )
}function PipelineTab() {
  const [counts, setCounts] = useState(null)
  const [rows, setRows] = useState([])
  const [mentors, setMentors] = useState([])
  const [view, setView] = useState('inbox')
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
    const { error: e } = await supabase.rpc('admin_bulk_assign', { p_ideas: [...sel], p_mentor: bulkMentor, p_reason: bulkReason.trim() })
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

  async function deleteIdea(r) {
    const reason = window.prompt(`Delete ${ifnTag(r.ifn)} "${r.title}" permanently?\n\nThis removes the application, its submissions, reviews, files and thread for everyone. This cannot be undone.\n\nReason (required, audited):`)
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
      {counts && (
        <div className="card flex flex-wrap items-center gap-x-5 gap-y-1.5 p-3 text-xs">
          {GATES.map((g) => ( <span key={g.g} title={g.label} className="text-muted">G{g.g} <span className="font-bold text-ink">{byGate[g.g] || 0}</span></span> ))}
          <span className="text-muted">Unassigned <span className="font-bold text-ink">{counts.unassigned}</span></span>
          <span className="text-muted">Refine <span className="font-bold text-ink">{counts.refine}</span></span>
          <span className="text-muted">Rejected <span className="font-bold text-ink">{counts.rejected}</span></span>
          <span className={counts.stale > 0 ? 'font-bold text-down' : 'text-muted'}>Stale 14d+ {counts.stale}</span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setView('inbox')} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${view === 'inbox' ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink hover:bg-black/5'}`}>Inbox (needs you)</button>
        <button onClick={() => setView('all')} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${view === 'all' ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink hover:bg-black/5'}`}>All ideas</button>
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
            <input className="input w-44 py-1.5 text-xs" aria-label="Search ideas" placeholder="Search title / author / IFN" value={query} onChange={(e) => setQuery(e.target.value)} />
          </>
        )}
      </div>

      {sel.size > 0 && (
        <div className="card mt-3 flex flex-wrap items-center gap-2 border-accent/30 p-3">
          <span className="text-xs font-bold">{sel.size} selected</span>
          <select className="input w-auto py-1.5 text-xs" value={bulkMentor} onChange={(e) => setBulkMentor(e.target.value)}>
            <option value="">Assign mentor...</option>
            {mentors.map((m) => <option key={m.mentor_id} value={m.mentor_id}>{m.mentor_name} ({m.active_count} active)</option>)}
          </select>
          <input className="input min-w-0 flex-1 py-1.5 text-xs" maxLength={300} placeholder="Reason (required, audited)" value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} />
          <button className="btn-primary px-3 py-1.5 text-xs" onClick={bulkAssign} disabled={busy || !bulkMentor || !bulkReason.trim()}>{busy ? 'Assigning...' : 'Assign'}</button>
        </div>
      )}

      {error && <div role="alert" className="mt-3 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">{error}</div>}

      {loading ? (
        <ListSkeleton rows={4} avatar={false} className="mt-3" />
      ) : rows.length === 0 ? (
        <div className="card mt-3 p-8 text-center text-sm text-muted">
          {view === 'inbox' ? 'Nothing needs your attention right now.' : 'No ideas match the current filters.'}
        </div>
      ) : (
        <div className="card mt-3 divide-y divide-line">
          {rows.map((r) => {
            const chip = waitingChip(r.waiting)
            return (
              <div key={r.id} className="flex items-center gap-3 p-3">
                <input
                  type="checkbox"
                  checked={sel.has(r.id)}
                  onChange={() => toggle(r.id)}
                  className="h-4 w-4 shrink-0 accent-accent"
                  aria-label={`Select ${r.title}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-muted">{ifnTag(r.ifn)}</span>
                    <span className="text-[11px] text-muted">G{r.gate}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${chip.tone}`}>{chip.label}</span>
                    {r.days_in_gate >= 14 && <span className="text-[10px] font-bold text-down">{r.days_in_gate}d stale</span>}
                  </div>
                  <div className="mt-0.5 truncate text-sm font-semibold text-ink">{r.title}</div>
                  {r.author_name && <div className="text-xs text-muted">{r.author_name}</div>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link to={`/pipeline/${r.id}`} className="btn-outline px-2.5 py-1 text-xs" target="_blank" rel="noopener">
                    Open
                  </Link>
                  <button onClick={() => deleteIdea(r)} className="px-2 py-1 text-xs text-faint hover:text-down">Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
// Admin creates a member account directly: the create-member Edge Function (service role)
// makes a confirmed auth user with an auto-generated password, sets the role, and emails
// the credentials via Resend. The member logs in and completes onboarding themselves.
function CreateMemberTab() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('student')
  const [memberType, setMemberType] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null) // { email, password, emailed }
  const [copied, setCopied] = useState(false)

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { }
  }

  async function createMember() {
    setError('')
    setResult(null)
    const addr = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(addr)) return setError('Enter a valid email address.')
    setBusy(true)
    const { data, error: e } = await supabase.functions.invoke('create-member', { body: { email: addr, role, member_type: memberType || null } })
    setBusy(false)
    if (e) {
      console.error(e)
      let msg = e.message
      try { msg = (await e.context?.json())?.error || msg } catch { }
      return setError(msg === 'Failed to send a request to the Edge Function' ? 'Could not reach the account service. Is the create-member function deployed?' : msg || GENERIC_ERR)
    }
    if (data?.error) return setError(data.error)
    setResult({ email: addr, password: data.password, emailed: !!data.emailed })
    setEmail('')
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="card p-4">
        <div className="text-sm font-bold">Add a member</div>
        <p className="mt-0.5 text-xs text-muted">Creates the account with a strong auto-generated password and emails the sign-in details. They finish their profile during onboarding on first login.</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-medium text-muted">Email</label>
            <input className="input" type="email" autoComplete="off" placeholder="jane@acme.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !busy && email.trim()) createMember() }} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Role</label>
            <select className="input w-auto py-2 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Member type</label>
            <select className="input w-auto py-2 text-sm" value={memberType} onChange={(e) => { const mt = e.target.value; setMemberType(mt); if (mt) setRole(typeToRole(mt)) }}>
              <option value="">None</option>
              {MEMBER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm" onClick={createMember} disabled={busy || !email.trim()}><UserPlus size={15} /> {busy ? 'Creating...' : 'Create & email'}</button>
        </div>
        <p className="mt-2 text-xs text-faint">The password is shown once here for your reference. Ask the member to change it from Settings after they sign in.</p>
      </div>

      {result && (
        <div className="card p-4">
          <div className="flex items-center gap-2">
            <Check size={16} className="text-success" />
            <div className="text-sm font-bold">Account created for {result.email}</div>
          </div>
          <p className="mt-1 text-xs text-muted">{result.emailed ? 'The sign-in details were emailed to them.' : 'The account was created, but the email could not be sent — share these credentials manually.'}</p>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-black/5 p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs text-muted">Email</div>
              <div className="truncate text-sm font-semibold">{result.email}</div>
              <div className="mt-1.5 truncate text-xs text-muted">Temporary password</div>
              <div className="truncate font-mono text-sm font-semibold">{result.password}</div>
            </div>
            <button className="shrink-0 rounded-lg border border-line p-2 text-muted hover:bg-black/5" onClick={() => copy(`Email: ${result.email}\nPassword: ${result.password}`)} aria-label="Copy credentials">{copied ? <Check size={15} className="text-success" /> : <Copy size={15} />}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// Admin reviews pending registration requests: view the certificate (signed URL), approve
// (create the account via review-registration + pick the permission role) or disapprove.
function RequestsTab({ requests, loading, reload }) {
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [approveFor, setApproveFor] = useState(null)
  const [result, setResult] = useState(null) // { email, password, emailed } shown once
  const [copied, setCopied] = useState(false)

  async function fnError(e) {
    let msg = e.message
    try { msg = (await e.context?.json())?.error || msg } catch { /* ignore */ }
    return msg || GENERIC_ERR
  }

  async function viewCert(path) {
    setError('')
    const { data, error: e } = await supabase.storage.from('registration-certs').createSignedUrl(path, 3600)
    if (e || !data?.signedUrl) { console.error(e); return setError('Could not open the certificate.') }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  async function disapprove(r) {
    const reason = window.prompt(`Disapprove ${r.name} (${r.email})?\n\nReason (internal/audited, optional):`)
    if (reason === null) return
    setBusyId(r.id); setError('')
    const { data, error: e } = await supabase.functions.invoke('review-registration', { body: { id: r.id, action: 'reject', reason } })
    setBusyId(null)
    if (e) { console.error(e); return setError(await fnError(e)) }
    if (data?.error) return setError(data.error)
    reload()
  }

  async function approve(r, role) {
    setBusyId(r.id); setError('')
    const { data, error: e } = await supabase.functions.invoke('review-registration', { body: { id: r.id, action: 'approve', role } })
    setBusyId(null)
    if (e) { console.error(e); return setError(await fnError(e)) }
    if (data?.error) return setError(data.error)
    setApproveFor(null)
    setResult({ email: r.email, password: data.password, emailed: !!data.emailed })
    reload()
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  const pending = requests.filter((r) => r.status === 'pending')

  return (
    <div className="mt-4 space-y-4">
      {error && <div role="alert" className="rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">{error}</div>}

      {result && (
        <div className="card p-4">
          <div className="flex items-center gap-2"><Check size={16} className="text-success" /><div className="text-sm font-bold">Account created for {result.email}</div></div>
          <p className="mt-1 text-xs text-muted">{result.emailed ? 'Login details were emailed to them.' : 'Account created, but the email could not be sent — share these manually.'}</p>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-black/5 p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs text-muted">Email</div>
              <div className="truncate text-sm font-semibold">{result.email}</div>
              <div className="mt-1.5 truncate text-xs text-muted">Temporary password</div>
              <div className="truncate font-mono text-sm font-semibold">{result.password}</div>
            </div>
            <button className="shrink-0 rounded-lg border border-line p-2 text-muted hover:bg-black/5" onClick={() => copy(`Email: ${result.email}\nPassword: ${result.password}`)} aria-label="Copy credentials">{copied ? <Check size={15} className="text-success" /> : <Copy size={15} />}</button>
          </div>
        </div>
      )}

      {loading ? (
        <ListSkeleton avatar={false} rows={3} className="mt-0" />
      ) : pending.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">No pending requests.</div>
      ) : (
        <div className="card divide-y divide-line">
          {pending.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 flex-1 break-words text-sm font-bold">{r.name}</span>
                <span className="shrink-0 text-xs text-faint">{timeAgo(r.created_at)}</span>
              </div>
              <div><span className="chip">{r.member_type}{r.other_text ? `: ${r.other_text}` : ''}</span></div>
              <div className="break-words text-xs text-muted">{r.email}{r.phone ? ` · ${r.phone}` : ''}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {r.cert_path
                  ? <button className="btn-outline inline-flex items-center gap-1.5 px-3 py-1.5 text-xs" onClick={() => viewCert(r.cert_path)}><ExternalLink size={13} /> View certificate</button>
                  : <span className="text-xs text-faint">No certificate</span>}
                <div className="ml-auto flex items-center gap-2">
                  <button className="btn px-3 py-1.5 text-xs border border-down/40 text-down hover:bg-down/10" disabled={busyId === r.id} onClick={() => disapprove(r)}>Disapprove</button>
                  <button className="btn-primary px-3 py-1.5 text-xs" disabled={busyId === r.id} onClick={() => setApproveFor(r)}>Approve</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {approveFor && <ApproveModal request={approveFor} busy={busyId === approveFor.id} onClose={() => setApproveFor(null)} onApprove={(role) => approve(approveFor, role)} />}
    </div>
  )
}

function ApproveModal({ request, busy, onClose, onApprove }) {
  const [role, setRole] = useState(typeToRole(request.member_type))
  return (
    <ModalShell onRequestClose={() => !busy && onClose()} labelledBy="approve-title">
      <h2 id="approve-title" className="text-lg font-bold">Approve {request.name}</h2>
      <p className="mt-0.5 text-xs text-muted">{request.email} · registering as {request.member_type}</p>
      <p className="mt-3 text-sm text-muted">Creates the account and emails a generated password plus the user guide. Choose the permission role:</p>
      <select className="input mt-3" value={role} onChange={(e) => setRole(e.target.value)}>
        {ROLES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
      </select>
      <p className="mt-1.5 text-xs text-faint">Their "{request.member_type}" label is kept separately. Most approvals are Student-level access.</p>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn-primary" onClick={() => onApprove(role)} disabled={busy}>{busy ? 'Approving...' : 'Approve & create'}</button>
      </div>
    </ModalShell>
  )
}

function AdminEditProfileModal({ member, onClose, onSaved }) {
  const { session } = useAuth()
  const isSelf = member.id === session?.user?.id
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.rpc('admin_get_profile', { p_user: member.id }).then(({ data, error: e }) => {
      if (e || !data?.[0]) { setError(GENERIC_ERR); setForm({}); return }
      const p = data[0]
      setForm({ name: p.name || '', phone: p.phone || '', bio: p.bio || '', startup: p.startup || '', region: p.region || '', sector: p.sector || '', domain: p.domain || '', linkedin: p.linkedin || '', incubation_interest: !!p.incubation_interest, member_type: p.member_type || '', role: member.role })
    })
  }, [member.id])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function save() {
    if (!form.name.trim()) return setError('Name is required.')
    setBusy(true)
    const { error: e } = await supabase.rpc('admin_update_profile', { p_user: member.id, p_name: form.name.trim(), p_phone: form.phone.trim() || null, p_bio: form.bio.trim() || null, p_startup: form.startup.trim() || null, p_region: form.region || null, p_sector: form.sector || null, p_domain: form.domain || null, p_linkedin: form.linkedin.trim() || null, p_incubation: form.incubation_interest, p_member_type: form.member_type || null })
    if (e) { console.error(e); setBusy(false); return setError('Could not save the profile.') }
    // Permission level is a separate, admin-only grant (never your own); apply it if changed.
    let savedRole = member.role
    if (!isSelf && form.role && form.role !== member.role) {
      const { error: re } = await supabase.rpc('admin_set_role', { p_user: member.id, p_role: form.role })
      if (re) { console.error(re); setBusy(false); return setError('Profile saved, but the permission level could not be changed.') }
      savedRole = form.role
    }
    onSaved({ name: form.name.trim(), startup: form.startup.trim(), role: savedRole, member_type: form.member_type || null })
  }

  return (
    <ModalShell onRequestClose={() => !busy && onClose()} labelledBy="admin-edit-title">
      <h2 id="admin-edit-title" className="text-lg font-bold">Edit profile</h2>
      <p className="mt-0.5 text-xs text-muted">{member.email}</p>
      {error && <div role="alert" className="mt-4 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">{error}</div>}
      {!form ? ( <div className="mt-6 flex items-center gap-2 text-sm text-muted"><Spinner /> Loading...</div> ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Full name"><input className="input" maxLength={80} value={form.name} onChange={set('name')} /></Field>
            <Field label="Phone"><input className="input" maxLength={20} value={form.phone} onChange={set('phone')} /></Field>
            <Field label="Startup"><input className="input" maxLength={80} value={form.startup} onChange={set('startup')} /></Field>
            <Field label="LinkedIn"><input className="input" maxLength={200} value={form.linkedin} onChange={set('linkedin')} placeholder="https://..." /></Field>
            <Field label="Region"><Combobox value={form.region} onChange={(v) => setForm({ ...form, region: v })} options={REGIONS} placeholder="Select or type a state" /></Field>
            <Field label="Sector"><Combobox value={form.sector} onChange={(v) => setForm({ ...form, sector: v })} options={SECTORS} placeholder="Search or type a sector" /></Field>
            <Field label="Domain"><Combobox value={form.domain} onChange={(v) => setForm({ ...form, domain: v })} options={DOMAINS} placeholder="Search or type a domain" /></Field>
            <Field label="Member type"><select className="input" value={form.member_type} onChange={(e) => { const mt = e.target.value; setForm({ ...form, member_type: mt, role: mt ? typeToRole(mt) : form.role }) }}><option value="">None</option>{MEMBER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
            <Field label="Permission level"><select className="input" value={form.role} onChange={set('role')} disabled={isSelf}>{ROLES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}</select>{isSelf && <span className="mt-1 block text-[11px] text-faint">You can't change your own access.</span>}</Field>
            <div className="sm:col-span-2"><Field label="About"><textarea className="input min-h-[70px] resize-y" maxLength={160} value={form.bio} onChange={set('bio')} /></Field></div>
            <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2"><input type="checkbox" checked={form.incubation_interest} onChange={(e) => setForm({ ...form, incubation_interest: e.target.checked })} />Interested in incubation</label>
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

function Field({ label, children }) { return ( <label className="block"><span className="mb-1 block text-xs font-medium text-muted">{label}</span>{children}</label> ) }

function ListSkeleton({ rows = 6, avatar = true, className = 'mt-4' }) {
  return (
    <div className={`card animate-pulse divide-y divide-line ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          {avatar && <div className="h-9 w-9 shrink-0 rounded-full bg-line" />}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 rounded bg-line" style={{ width: `${32 + (i % 3) * 14}%` }} />
            <div className="h-2.5 w-1/2 rounded bg-line" />
          </div>
          <div className="h-7 w-20 shrink-0 rounded-lg bg-line" />
        </div>
      ))}
    </div>
  )
}
