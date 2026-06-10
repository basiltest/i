import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PostCard from '../components/PostCard'
import PostCardSkeleton from '../components/PostCardSkeleton'
import CreatePostModal from '../components/CreatePostModal'
import Dropdown, { MenuItem } from '../components/Dropdown'

const PAGE = 20
const SORTS = [
  { s: 'hot', label: 'Hot' },
  { s: 'new', label: 'Newest' },
  { s: 'top', label: 'Top' },
]
const KINDS = [
  { k: 'all', label: 'All types' },
  { k: 'idea', label: 'Ideas' },
  { k: 'problem', label: 'Problems' },
]

const normTag = (s) => s.toLowerCase().replace(/[^a-z0-9-]/g, '')

// Split the search box into free text + committed #tags. The token currently being typed
// (last token with no trailing space) is "in progress": a #word there drives autocomplete but
// is not yet a filter; a plain word there still filters text live.
function parseQuery(q) {
  const trailing = /\s$/.test(q)
  const toks = q.trim().split(/\s+/).filter(Boolean)
  const inProgress = trailing ? '' : toks[toks.length - 1] || ''
  const committed = trailing ? toks : toks.slice(0, -1)
  const tags = []
  const words = []
  for (const tok of committed) {
    if (tok.startsWith('#')) {
      const n = normTag(tok.slice(1))
      if (n && !tags.includes(n)) tags.push(n)
    } else {
      words.push(tok)
    }
  }
  if (inProgress && !inProgress.startsWith('#')) words.push(inProgress)
  const typingTag = inProgress.startsWith('#')
  return { text: words.join(' '), tags, typingTag, tagToken: typingTag ? normTag(inProgress.slice(1)) : '' }
}

