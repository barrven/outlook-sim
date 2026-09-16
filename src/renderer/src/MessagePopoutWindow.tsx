import { useEffect, useState, type ReactElement } from 'react'
import type { MailMessage } from '../../shared/data-types'
import ReadingPane from './components/ReadingPane'

interface MessagePopoutWindowProps {
  messageId: string
}

// Feature 041 — a separate window showing one message's full content,
// mirroring the compose pop-out pattern (feature 004). It's a thin host
// around the same `ReadingPane` the main window uses, so the content and
// every action button behave identically; each action here talks to the
// data layer directly (this window has no selection state of its own to
// keep in sync with the main window — closing it doesn't touch that
// state at all, satisfying AC3 structurally).
function MessagePopoutWindow({ messageId }: MessagePopoutWindowProps): ReactElement {
  const [messagesVersion, setMessagesVersion] = useState(0)

  // Same cross-window refresh pattern `App.tsx` uses (AC2): the main
  // process broadcasts `data:messages-changed` to every open window, so a
  // read/flag/category change made elsewhere — or here — refetches this
  // message into both windows.
  useEffect(() => {
    return window.api.onMessagesChanged(() => {
      setMessagesVersion((version) => version + 1)
    })
  }, [])

  function handleEditDraft(message: MailMessage): void {
    window.api.compose.open({ draftId: message.id })
  }

  function handleReply(message: MailMessage): void {
    window.api.compose.open({ sourceMessageId: message.id, intent: 'reply' })
  }

  function handleReplyAll(message: MailMessage): void {
    window.api.compose.open({ sourceMessageId: message.id, intent: 'replyAll' })
  }

  function handleForward(message: MailMessage): void {
    window.api.compose.open({ sourceMessageId: message.id, intent: 'forward' })
  }

  async function handleDelete(message: MailMessage): Promise<void> {
    await window.api.data.messages.update(message.id, {
      folderId: 'deleted',
      previousFolderId: message.folderId
    })
  }

  async function handleRestore(message: MailMessage): Promise<void> {
    await window.api.data.messages.update(message.id, {
      folderId: message.previousFolderId ?? 'inbox',
      previousFolderId: null
    })
  }

  async function handlePermanentDelete(message: MailMessage): Promise<void> {
    await window.api.data.messages.delete(message.id)
  }

  return (
    <div className="message-popout-window">
      <ReadingPane
        selectedMessageId={messageId}
        selectedCount={1}
        messagesVersion={messagesVersion}
        onEditDraft={handleEditDraft}
        onReply={handleReply}
        onReplyAll={handleReplyAll}
        onForward={handleForward}
        onDelete={handleDelete}
        onRestore={handleRestore}
        onPermanentDelete={handlePermanentDelete}
      />
    </div>
  )
}

export default MessagePopoutWindow
