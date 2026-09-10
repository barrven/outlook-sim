import { useState, type ReactElement } from 'react'
import type { Folder } from '../../../shared/data-types'

interface FolderPaneProps {
  folders: Folder[]
  selectedFolderId: string
  onSelectFolder: (folderId: string) => void
  onFoldersChanged: () => void | Promise<void>
}

function generateFolderId(): string {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function FolderPane({
  folders,
  selectedFolderId,
  onSelectFolder,
  onFoldersChanged
}: FolderPaneProps): ReactElement {
  const [creating, setCreating] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  async function submitNewFolder(): Promise<void> {
    const name = newFolderName.trim()
    setCreating(false)
    setNewFolderName('')
    if (!name) return
    await window.api.data.folders.create({
      id: generateFolderId(),
      name,
      type: 'custom',
      sortOrder: folders.length
    })
    await onFoldersChanged()
  }

  async function handleRename(id: string): Promise<void> {
    const name = renameValue.trim()
    setRenamingId(null)
    if (!name) return
    await window.api.data.folders.rename(id, name)
    await onFoldersChanged()
  }

  async function handleDelete(id: string): Promise<void> {
    await window.api.data.folders.delete(id)
    if (id === selectedFolderId) onSelectFolder('inbox')
    await onFoldersChanged()
  }

  return (
    <div className="folder-pane">
      <div className="folder-pane-header">Mailbox</div>
      <ul className="folder-list">
        {folders.map((folder) => (
          <li key={folder.id} className="folder-list-item">
            {renamingId === folder.id ? (
              <form
                className="folder-rename-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  handleRename(folder.id)
                }}
              >
                <input
                  autoFocus
                  aria-label={`Rename ${folder.name}`}
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setRenamingId(null)
                  }}
                />
              </form>
            ) : (
              <>
                <button
                  type="button"
                  className={`folder-item${folder.id === selectedFolderId ? ' selected' : ''}`}
                  onClick={() => onSelectFolder(folder.id)}
                >
                  {folder.name}
                </button>
                {folder.type === 'custom' && (
                  <span className="folder-item-actions">
                    <button
                      type="button"
                      className="folder-action-btn"
                      aria-label={`Rename ${folder.name}`}
                      onClick={() => {
                        setRenamingId(folder.id)
                        setRenameValue(folder.name)
                      }}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="folder-action-btn"
                      aria-label={`Delete ${folder.name}`}
                      onClick={() => handleDelete(folder.id)}
                    >
                      ✕
                    </button>
                  </span>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {creating ? (
        <form
          className="folder-create-form"
          onSubmit={(event) => {
            event.preventDefault()
            submitNewFolder()
          }}
        >
          <input
            autoFocus
            aria-label="New folder name"
            placeholder="Folder name"
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setCreating(false)
                setNewFolderName('')
              }
            }}
          />
        </form>
      ) : (
        <button type="button" className="folder-new-btn" onClick={() => setCreating(true)}>
          + New folder
        </button>
      )}
    </div>
  )
}

export default FolderPane
