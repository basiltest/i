import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthProvider'

export default function CreatePostModal({ open, onClose, onCreated }) {
  const { session } = useAuth()
  const [kind, setKind] = useState('idea')
  const [title, setTitle] = useState('')
  const [startup, setStartup] = useState('')
  const [problem, setProblem] = useState('')
  const [solution, setSolution] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  function reset() {
    setKind('idea'); setTitle(''); setStartup(''); setProblem(''); setSolution(''); setAnonymous(false); setError('')
  }
  function close() {
    if (busy) return
    reset()
    onClose()
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    const t = title.trim()
    const pr = problem.trim()
    if (!t) return setError('Title is required.')
    if (!pr) return setError('Problem statement is required.')

    setBusy(true)
    try {
      const { error: insErr } = await supabase.from('posts').insert({
        author_id: session.user.id,
        kind,
        title: t,
        problem: pr,
        solution: kind === 'idea' ? solution.trim() || null : null,
        startup: startup.trim() || null,
        anonymous,
        status: 'published',
      })
      if (insErr) {
        setError(insErr.message)
        return
      }
      reset()
      onCreated?.()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
      <form onSubmit={submit} className="card relative z-10 w-full max-w-lg p-6 animate-pop-in">
        <h2 className="text-lg font-bold">Create post</h2>

        <div className="mt-4 inline-flex rounded-full border border-line p-0.5">
          {['idea', 'problem'].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                kind === k ? 'bg-accent-soft text-accent' : 'text-muted'
              }`}
            >
              {k === 'idea' ? 'Idea' : 'Problem'}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">{error}</div>
        )}

        <div className="mt-4 space-y-3">
          <input className="input" placeholder="Title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="input" placeholder="Startup name (optional)" maxLength={100} value={startup} onChange={(e) => setStartup(e.target.value)} />
          <textarea
            className="input min-h-[90px] resize-y"
            placeholder={kind === 'idea' ? 'The problem you are solving' : 'Describe the problem'}
            maxLength={5000}
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
          />
          {kind === 'idea' && (
            <textarea
              className="input min-h-[90px] resize-y"
              placeholder="Your solution"
              maxLength={5000}
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
            />
          )}
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
            Post anonymously
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={close} disabled={busy}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Posting...' : 'Post'}</button>
        </div>
      </form>
    </div>
  )
}
