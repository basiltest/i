import { NavLink } from 'react-router-dom'
import { Home, Lightbulb, Workflow, Users, Calendar, LayoutGrid } from 'lucide-react'

// Twitter-style left rail. Built sections are links; the rest are placeholders until built.
const ITEMS = [
  { to: '/', label: 'Feed', icon: Home, end: true },
  { label: 'Problem Hub', icon: Lightbulb, soon: true },
  { label: 'Idea Pipeline', icon: Workflow, soon: true },
  { label: 'Team Board', icon: Users, soon: true },
  { label: 'Calendar', icon: Calendar, soon: true },
  { label: 'Directory', icon: LayoutGrid, soon: true },
]

export default function SideNav({ onNavigate }) {
  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.map((it) => {
        const Ic = it.icon
        if (it.soon) {
          return (
            <span
              key={it.label}
              title="Coming soon"
              className="flex cursor-not-allowed items-center gap-3 rounded-full px-4 py-2.5 text-[15px] font-semibold text-faint"
            >
              <Ic size={20} />
              <span>{it.label}</span>
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wide">soon</span>
            </span>
          )
        }
        return (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-full px-4 py-2.5 text-[15px] font-semibold transition-colors ${
                isActive ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-black/5'
              }`
            }
          >
            <Ic size={20} />
            <span>{it.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
