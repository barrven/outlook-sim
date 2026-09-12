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
  const [allMessages, setAllMessages] = useState<MailMessage[]>([])
  const [categoryFilter, setCategoryFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchScope, setSearchScope] = useState<'folder' | 'all'>('folder')
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

  // Only fetched while searching all folders, so a plain current-folder
  // view never pays for an extra IPC round trip it doesn't need.
  useEffect(() => {
    if (searchScope !== 'all') return
    let cancelled = false
    window.api.data.messages.list().then((list) => {
      if (!cancelled) setAllMessages(list)
    })
    return () => {
      cancelled = true
    }
  }, [searchScope, messagesVersion])

  function handleToggleFlag(message: MailMessage): void {
    window.api.data.messages.update(message.id, { isFlagged: !message.isFlagged })
  }

  const query = searchQuery.trim().toLowerCase()
  function matchesQuery(message: MailMessage): boolean {
    return (
      message.subject.toLowerCase().includes(query) ||
      message.body.toLowerCase().includes(query) ||
      message.fromName.toLowerCase().includes(query) ||
      message.fromEmail.toLowerCase().includes(query)
    )
  }

  const searchedMessages = query
    ? (searchScope === 'all' ? allMessages : messages).filter(matchesQuery)
    : messages

  const allCategories = Array.from(new Set(messages.flatMap((message) => message.categories))).sort()
  const visibleMessages = categoryFilter
    ? searchedMessages.filter((message) => message.categories.includes(categoryFilter))
    : searchedMessages

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
      <div className="message-list-search">
        <input
          type="search"
          aria-label="Search mail"
          placeholder="Search mail"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <select
          aria-label="Search scope"
          value={searchScope}
          onChange={(event) => setSearchScope(event.target.value as 'folder' | 'all')}
        >
          <option value="folder">This folder</option>
          <option value="all">All folders</option>
        </select>
      </div>
      {visibleMessages.length === 0 ? (
        <div className="message-list-empty">{query ? 'No results found.' : 'No items to show.'}</div>
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
