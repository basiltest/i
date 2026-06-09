import { TrendingUp, Calendar } from 'lucide-react'

// Feed-only right rail. Trending + events are placeholders until tags and the calendar exist.
export default function RightSidebar() {
  return (
    <div className="space-y-4">
      <section className="card p-5">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-accent" />
          <h3 className="font-bold">Trending Topics</h3>
        </div>
        <p className="mt-2 text-sm text-muted">No tags yet.</p>
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
