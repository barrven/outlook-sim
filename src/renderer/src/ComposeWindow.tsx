import { useEffect, useState, type ReactElement } from 'react'
import type { Persona } from '../../shared/data-types'

interface ComposeWindowProps {
  draftId?: string
}

function ComposeWindow({ draftId }: ComposeWindowProps): ReactElement {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [toEmail, setToEmail] = useState('')
  const [toName, setToName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loaded, setLoaded] = useState(!draftId)

  useEffect(() => {
    let cancelled = false
    window.api.data.personas.get().then((list) => {
      if (!cancelled) setPersonas(list)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!draftId) return
    let cancelled = false
    window.api.data.messages.get(draftId).then((message) => {
      if (cancelled || !message) return
      setToEmail(message.toEmail)
      setToName(message.toName)
      setSubject(message.subject)
      setBody(message.body)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [draftId])

  async function persist(folderId: 'drafts' | 'sent'): Promise<void> {
    const identity = await window.api.data.identity.get()
    const fields = {
      folderId,
      subject,
      body,
      toName,
      toEmail,
      fromName: identity.displayName,
      fromEmail: identity.fromEmail,
      timestamp: Date.now()
    }
    if (draftId) {
      await window.api.data.messages.update(draftId, fields)
    } else {
      await window.api.data.messages.create(fields)
    }
    window.close()
  }

  if (!loaded) {
    return <div className="compose-window" />
  }

  const knownEmails = new Set(personas.map((persona) => persona.email))

  return (
    <div className="compose-window">
      <div className="compose-toolbar">
        <button type="button" onClick={() => persist('sent')} disabled={!toEmail}>
          Send
        </button>
        <button type="button" onClick={() => persist('drafts')}>
          Save &amp; Close
        </button>
        <button type="button" onClick={() => window.close()}>
          Discard
        </button>
      </div>
      <div className="compose-field-row">
        <label htmlFor="compose-to">To</label>
        <select
          id="compose-to"
          value={toEmail}
          onChange={(event) => {
            const email = event.target.value
            setToEmail(email)
            setToName(personas.find((persona) => persona.email === email)?.displayName ?? '')
          }}
        >
          <option value="">Select a recipient…</option>
          {personas.map((persona) => (
            <option key={persona.id} value={persona.email}>
              {persona.displayName} &lt;{persona.email}&gt;
            </option>
          ))}
          {toEmail && !knownEmails.has(toEmail) && (
            <option value={toEmail}>{toName ? `${toName} <${toEmail}>` : toEmail}</option>
          )}
        </select>
      </div>
      <div className="compose-field-row">
        <label htmlFor="compose-subject">Subject</label>
        <input
          id="compose-subject"
          type="text"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
        />
      </div>
      <textarea
        className="compose-body"
        aria-label="Message body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
    </div>
  )
}

export default ComposeWindow
