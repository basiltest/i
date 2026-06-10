import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, CalendarPlus, Download, MapPin, Clock } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthProvider'
import Spinner from '../components/Spinner'
import { EVENT_TYPES, typeClass, typeDot, googleCalUrl, downloadICS } from '../lib/calendar'

const GENERIC_ERR = 'Something went wrong. Please try again.'
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const dayKey = (d) => startOfDay(d).toDateString()
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1)
const fmtTime = (d) => new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export default function Calendar() {
  const { isAdmin } = useAuth()
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)
  const [formEvent, setFormEvent] = useState(undefined) // undefined = closed, null = new, obj = edit

  // 6-week grid starting on the Sunday on/before the 1st
  const gridStart = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const s = startOfDay(first)
    s.setDate(s.getDate() - s.getDay())
    return s
  }, [month])
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart); d.setDate(d.getDate() + i); return d
  }), [gridStart])

  const load = useCallback(async () => {
    setLoading(true)
    const end = new Date(gridStart); end.setDate(end.getDate() + 42)
    const { data, error: e } = await supabase
      .from('events')
      .select('*')
      .gte('starts_at', gridStart.toISOString())
      .lt('starts_at', end.toISOString())
      .order('starts_at')
    if (e) { console.error(e); setError(GENERIC_ERR) } else { setError(''); setEvents(data || []) }
    setLoading(false)
  }, [gridStart])
  useEffect(() => { load() }, [load])

  const byDay = useMemo(() => {
    const m = {}
    for (const ev of events) (m[dayKey(ev.starts_at)] ||= []).push(ev)
    return m
  }, [events])

  const todayKey = dayKey(new Date())

  async function deleteEvent(id) {
    if (!window.confirm('Delete this event?')) return
    const { error: e } = await supabase.rpc('admin_delete_event', { p_id: id })
    if (e) { console.error(e); return setError(GENERIC_ERR) }
    setDetail(null)
    load()
  }

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Calendar</h1>
          <p className="mt-0.5 text-sm text-muted">Workshops, mentorship, deadlines and hackathons.</p>
        </div>
        {isAdmin && (
          <button className="btn-primary shrink-0" onClick={() => setFormEvent(null)}>
            <Plus size={16} /> Add event
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month" className="rounded-full p-2 text-muted hover:bg-black/5"><ChevronLeft size={18} /></button>
        <h2 className="min-w-[10ch] text-center text-base font-bold">
          {month.toLocaleDateString([], { month: 'long', year: 'numeric' })}
        </h2>
        <button onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month" className="rounded-full p-2 text-muted hover:bg-black/5"><ChevronRight size={18} /></button>
        <button onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)) }} className="btn-outline ml-2 px-3 py-1.5 text-xs">Today</button>
        {loading && <Spinner size={16} />}
      </div>

      {error && <div className="mt-3 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">{error}</div>}

      <div className="mt-3 grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line">
        {DOW.map((d) => (
          <div key={d} className="bg-card px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-muted">{d}</div>
        ))}
        {days.map((d) => {
          const inMonth = d.getMonth() === month.getMonth()
          const isToday = dayKey(d) === todayKey
          const list = byDay[dayKey(d)] || []
          return (
            <div key={d.toISOString()} className={`min-h-[92px] bg-card p-1.5 ${inMonth ? '' : 'opacity-40'}`}>
              <div className={`mb-1 text-right text-xs font-semibold ${isToday ? 'text-accent' : 'text-muted'}`}>
                {isToday ? <span className="inline-grid h-5 w-5 place-items-center rounded-full bg-accent text-white">{d.getDate()}</span> : d.getDate()}
              </div>
              <div className="space-y-1">
                {list.slice(0, 3).map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => setDetail(ev)}
                    className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] font-semibold ${typeClass(ev.type)}`}
                    title={ev.title}
                  >
                    <span className="truncate">{ev.title}</span>
                  </button>
                ))}
                {list.length > 3 && <div className="px-1 text-[10px] font-semibold text-muted">+{list.length - 3} more</div>}
              </div>
            </div>
          )
        })}
      </div>

      {detail && (
        <EventDetailModal
          ev={detail}
          isAdmin={isAdmin}
          onClose={() => setDetail(null)}
          onEdit={() => { setFormEvent(detail); setDetail(null) }}
          onDelete={() => deleteEvent(detail.id)}
        />
      )}
      {formEvent !== undefined && (
        <EventFormModal
          ev={formEvent}
          onClose={() => setFormEvent(undefined)}
          onSaved={() => { setFormEvent(undefined); load() }}
        />
      )}
    </div>
  )
}

function EventDetailModal({ ev, isAdmin, onClose, onEdit, onDelete }) {
  const start = new Date(ev.starts_at)
  return (
    <Shell title={ev.title} onClose={onClose}>
      <span className={`mt-3 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${typeClass(ev.type)}`}>{ev.type}</span>

      <div className="mt-3 space-y-1.5 text-sm text-ink">
        <div className="flex items-center gap-2"><Clock size={15} className="text-muted" />
          {start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          {' · '}{fmtTime(ev.starts_at)}{ev.ends_at ? ` - ${fmtTime(ev.ends_at)}` : ''}
        </div>
        {ev.location && <div className="flex items-center gap-2"><MapPin size={15} className="text-muted" /> {ev.location}</div>}
      </div>

      {ev.description && <p className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm text-muted">{ev.description}</p>}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
        <a href={googleCalUrl(ev)} target="_blank" rel="noreferrer" className="btn-primary">
          <CalendarPlus size={16} /> Add to Google
        </a>
        <button className="btn-outline" onClick={() => downloadICS(ev)}>
          <Download size={16} /> Apple / .ics
        </button>
        {isAdmin && (
          <div className="ml-auto flex gap-2">
            <button className="btn-outline" onClick={onEdit}>Edit</button>
            <button className="btn inline-flex items-center border border-down/40 px-4 py-2 text-sm text-down hover:bg-down/10" onClick={onDelete}>Delete</button>
          </div>
        )}
      </div>
    </Shell>
  )
}

function EventFormModal({ ev, onClose, onSaved }) {
  const editing = !!ev
  const [f, setF] = useState({
    title: ev?.title || '',
    type: ev?.type || 'Workshop',
    location: ev?.location || '',
    description: ev?.description || '',
    starts: ev?.starts_at ? new Date(ev.starts_at) : null,
    ends: ev?.ends_at ? new Date(ev.ends_at) : null,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function save() {
    if (!f.title.trim()) return setError('Title is required.')
    if (!f.starts) return setError('Start time is required.')
    const startsIso = f.starts.toISOString()
    const endsIso = f.ends ? f.ends.toISOString() : null
    if (endsIso && endsIso < startsIso) return setError('End must be after start.')
    setBusy(true)
    const args = {
      p_title: f.title.trim(), p_description: f.description.trim(), p_location: f.location.trim(),
      p_type: f.type, p_starts_at: startsIso, p_ends_at: endsIso,
    }
    const { error: e } = editing
      ? await supabase.rpc('admin_update_event', { p_id: ev.id, ...args })
      : await supabase.rpc('admin_create_event', args)
    setBusy(false)
    if (e) { console.error(e); return setError(GENERIC_ERR) }
    onSaved()
  }

  return (
    <Shell title={editing ? 'Edit event' : 'Add event'} onClose={() => !busy && onClose()}>
      {error && <div className="mt-4 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">{error}</div>}
      <div className="mt-4 space-y-3">
        <L label="Title *"><input className="input" maxLength={200} value={f.title} onChange={set('title')} placeholder="Demo Day" /></L>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <L label="Type">
            <select className="input" value={f.type} onChange={set('type')}>
              {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </L>
          <L label="Location"><input className="input" maxLength={200} value={f.location} onChange={set('location')} placeholder="Auditorium / Zoom link" /></L>
          <L label="Starts *">
            <DatePicker
              selected={f.starts}
              onChange={(d) => setF({ ...f, starts: d })}
              showTimeSelect
              timeIntervals={15}
              dateFormat="dd/MM/yyyy h:mm aa"
              placeholderText="dd/mm/yyyy, time"
              className="input"
              wrapperClassName="w-full"
            />
          </L>
          <L label="Ends">
            <DatePicker
              selected={f.ends}
              onChange={(d) => setF({ ...f, ends: d })}
              showTimeSelect
              timeIntervals={15}
              dateFormat="dd/MM/yyyy h:mm aa"
              placeholderText="optional"
              minDate={f.starts}
              isClearable
              className="input"
              wrapperClassName="w-full"
            />
          </L>
        </div>
        <L label={`Description (${f.description.length}/500)`}><textarea className="input min-h-[80px] resize-y" maxLength={500} value={f.description} onChange={set('description')} /></L>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving...' : editing ? 'Save changes' : 'Add event'}</button>
      </div>
    </Shell>
  )
}

function Shell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="card relative z-10 my-8 w-full max-w-lg p-6 animate-pop-in">
        <h2 className="break-words text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function L({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  )
}
