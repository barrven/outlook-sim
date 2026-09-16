import { useEffect, useState, type MouseEvent, type ReactElement } from 'react'
import type { Folder, MailMessage } from '../../../shared/data-types'
import MessageContextMenu from './MessageContextMenu'

interface MessageListPaneProps {
  selectedFolderId: string
  selectedFolderName: string
  selectedMessageIds: string[]
  onSelectionChange: (messageIds: string[]) => void
  messagesVersion: number
  folders: Folder[]
  // Search (feature 038) — the input itself now lives in the ribbon; this
  // component only reads the current query/scope to filter its list.
  searchQuery: string
  searchScope: 'folder' | 'all'
  // Reading Pane Right/Off toggle (feature 042) — when the inline Reading
  // Pane isn't rendered alongside this pane, it takes the freed space
  // instead of leaving a blank gap.
  fullWidth: boolean
  onReply: (message: MailMessage) => void
  onReplyAll: (message: MailMessage) => void
  onForward: (message: MailMessage) => void
  onDeleteMessages: (messages: MailMessage[]) => void
}

function MessageListPane({
  selectedFolderId,
  selectedFolderName,
  selectedMessageIds,
  onSelectionChange,
  messagesVersion,
  folders,
  searchQuery,
  searchScope,
  fullWidth,
  onReply,
  onReplyAll,
  onForward,
  onDeleteMessages
}: MessageListPaneProps): ReactElement {
  const [messages, setMessages] = useState<MailMessage[]>([])
  const [allMessages, setAllMessages] = useState<MailMessage[]>([])
  const [categoryFilter, setCategoryFilter] = useState('')
  // The message a Shift-click range extends from — the most recently
  // plain- or Ctrl-clicked message (feature 039 AC2). Purely a click-
  // handling detail nothing outside this component needs, so it lives
  // here rather than being lifted to the parent alongside the selection
  // itself.
  const [anchorId, setAnchorId] = useState<string | null>(null)
  // The right-click context menu (feature 040) — `messageIds` is the
  // selection it was opened on (AC2: the existing selection if the
  // right-clicked row was already part of it, otherwise just that row).
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; messageIds: string[] } | null>(null)
  // Reset the filter (and selection anchor) when the folder changes — done
  // during render (React's recommended pattern for "adjusting state when a
  // prop changes") rather than in an effect, since setState-in-effect
  // triggers a lint error.
  const [categoryFilterFolderId, setCategoryFilterFolderId] = useState(selectedFolderId)
  if (selectedFolderId !== categoryFilterFolderId) {
    setCategoryFilterFolderId(selectedFolderId)
    setCategoryFilter('')
    setAnchorId(null)
    setContextMenu(null)
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

  // Ctrl/Cmd-click toggles one message in/out of the selection (AC1);
  // Shift-click selects the contiguous range between `anchorId` and the
  // clicked message, replacing the current selection (AC2) — falling back
  // to a plain click if there's no anchor yet, or the anchor has scrolled
  // out of the current filtered/searched view; a plain click selects just
  // that one message (AC3). The anchor itself only ever moves on a plain
  // or Ctrl-click, so repeated Shift-clicks keep extending/contracting the
  // same range.
  function handleMessageClick(messageId: string, event: MouseEvent<HTMLButtonElement>): void {
    if (event.shiftKey && anchorId) {
      const ids = visibleMessages.map((message) => message.id)
      const anchorIndex = ids.indexOf(anchorId)
      const targetIndex = ids.indexOf(messageId)
      if (anchorIndex !== -1 && targetIndex !== -1) {
        const [start, end] = anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex]
        onSelectionChange(ids.slice(start, end + 1))
        return
      }
    }
    if (event.ctrlKey || event.metaKey) {
      setAnchorId(messageId)
      onSelectionChange(
        selectedMessageIds.includes(messageId)
          ? selectedMessageIds.filter((id) => id !== messageId)
          : [...selectedMessageIds, messageId]
      )
      return
    }
    setAnchorId(messageId)
    onSelectionChange([messageId])
  }

  // Right-clicking a message that's already part of the current selection
  // keeps that selection; right-clicking outside it selects just that one
  // message first (AC2), same as a plain click.
  function handleMessageContextMenu(messageId: string, event: MouseEvent<HTMLButtonElement>): void {
    event.preventDefault()
    const targetIds = selectedMessageIds.includes(messageId) ? selectedMessageIds : [messageId]
    if (!selectedMessageIds.includes(messageId)) {
      setAnchorId(messageId)
      onSelectionChange([messageId])
    }
    setContextMenu({ x: event.clientX, y: event.clientY, messageIds: targetIds })
  }

  function handleBulkMarkRead(messageIds: string[], isRead: boolean): void {
    messageIds.forEach((id) => window.api.data.messages.update(id, { isRead }))
  }

  function handleBulkToggleFlag(messageIds: string[], isFlagged: boolean): void {
    messageIds.forEach((id) => window.api.data.messages.update(id, { isFlagged }))
  }

  function handleBulkAddCategory(targetMessages: MailMessage[], category: string): void {
    targetMessages.forEach((message) => {
      if (message.categories.includes(category)) return
      window.api.data.messages.update(message.id, { categories: [...message.categories, category] })
    })
  }

  // Moving out of the currently viewed folder means the selected messages
  // are about to disappear from this list, so the selection is cleared —
  // same reasoning as Delete below.
  function handleBulkMoveToFolder(messageIds: string[], folderId: string): void {
    messageIds.forEach((id) => window.api.data.messages.update(id, { folderId }))
    onSelectionChange([])
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

  const contextMenuMessages = contextMenu
    ? visibleMessages.filter((message) => contextMenu.messageIds.includes(message.id))
    : []

  return (
    <div className={`message-list-pane${fullWidth ? ' full-width' : ''}`}>
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
        <div className="message-list-empty">{query ? 'No results found.' : 'No items to show.'}</div>
      ) : (
        <ul className="message-list">
          {visibleMessages.map((message) => (
            <li key={message.id} className="message-list-row">
              <button
                type="button"
                className={`message-list-item${
                  selectedMessageIds.includes(message.id) ? ' selected' : ''
                }${message.isRead ? '' : ' unread'}`}
                onClick={(event) => handleMessageClick(message.id, event)}
                onContextMenu={(event) => handleMessageContextMenu(message.id, event)}
                onDoubleClick={() => window.api.messagePopout.open(message.id)}
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
      {contextMenu && (
        <MessageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          targetMessages={contextMenuMessages}
          folders={folders}
          onClose={() => setContextMenu(null)}
          onMoveToFolder={(folderId) => handleBulkMoveToFolder(contextMenu.messageIds, folderId)}
          onMarkRead={(isRead) => handleBulkMarkRead(contextMenu.messageIds, isRead)}
          onToggleFlag={(isFlagged) => handleBulkToggleFlag(contextMenu.messageIds, isFlagged)}
          onAddCategory={(category) => handleBulkAddCategory(contextMenuMessages, category)}
          onReply={() => {
            if (contextMenuMessages.length === 1) onReply(contextMenuMessages[0])
          }}
          onReplyAll={() => {
            if (contextMenuMessages.length === 1) onReplyAll(contextMenuMessages[0])
          }}
          onForward={() => {
            if (contextMenuMessages.length === 1) onForward(contextMenuMessages[0])
          }}
          onDelete={() => onDeleteMessages(contextMenuMessages)}
        />
      )}
    </div>
  )
}

export default MessageListPane
