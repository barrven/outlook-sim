import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react'
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
  const [categoryDraft, setCategoryDraft] = useState('')
  // Reset the draft when the selected message changes — done during render
  // (React's recommended pattern for "adjusting state when a prop changes")
  // rather than in an effect, since setState-in-effect triggers a lint error.
  const [categoryDraftMessageId, setCategoryDraftMessageId] = useState(selectedMessageId)
  if (selectedMessageId !== categoryDraftMessageId) {
    setCategoryDraftMessageId(selectedMessageId)
    setCategoryDraft('')
  }

  // Tracks which message id we've already run the open/auto-mark-read check
  // for, so that a messagesVersion-triggered refetch of the *same* open
  // message (e.g. from the user's own "Mark as unread" click below) doesn't
  // immediately flip it back to read. Only a genuinely new selection
  // re-runs the check.
  const lastCheckedIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!selectedMessageId) {
      lastCheckedIdRef.current = null
      return
    }
    let cancelled = false
    window.api.data.messages.get(selectedMessageId).then((result) => {
      if (cancelled) return
      setMessage(result)
      const alreadyChecked = lastCheckedIdRef.current === selectedMessageId
      lastCheckedIdRef.current = selectedMessageId
      if (result && !result.isRead && !alreadyChecked) {
        window.api.data.messages.update(result.id, { isRead: true })
      }
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

  // A separate, non-nullable binding so the handlers below (nested function
  // declarations) type-check without TS losing the null-narrowing on
  // `displayedMessage` across the closure boundary.
  const currentMessage: MailMessage = displayedMessage

  function handleToggleRead(): void {
    window.api.data.messages.update(currentMessage.id, { isRead: !currentMessage.isRead })
  }

  function handleToggleFlag(): void {
    window.api.data.messages.update(currentMessage.id, { isFlagged: !currentMessage.isFlagged })
  }

  function handleAddCategory(event: FormEvent): void {
    event.preventDefault()
    const category = categoryDraft.trim()
    setCategoryDraft('')
    if (!category || currentMessage.categories.includes(category)) return
    window.api.data.messages.update(currentMessage.id, {
      categories: [...currentMessage.categories, category]
    })
  }

  function handleRemoveCategory(category: string): void {
    window.api.data.messages.update(currentMessage.id, {
      categories: currentMessage.categories.filter((existing) => existing !== category)
    })
  }

  const readToggleLabel = displayedMessage.isRead ? 'Mark as unread' : 'Mark as read'
  const flagToggleLabel = displayedMessage.isFlagged ? 'Unflag' : 'Flag'

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
              <button type="button" onClick={handleToggleRead}>
                {readToggleLabel}
              </button>
              <button type="button" onClick={handleToggleFlag}>
                {flagToggleLabel}
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
              <button type="button" onClick={handleToggleRead}>
                {readToggleLabel}
              </button>
              <button type="button" onClick={handleToggleFlag}>
                {flagToggleLabel}
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
              <button type="button" onClick={handleToggleRead}>
                {readToggleLabel}
              </button>
              <button type="button" onClick={handleToggleFlag}>
                {flagToggleLabel}
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
        <div className="reading-pane-categories">
          {displayedMessage.categories.map((category) => (
            <span key={category} className="category-tag">
              {category}
              <button
                type="button"
                aria-label={`Remove category ${category}`}
                onClick={() => handleRemoveCategory(category)}
              >
                &times;
              </button>
            </span>
          ))}
          <form className="category-add-form" onSubmit={handleAddCategory}>
            <input
              aria-label="Add category"
              placeholder="Add category"
              value={categoryDraft}
              onChange={(event) => setCategoryDraft(event.target.value)}
            />
          </form>
        </div>
      </div>
      <div className="reading-pane-body">{displayedMessage.body}</div>
    </div>
  )
}

export default ReadingPane
