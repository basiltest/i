import { useEffect, useState } from 'react'
import ModalShell from './ModalShell'
import { supabase } from '../lib/supabase'

// Send a member a message through the network. Neither address is shown: the recipient
// gets an email via the send-contact relay; if they reply, it reaches the sender.
export default function ContactModal({ member, onClose }) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => { setSubject(''); setBody(''); setError(''); setSent(false) }, [member?.id])

  if (!member) return null
  const firstName = member.name?.split(' ')[0] || 'there'

  async function send(e) {
    e.preventDefault()
    if (!body.trim()) return setError('Write a message first.')
    setBusy(true); setError('')
    const { data, error: e2 } = await supabase.functions.invoke('send-contact', {
      body: { to: member.id, subject: subject.trim() || null, body: body.trim() },
    })
    setBusy(false)
    if (e2) {
      let msg = e2.message
      try { msg = (await e2.context?.json())?.error || msg } catch { /* keep msg */ }
      return setError(msg === 'Failed to send a request to the Edge Function'
        ? 'Could not reach the message service. Is send-contact deployed?'
        : (msg || 'Could not send. Try again.'))
    }
    if (data?.error) return setError(data.error)
    setSent(true)
  }

  return (
    <ModalShell onRequestClose={() => !busy && onClose()} labelledBy="contact-title">
      {sent ? (
        <div className="text-center">
          <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-success/15 text-success text-lg font-bold">✓</div>
          <h2 id="contact-title" className="text-lg font-bold">Message sent</h2>
          <p className="mt-1 text-sm text-muted">
            {member.name || 'They'}&rsquo;ll get it by email. If they reply, it comes straight to your inbox.
          </p>
          <button className="btn-primary mt-4" onClick={onClose}>Done</button>
        </div>
      ) : (
        <form onSubmit={send}>
          <h2 id="contact-title" className="text-lg font-bold">Message {member.name || 'member'}</h2>
          <p className="mt-0.5 text-xs text-muted">
            Sent through the network. Your email is shared only if they reply; their address stays private.
          </p>
          {error && <div role="alert" className="mt-4 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">{error}</div>}
          <div className="mt-4 space-y-3">
            <input className="input" placeholder="Subject (optional)" maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} />
            <textarea
              className="input min-h-[120px] resize-y"
              placeholder={`Hi ${firstName}, `}
              maxLength={4000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy || !body.trim()}>{busy ? 'Sending...' : 'Send message'}</button>
          </div>
        </form>
      )}
    </ModalShell>
  )
}
