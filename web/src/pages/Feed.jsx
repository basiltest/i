import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { X, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PostCard from '../components/PostCard'
import PostCardSkeleton from '../components/PostCardSkeleton'
import CreatePostModal from '../components/CreatePostModal'
import Dropdown, { MenuItem } from '../components/Dropdown'
import { timeAgo } from '../lib/format'

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

  // own drafts (RLS: only the author can read status='draft' rows)
  const [drafts, setDrafts] = useState([])
  const [draftsOpen, setDraftsOpen] = useState(false)
  const [editDraft, setEditDraft] = useState(null)

  const loadDrafts = useCallback(async () => {
    const { data } = await supabase
      .from('posts')
      .select('id, kind, title, problem, solution, startup, created_at, post_tags(tags(name))')
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
    setDrafts(data || [])
  }, [])
  useEffect(() => { loadDrafts() }, [loadDrafts])

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
      if (e) { console.error('feed_posts failed:', e); setError(e.message); return 0 }
      setError('')
      const rows = data || []
      setPosts((prev) => (replace ? rows : [...prev, ...rows]))
      setHasMore(rows.length === PAGE)
      if (replace) {
        // baseline = newest post actually shown (rows[0] is not newest under Hot/Top sort)
        const newest = rows.reduce(
          (m, r) => (r.created_at > m ? r.created_at : m),
          rows[0]?.created_at || new Date().toISOString(),
        )
        setNewestAt(newest)
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

  async function publishDraft(id) {
    const { error: e } = await supabase.rpc('publish_post', { p_id: id })
    if (e) { console.error('publish_post failed:', e); return }
    await loadDrafts()
    reload()
    setNotice('Posted.')
    setTimeout(() => setNotice(''), 3000)
  }

  async function deleteDraft(id) {
    if (!window.confirm('Delete this draft?')) return
    const { error: e } = await supabase.from('posts').delete().eq('id', id)
    if (e) { console.error(e); return }
    loadDrafts()
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

        {drafts.length > 0 && (
          <button
            onClick={() => setDraftsOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
              draftsOpen ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink hover:bg-black/5'
            }`}
          >
            <FileText size={15} /> Drafts ({drafts.length})
          </button>
        )}
      </div>

      {/* drafts panel */}
      {draftsOpen && drafts.length > 0 && (
        <div className="mb-4 space-y-2">
          {drafts.map((d) => (
            <div key={d.id} className="card flex flex-wrap items-center gap-2 p-4">
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  d.kind === 'problem' ? 'bg-warn/20 text-[#8a6d00]' : 'bg-accent-soft text-accent'
                }`}
              >
                {d.kind === 'problem' ? 'Problem' : 'Idea'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="break-words text-sm font-bold">{d.title}</div>
                <div className="text-xs text-muted">Saved {timeAgo(d.created_at)}</div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button className="btn-outline px-3 py-1.5 text-xs" onClick={() => setEditDraft(d)}>Edit</button>
                <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => publishDraft(d.id)}>Publish</button>
                <button
                  className="btn-ghost px-3 py-1.5 text-xs text-down"
                  onClick={() => deleteDraft(d.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
          loadDrafts()
          supabase.rpc('feed_tags').then(({ data }) => setAvailableTags(data || []))
          setTimeout(() => setNotice(''), 3000)
        }}
      />

      {/* edit a draft (reuses the create modal in edit mode) */}
      <CreatePostModal
        open={!!editDraft}
        editPost={editDraft && {
          id: editDraft.id,
          kind: editDraft.kind,
          title: editDraft.title,
          problem: editDraft.problem,
          solution: editDraft.solution,
          startup: editDraft.startup,
          tags: editDraft.post_tags?.map((pt) => pt.tags?.name).filter(Boolean) || [],
        }}
        onClose={() => setEditDraft(null)}
        onUpdated={() => { setEditDraft(null); loadDrafts() }}
      />
    </div>
  )
}
