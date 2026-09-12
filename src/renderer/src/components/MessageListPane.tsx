import { useEffect, useState, type ReactElement } from 'react'
import type { MailMessage } from '../../../shared/data-types'

interface MessageListPaneProps {
  selectedFolderId: string
  selectedFolderName: string
  selectedMessageId: string | null
  onSelectMessage: (messageId: string) => void
  messagesVersion: number
}

function MessageListPane({
  selectedFolderId,
  selectedFolderName,
  selectedMessageId,
  onSelectMessage,
  messagesVersion
}: MessageListPaneProps): ReactElement {
  const [messages, setMessages] = useState<MailMessage[]>([])
  const [categoryFilter, setCategoryFilter] = useState('')
  // Reset the filter when the folder changes — done during render (React's
  // recommended pattern for "adjusting state when a prop changes") rather
  // than in an effect, since setState-in-effect triggers a lint error.
  const [categoryFilterFolderId, setCategoryFilterFolderId] = useState(selectedFolderId)
  if (selectedFolderId !== categoryFilterFolderId) {
    setCategoryFilterFolderId(selectedFolderId)
    setCategoryFilter('')
  }

  useEffect(() => {
    let cancelled = false
    window.api.data.messages.list(selectedFolderId).then((list) => {
      if (!cancelled) setMessages(list)
    })
    return () => {
      cancelled = true
    }
  }, [selectedFolderId, messagesVersion])

  function handleToggleFlag(message: MailMessage): void {
    window.api.data.messages.update(message.id, { isFlagged: !message.isFlagged })
  }

  const allCategories = Array.from(new Set(messages.flatMap((message) => message.categories))).sort()
  const visibleMessages = categoryFilter
    ? messages.filter((message) => message.categories.includes(categoryFilter))
    : messages

  return (
    <div className="message-list-pane">
      <div className="message-list-header">
        {selectedFolderName}
        {allCategories.length > 0 && (
          <select
            aria-label="Filter by category"
            className="message-list-filter"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="">All categories</option>
            {allCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        )}
      </div>
      {visibleMessages.length === 0 ? (
        <div className="message-list-empty">No items to show.</div>
      ) : (
        <ul className="message-list">
          {visibleMessages.map((message) => (
            <li key={message.id} className="message-list-row">
              <button
                type="button"
                className={`message-list-item${
                  message.id === selectedMessageId ? ' selected' : ''
                }${message.isRead ? '' : ' unread'}`}
                onClick={() => onSelectMessage(message.id)}
              >
                <span className="message-list-item-from">{message.fromName || message.fromEmail}</span>
                <span className="message-list-item-subject">{message.subject || '(no subject)'}</span>
                {message.categories.length > 0 && (
                  <span className="message-list-item-categories">{message.categories.join(', ')}</span>
                )}
              </button>
              <button
                type="button"
                className={`message-list-flag-btn${message.isFlagged ? ' flagged' : ''}`}
                aria-label={message.isFlagged ? 'Unflag message' : 'Flag message'}
                onClick={(event) => {
                  event.stopPropagation()
                  handleToggleFlag(message)
                }}
              >
                {message.isFlagged ? '⚑' : '⚐'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default MessageListPane
