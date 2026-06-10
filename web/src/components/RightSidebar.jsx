import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, Calendar } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function RightSidebar() {
  const [tags, setTags] = useState([])

  useEffect(() => {
    let active = true
    supabase.rpc('trending_tags', { p_days: 7, p_limit: 6 }).then(({ data }) => {
      if (active) setTags(data || [])
    })
    return () => { active = false }
  }, [])

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-accent" />
          <h3 className="font-bold">Trending Topics</h3>
        </div>
        {tags.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No tags yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {tags.map((t) => (
              <li key={t.name}>
                <Link
                  to={`/?tag=${encodeURIComponent(t.name)}`}
                  className="flex items-center justify-between gap-2 hover:underline"
                >
                  <span className="truncate text-sm font-semibold text-accent">#{t.name}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {Number(t.cnt)} {Number(t.cnt) === 1 ? 'post' : 'posts'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-accent" />
          <h3 className="font-bold">Upcoming Events</h3>
        </div>
        <p className="mt-2 text-sm text-muted">Nothing scheduled.</p>
      </section>
    </div>
  )
}
