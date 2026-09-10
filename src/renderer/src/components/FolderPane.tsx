import type { ReactElement } from 'react'
import { MAIL_FOLDERS } from '../types'

interface FolderPaneProps {
  selectedFolderId: string
  onSelectFolder: (folderId: string) => void
}

function FolderPane({ selectedFolderId, onSelectFolder }: FolderPaneProps): ReactElement {
  return (
    <div className="folder-pane">
      <div className="folder-pane-header">Mailbox</div>
      <ul className="folder-list">
        {MAIL_FOLDERS.map((folder) => (
          <li key={folder.id}>
            <button
              type="button"
              className={`folder-item${folder.id === selectedFolderId ? ' selected' : ''}`}
              onClick={() => onSelectFolder(folder.id)}
            >
              {folder.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default FolderPane
