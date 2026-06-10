// Idea Pipeline constants shared by the Pipeline, Mentor Review, and Admin surfaces.
// Gate semantics + submission templates mirror db/pipeline.sql (the server re-validates).

export const GATES = [
  { g: 1, label: 'Idea Submitted', desc: 'Your application is in the mentor queue.' },
  { g: 2, label: 'Mentor Assigned', desc: 'An admin assigned a mentor; waiting for them to accept.' },
  { g: 3, label: 'Mentor Picked Up', desc: 'Mentor engaged. Complete the full dossier (details + files).' },
  { g: 4, label: 'Review Completed', desc: 'Dossier approved on the rubric. Submit your beta plan.' },
  { g: 5, label: 'Beta Prototyping', desc: 'Build. Advancing needs evidence (prototype link or files), or a mentor bypass when the prototype needs funding.' },
  { g: 6, label: 'Incubation', desc: 'Confirmed for incubation. Work continues via actions and the thread.' },
]

export const gateLabel = (g) => GATES.find((x) => x.g === g)?.label || `Gate ${g}`

// Whose turn is it (server-derived); label + tone for chips.
export const WAITING = {
  student: { label: 'Your move', tone: 'bg-accent-soft text-accent' },
  mentor: { label: 'With mentor', tone: 'bg-success/15 text-success' },
  'mentor-pool': { label: 'In mentor queue', tone: 'bg-line text-muted' },
  admin: { label: 'Needs admin', tone: 'bg-down/15 text-down' },
  none: { label: 'Done', tone: 'bg-line text-muted' },
}
export const waitingChip = (w) => WAITING[w] || WAITING.none

export const STATES = {
  active: { label: 'Active', tone: 'bg-success/15 text-success' },
  refine: { label: 'Refine & retry', tone: 'bg-accent-soft text-accent' },
  rejected: { label: 'Rejected', tone: 'bg-down/15 text-down' },
}

export const LEVELS = ['High', 'Medium', 'Low']

// Mentor rubric (7 criteria, scored 1-5). Keys match review_gate's server check.
export const RUBRIC = [
  { k: 'clarity', label: 'Clarity' },
  { k: 'feasibility', label: 'Feasibility' },
  { k: 'market_potential', label: 'Market potential' },
  { k: 'innovation', label: 'Innovation' },
  { k: 'technical', label: 'Technical' },
  { k: 'scalability', label: 'Scalability' },
  { k: 'ps_fit', label: 'Problem-solution fit' },
]

// Notification copy for the bell.
export const NOTIF_TEXT = {
  mentor_assigned: 'Mentor assigned',
  mentor_unassigned: 'Mentor unassigned',
  mentor_picked: 'A mentor picked up the idea',
  mentor_accepted: 'Mentor accepted the assignment',
  gate_submitted: 'New gate submission to review',
  review_approved: 'Gate approved',
  revision_requested: 'Revision requested',
  idea_rejected: 'Idea rejected',
  idea_refine: 'Sent back to refine & retry',
  gate_moved: 'Gate moved by an admin',
  action_created: 'New action item for you',
  action_done: 'An action item was completed',
  message_received: 'New message on an idea',
  application_withdrawn: 'An application was withdrawn',
  pipeline_stale: 'No pipeline movement in a while',
}

export const ifnTag = (n) => `IFN-${n}`
