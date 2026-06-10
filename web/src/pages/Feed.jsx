import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PostCard from '../components/PostCard'
import PostCardSkeleton from '../components/PostCardSkeleton'
import CreatePostModal from '../components/CreatePostModal'

const PAGE = 20
const KINDS = [
  { k: 'all', label: 'All' },
  { k: 'idea', label: 'Ideas' },
  { k: 'problem', label: 'Problems' },
]

export default function Feed() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tagFilter = searchParams.get('tag') || ''

  const [sort, setSort] = useState('new')
  const [kind, setKind] = useState('all')
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [suggestions, setSuggestions] = useState([])

  const [posts, setPosts] = useState([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [notice, setNotice] = useState('')

  // debounce text search; ignore while the user is typing a #tag
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.startsWith('#') ? '' : q.trim()), 300)
    return () => clearTimeout(id)
  }, [q])

  // live supertag suggestions when typing "#"
  useEffect(() => {
    if (!q.startsWith('#')) { setSuggestions([]); return }
    const term = q.slice(1).toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (!term) { setSuggestions([]); return }
    let active = true
    supabase
      .from('tags')
      .select('name')
      .eq('approved', true)
      .ilike('name', `${term}%`)
      .limit(8)
      .then(({ data }) => { if (active) setSuggestions((data || []).map((t) => t.name)) })
    return () => { active = false }
  }, [q])

  const fetchPage = useCallback(
    async (off, replace) => {
      const { data, error: e } = await supabase.rpc('feed_posts', {
        p_kind: kind === 'all' ? null : kind,
        p_search: tagFilter ? null : debounced || null,
        p_tag: tagFilter || null,
        p_sort: sort,
        p_limit: PAGE,
        p_offset: off,
      })
      if (e) { setError(e.message); return 0 }
      setError('')
      const rows = data || []
      setPosts((prev) => (replace ? rows : [...prev, ...rows]))
      setHasMore(rows.length === PAGE)
      return rows.length
    },
    [kind, sort, tagFilter, debounced],
  )

  // reload from the top whenever filters/sort/search change
  useEffect(() => {
    setLoading(true)
    fetchPage(0, true).then((count) => {
      setOffset(count)
      setLoading(false)
    })
  }, [fetchPage])

  async function loadMore() {
    setLoadingMore(true)
    const count = await fetchPage(offset, false)
    setOffset((o) => o + count)
    setLoadingMore(false)
  }

  function pickTag(name) {
    setSearchParams({ tag: name })
    setQ('')
    setSuggestions([])
  }

  return (
    <div>
      {/* search + create */}
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <input
            className="input"
            placeholder="Search posts, or type # to filter by supertag"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {suggestions.length > 0 && (
            <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-line bg-card shadow-pop">
              {suggestions.map((name) => (
                <button
                  key={name}
                  onClick={() => pickTag(name)}
                  className="block w-full px-3 py-2 text-left text-sm font-semibold text-accent hover:bg-black/5"
                >
                  #{name}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="btn-primary shrink-0" onClick={() => setCreateOpen(true)}>Create post</button>
      </div>

      {/* sort + kind */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-line p-0.5">
          {[{ s: 'new', label: 'Newest' }, { s: 'top', label: 'Top' }].map((o) => (
            <button
              key={o.s}
              onClick={() => setSort(o.s)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                sort === o.s ? 'bg-accent-soft text-accent' : 'text-muted'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="ml-2 flex gap-2">
          {KINDS.map((f) => (
            <button
              key={f.k}
              onClick={() => setKind(f.k)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                kind === f.k ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-black/5'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* active tag filter */}
      {tagFilter && (
        <div className="mb-3">
          <span className="chip">
            #{tagFilter}
            <button onClick={() => setSearchParams({})} aria-label="Clear tag filter"><X size={12} /></button>
          </span>
        </div>
      )}

      {notice && (
        <div className="mb-4 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{notice}</div>
      )}

      {loading ? (
        <div className="space-y-4">
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
        </div>
      ) : error ? (
        <p className="text-sm text-down">{error}</p>
      ) : posts.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-semibold">No posts {tagFilter || debounced ? 'match' : 'yet'}.</p>
          <p className="mt-1 text-sm text-muted">Be the first to share an idea.</p>
          <button className="btn-primary mt-4" onClick={() => setCreateOpen(true)}>Create post</button>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
          {hasMore && (
            <div className="mt-4 text-center">
              <button className="btn-outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}

      <CreatePostModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(status) => {
          setCreateOpen(false)
          setNotice(status === 'draft' ? 'Saved as draft.' : 'Posted.')
          fetchPage(0, true).then((count) => setOffset(count))
          setTimeout(() => setNotice(''), 3000)
        }}
      />
    </div>
  )
}
