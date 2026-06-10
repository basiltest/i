// Post kinds shown across the feed, cards, detail, and the create modal.
export const KIND_LABEL = { idea: 'Idea', problem: 'Problem', discussion: 'Discussion' }

export const kindLabel = (k) => KIND_LABEL[k] || 'Post'

// chip styling per kind: idea = brand, problem = amber, discussion = neutral
export const kindChipClass = (k) =>
  k === 'problem'
    ? 'bg-warn/20 text-[#8a6d00]'
    : k === 'discussion'
      ? 'bg-line text-ink'
      : 'bg-accent-soft text-accent'
