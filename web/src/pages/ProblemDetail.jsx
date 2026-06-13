import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarClock, MessageCircle, MoreHorizontal } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthProvider'
import RoleBadge from '../components/RoleBadge'
import Dropdown, { MenuItem } from '../components/Dropdown'
import ProblemModal from '../components/ProblemModal'
import { timeAgo } from '../lib/format'

const SSORTS = [
  { s: 'new', label: 'Newest' },
  { s: 'old', label: 'Oldest' },
]
const GENERIC_ERR = 'Something went wrong. Please try again.'

// kebab "..." menu with outside-click close; children is a render fn receiving close().
function Kebab({ children }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="More options"
        className="rounded-full p-1.5 text-muted transition-colors hover:bg-black/5"
      >
        <MoreHorizontal size={20} />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 min-w-[160px] rounded-xl border border-line bg-card p-1 shadow-pop">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export default function ProblemDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session, isAdmin, isMentor } = useAuth()
  const uid = session?.user?.id

  const [problem, setProblem] = useState(null)
  const [solutions, setSolutions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [actionError, setActionError] = useState('')
  const [body, setBody] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [ssort, setSsort] = useState('new')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const [d, s] = await Promise.all([
        supabase.rpc('problem_detail', { p_id: id }),
        supabase.rpc('problem_solutions_list', { p_problem: id }),
      ])
      if (d.error) throw d.error
      setProblem(d.data?.[0] || null)
      setSolutions(s.data || [])
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function refreshSolutions() {
    const { data } = await supabase.rpc('problem_solutions_list', { p_problem: id })
    setSolutions(data || [])
  }

  async function addSolution(e) {
    e.preventDefault()
    const text = body.trim()
    if (!text) return
    setBusy(true)
    const { error } = await supabase.rpc('problem_solve', { p_problem: id, p_body: text })
    setBusy(false)
    if (error) { console.error(error); return setActionError('Could not post your solution. Check your connection and try again.') }
    setActionError('')
    setBody('')
    setComposerOpen(false)
    refreshSolutions()
  }

  async function deleteSolution(sid, mine) {
    // own solutions delete via RLS; others (admin moderation) via the admin RPC
    const { error } = mine
      ? await supabase.from('problem_solutions').delete().eq('id', sid)
      : await supabase.rpc('admin_delete_solution', { p_id: sid })
    if (error) { console.error(error); return setActionError('Could not delete the solution. Try again.') }
    setSolutions((prev) => prev.filter((s) => s.id !== sid))
  }

  async function deleteProblem() {
    if (!window.confirm('Delete this problem? Its solutions go with it.')) return
    const { error } = problem.is_mine
      ? await supabase.from('problems').delete().eq('id', id)
      : await supabase.rpc('admin_delete_problem', { p_id: id })
    if (error) { console.error(error); return setActionError('Could not delete the problem. Try again.') }
    navigate('/problem-hub', { replace: true })
  }

  async function toggleClosed() {
    const { error } = await supabase.rpc('set_problem_closed', { p_id: id, p_closed: !problem.closed })
    if (error) { console.error(error); return setActionError('Could not update the problem. Try again.') }
    setProblem((p) => ({ ...p, closed: !p.closed }))
  }

  const sortedSolutions = [...solutions].sort((a, b) =>
    ssort === 'new'
      ? new Date(b.created_at) - new Date(a.created_at)
      : new Date(a.created_at) - new Date(b.created_at),
  )

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={16} /> Back
      </button>

      {loading ? (
        <ProblemDetailSkeleton />
      ) : loadError ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-muted">{GENERIC_ERR}</p>
          <button className="btn-outline mt-3" onClick={load}>Try again</button>
        </div>
      ) : !problem ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-muted">This problem does not exist or was removed.</p>
          <button className="btn-outline mt-3" onClick={() => navigate('/problem-hub')}>Back to Problem Hub</button>
        </div>
      ) : (
        <>
          {actionError && (
            <div role="alert" className="mb-4 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">{actionError}</div>
          )}

          {/* problem header */}
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent">
              {(problem.author_name || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-bold">{problem.author_name}</span>
                {problem.author_role && <RoleBadge role={problem.author_role} />}
              </div>
              <div className="text-xs text-muted">{timeAgo(problem.created_at)}</div>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {problem.closed && (
                <span className="rounded-md bg-down/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-down">Closed</span>
              )}
              {(problem.is_mine || isAdmin) && (
                <Kebab>
                  {(close) => (
                    <>
                      {problem.is_mine && (
                        <MenuItem onClick={() => { close(); setEditOpen(true) }}>Edit problem</MenuItem>
                      )}
                      <MenuItem onClick={() => { close(); toggleClosed() }}>
                        {problem.closed ? 'Reopen problem' : 'Close problem'}
                      </MenuItem>
                      <MenuItem onClick={() => { close(); deleteProblem() }}>
                        <span className="text-down">Delete problem</span>
                      </MenuItem>
                    </>
                  )}
                </Kebab>
              )}
            </div>
          </div>

          {/* title + body */}
          <h1 className="mt-3 break-words text-2xl font-extrabold leading-tight">{problem.title}</h1>
          {problem.deadline && (
            <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-muted">
              <CalendarClock size={15} />
              <span>Needed by {new Date(problem.deadline).toLocaleDateString()}</span>
            </div>
          )}
          <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink">{problem.description}</p>

          {problem.tags?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {problem.tags.map((t) => (
                <span key={t} className="chip">{t}</span>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-2 text-sm font-semibold text-muted">
              <MessageCircle size={18} /> {solutions.length}
            </span>
          </div>

          {/* solutions header + sort */}
          <div className="mb-3 mt-6 flex items-center justify-between">
            <h3 className="text-sm font-bold">{solutions.length} {solutions.length === 1 ? 'Solution' : 'Solutions'}</h3>
            {solutions.length > 1 && (
              <Dropdown label={`Sort: ${SSORTS.find((o) => o.s === ssort).label}`}>
                {(close) =>
                  SSORTS.map((o) => (
                    <MenuItem key={o.s} active={ssort === o.s} onClick={() => { setSsort(o.s); close() }}>
                      {o.label}
                    </MenuItem>
                  ))
                }
              </Dropdown>
            )}
          </div>

          {/* solution composer; hidden when the problem is closed */}
          {problem.closed ? (
            <p className="mb-4 rounded-lg bg-page px-3 py-2.5 text-sm text-muted">This problem is closed. New solutions are turned off.</p>
          ) : (
            <form onSubmit={addSolution} className="mb-4">
              <textarea
                className="input min-h-[44px] resize-y"
                placeholder="Propose a solution: your approach, why it fits, what it would take"
                maxLength={3000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onFocus={() => setComposerOpen(true)}
              />
              {(composerOpen || body) && (
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => { setBody(''); setComposerOpen(false) }}
                  >
                    Cancel
                  </button>
                  <button className="btn-primary" disabled={busy || !body.trim()}>
                    {busy ? 'Posting...' : 'Post solution'}
                  </button>
                </div>
              )}
            </form>
          )}

          {/* solutions list */}
          {solutions.length === 0 ? (
            <p className="py-2 text-sm text-muted">No solutions yet. Be the first.</p>
          ) : (
            <ul className="divide-y divide-line">
              {sortedSolutions.map((s) => {
                const mine = s.author_id === uid
                return (
                  <li key={s.id} className="flex gap-2.5 py-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                      {(s.author_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <span className="font-semibold text-ink">{s.author_name}</span>
                        {s.author_role && <RoleBadge role={s.author_role} />}
                        <span>· {timeAgo(s.created_at)}</span>
                        {(mine || isAdmin) && (
                          <button onClick={() => deleteSolution(s.id, mine)} className="ml-auto text-faint hover:text-down">delete</button>
                        )}
                      </div>
                      {s.title && <h4 className="mt-1 text-sm font-extrabold">{s.title}</h4>}
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{s.description}</p>
                      {s.course_context && (
                        <div className="mt-1.5 text-xs text-muted">
                          <span className="font-bold uppercase tracking-wide">Draws on:</span> {s.course_context}
                        </div>
                      )}
                      {s.reviewed_at ? (
                        <div className="mt-2 rounded-lg bg-page px-3 py-2 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="chip">Impact {s.impact}/10</span>
                            <span className="chip">Feasibility {s.feasibility}/10</span>
                            {s.reviewer_name && <span className="ml-auto text-xs text-faint">by {s.reviewer_name}</span>}
                          </div>
                          {s.review_note && <p className="mt-1.5 text-xs text-muted">{s.review_note}</p>}
                        </div>
                      ) : isMentor && !mine ? (
                        <ReviewForm solutionId={s.id} onReviewed={refreshSolutions} />
                      ) : (
                        <div className="mt-1.5 text-xs font-semibold text-muted">Awaiting mentor review</div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {editOpen && (
            <ProblemModal
              edit={problem}
              onClose={() => setEditOpen(false)}
              onSaved={() => { setEditOpen(false); load() }}
            />
          )}
        </>
      )}
    </div>
  )
}

function ReviewForm({ solutionId, onReviewed }) {
  const [impact, setImpact] = useState(5)
  const [feasibility, setFeasibility] = useState(5)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const scale = Array.from({ length: 10 }, (_, i) => i + 1)

  async function submit() {
    setBusy(true)
    setError('')
    const { error: e } = await supabase.rpc('review_solution', {
      p_solution: solutionId,
      p_impact: impact,
      p_feasibility: feasibility,
      p_note: note.trim() || null,
    })
    setBusy(false)
    if (e) { console.error(e); return setError('Could not save the score. Try again.') }
    onReviewed()
  }

  return (
    <div className="mt-2 rounded-lg bg-page px-3 py-2">
      {error && <div className="mb-2 text-xs text-down">{error}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
          Impact
          <select className="input w-auto px-2 py-1" value={impact} onChange={(e) => setImpact(Number(e.target.value))}>
            {scale.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
          Feasibility
          <select className="input w-auto px-2 py-1" value={feasibility} onChange={(e) => setFeasibility(Number(e.target.value))}>
            {scale.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button className="btn-outline ml-auto px-3 py-1 text-xs" onClick={submit} disabled={busy}>
          {busy ? 'Scoring...' : 'Score'}
        </button>
      </div>
      <input className="input mt-2" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Review note (optional)" />
    </div>
  )
}

function ProblemDetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-full bg-line" />
        <div className="h-3 w-28 rounded bg-line" />
      </div>
      <div className="mt-4 h-6 w-3/4 rounded bg-line" />
      <div className="mt-3 space-y-2">
        <div className="h-3 w-full rounded bg-line" />
        <div className="h-3 w-full rounded bg-line" />
        <div className="h-3 w-2/3 rounded bg-line" />
      </div>
      <div className="mt-6 h-10 w-full rounded-lg bg-line" />
    </div>
  )
}
