import { useEffect, useState, type FormEvent, type ReactElement } from 'react'
import type { ComposeIntent, MessageAttachment, MessageRecipient, Persona } from '../../shared/data-types'
import { buildComposeSeed } from './composeIntent'

interface ComposeWindowProps {
  draftId?: string
  sourceMessageId?: string
  intent?: ComposeIntent
}

function ComposeWindow({ draftId, sourceMessageId, intent }: ComposeWindowProps): ReactElement {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [toEmail, setToEmail] = useState('')
  const [toName, setToName] = useState('')
  const [cc, setCc] = useState<MessageRecipient[]>([])
  const [ccSelection, setCcSelection] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [attachments, setAttachments] = useState<MessageAttachment[]>([])
  const [attachmentDraft, setAttachmentDraft] = useState('')
  const [loaded, setLoaded] = useState(!draftId && !sourceMessageId)

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
      setCc(message.cc)
      setSubject(message.subject)
      setBody(message.body)
      setAttachments(message.attachments)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [draftId])

  useEffect(() => {
    if (!sourceMessageId || !intent) return
    let cancelled = false
    Promise.all([window.api.data.messages.get(sourceMessageId), window.api.data.identity.get()]).then(
      ([message, identity]) => {
        if (cancelled || !message) return
        const seed = buildComposeSeed(intent, message, identity)
        setToEmail(seed.toEmail)
        setToName(seed.toName)
        setCc(seed.cc)
        setSubject(seed.subject)
        setBody(seed.body)
        setLoaded(true)
      }
    )
    return () => {
      cancelled = true
    }
  }, [sourceMessageId, intent])

  function addCc(email: string): void {
    if (!email || email === toEmail || cc.some((recipient) => recipient.email === email)) return
    const persona = personas.find((candidate) => candidate.email === email)
    setCc((prev) => [...prev, { name: persona?.displayName ?? email, email }])
    setCcSelection('')
  }

  function removeCc(email: string): void {
    setCc((prev) => prev.filter((recipient) => recipient.email !== email))
  }

  function handleAddAttachment(event: FormEvent): void {
    event.preventDefault()
    const filename = attachmentDraft.trim()
    setAttachmentDraft('')
    if (!filename) return
    setAttachments((prev) => [...prev, { filename }])
  }

  function removeAttachment(index: number): void {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  async function persist(folderId: 'drafts' | 'sent'): Promise<void> {
    const [identity, timestamp] = await Promise.all([window.api.data.identity.get(), window.api.data.clock.now()])
    const fields = {
      folderId,
      subject,
      body,
      toName,
      toEmail,
      cc,
      attachments,
      fromName: identity.displayName,
      fromEmail: identity.fromEmail,
      timestamp,
      isRead: folderId === 'sent'
    }
    let messageId: string
    if (draftId) {
      await window.api.data.messages.update(draftId, fields)
      messageId = draftId
    } else {
      const created = await window.api.data.messages.create(fields)
      messageId = created.id
    }
    if (folderId === 'sent') {
      // Fire-and-forget: this window is about to close, so any resulting
      // reply (or failure) surfaces later in the main window instead.
      void window.api.llm.personaReply(messageId)
    }
    window.close()
  }

  if (!loaded) {
    return <div className="compose-window" />
  }

  const knownEmails = new Set(personas.map((persona) => persona.email))
  const ccCandidates = personas.filter(
    (persona) => persona.email !== toEmail && !cc.some((recipient) => recipient.email === persona.email)
  )

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
      <div className="compose-field-row compose-field-row-cc">
        <label htmlFor="compose-cc">Cc</label>
        <div className="compose-cc-field">
          {cc.length > 0 && (
            <ul className="compose-cc-list">
              {cc.map((recipient) => (
                <li key={recipient.email} className="compose-cc-chip">
                  {recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email}
                  <button
                    type="button"
                    aria-label={`Remove ${recipient.email} from Cc`}
                    onClick={() => removeCc(recipient.email)}
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          )}
          <select
            id="compose-cc"
            value={ccSelection}
            onChange={(event) => addCc(event.target.value)}
          >
            <option value="">Add a Cc recipient…</option>
            {ccCandidates.map((persona) => (
              <option key={persona.id} value={persona.email}>
                {persona.displayName} &lt;{persona.email}&gt;
              </option>
            ))}
          </select>
        </div>
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
      <div className="compose-field-row compose-field-row-attachments">
        <label htmlFor="compose-attachment">Attachments</label>
        <div className="compose-attachments-field">
          {attachments.length > 0 && (
            <ul className="compose-attachments-list">
              {attachments.map((attachment, index) => (
                <li key={index} className="compose-attachment-chip">
                  📎 {attachment.filename}
                  <button
                    type="button"
                    aria-label={`Remove attachment ${attachment.filename}`}
                    onClick={() => removeAttachment(index)}
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form className="compose-attachment-add-form" onSubmit={handleAddAttachment}>
            <input
              id="compose-attachment"
              type="text"
              placeholder="Add attachment filename"
              value={attachmentDraft}
              onChange={(event) => setAttachmentDraft(event.target.value)}
            />
            <button type="submit">Add</button>
          </form>
        </div>
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
