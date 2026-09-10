import type { ReactElement } from 'react'
import { MAIL_FOLDERS } from '../types'

interface MessageListPaneProps {
  selectedFolderId: string
}

function MessageListPane({ selectedFolderId }: MessageListPaneProps): ReactElement {
  const folder = MAIL_FOLDERS.find((f) => f.id === selectedFolderId)

  return (
    <div className="message-list-pane">
      <div className="message-list-header">{folder?.label ?? 'Inbox'}</div>
      <div className="message-list-empty">No items to show.</div>
    </div>
  )
}

export default MessageListPane
