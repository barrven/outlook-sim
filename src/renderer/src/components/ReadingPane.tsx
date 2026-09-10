import { useEffect, useState, type ReactElement } from 'react'
import type { MailMessage } from '../../../shared/data-types'

interface ReadingPaneProps {
  selectedMessageId: string | null
  messagesVersion: number
  onEditDraft: (message: MailMessage) => void
}

function ReadingPane({ selectedMessageId, messagesVersion, onEditDraft }: ReadingPaneProps): ReactElement {
  const [message, setMessage] = useState<MailMessage | null>(null)

  useEffect(() => {
    if (!selectedMessageId) return
    let cancelled = false
    window.api.data.messages.get(selectedMessageId).then((result) => {
      if (!cancelled) setMessage(result)
    })
    return () => {
      cancelled = true
    }
  }, [selectedMessageId, messagesVersion])

  const displayedMessage = selectedMessageId ? message : null

  if (!displayedMessage) {
    return (
      <div className="reading-pane">
        <div className="reading-pane-empty">Select an item to read.</div>
      </div>
    )
  }

  return (
    <div className="reading-pane">
      <div className="reading-pane-header">
        <div className="reading-pane-subject-row">
          <div className="reading-pane-subject">{displayedMessage.subject || '(no subject)'}</div>
          {displayedMessage.folderId === 'drafts' && (
            <button
              type="button"
              className="reading-pane-edit-draft"
              onClick={() => onEditDraft(displayedMessage)}
            >
              Edit draft
            </button>
          )}
        </div>
        <div className="reading-pane-meta">
          <span className="reading-pane-from">
            {displayedMessage.fromName} &lt;{displayedMessage.fromEmail}&gt;
          </span>
          <span className="reading-pane-timestamp">
            {new Date(displayedMessage.timestamp).toLocaleString()}
          </span>
        </div>
        <div className="reading-pane-to">
          To: {displayedMessage.toName} &lt;{displayedMessage.toEmail}&gt;
        </div>
      </div>
      <div className="reading-pane-body">{displayedMessage.body}</div>
    </div>
  )
}

export default ReadingPane
