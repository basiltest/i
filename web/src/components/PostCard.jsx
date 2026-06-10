import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowBigUp, ArrowBigDown } from 'lucide-react'
import RoleBadge from './RoleBadge'
import { timeAgo } from '../lib/format'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthProvider'

export default function PostCard({ post }) {
  const { session } = useAuth()
  const uid = session?.user?.id
  const anon = !post.author_name
  const [score, setScore] = useState(Number(post.score) || 0)
  const [myVote, setMyVote] = useState(post.my_vote ?? 0)
  const [voting, setVoting] = useState(false)

  async function vote(v) {
    if (voting || !uid) return
    const prevScore = score
    const prevVote = myVote
    const nextVote = myVote === v ? 0 : v // click same arrow again = remove vote
    setMyVote(nextVote)
    setScore(score + (nextVote - myVote))
    setVoting(true)
    try {
      if (nextVote === 0) {
        await supabase.from('post_votes').delete().eq('post_id', post.id).eq('user_id', uid)
      } else {
        await supabase.from('post_votes').upsert({ post_id: post.id, user_id: uid, value: nextVote })
      }
    } catch {
      setMyVote(prevVote)
      setScore(prevScore)
    } finally {
      setVoting(false)
    }
  }

  return (
    <article className="card p-5">
      <header className="flex items-center gap-2">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent">
          {anon ? '?' : post.author_name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-bold">{anon ? 'Anonymous Founder' : post.author_name}</span>
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

      <Link to={`/post/${post.id}`} className="mt-3 block break-words text-base font-bold hover:underline">
        {post.title}
      </Link>
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

      <footer className="mt-3 flex items-center gap-1">
        <button
          onClick={() => vote(1)}
          aria-label="Upvote"
          className={`rounded-full p-1.5 transition-colors hover:bg-black/5 ${myVote === 1 ? 'text-accent' : 'text-muted'}`}
        >
          <ArrowBigUp size={20} fill={myVote === 1 ? 'currentColor' : 'none'} />
        </button>
        <span
          className={`min-w-[2ch] text-center text-sm font-bold ${
            myVote > 0 ? 'text-accent' : myVote < 0 ? 'text-down' : 'text-ink'
          }`}
        >
          {score}
        </span>
        <button
          onClick={() => vote(-1)}
          aria-label="Downvote"
          className={`rounded-full p-1.5 transition-colors hover:bg-black/5 ${myVote === -1 ? 'text-down' : 'text-muted'}`}
        >
          <ArrowBigDown size={20} fill={myVote === -1 ? 'currentColor' : 'none'} />
        </button>
        {post.edited && <span className="ml-2 text-xs text-faint">edited</span>}
      </footer>
    </article>
  )
}
