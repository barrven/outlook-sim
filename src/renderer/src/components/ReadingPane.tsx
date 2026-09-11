import { useEffect, useState, type ReactElement } from 'react'
import type { MailMessage } from '../../../shared/data-types'

interface ReadingPaneProps {
  selectedMessageId: string | null
  messagesVersion: number
  onEditDraft: (message: MailMessage) => void
  onReply: (message: MailMessage) => void
  onReplyAll: (message: MailMessage) => void
  onForward: (message: MailMessage) => void
  onDelete: (message: MailMessage) => void
  onRestore: (message: MailMessage) => void
  onPermanentDelete: (message: MailMessage) => void
}

function ReadingPane({
  selectedMessageId,
  messagesVersion,
  onEditDraft,
  onReply,
  onReplyAll,
  onForward,
  onDelete,
  onRestore,
  onPermanentDelete
}: ReadingPaneProps): ReactElement {
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
          {displayedMessage.folderId === 'drafts' ? (
            <div className="reading-pane-actions">
              <button type="button" onClick={() => onEditDraft(displayedMessage)}>
                Edit draft
              </button>
              <button type="button" onClick={() => onDelete(displayedMessage)}>
                Delete
              </button>
            </div>
          ) : displayedMessage.folderId === 'deleted' ? (
            <div className="reading-pane-actions">
              <button type="button" onClick={() => onRestore(displayedMessage)}>
                Restore
              </button>
              <button type="button" onClick={() => onPermanentDelete(displayedMessage)}>
                Delete permanently
              </button>
            </div>
          ) : (
            <div className="reading-pane-actions">
              <button type="button" onClick={() => onReply(displayedMessage)}>
                Reply
              </button>
              <button type="button" onClick={() => onReplyAll(displayedMessage)}>
                Reply All
              </button>
              <button type="button" onClick={() => onForward(displayedMessage)}>
                Forward
              </button>
              <button type="button" onClick={() => onDelete(displayedMessage)}>
                Delete
              </button>
            </div>
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
          {displayedMessage.cc.length > 0 && (
            <>
              {' '}
              &middot; Cc: {displayedMessage.cc.map((recipient) => recipient.name || recipient.email).join(', ')}
            </>
          )}
        </div>
      </div>
      <div className="reading-pane-body">{displayedMessage.body}</div>
    </div>
  )
}

export default ReadingPane
