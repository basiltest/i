import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthProvider'
import PostCard from '../components/PostCard'
import Spinner from '../components/Spinner'
import { timeAgo } from '../lib/format'

export default function PostDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const uid = session?.user?.id

  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [updates, setUpdates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [commentBody, setCommentBody] = useState('')
  const [updateBody, setUpdateBody] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [d, c, s] = await Promise.all([
      supabase.rpc('post_detail', { p_id: id }),
      supabase.rpc('post_comments', { p_id: id }),
      supabase.rpc('post_subthreads', { p_id: id }),
    ])
    if (d.error) setError(d.error.message)
    setPost(d.data?.[0] || null)
    setComments(c.data || [])
    setUpdates(s.data || [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function addComment(e) {
    e.preventDefault()
    const body = commentBody.trim()
    if (!body) return
    setBusy(true)
    const { error: e2 } = await supabase.from('comments').insert({ post_id: id, author_id: uid, body })
    setBusy(false)
    if (e2) return setError(e2.message)
    setCommentBody('')
    const { data } = await supabase.rpc('post_comments', { p_id: id })
    setComments(data || [])
  }

  async function deleteComment(cid) {
    await supabase.from('comments').delete().eq('id', cid)
    setComments((prev) => prev.filter((c) => c.id !== cid))
  }

  async function addUpdate(e) {
    e.preventDefault()
    const body = updateBody.trim()
    if (!body) return
    setBusy(true)
    const { error: e2 } = await supabase.from('sub_threads').insert({ post_id: id, author_id: uid, body })
    setBusy(false)
    if (e2) return setError(e2.message)
    setUpdateBody('')
    const { data } = await supabase.rpc('post_subthreads', { p_id: id })
    setUpdates(data || [])
  }

  async function deleteUpdate(sid) {
    await supabase.from('sub_threads').delete().eq('id', sid)
    setUpdates((prev) => prev.filter((s) => s.id !== sid))
  }

  async function deletePost() {
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    const { error: e2 } = await supabase.from('posts').delete().eq('id', id)
    if (e2) return setError(e2.message)
    navigate('/', { replace: true })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={16} /> Back
      </button>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted"><Spinner /> Loading post...</div>
      ) : !post ? (
        <p className="text-sm text-down">{error || 'Post not found.'}</p>
      ) : (
        <>
          <PostCard post={post} />

          {post.is_mine && (
            <div className="mt-2 text-right">
              <button onClick={deletePost} className="text-sm font-semibold text-down hover:underline">Delete post</button>
            </div>
          )}

          {/* creator updates */}
          <section className="mt-6">
            <h3 className="mb-2 text-sm font-bold">Updates from the creator</h3>
            {post.is_mine && (
              <form onSubmit={addUpdate} className="mb-3 flex gap-2">
                <input
                  className="input" placeholder="Post an update..." maxLength={2000}
                  value={updateBody} onChange={(e) => setUpdateBody(e.target.value)}
                />
                <button className="btn-primary shrink-0" disabled={busy}>Add</button>
              </form>
            )}
            {updates.length === 0 ? (
              <p className="text-sm text-muted">No updates yet.</p>
            ) : (
              <ul className="space-y-2">
                {updates.map((u) => (
                  <li key={u.id} className="card p-3">
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <span className="font-semibold text-ink">{u.author_name || 'Anonymous Founder'}</span>
                      <span>· {timeAgo(u.created_at)}</span>
                      {u.is_mine && (
                        <button onClick={() => deleteUpdate(u.id)} className="ml-auto text-faint hover:text-down">delete</button>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{u.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* comments */}
          <section className="mt-6">
            <h3 className="mb-2 text-sm font-bold">Comments ({comments.length})</h3>
            <form onSubmit={addComment} className="mb-3 flex gap-2">
              <input
                className="input" placeholder="Add a comment..." maxLength={2000}
                value={commentBody} onChange={(e) => setCommentBody(e.target.value)}
              />
              <button className="btn-primary shrink-0" disabled={busy}>Comment</button>
            </form>
            {comments.length === 0 ? (
              <p className="text-sm text-muted">No comments yet.</p>
            ) : (
              <ul className="space-y-2">
                {comments.map((c) => (
                  <li key={c.id} className="card p-3">
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <span className="font-semibold text-ink">{c.author_name}</span>
                      <span>· {timeAgo(c.created_at)}</span>
                      {c.is_mine && (
                        <button onClick={() => deleteComment(c.id)} className="ml-auto text-faint hover:text-down">delete</button>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
