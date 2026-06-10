import { useCallback, useEffect, useState } from 'react'
import { Plus, Search, X, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthProvider'
import RoleBadge from '../components/RoleBadge'
import Spinner from '../components/Spinner'
import { timeAgo } from '../lib/format'

const GENERIC_ERR = 'Something went wrong. Please try again.'

export default function TeamAcquisition() {
  const { session, isAdmin } = useAuth()
  const uid = session?.user?.id

  const [posts, setPosts] = useState([])
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [postOpen, setPostOpen] = useState(false)
  const [editPost, setEditPost] = useState(null)
  const [applyTo, setApplyTo] = useState(null)
  const [applicantsFor, setApplicantsFor] = useState(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300)
    return () => clearTimeout(id)
  }, [q])

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: e } = await supabase.rpc('team_feed', { p_search: debounced || null })
    if (e) { console.error(e); setError(GENERIC_ERR) } else { setError(''); setPosts(data || []) }
    setLoading(false)
  }, [debounced])
  useEffect(() => { load() }, [load])

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(''), 3000) }

  async function deletePost(id, mine) {
    if (!window.confirm('Delete this role need?')) return
    const { error: e } = mine
      ? await supabase.from('team_posts').delete().eq('id', id)
      : await supabase.rpc('admin_delete_team_post', { p_id: id })
    if (e) { console.error(e); return setError(GENERIC_ERR) }
    setPosts((prev) => prev.filter((p) => p.id !== id))
  }

  async function withdraw(postId) {
    if (!window.confirm('Withdraw your application?')) return
    const { error: e } = await supabase
      .from('team_applications')
      .delete()
      .eq('team_post_id', postId)
      .eq('applicant_id', uid)
    if (e) { console.error(e); return setError(GENERIC_ERR) }
    flash('Application withdrawn.')
    load()
  }

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Team Acquisition</h1>
          <p className="mt-0.5 text-sm text-muted">Post role and talent needs. Co-founders, technical hires, designers, growth.</p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setPostOpen(true)}>
          <Plus size={16} /> Post a need
        </button>
      </div>

      <div className="relative mt-4">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input
          className="input pl-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search roles, skills, startups..."
        />
      </div>

      {notice && (
        <div className="mt-4 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{notice}</div>
      )}

      {loading ? (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TeamCardSkeleton />
          <TeamCardSkeleton />
          <TeamCardSkeleton />
          <TeamCardSkeleton />
        </div>
      ) : error ? (
        <div className="card mt-4 p-6 text-center">
          <p className="text-sm text-down">{GENERIC_ERR}</p>
          <button className="btn-outline mt-3" onClick={load}>Retry</button>
        </div>
      ) : posts.length === 0 ? (
        <div className="card mt-4 p-8 text-center">
          <p className="font-semibold">No role needs {debounced ? 'match this search' : 'yet'}.</p>
          {!debounced && <button className="btn-primary mt-4" onClick={() => setPostOpen(true)}>Post the first need</button>}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
          {posts.map((t) => (
            <div key={t.id} className="card flex flex-col p-4">
              <div className="mb-2 flex items-center gap-2">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                  {(t.author_name || '?').charAt(0).toUpperCase()}
                </div>
                <span className="truncate text-sm font-bold">{t.author_name}</span>
                {t.author_role && <RoleBadge role={t.author_role} />}
                <span className="ml-auto shrink-0 text-xs text-faint">{timeAgo(t.created_at)}</span>
              </div>

              <h3 className="break-words text-base font-extrabold">{t.title}</h3>
              {t.startup && <span className="mt-1 inline-flex w-fit chip">{t.startup}</span>}
              {t.description && <p className="mt-2 line-clamp-4 whitespace-pre-wrap break-words text-sm text-muted">{t.description}</p>}

              <dl className="mt-3 space-y-1.5 text-sm">
                {t.looking_for && <Row label="Looking for" value={t.looking_for} />}
                {t.commitment && <Row label="Commitment" value={t.commitment} />}
                {t.stage && <Row label="Stage" value={t.stage} />}
              </dl>

              {t.skills?.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">Skills required</div>
                  <div className="flex flex-wrap gap-1.5">
                    {t.skills.slice(0, 12).map((s) => (
                      <span key={s} className="rounded-full bg-page px-2.5 py-1 text-xs font-semibold text-ink ring-1 ring-line">{s}</span>
                    ))}
                    {t.skills.length > 12 && (
                      <span className="rounded-full px-2.5 py-1 text-xs font-semibold text-muted">+{t.skills.length - 12} more</span>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-center gap-2">
                {t.is_mine ? (
                  <>
                    <button className="btn-outline" onClick={() => setApplicantsFor(t)}>
                      Applicants ({Number(t.app_count)})
                    </button>
                    <button className="btn-outline" onClick={() => setEditPost(t)}>Edit</button>
                  </>
                ) : t.i_applied ? (
                  <button
                    onClick={() => withdraw(t.id)}
                    className="btn inline-flex items-center border border-down/40 px-4 py-2 text-sm text-down transition-colors hover:bg-down/10"
                  >
                    Withdraw application
                  </button>
                ) : (
                  <button className="btn-primary" onClick={() => setApplyTo(t)}>Apply</button>
                )}
                {isAdmin && !t.is_mine && (
                  <button className="btn-outline" onClick={() => setApplicantsFor(t)}>Applicants ({Number(t.app_count)})</button>
                )}
                {(t.is_mine || isAdmin) && (
                  <button
                    onClick={() => deletePost(t.id, t.is_mine)}
                    aria-label="Delete"
                    className="ml-auto rounded-full p-2 text-muted transition-colors hover:bg-black/5 hover:text-down"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {postOpen && (
        <PostNeedModal
          onClose={() => setPostOpen(false)}
          onSaved={() => { setPostOpen(false); flash('Role need posted.'); load() }}
        />
      )}
      {editPost && (
        <PostNeedModal
          edit={editPost}
          onClose={() => setEditPost(null)}
          onSaved={() => { setEditPost(null); flash('Role need updated.'); load() }}
        />
      )}
      {applyTo && (
        <ApplyModal
          post={applyTo}
          onClose={() => setApplyTo(null)}
          onSent={() => { setApplyTo(null); flash('Application sent.'); load() }}
        />
      )}
      {applicantsFor && (
        <ApplicantsModal post={applicantsFor} onClose={() => setApplicantsFor(null)} />
      )}
    </div>
  )
}

function TeamCardSkeleton() {
  return (
    <div className="card animate-pulse p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-line" />
        <div className="h-3 w-24 rounded bg-line" />
        <div className="ml-auto h-2.5 w-10 rounded bg-line" />
      </div>
      <div className="h-4 w-3/5 rounded bg-line" />
      <div className="mt-2 h-5 w-20 rounded-full bg-line" />
      <div className="mt-3 space-y-2">
        <div className="h-3 w-full rounded bg-line" />
        <div className="h-3 w-4/5 rounded bg-line" />
      </div>
      <div className="mt-4 flex gap-1.5">
        <div className="h-6 w-14 rounded-full bg-line" />
        <div className="h-6 w-16 rounded-full bg-line" />
        <div className="h-6 w-12 rounded-full bg-line" />
      </div>
      <div className="mt-4 h-9 w-24 rounded-full bg-line" />
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-[11px] font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="break-words font-semibold">{value}</dd>
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

function PostNeedModal({ edit, onClose, onSaved }) {
  const { session } = useAuth()
  const [f, setF] = useState({
    title: edit?.title || '',
    startup: edit?.startup || '',
    description: edit?.description || '',
    looking_for: edit?.looking_for || '',
    commitment: edit?.commitment || '',
    stage: edit?.stage || 'Idea',
  })
  const [skills, setSkills] = useState(edit?.skills || [])
  const [skillInput, setSkillInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const valid = f.title.trim() && f.looking_for.trim() && f.description.trim()

  function addSkill() {
    const s = skillInput.trim()
    if (s && !skills.includes(s) && skills.length < 20) setSkills([...skills, s])
    setSkillInput('')
  }

  async function submit() {
    if (!valid) return setError('Title, description and "looking for" are required.')
    setBusy(true)
    const payload = {
      title: f.title.trim(),
      startup: f.startup.trim(),
      description: f.description.trim(),
      looking_for: f.looking_for.trim(),
      commitment: f.commitment.trim(),
      stage: f.stage.trim(),
      skills,
    }
    const { error: e } = edit
      ? await supabase.from('team_posts').update(payload).eq('id', edit.id)
      : await supabase.from('team_posts').insert({ ...payload, author_id: session.user.id })
    setBusy(false)
    if (e) { console.error(e); return setError(GENERIC_ERR) }
    onSaved()
  }

  return (
    <Shell title={edit ? 'Edit role need' : 'Post a role need'} onClose={() => !busy && onClose()}>
      {error && <div className="mt-4 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">{error}</div>}
      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <L label="Role title *"><input className="input" maxLength={200} value={f.title} onChange={set('title')} placeholder="Full-Stack Developer" /></L>
          <L label="Startup"><input className="input" maxLength={200} value={f.startup} onChange={set('startup')} placeholder="FarmSense" /></L>
        </div>
        <L label="Description *"><textarea className="input min-h-[70px] resize-y" maxLength={1200} value={f.description} onChange={set('description')} placeholder="What you need and why" /></L>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <L label="Looking for *"><input className="input" maxLength={200} value={f.looking_for} onChange={set('looking_for')} placeholder="Co-founder" /></L>
          <L label="Commitment"><input className="input" maxLength={120} value={f.commitment} onChange={set('commitment')} placeholder="Part-time" /></L>
          <L label="Stage">
            <select className="input" value={f.stage} onChange={set('stage')}>
              <option>Idea</option><option>Prototype</option><option>Revenue</option>
            </select>
          </L>
        </div>
        <L label="Skills required">
          {skills.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <span key={s} className="chip">{s}
                  <button type="button" onClick={() => setSkills(skills.filter((x) => x !== s))} aria-label={`Remove ${s}`}><X size={12} /></button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input className="input" maxLength={60} value={skillInput} onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }} placeholder="Add a skill, press Enter" />
            <button className="btn-outline shrink-0 px-4" type="button" onClick={addSkill}>Add</button>
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

function ApplyModal({ post, onClose, onSent }) {
  const [msg, setMsg] = useState('')
  const [contact, setContact] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function send() {
    if (!msg.trim()) return setError('Write a short message before sending.')
    if (!contact.trim()) return setError('Add contact info so they can reach you.')
    setBusy(true)
    const { error: e } = await supabase.rpc('team_apply', {
      p_post: post.id,
      p_message: msg.trim(),
      p_contact: contact.trim(),
    })
    setBusy(false)
    if (e) { console.error(e); return setError(e.message === 'already applied' ? 'You already applied to this.' : GENERIC_ERR) }
    onSent()
  }

  return (
    <Shell title={`Apply: ${post.title}`} onClose={() => !busy && onClose()}>
      <p className="mt-3 text-sm text-muted">
        Applying to <span className="font-bold text-ink">{post.author_name}</span>
        {post.startup ? <> for <span className="font-bold text-ink">{post.startup}</span></> : null}. They will see your message and the contact info you share here. Your account email stays private.
      </p>
      {error && <div className="mt-3 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">{error}</div>}
      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">Message</span>
        <textarea
          className="input min-h-[100px] resize-y" maxLength={2000} value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Why you're a fit, links, availability..."
        />
      </label>
      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">Contact info *</span>
        <input
          className="input" maxLength={200} value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Email, phone, or @handle the poster can reach you on"
        />
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn-primary" onClick={send} disabled={busy || !msg.trim() || !contact.trim()}>
          {busy ? 'Sending...' : 'Send application'}
        </button>
      </div>
    </Shell>
  )
}

function ApplicantsModal({ post, onClose }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.rpc('team_applicants', { p_post: post.id }).then(({ data, error: e }) => {
      if (e) { console.error(e); setError(GENERIC_ERR) } else setRows(data || [])
    })
  }, [post.id])

  return (
    <Shell title={`Applicants: ${post.title}`} onClose={onClose}>
      {error ? (
        <p className="mt-4 text-sm text-down">{GENERIC_ERR}</p>
      ) : rows === null ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted"><Spinner /> Loading...</div>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No applications yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-lg border border-line p-3">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                  {(r.applicant_name || '?').charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-bold">{r.applicant_name}</span>
                {r.applicant_role && <RoleBadge role={r.applicant_role} />}
                <span className="ml-auto text-xs text-faint">{timeAgo(r.created_at)}</span>
              </div>
              {r.applicant_startup && <div className="mt-1 text-xs font-semibold text-muted">{r.applicant_startup}</div>}
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink">{r.message}</p>
              <div className="mt-2 break-words rounded-lg bg-page px-3 py-2 text-sm">
                <span className="text-xs font-bold uppercase tracking-wide text-muted">Contact</span>
                <div className="font-semibold text-ink">{r.contact || 'Not provided'}</div>
              </div>
              {r.applicant_linkedin && (
                <a href={r.applicant_linkedin} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-accent hover:underline">
                  View LinkedIn
                </a>
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

function L({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  )
}
