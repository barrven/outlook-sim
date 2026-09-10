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

  useEffect(() => {
    let cancelled = false
    window.api.data.messages.list(selectedFolderId).then((list) => {
      if (!cancelled) setMessages(list)
    })
    return () => {
      cancelled = true
    }
  }, [selectedFolderId, messagesVersion])

  return (
    <div className="message-list-pane">
      <div className="message-list-header">{selectedFolderName}</div>
      {messages.length === 0 ? (
        <div className="message-list-empty">No items to show.</div>
      ) : (
        <ul className="message-list">
          {messages.map((message) => (
            <li key={message.id}>
              <button
                type="button"
                className={`message-list-item${
                  message.id === selectedMessageId ? ' selected' : ''
                }${message.isRead ? '' : ' unread'}`}
                onClick={() => onSelectMessage(message.id)}
              >
                <span className="message-list-item-from">{message.fromName || message.fromEmail}</span>
                <span className="message-list-item-subject">{message.subject || '(no subject)'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default MessageListPane
