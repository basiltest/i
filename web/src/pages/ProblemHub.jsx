import { useCallback, useEffect, useState } from 'react'
import { Plus, Search, X, Trash2, ChevronRight, CalendarClock, ClipboardCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthProvider'
import RoleBadge from '../components/RoleBadge'
import Spinner from '../components/Spinner'
import { timeAgo } from '../lib/format'

const GENERIC_ERR = 'Something went wrong. Please try again.'
const MAX_TAGS = 6

export default function ProblemHub() {
  const { session, isAdmin, isMentor } = useAuth()
  const uid = session?.user?.id

  const [problems, setProblems] = useState([])
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [postOpen, setPostOpen] = useState(false)
  const [editProblem, setEditProblem] = useState(null)
  const [solveFor, setSolveFor] = useState(null)
  const [solutionsFor, setSolutionsFor] = useState(null)
  const [detail, setDetail] = useState(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300)
    return () => clearTimeout(id)
  }, [q])

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: e } = await supabase.rpc('problem_feed', { p_search: debounced || null })
    if (e) { console.error(e); setError(GENERIC_ERR) } else { setError(''); setProblems(data || []) }
    setLoading(false)
  }, [debounced])
  useEffect(() => { load() }, [load])

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(''), 3000) }

  async function deleteProblem(id, mine) {
    if (!window.confirm('Delete this problem? Its proposed solutions go with it.')) return
    const { error: e } = mine
      ? await supabase.from('problems').delete().eq('id', id)
      : await supabase.rpc('admin_delete_problem', { p_id: id })
    if (e) { console.error(e); return setError(GENERIC_ERR) }
    setProblems((prev) => prev.filter((p) => p.id !== id))
  }

  async function toggleClosed(problem) {
    const { error: e } = await supabase.rpc('set_problem_closed', { p_id: problem.id, p_closed: !problem.closed })
    if (e) { console.error(e); return setError(GENERIC_ERR) }
    flash(problem.closed ? 'Problem reopened.' : 'Problem closed.')
    load()
  }

  async function withdraw(problemId) {
    if (!window.confirm('Withdraw your solution?')) return
    const { error: e } = await supabase
      .from('problem_solutions')
      .delete()
      .eq('problem_id', problemId)
      .eq('author_id', uid)
    if (e) { console.error(e); return setError(GENERIC_ERR) }
    flash('Solution withdrawn.')
    load()
  }

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Problem Hub</h1>
          <p className="mt-0.5 text-sm text-muted">Real-world problems from the network. Propose a solution; mentors score impact and feasibility.</p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setPostOpen(true)}>
          <Plus size={16} /> Post a problem
        </button>
      </div>

      <div className="relative mt-4">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input
          className="input pl-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search problems, tags..."
        />
      </div>

      {notice && (
        <div className="mt-4 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{notice}</div>
      )}

      {loading ? (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ProblemCardSkeleton />
          <ProblemCardSkeleton />
          <ProblemCardSkeleton />
          <ProblemCardSkeleton />
        </div>
      ) : error ? (
        <div className="card mt-4 p-6 text-center">
          <p className="text-sm text-down">{GENERIC_ERR}</p>
          <button className="btn-outline mt-3" onClick={load}>Retry</button>
        </div>
      ) : problems.length === 0 ? (
        <div className="card mt-4 p-8 text-center">
          <p className="font-semibold">No problems {debounced ? 'match this search' : 'posted yet'}.</p>
          {!debounced && <button className="btn-primary mt-4" onClick={() => setPostOpen(true)}>Post the first problem</button>}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {problems.map((p) => (
            <button
              key={p.id}
              onClick={() => setDetail(p)}
              className={`card flex h-52 cursor-pointer flex-col overflow-hidden p-4 text-left transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-pop ${p.closed ? 'opacity-60' : ''}`}
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                  {(p.author_name || '?').charAt(0).toUpperCase()}
                </div>
                <span className="truncate text-sm font-bold">{p.author_name}</span>
                {p.author_role && <RoleBadge role={p.author_role} />}
                {p.closed && <span className="rounded-full bg-down/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-down">Closed</span>}
                <span className="ml-auto shrink-0 text-xs text-faint">{timeAgo(p.created_at)}</span>
              </div>

              <h3 className="truncate text-base font-extrabold">{p.title}</h3>
              {p.deadline && (
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                  <CalendarClock size={13} />
                  <span>Needed by {new Date(p.deadline).toLocaleDateString()}</span>
                </div>
              )}
              <p className="mt-2 line-clamp-2 break-words text-sm text-muted">{p.description}</p>

              {p.tags?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 overflow-hidden">
                  {p.tags.slice(0, 4).map((t) => (
                    <span key={t} className="rounded-full bg-page px-2 py-0.5 text-xs font-semibold text-ink ring-1 ring-line">{t}</span>
                  ))}
                  {p.tags.length > 4 && (
                    <span className="px-1 py-0.5 text-xs font-semibold text-muted">+{p.tags.length - 4}</span>
                  )}
                </div>
              )}

              <div className="mt-auto flex items-center gap-2 pt-3 text-xs font-semibold text-muted">
                {p.closed
                  ? <span className="text-down">Closed</span>
                  : p.is_mine
                    ? `${Number(p.solution_count)} ${Number(p.solution_count) === 1 ? 'solution' : 'solutions'}`
                    : p.i_solved
                      ? <span className="text-accent">Solution submitted</span>
                      : 'Tap to view and solve'}
                <ChevronRight size={16} className="ml-auto text-faint" />
              </div>
            </button>
          ))}
        </div>
      )}

      {detail && (
        <DetailModal
          problem={detail}
          isAdmin={isAdmin}
          onClose={() => setDetail(null)}
          onSolve={() => { setSolveFor(detail); setDetail(null) }}
          onWithdraw={() => { withdraw(detail.id); setDetail(null) }}
          onEdit={() => { setEditProblem(detail); setDetail(null) }}
          onSolutions={() => { setSolutionsFor(detail); setDetail(null) }}
          onToggleClosed={() => { toggleClosed(detail); setDetail(null) }}
          onDelete={() => { deleteProblem(detail.id, detail.is_mine); setDetail(null) }}
        />
      )}

      {postOpen && (
        <PostProblemModal
          onClose={() => setPostOpen(false)}
          onSaved={() => { setPostOpen(false); flash('Problem posted.'); load() }}
        />
      )}
      {editProblem && (
        <PostProblemModal
          edit={editProblem}
          onClose={() => setEditProblem(null)}
          onSaved={() => { setEditProblem(null); flash('Problem updated.'); load() }}
        />
      )}
      {solveFor && (
        <SolveModal
          problem={solveFor}
          onClose={() => setSolveFor(null)}
          onSent={() => { setSolveFor(null); flash('Solution submitted.'); load() }}
        />
      )}
      {solutionsFor && (
        <SolutionsModal problem={solutionsFor} isMentor={isMentor} uid={uid} onClose={() => setSolutionsFor(null)} />
      )}
    </div>
  )
}