export default function Feed() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [sort, setSort] = useState('hot')
  const [kind, setKind] = useState('all')
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState({ text: '', tags: [] })

  const [availableTags, setAvailableTags] = useState([])

  const [posts, setPosts] = useState([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const [newestAt, setNewestAt] = useState(null)
  const [newCount, setNewCount] = useState(0)

  // tags that actually have posts (for # suggestions)
  useEffect(() => {
    supabase.rpc('feed_tags').then(({ data }) => setAvailableTags(data || []))
  }, [])

  // a trending click arrives as /?tag=name; seed the search box with #name, then clear the URL
  useEffect(() => {
    const t = searchParams.get('tag')
    if (!t) return
    const tok = `#${normTag(t)}`
    setQ((prev) => (prev.includes(tok) ? prev : `${prev ? prev.trim() + ' ' : ''}${tok} `))
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  // live view of the box (suggestions) + debounced view (the actual query)
  const live = parseQuery(q)
  useEffect(() => {
    const id = setTimeout(() => {
      const { text, tags } = parseQuery(q)
      setFilters({ text, tags })
    }, 300)
    return () => clearTimeout(id)
  }, [q])

  const suggestions = live.typingTag
    ? availableTags.filter((t) => t.name.startsWith(live.tagToken)).slice(0, 8)
    : []

  const tagsKey = filters.tags.join(',')
  const fetchPage = useCallback(
    async (off, replace) => {
      const { data, error: e } = await supabase.rpc('feed_posts', {
        p_kind: kind === 'all' ? null : kind,
        p_search: filters.text || null,
        p_tags: filters.tags.length ? filters.tags : null,
        p_sort: sort,
        p_limit: PAGE,
        p_offset: off,
      })
      if (e) { setError(e.message); return 0 }
      setError('')
      const rows = data || []
      setPosts((prev) => (replace ? rows : [...prev, ...rows]))
      setHasMore(rows.length === PAGE)
      if (replace) {
        setNewestAt(rows[0]?.created_at || new Date().toISOString())
        setNewCount(0)
      }
      return rows.length
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, sort, filters.text, tagsKey],
  )

  // reload from the top when filters/sort/search change
  useEffect(() => {
    setLoading(true)
    fetchPage(0, true).then((count) => {
      setOffset(count)
      setLoading(false)
    })
  }, [fetchPage])

  // poll for newer posts (banner, no auto-insert)
  useEffect(() => {
    if (!newestAt) return
    const id = setInterval(() => {
      supabase.rpc('posts_since', { p_since: newestAt }).then(({ data }) => {
        if (data != null) setNewCount(Number(data))
      })
    }, 30000)
    return () => clearInterval(id)
  }, [newestAt])

  async function loadMore() {
    setLoadingMore(true)
    const count = await fetchPage(offset, false)
    setOffset((o) => o + count)
    setLoadingMore(false)
  }

  function reload() {
    setLoading(true)
    fetchPage(0, true).then((count) => {
      setOffset(count)
      setLoading(false)
    })
  }

  // commit the in-progress #token (or a picked suggestion) as a tag in the box
  function pickTag(name) {
    setQ((prev) => {
      const trailing = /\s$/.test(prev)
      const toks = prev.trim().split(/\s+/).filter(Boolean)
      if (!trailing && toks.length) toks.pop() // drop the in-progress token
      const tok = `#${name}`
      if (!toks.includes(tok)) toks.push(tok)
      return toks.join(' ') + ' '
    })
  }

  function removeTag(name) {
    setQ((prev) =>
      prev
        .split(/\s+/)
        .filter(Boolean)
        .filter((tok) => !(tok.startsWith('#') && normTag(tok.slice(1)) === name))
        .join(' '),
    )
  }

  const hasFilter = filters.text || filters.tags.length > 0

  return (
    <div>
      {/* search + create */}
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <input
            className="input"
            placeholder="Search posts, add #supertags to filter"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && live.typingTag) {
                e.preventDefault()
                if (live.tagToken) pickTag(live.tagToken)
              }
            }}
          />
          {suggestions.length > 0 && (
            <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-line bg-card shadow-pop">
              {suggestions.map((t) => (
                <button
                  key={t.name}
                  onClick={() => pickTag(t.name)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-accent hover:bg-black/5"
                >
                  <span>#{t.name}</span>
                  <span className="text-xs text-muted">{Number(t.cnt)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="btn-primary shrink-0" onClick={() => setCreateOpen(true)}>Create post</button>
      </div>

      {/* controls: sort / type */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Dropdown label={SORTS.find((o) => o.s === sort).label}>
          {(close) =>
            SORTS.map((o) => (
              <MenuItem key={o.s} active={sort === o.s} onClick={() => { setSort(o.s); close() }}>
                {o.label}
              </MenuItem>
            ))
          }
        </Dropdown>

        <Dropdown label={KINDS.find((f) => f.k === kind).label}>
          {(close) =>
            KINDS.map((f) => (
              <MenuItem key={f.k} active={kind === f.k} onClick={() => { setKind(f.k); close() }}>
                {f.label}
              </MenuItem>
            ))
          }
        </Dropdown>
      </div>

      {/* active supertag filters */}
      {filters.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {filters.tags.map((t) => (
            <span key={t} className="chip">
              #{t}
              <button onClick={() => removeTag(t)} aria-label={`Remove ${t}`}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}

      {/* new posts banner */}
      {newCount > 0 && (
        <button
          onClick={reload}
          className="mb-4 w-full rounded-lg bg-accent-soft px-3 py-2 text-sm font-semibold text-accent hover:underline"
        >
          {newCount} new {newCount === 1 ? 'post' : 'posts'}, tap to refresh
        </button>
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
        <div className="card p-6 text-center">
          <p className="text-sm text-down">Could not load the feed.</p>
          <button className="btn-outline mt-3" onClick={reload}>Retry</button>
        </div>
      ) : posts.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-semibold">No posts {hasFilter ? 'match this filter' : 'yet'}.</p>
          {hasFilter ? (
            <button className="btn-outline mt-3" onClick={() => setQ('')}>Clear filter</button>
          ) : (
            <button className="btn-primary mt-4" onClick={() => setCreateOpen(true)}>Create post</button>
          )}
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
          reload()
          supabase.rpc('feed_tags').then(({ data }) => setAvailableTags(data || []))
          setTimeout(() => setNotice(''), 3000)
        }}
      />
    </div>
  )
}
