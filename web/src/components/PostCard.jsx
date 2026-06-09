import RoleBadge from './RoleBadge'
import { timeAgo } from '../lib/format'

// One feed post. Votes, comments, and tags arrive in later slices.
export default function PostCard({ post }) {
  const anon = !post.author_name
  return (
    <article className="card p-5">
      <header className="flex items-center gap-2">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent">
          {anon ? '?' : post.author_name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-bold">
              {anon ? 'Anonymous Founder' : post.author_name}
            </span>
            {!anon && post.author_role && <RoleBadge role={post.author_role} />}
          </div>
          <div className="text-xs text-muted">{timeAgo(post.created_at)}</div>
        </div>
        <span
          className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            post.kind === 'problem' ? 'bg-warn/20 text-[#8a6d00]' : 'bg-accent-soft text-accent'
          }`}
        >
          {post.kind === 'problem' ? 'Problem' : 'Idea'}
        </span>
      </header>

      <h3 className="mt-3 break-words text-base font-bold">{post.title}</h3>
      {post.startup && <p className="break-words text-sm font-semibold text-muted">{post.startup}</p>}

      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink">{post.problem}</p>
      {post.kind === 'idea' && post.solution && (
        <div className="mt-3 rounded-lg bg-page p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Solution</div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{post.solution}</p>
        </div>
      )}

      {post.tags?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {post.tags.map((t) => (
            <span key={t} className="chip">#{t}</span>
          ))}
        </div>
      )}

      {post.edited && <div className="mt-2 text-xs text-faint">edited</div>}
    </article>
  )
}
