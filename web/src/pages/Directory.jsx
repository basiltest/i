import { useCallback, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { REGIONS, SECTORS, DOMAINS } from '../lib/options'
import RoleBadge from '../components/RoleBadge'
import Dropdown, { MenuItem } from '../components/Dropdown'

const GENERIC_ERR = 'Something went wrong. Please try again.'
const ROLES = [
  { v: '', label: 'All roles' },
  { v: 'student', label: 'Students' },
  { v: 'mentor', label: 'Mentors' },
  { v: 'admin', label: 'Admins' },
]

// dropdown that takes a list of plain string options plus an "all" entry
function FilterDropdown({ label, value, options, onChange }) {
  const current = value || label
  return (
    <Dropdown label={current} width="w-52">
      {(close) => (
        <>
          <MenuItem active={!value} onClick={() => { onChange(''); close() }}>{label}</MenuItem>
          {options.map((o) => (
            <MenuItem key={o} active={value === o} onClick={() => { onChange(o); close() }}>{o}</MenuItem>
          ))}
        </>
      )}
    </Dropdown>
  )
}

export default function Directory() {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [role, setRole] = useState('')
  const [region, setRegion] = useState('')
  const [sector, setSector] = useState('')
  const [domain, setDomain] = useState('')
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300)
    return () => clearTimeout(id)
  }, [q])

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: e } = await supabase.rpc('directory', {
      p_search: debounced || null,
      p_region: region || null,
      p_sector: sector || null,
      p_domain: domain || null,
      p_role: role || null,
    })
    if (e) { console.error(e); setError(GENERIC_ERR) } else { setError(''); setMembers(data || []) }
    setLoading(false)
  }, [debounced, region, sector, domain, role])
  useEffect(() => { load() }, [load])

  const roleLabel = ROLES.find((r) => r.v === role).label

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-extrabold">Directory</h1>
      <p className="mt-0.5 text-sm text-muted">Find people across the network and reach out directly.</p>

      <div className="relative mt-4">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or startup..." />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Dropdown label={roleLabel} width="w-52">
          {(close) => ROLES.map((r) => (
            <MenuItem key={r.v} active={role === r.v} onClick={() => { setRole(r.v); close() }}>{r.label}</MenuItem>
          ))}
        </Dropdown>
        <FilterDropdown label="All regions" value={region} options={REGIONS} onChange={setRegion} />
        <FilterDropdown label="All sectors" value={sector} options={SECTORS} onChange={setSector} />
        <FilterDropdown label="All domains" value={domain} options={DOMAINS} onChange={setDomain} />
        {(role || region || sector || domain || debounced) && (
          <button
            className="text-sm font-semibold text-muted hover:text-ink"
            onClick={() => { setRole(''); setRegion(''); setSector(''); setDomain(''); setQ('') }}
          >
            Clear
          </button>
        )}
      </div>

      {error ? (
        <div className="card mt-4 p-6 text-center">
          <p className="text-sm text-down">{GENERIC_ERR}</p>
          <button className="btn-outline mt-3" onClick={load}>Retry</button>
        </div>
      ) : loading ? (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => <MemberSkeleton key={i} />)}
        </div>
      ) : members.length === 0 ? (
        <div className="card mt-4 p-8 text-center">
          <p className="font-semibold">No members match these filters.</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {members.map((m) => (
            <div key={m.id} className="card flex flex-col p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft text-base font-bold text-accent">
                  {(m.name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold">{m.name || 'Unnamed'}</span>
                    <RoleBadge role={m.role} />
                  </div>
                  {m.startup && <div className="truncate text-xs font-semibold text-muted">{m.startup}</div>}
                </div>
              </div>

              {m.bio && <p className="mt-2 line-clamp-3 break-words text-sm text-muted">{m.bio}</p>}

              {(m.region || m.sector || m.domain) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {m.region && <span className="chip">{m.region}</span>}
                  {m.sector && <span className="chip">{m.sector}</span>}
                  {m.domain && <span className="chip">{m.domain}</span>}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {m.linkedin && (
                  <a href={m.linkedin} target="_blank" rel="noreferrer" className="btn-outline px-3 py-1.5 text-xs">LinkedIn</a>
                )}
                {m.email && (
                  <a href={`mailto:${m.email}`} className="btn-outline px-3 py-1.5 text-xs">Email</a>
                )}
                {!m.linkedin && !m.email && <span className="px-1 py-1.5 text-xs text-faint">No public contact</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MemberSkeleton() {
  return (
    <div className="card animate-pulse p-4">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-line" />
        <div className="space-y-1.5">
          <div className="h-3 w-28 rounded bg-line" />
          <div className="h-2.5 w-20 rounded bg-line" />
        </div>
      </div>
      <div className="mt-3 flex gap-1.5">
        <div className="h-6 w-16 rounded-full bg-line" />
        <div className="h-6 w-16 rounded-full bg-line" />
      </div>
      <div className="mt-3 h-8 w-24 rounded-full bg-line" />
    </div>
  )
}
