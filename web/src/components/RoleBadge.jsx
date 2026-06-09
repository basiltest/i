const STYLES = {
  student: 'bg-accent-soft text-accent',
  mentor: 'bg-success/15 text-success',
  admin: 'bg-warn/25 text-[#8a6d00]',
}
const LABELS = { student: 'Student', mentor: 'Mentor', admin: 'Super Admin' }

export default function RoleBadge({ role }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STYLES[role] || STYLES.student}`}>
      {LABELS[role] || role}
    </span>
  )
}