function DetailModal({ problem, isAdmin, onClose, onSolve, onWithdraw, onEdit, onSolutions, onToggleClosed, onDelete }) {
  return (
    <Shell title={problem.title} onClose={onClose}>
      <div className="mt-3 flex items-center gap-2">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">
          {(problem.author_name || '?').charAt(0).toUpperCase()}
        </div>
        <span className="truncate text-sm font-bold">{problem.author_name}</span>
        {problem.author_role && <RoleBadge role={problem.author_role} />}
        {problem.closed && <span className="rounded-full bg-down/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-down">Closed</span>}
        <span className="ml-auto shrink-0 text-xs text-faint">{timeAgo(problem.created_at)}</span>
      </div>

      {problem.deadline && (
        <div className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-muted">
          <CalendarClock size={15} />
          <span>Needed by {new Date(problem.deadline).toLocaleDateString()}</span>
        </div>
      )}

      <p className="mt-3 max-h-60 overflow-y-auto whitespace-pre-wrap break-words text-sm text-ink">{problem.description}</p>

      {problem.tags?.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">Domain tags</div>
          <div className="flex flex-wrap gap-1.5">
            {problem.tags.map((t) => (
              <span key={t} className="rounded-full bg-page px-2.5 py-1 text-xs font-semibold text-ink ring-1 ring-line">{t}</span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <button className="btn-outline" onClick={onSolutions}>
          <ClipboardCheck size={15} /> Solutions ({Number(problem.solution_count)})
        </button>
        {problem.is_mine ? (
          <>
            <button className="btn-outline" onClick={onEdit}>Edit</button>
            <button className="btn-outline" onClick={onToggleClosed}>{problem.closed ? 'Reopen' : 'Close'}</button>
          </>
        ) : problem.i_solved ? (
          <button onClick={onWithdraw} className="btn inline-flex items-center border border-down/40 px-4 py-2 text-sm text-down transition-colors hover:bg-down/10">
            Withdraw solution
          </button>
        ) : problem.closed ? (
          <span className="text-sm font-semibold text-down">This problem is closed.</span>
        ) : (
          <button className="btn-primary" onClick={onSolve}>Propose a solution</button>
        )}
        {isAdmin && !problem.is_mine && (
          <button className="btn-outline" onClick={onToggleClosed}>{problem.closed ? 'Reopen' : 'Close'}</button>
        )}
        {(problem.is_mine || isAdmin) && (
          <button onClick={onDelete} aria-label="Delete" className="ml-auto rounded-full p-2 text-muted transition-colors hover:bg-black/5 hover:text-down">
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </Shell>
  )
}

function ProblemCardSkeleton() {
  return (
    <div className="card animate-pulse p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-line" />
        <div className="h-3 w-24 rounded bg-line" />
        <div className="ml-auto h-2.5 w-10 rounded bg-line" />
      </div>
      <div className="h-4 w-3/5 rounded bg-line" />
      <div className="mt-3 space-y-2">
        <div className="h-3 w-full rounded bg-line" />
        <div className="h-3 w-4/5 rounded bg-line" />
      </div>
      <div className="mt-4 flex gap-1.5">
        <div className="h-6 w-14 rounded-full bg-line" />
        <div className="h-6 w-16 rounded-full bg-line" />
        <div className="h-6 w-12 rounded-full bg-line" />
      </div>
    </div>
  )
}

function Shell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="card relative z-10 my-8 w-full max-w-lg p-6 animate-pop-in">
        <h2 className="text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function PostProblemModal({ edit, onClose, onSaved }) {
  const { session } = useAuth()
  const [f, setF] = useState({
    title: edit?.title || '',
    description: edit?.description || '',
    deadline: edit?.deadline || '',
  })
  const [tags, setTags] = useState(edit?.tags || [])
  const [tagInput, setTagInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const valid = f.title.trim() && f.description.trim()

  function addTag() {
    const t = tagInput.trim()
    if (!t) return
    if (tags.includes(t)) { setTagInput(''); return }
    if (tags.length >= MAX_TAGS) { setError(`Max ${MAX_TAGS} tags.`); return }
    setTags([...tags, t])
    setTagInput('')
  }

  async function submit() {
    if (!valid) return setError('Title and description are required.')
    setBusy(true)
    const payload = {
      title: f.title.trim(),
      description: f.description.trim(),
      deadline: f.deadline || null,
      tags,
    }
    const { error: e } = edit
      ? await supabase.from('problems').update(payload).eq('id', edit.id)
      : await supabase.from('problems').insert({ ...payload, author_id: session.user.id })
    setBusy(false)
    if (e) { console.error(e); return setError(GENERIC_ERR) }
    onSaved()
  }

  return (
    <Shell title={edit ? 'Edit problem' : 'Post a problem'} onClose={() => !busy && onClose()}>
      <p className="mt-2 text-sm text-muted">Describe a real problem you face. Members propose solutions; mentors score them.</p>
      {error && <div className="mt-3 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">{error}</div>}
      <div className="mt-4 space-y-3">
        <L label="Problem title *"><input className="input" maxLength={200} value={f.title} onChange={set('title')} placeholder="Farmers cannot verify soil quality cheaply" /></L>
        <L label="Description *"><textarea className="input min-h-[100px] resize-y" maxLength={3000} value={f.description} onChange={set('description')} placeholder="The context, who is affected, what a good solution looks like" /></L>
        <L label="Needed by"><input className="input" type="date" value={f.deadline} onChange={set('deadline')} /></L>
        <L label={`Domain tags (${tags.length}/${MAX_TAGS})`}>
          {tags.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="chip">{t}
                  <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}><X size={12} /></button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input className="input" maxLength={40} value={tagInput} onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }} placeholder="Add a tag, press Enter" />
            <button className="btn-outline shrink-0 px-4" type="button" onClick={addTag}>Add</button>
          </div>
        </L>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn-primary" disabled={busy || !valid} onClick={submit}>
          {busy ? 'Saving...' : edit ? 'Save changes' : 'Post'}
        </button>
      </div>
    </Shell>
  )
}

function SolveModal({ problem, onClose, onSent }) {
  const [f, setF] = useState({ title: '', description: '', course: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const valid = f.title.trim() && f.description.trim()

  async function send() {
    if (!valid) return setError('Title and description are required.')
    setBusy(true)
    const { error: e } = await supabase.rpc('problem_solve', {
      p_problem: problem.id,
      p_title: f.title.trim(),
      p_description: f.description.trim(),
      p_course: f.course.trim(),
    })
    setBusy(false)
    if (e) { console.error(e); return setError(e.message === 'already proposed' ? 'You already proposed a solution to this.' : GENERIC_ERR) }
    onSent()
  }

  return (
    <Shell title={`Solve: ${problem.title}`} onClose={() => !busy && onClose()}>
      <p className="mt-3 text-sm text-muted">
        Proposing to <span className="font-bold text-ink">{problem.author_name}</span>. They are notified, and mentors score your solution on impact and feasibility.
      </p>
      {error && <div className="mt-3 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">{error}</div>}
      <div className="mt-3 space-y-3">
        <L label="Solution title *"><input className="input" maxLength={200} value={f.title} onChange={set('title')} placeholder="Low-cost soil testing kit with shared lab access" /></L>
        <L label="How it works *"><textarea className="input min-h-[100px] resize-y" maxLength={3000} value={f.description} onChange={set('description')} placeholder="Your approach, why it fits, what it would take to build" /></L>
        <L label="Course / skills context"><input className="input" maxLength={200} value={f.course} onChange={set('course')} placeholder="Coursework or skills this draws on (optional)" /></L>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn-primary" onClick={send} disabled={busy || !valid}>
          {busy ? 'Sending...' : 'Submit solution'}
        </button>
      </div>
    </Shell>
  )
}

function SolutionsModal({ problem, isMentor, uid, onClose }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    supabase.rpc('problem_solutions_list', { p_problem: problem.id }).then(({ data, error: e }) => {
      if (e) { console.error(e); setError(GENERIC_ERR) } else setRows(data || [])
    })
  }, [problem.id])
  useEffect(() => { load() }, [load])

  return (
    <Shell title={`Solutions: ${problem.title}`} onClose={onClose}>
      {error ? (
        <p className="mt-4 text-sm text-down">{GENERIC_ERR}</p>
      ) : rows === null ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted"><Spinner /> Loading...</div>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No solutions proposed yet.</p>
      ) : (
        <ul className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {rows.map((r) => (
            <li key={r.id} className="rounded-lg border border-line p-3">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                  {(r.author_name || '?').charAt(0).toUpperCase()}
                </div>
                <span className="truncate text-sm font-bold">{r.author_name}</span>
                {r.author_role && <RoleBadge role={r.author_role} />}
                <span className="ml-auto shrink-0 text-xs text-faint">{timeAgo(r.created_at)}</span>
              </div>
              <h4 className="mt-2 text-sm font-extrabold">{r.title}</h4>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{r.description}</p>
              {r.course_context && (
                <div className="mt-2 text-xs text-muted">
                  <span className="font-bold uppercase tracking-wide">Draws on:</span> {r.course_context}
                </div>
              )}
              {r.reviewed_at ? (
                <div className="mt-2 rounded-lg bg-page px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip">Impact {r.impact}/10</span>
                    <span className="chip">Feasibility {r.feasibility}/10</span>
                    {r.reviewer_name && <span className="ml-auto text-xs text-faint">by {r.reviewer_name}</span>}
                  </div>
                  {r.review_note && <p className="mt-1.5 text-xs text-muted">{r.review_note}</p>}
                </div>
              ) : isMentor && r.author_id !== uid ? (
                <ReviewForm solutionId={r.id} onReviewed={load} />
              ) : (
                <div className="mt-2 text-xs font-semibold text-muted">Awaiting mentor review</div>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 flex justify-end">
        <button className="btn-ghost" onClick={onClose}>Close</button>
      </div>
    </Shell>
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
    if (e) { console.error(e); return setError(GENERIC_ERR) }
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

function L({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  )
}
