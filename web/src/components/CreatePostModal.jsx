import { useEffect, useState } from 'react'
import { X, FileText, ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { timeAgo } from '../lib/format'

const MAX_TAGS = 10

export default function CreatePostModal({ open, onClose, onCreated, onUpdated, editPost }) {
  const isEdit = !!editPost
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

  // drafts live inside the create flow (like Reddit's composer / Instagram's gallery)
  const [drafts, setDrafts] = useState([])
  const [view, setView] = useState('form') // 'form' | 'drafts'
  const [draft, setDraft] = useState(null) // the loaded draft being edited

  async function fetchDrafts() {
    const { data } = await supabase
      .from('posts')
      .select('id, kind, title, problem, solution, startup, created_at, post_tags(tags(name))')
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
    setDrafts(data || [])
  }

  // prefill on open (edit) or reset (create); creating also loads your drafts
  useEffect(() => {
    if (!open) return
    setDraft(null)
    setView('form')
    if (editPost) {
      setKind(editPost.kind || 'idea')
      setTitle(editPost.title || '')
      setStartup(editPost.startup || '')
      setProblem(editPost.problem || '')
      setSolution(editPost.solution || '')
      setTags(editPost.tags || [])
    } else {
      setKind('idea'); setTitle(''); setStartup(''); setProblem(''); setSolution('')
      setAnonymous(false); setTags([])
      fetchDrafts()
    }
    setTagInput(''); setError('')
  }, [open, editPost])

  if (!open) return null

  function close() {
    if (busy) return
    onClose()
  }

  function loadDraft(d) {
    setKind(d.kind || 'idea')
    setTitle(d.title || '')
    setStartup(d.startup || '')
    setProblem(d.problem || '')
    setSolution(d.solution || '')
    setTags(d.post_tags?.map((pt) => pt.tags?.name).filter(Boolean) || [])
    setDraft(d)
    setView('form')
    setError('')
  }

  async function deleteDraft(id) {
    if (!window.confirm('Delete this draft?')) return
    const { error: e } = await supabase.from('posts').delete().eq('id', id)
    if (e) { console.error(e); return setError('Something went wrong. Please try again.') }
    fetchDrafts()
  }

  function addTag() {
    const t = tagInput.replace(/^#+/, '').toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (!t) return
    if (t === 'success') {
      setError("#Success is a verified badge. Request it from your post's menu after publishing.")
      setTagInput('')
      return
    }
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
      if (isEdit || draft) {
        const id = isEdit ? editPost.id : draft.id
        const { error: rpcErr } = await supabase.rpc('update_post', {
          p_id: id,
          p_title: title.trim(),
          p_problem: problem.trim(),
          p_solution: kind === 'idea' ? solution.trim() : null,
          p_startup: startup.trim() || null,
          p_tags: tags,
        })
        if (rpcErr) { console.error(rpcErr); setError('Something went wrong. Please try again.'); return }
        if (isEdit) { onUpdated?.(); return }
        // loaded draft: optionally publish after saving the edits
        if (status === 'published') {
          const { error: pubErr } = await supabase.rpc('publish_post', { p_id: id })
          if (pubErr) { console.error(pubErr); setError('Something went wrong. Please try again.'); return }
        }
        onCreated?.(status)
      } else {
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
        if (rpcErr) { console.error(rpcErr); setError('Something went wrong. Please try again.'); return }
        onCreated?.(status)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const kindLocked = isEdit || !!draft

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
      <form
        onSubmit={(e) => { e.preventDefault(); save('published') }}
        className="card relative z-10 my-8 w-full max-w-lg p-6 animate-pop-in"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            {view === 'drafts' && (
              <button type="button" onClick={() => setView('form')} aria-label="Back" className="rounded-full p-1 text-muted hover:bg-black/5">
                <ArrowLeft size={18} />
              </button>
            )}
            {isEdit ? 'Edit post' : view === 'drafts' ? 'Your drafts' : draft ? 'Edit draft' : 'Create post'}
          </h2>
          {!isEdit && view === 'form' && drafts.length > 0 && (
            <button
              type="button"
              onClick={() => setView('drafts')}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-black/5"
            >
              <FileText size={14} /> Drafts ({drafts.length})
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">{error}</div>
        )}

        {view === 'drafts' ? (
          <>
            <ul className="mt-4 divide-y divide-line">
              {drafts.map((d) => (
                <li key={d.id} className="flex items-center gap-2 py-2.5">
                  <button type="button" onClick={() => loadDraft(d)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        d.kind === 'problem' ? 'bg-warn/20 text-[#8a6d00]' : 'bg-accent-soft text-accent'
                      }`}
                    >
                      {d.kind === 'problem' ? 'Problem' : 'Idea'}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{d.title}</span>
                      <span className="block text-xs text-muted">Saved {timeAgo(d.created_at)}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteDraft(d.id)}
                    aria-label="Delete draft"
                    className="shrink-0 rounded-full p-1.5 text-faint transition-colors hover:bg-black/5 hover:text-down"
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
            {drafts.length === 0 && <p className="mt-4 text-sm text-muted">No drafts left.</p>}
            <div className="mt-5 flex justify-end">
              <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-4 inline-flex rounded-full border border-line p-0.5">
              {['idea', 'problem'].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => !kindLocked && setKind(k)}
                  disabled={kindLocked}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                    kind === k ? 'bg-accent-soft text-accent' : 'text-muted'
                  } ${kindLocked ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  {k === 'idea' ? 'Idea' : 'Problem'}
                </button>
              ))}
            </div>

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
              </div>

              {!kindLocked && (
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
                  Post anonymously
                </label>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={close} disabled={busy}>Cancel</button>
              {isEdit ? (
                <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save changes'}</button>
              ) : (
                <>
                  <button type="button" className="btn-outline" onClick={() => save('draft')} disabled={busy}>
                    {draft ? 'Save draft' : 'Save as draft'}
                  </button>
                  <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Posting...' : 'Publish'}</button>
                </>
              )}
            </div>
          </>
        )}
      </form>
    </div>
  )
}
