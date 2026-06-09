import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import PostCard from '../components/PostCard'
import CreatePostModal from '../components/CreatePostModal'

const FILTERS = [
  { k: 'all', label: 'All' },
  { k: 'idea', label: 'Ideas' },
  { k: 'problem', label: 'Problems' },
]

export default function Feed() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(async (kind) => {
    setLoading(true)
    setError('')
    const { data, error: e } = await supabase.rpc('feed_posts', {
      p_kind: kind === 'all' ? null : kind,
    })
    if (e) setError(e.message)
    else setPosts(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load(filter)
  }, [filter, load])

  const query = q.trim().toLowerCase()
  const shown = query
    ? posts.filter((p) =>
        [p.title, p.problem, p.startup, p.solution].some((v) => v && v.toLowerCase().includes(query)),
      )
    : posts

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <input className="input" placeholder="Search posts" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-primary shrink-0" onClick={() => setCreateOpen(true)}>Create post</button>
      </div>

      <div className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.k}
            onClick={() => setFilter(f.k)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
              filter === f.k ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-black/5'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : error ? (
        <p className="text-sm text-down">{error}</p>
      ) : shown.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-semibold">No posts yet.</p>
          <p className="mt-1 text-sm text-muted">Be the first to share an idea.</p>
          <button className="btn-primary mt-4" onClick={() => setCreateOpen(true)}>Create post</button>
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}

      <CreatePostModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false)
          load(filter)
        }}
      />
    </div>
  )
}
