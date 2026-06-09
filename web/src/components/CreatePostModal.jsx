import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'

const MAX_TAGS = 10

export default function CreatePostModal({ open, onClose, onCreated }) {
  const [kind, setKind] = useState('idea')
  const [title, setTitle] = useState('')
  const [startup, setStartup] = useState('')
  const [problem, setProblem] = useState('')
  const [solution, setSolution] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [tags, setTags] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  function reset() {
    setKind('idea'); setTitle(''); setStartup(''); setProblem(''); setSolution('')
    setAnonymous(false); setTags([]); setTagInput(''); setError('')
  }
  function close() {
    if (busy) return
    reset()
    onClose()
  }

  function addTag() {
    const t = tagInput.replace(/^#+/, '').toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (!t) return
    if (tags.includes(t)) { setTagInput(''); return }
    if (tags.length >= MAX_TAGS) { setError(`Max ${MAX_TAGS} tags.`); return }
    setTags([...tags, t])
    setTagInput('')
  }
  function onTagKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); addTag() }
  }

  async function save(status) {
    setError('')
    if (!title.trim()) return setError('Title is required.')
    if (!problem.trim()) return setError('Problem statement is required.')

    setBusy(true)
    try {
      const { error: rpcErr } = await supabase.rpc('create_post', {
        p_kind: kind,
        p_title: title.trim(),
        p_problem: problem.trim(),
        p_solution: kind === 'idea' ? solution.trim() : null,
        p_startup: startup.trim() || null,
        p_anonymous: anonymous,
        p_status: status,
        p_tags: tags,
      })
      if (rpcErr) {
        setError(rpcErr.message)
        return
      }
      reset()
      onCreated?.(status)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
      <form
        onSubmit={(e) => { e.preventDefault(); save('published') }}
        className="card relative z-10 my-8 w-full max-w-lg p-6 animate-pop-in"
      >
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
            className="input min-h-[80px] resize-y"
            placeholder={kind === 'idea' ? 'The problem you are solving' : 'Describe the problem'}
            maxLength={5000} value={problem} onChange={(e) => setProblem(e.target.value)}
          />
          {kind === 'idea' && (
            <textarea
              className="input min-h-[80px] resize-y" placeholder="Your solution"
              maxLength={5000} value={solution} onChange={(e) => setSolution(e.target.value)}
            />
          )}

          {/* supertags */}
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted">Supertags ({tags.length}/{MAX_TAGS})</div>
            {tags.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span key={t} className="chip">
                    #{t}
                    <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                className="input" placeholder="Type a tag, press Enter" maxLength={30}
                value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={onTagKey}
              />
              <button type="button" className="btn-outline shrink-0 px-4" onClick={addTag}>Add</button>
            </div>
            <p className="mt-1 text-xs text-faint">A brand-new tag is sent to Tag Requests for Super Admin approval.</p>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
            Post anonymously
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={close} disabled={busy}>Cancel</button>
          <button type="button" className="btn-outline" onClick={() => save('draft')} disabled={busy}>Save as draft</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Posting...' : 'Publish'}</button>
        </div>
      </form>
    </div>
  )
}
