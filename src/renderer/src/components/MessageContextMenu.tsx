import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react'
import type { Folder, MailMessage } from '../../../shared/data-types'

interface MessageContextMenuProps {
  x: number
  y: number
  targetMessages: MailMessage[]
  folders: Folder[]
  onClose: () => void
  onMoveToFolder: (folderId: string) => void
  onMarkRead: (isRead: boolean) => void
  onToggleFlag: (isFlagged: boolean) => void
  onAddCategory: (category: string) => void
  onReply: () => void
  onReplyAll: () => void
  onForward: () => void
  onDelete: () => void
}

// Right-click menu for the message list (feature 040). Applies to whatever
// selection it was opened on (`targetMessages`, decided by the caller per
// AC2) — Reply/Reply All/Forward stay disabled unless that's exactly one
// message (AC5), everything else works for any selection size.
function MessageContextMenu({
  x,
  y,
  targetMessages,
  folders,
  onClose,
  onMoveToFolder,
  onMarkRead,
  onToggleFlag,
  onAddCategory,
  onReply,
  onReplyAll,
  onForward,
  onDelete
}: MessageContextMenuProps): ReactElement {
  const [moveMenuOpen, setMoveMenuOpen] = useState(false)
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false)
  const [categoryDraft, setCategoryDraft] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) onClose()
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const canActOnOne = targetMessages.length === 1
  const allRead = targetMessages.every((message) => message.isRead)
  const allFlagged = targetMessages.length > 0 && targetMessages.every((message) => message.isFlagged)

  function handleAddCategorySubmit(event: FormEvent): void {
    event.preventDefault()
    const category = categoryDraft.trim()
    setCategoryDraft('')
    if (!category) return
    onAddCategory(category)
    onClose()
  }

  function runAndClose(action: () => void): void {
    action()
    onClose()
  }

  return (
    <div ref={menuRef} className="message-context-menu" role="menu" style={{ top: y, left: x }}>
      <button type="button" role="menuitem" disabled={!canActOnOne} onClick={() => runAndClose(onReply)}>
        Reply
      </button>
      <button type="button" role="menuitem" disabled={!canActOnOne} onClick={() => runAndClose(onReplyAll)}>
        Reply All
      </button>
      <button type="button" role="menuitem" disabled={!canActOnOne} onClick={() => runAndClose(onForward)}>
        Forward
      </button>
      <div className="message-context-menu-divider" />
      <button type="button" role="menuitem" onClick={() => runAndClose(() => onMarkRead(!allRead))}>
        {allRead ? 'Mark as unread' : 'Mark as read'}
      </button>
      <button type="button" role="menuitem" onClick={() => runAndClose(() => onToggleFlag(!allFlagged))}>
        {allFlagged ? 'Unflag' : 'Flag'}
      </button>
      <div className="message-context-menu-divider" />
      <button
        type="button"
        role="menuitem"
        aria-expanded={categoryMenuOpen}
        onClick={() => setCategoryMenuOpen((open) => !open)}
      >
        Add to category
      </button>
      {categoryMenuOpen && (
        <form
          className="message-context-submenu message-context-menu-category-form"
          onSubmit={handleAddCategorySubmit}
        >
          <input
            autoFocus
            aria-label="Category name"
            placeholder="Category name"
            value={categoryDraft}
            onChange={(event) => setCategoryDraft(event.target.value)}
          />
        </form>
      )}
      <button
        type="button"
        role="menuitem"
        aria-expanded={moveMenuOpen}
        onClick={() => setMoveMenuOpen((open) => !open)}
      >
        Move to folder
      </button>
      {moveMenuOpen && (
        <div className="message-context-submenu">
          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              role="menuitem"
              onClick={() => runAndClose(() => onMoveToFolder(folder.id))}
            >
              {folder.name}
            </button>
          ))}
        </div>
      )}
      <div className="message-context-menu-divider" />
      <button type="button" role="menuitem" onClick={() => runAndClose(onDelete)}>
        Delete
      </button>
    </div>
  )
}

export default MessageContextMenu
