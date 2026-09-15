import { useEffect, useState, type FormEvent, type ReactElement } from 'react'
import type { FileVineFolder, FileVineNote, Persona } from '../../../shared/data-types'
import { renderMarkdown } from '../markdown'

// A folder can be created either at the root (`parentId: null`) or nested
// under another folder — this tracks which, while `null` (not `undefined`)
// means "not currently showing a create form" so it also doubles as the
// "am I creating a root folder" vs "not creating at all" distinction.
type CreateTarget = { parentId: string | null } | undefined

interface TreeNode extends FileVineFolder {
  children: TreeNode[]
}

function buildTree(folders: FileVineFolder[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>(folders.map((folder) => [folder.id, { ...folder, children: [] }]))
  const roots: TreeNode[] = []
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

interface FolderTreeItemProps {
  node: TreeNode
  depth: number
  selectedFolderId: string | null
  renamingId: string | null
  renameValue: string
  createTarget: CreateTarget
  newFolderName: string
  onSelect: (id: string) => void
  onStartRename: (folder: FileVineFolder) => void
  onRenameValueChange: (value: string) => void
  onSubmitRename: (id: string) => void
  onCancelRename: () => void
  onDelete: (folder: FileVineFolder) => void
  onStartCreate: (parentId: string | null) => void
  onNewFolderNameChange: (value: string) => void
  onSubmitCreate: () => void
  onCancelCreate: () => void
}

function FolderTreeItem(props: FolderTreeItemProps): ReactElement {
  const {
    node,
    depth,
    selectedFolderId,
    renamingId,
    renameValue,
    createTarget,
    newFolderName,
    onSelect,
    onStartRename,
    onRenameValueChange,
    onSubmitRename,
    onCancelRename,
    onDelete,
    onStartCreate,
    onNewFolderNameChange,
    onSubmitCreate,
    onCancelCreate
  } = props

  return (
    <li className="filevine-tree-item">
      {renamingId === node.id ? (
        <form
          className="filevine-tree-rename-form"
          style={{ paddingLeft: depth * 16 }}
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            onSubmitRename(node.id)
          }}
        >
          <input
            autoFocus
            aria-label={`Rename ${node.name}`}
            value={renameValue}
            onChange={(event) => onRenameValueChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onCancelRename()
            }}
          />
        </form>
      ) : (
        <div className="filevine-tree-row" style={{ paddingLeft: depth * 16 }}>
          <button
            type="button"
            className={`filevine-tree-name${node.id === selectedFolderId ? ' selected' : ''}`}
            onClick={() => onSelect(node.id)}
          >
            {node.name}
          </button>
          <span className="filevine-tree-actions">
            <button
              type="button"
              className="filevine-tree-action-btn"
              aria-label={`New subfolder under ${node.name}`}
              onClick={() => onStartCreate(node.id)}
            >
              +
            </button>
            <button
              type="button"
              className="filevine-tree-action-btn"
              aria-label={`Rename ${node.name}`}
              onClick={() => onStartRename(node)}
            >
              ✎
            </button>
            <button
              type="button"
              className="filevine-tree-action-btn"
              aria-label={`Delete ${node.name}`}
              onClick={() => onDelete(node)}
            >
              ✕
            </button>
          </span>
        </div>
      )}
      {createTarget?.parentId === node.id && (
        <form
          className="filevine-tree-create-form"
          style={{ paddingLeft: (depth + 1) * 16 }}
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            onSubmitCreate()
          }}
        >
          <input
            autoFocus
            aria-label="New subfolder name"
            placeholder="Folder name"
            value={newFolderName}
            onChange={(event) => onNewFolderNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onCancelCreate()
            }}
          />
        </form>
      )}
      {node.children.length > 0 && (
        <ul className="filevine-tree-children">
          {node.children.map((child) => (
            <FolderTreeItem key={child.id} {...props} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

function FileVineView(): ReactElement {
  const [folders, setFolders] = useState<FileVineFolder[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [createTarget, setCreateTarget] = useState<CreateTarget>(undefined)
  const [newFolderName, setNewFolderName] = useState('')

  const [notes, setNotes] = useState<FileVineNote[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [isCreatingNote, setIsCreatingNote] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteNameInput, setNoteNameInput] = useState('')
  const [noteContentInput, setNoteContentInput] = useState('')

  async function refreshFolders(): Promise<void> {
    const list = await window.api.data.fileVineFolders.list()
    setFolders(list)
  }

  useEffect(() => {
    let cancelled = false
    window.api.data.fileVineFolders.list().then((list) => {
      if (!cancelled) setFolders(list)
    })
    window.api.data.personas.get().then((list) => {
      if (!cancelled) setPersonas(list)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function refreshNotes(folderId: string): Promise<void> {
    const list = await window.api.data.fileVineNotes.list(folderId)
    setNotes(list)
  }

  // No folder selected means the notes section isn't rendered at all, so
  // stale notes from a previously-selected folder sitting unused in state
  // is harmless — avoids an extra setState call here for no visible effect.
  useEffect(() => {
    let cancelled = false
    if (selectedFolderId) {
      window.api.data.fileVineNotes.list(selectedFolderId).then((list) => {
        if (!cancelled) setNotes(list)
      })
    }
    return () => {
      cancelled = true
    }
  }, [selectedFolderId])

  // Switching folders leaves any other folder's note selection/editor state
  // behind — it belongs to a folder that's no longer showing.
  function selectFolder(id: string | null): void {
    setSelectedFolderId(id)
    setSelectedNoteId(null)
    setIsCreatingNote(false)
    setEditingNoteId(null)
  }

  function startCreate(parentId: string | null): void {
    setCreateTarget({ parentId })
    setNewFolderName('')
  }

  function cancelCreate(): void {
    setCreateTarget(undefined)
    setNewFolderName('')
  }

  async function submitCreate(): Promise<void> {
    const name = newFolderName.trim()
    const parentId = createTarget?.parentId ?? null
    cancelCreate()
    if (!name) return
    await window.api.data.fileVineFolders.create({ name, parentId })
    await refreshFolders()
  }

  function startRename(folder: FileVineFolder): void {
    setRenamingId(folder.id)
    setRenameValue(folder.name)
  }

  function cancelRename(): void {
    setRenamingId(null)
  }

  async function submitRename(id: string): Promise<void> {
    const name = renameValue.trim()
    setRenamingId(null)
    if (!name) return
    await window.api.data.fileVineFolders.update(id, { name })
    await refreshFolders()
  }

  async function handleDelete(folder: FileVineFolder): Promise<void> {
    await window.api.data.fileVineFolders.delete(folder.id)
    if (folder.id === selectedFolderId) selectFolder(null)
    await refreshFolders()
  }

  async function handleClientChange(id: string, personaId: string): Promise<void> {
    await window.api.data.fileVineFolders.update(id, { clientPersonaId: personaId || null })
    await refreshFolders()
  }

  function startCreateNote(): void {
    setIsCreatingNote(true)
    setEditingNoteId(null)
    setNoteNameInput('')
    setNoteContentInput('')
  }

  function cancelNoteEditor(): void {
    setIsCreatingNote(false)
    setEditingNoteId(null)
  }

  async function submitCreateNote(): Promise<void> {
    const name = noteNameInput.trim()
    cancelNoteEditor()
    if (!name || !selectedFolderId) return
    await window.api.data.fileVineNotes.create({ folderId: selectedFolderId, name, content: noteContentInput })
    await refreshNotes(selectedFolderId)
  }

  function startEditNote(note: FileVineNote): void {
    setIsCreatingNote(false)
    setEditingNoteId(note.id)
    setSelectedNoteId(note.id)
    setNoteNameInput(note.name)
    setNoteContentInput(note.content)
  }

  async function submitEditNote(): Promise<void> {
    const name = noteNameInput.trim()
    const id = editingNoteId
    cancelNoteEditor()
    if (!name || !id || !selectedFolderId) return
    await window.api.data.fileVineNotes.update(id, { name, content: noteContentInput })
    await refreshNotes(selectedFolderId)
  }

  async function handleDeleteNote(note: FileVineNote): Promise<void> {
    await window.api.data.fileVineNotes.delete(note.id)
    if (note.id === selectedNoteId) setSelectedNoteId(null)
    if (note.id === editingNoteId) cancelNoteEditor()
    if (selectedFolderId) await refreshNotes(selectedFolderId)
  }

  const tree = buildTree(folders)
  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) ?? null
  const selectedClientPersona = selectedFolder
    ? personas.find((persona) => persona.id === selectedFolder.clientPersonaId)
    : undefined
  // Only clients are assignable here — firm staff and other external
  // contacts (adjusters, opposing counsel, etc.) aren't valid folder
  // "clients". If a folder's existing association points at a persona
  // that's no longer marked as a client, keep showing it selected rather
  // than silently dropping the selection out from under the dropdown.
  const clientOptions = personas.filter(
    (persona) => persona.isClient || persona.id === selectedFolder?.clientPersonaId
  )
  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null

  const treeItemProps = {
    selectedFolderId,
    renamingId,
    renameValue,
    createTarget,
    newFolderName,
    onSelect: selectFolder,
    onStartRename: startRename,
    onRenameValueChange: setRenameValue,
    onSubmitRename: submitRename,
    onCancelRename: cancelRename,
    onDelete: handleDelete,
    onStartCreate: startCreate,
    onNewFolderNameChange: setNewFolderName,
    onSubmitCreate: submitCreate,
    onCancelCreate: cancelCreate
  }

  return (
    <div className="filevine-view">
      <div className="filevine-view-header">
        <h2 className="filevine-view-title">FileVine</h2>
      </div>
      <div className="filevine-view-body">
        <div className="filevine-tree-pane">
          {tree.length === 0 ? (
            <div className="filevine-tree-empty">No folders yet.</div>
          ) : (
            <ul className="filevine-tree-root">
              {tree.map((node) => (
                <FolderTreeItem key={node.id} {...treeItemProps} node={node} depth={0} />
              ))}
            </ul>
          )}
          {createTarget?.parentId === null && (
            <form
              className="filevine-tree-create-form"
              onSubmit={(event) => {
                event.preventDefault()
                submitCreate()
              }}
            >
              <input
                autoFocus
                aria-label="New folder name"
                placeholder="Folder name"
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') cancelCreate()
                }}
              />
            </form>
          )}
          <button type="button" className="filevine-new-root-btn" onClick={() => startCreate(null)}>
            + New folder
          </button>
        </div>
        <div className="filevine-detail-pane">
          {selectedFolder ? (
            <>
              <div className="filevine-detail-title">{selectedFolder.name}</div>
              <div className="filevine-detail-field">
                <label htmlFor="filevine-client-select">Client</label>
                <select
                  id="filevine-client-select"
                  value={selectedFolder.clientPersonaId ?? ''}
                  onChange={(event) => handleClientChange(selectedFolder.id, event.target.value)}
                >
                  <option value="">No client</option>
                  {clientOptions.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.displayName}
                    </option>
                  ))}
                </select>
              </div>
              {selectedClientPersona && (
                <div className="filevine-detail-client-summary">
                  Client: {selectedClientPersona.displayName}
                  {selectedClientPersona.role ? ` (${selectedClientPersona.role})` : ''}
                </div>
              )}

              <div className="filevine-notes-section">
                <div className="filevine-notes-header">
                  <h3 className="filevine-notes-title">Notes</h3>
                  {!isCreatingNote && (
                    <button type="button" className="filevine-new-note-btn" onClick={startCreateNote}>
                      + New note
                    </button>
                  )}
                </div>

                {isCreatingNote && (
                  <form
                    className="filevine-note-editor"
                    onSubmit={(event: FormEvent) => {
                      event.preventDefault()
                      submitCreateNote()
                    }}
                  >
                    <input
                      autoFocus
                      aria-label="Note name"
                      placeholder="Note name"
                      value={noteNameInput}
                      onChange={(event) => setNoteNameInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') cancelNoteEditor()
                      }}
                    />
                    <textarea
                      aria-label="Note content"
                      className="filevine-note-textarea"
                      placeholder="Markdown content"
                      value={noteContentInput}
                      onChange={(event) => setNoteContentInput(event.target.value)}
                    />
                    <div className="filevine-note-editor-actions">
                      <button type="submit">Create</button>
                      <button type="button" onClick={cancelNoteEditor}>
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {notes.length === 0 && !isCreatingNote ? (
                  <div className="filevine-notes-empty">No notes yet.</div>
                ) : (
                  <ul className="filevine-notes-list">
                    {notes.map((note) => (
                      <li key={note.id} className="filevine-notes-list-item">
                        {editingNoteId === note.id ? (
                          <form
                            className="filevine-note-editor"
                            onSubmit={(event: FormEvent) => {
                              event.preventDefault()
                              submitEditNote()
                            }}
                          >
                            <input
                              autoFocus
                              aria-label={`Edit name for ${note.name}`}
                              value={noteNameInput}
                              onChange={(event) => setNoteNameInput(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Escape') cancelNoteEditor()
                              }}
                            />
                            <textarea
                              aria-label={`Edit content for ${note.name}`}
                              className="filevine-note-textarea"
                              value={noteContentInput}
                              onChange={(event) => setNoteContentInput(event.target.value)}
                            />
                            <div className="filevine-note-editor-actions">
                              <button type="submit">Save</button>
                              <button type="button" onClick={cancelNoteEditor}>
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="filevine-notes-list-row">
                            <button
                              type="button"
                              className={`filevine-note-name${note.id === selectedNoteId ? ' selected' : ''}`}
                              onClick={() => setSelectedNoteId(note.id)}
                            >
                              {note.name}
                            </button>
                            <span className="filevine-note-actions">
                              <button
                                type="button"
                                className="filevine-tree-action-btn"
                                aria-label={`Edit ${note.name}`}
                                onClick={() => startEditNote(note)}
                              >
                                ✎
                              </button>
                              <button
                                type="button"
                                className="filevine-tree-action-btn"
                                aria-label={`Delete ${note.name}`}
                                onClick={() => handleDeleteNote(note)}
                              >
                                ✕
                              </button>
                            </span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {selectedNote && editingNoteId !== selectedNote.id && (
                  <div
                    className="filevine-note-rendered"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedNote.content) }}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="filevine-detail-empty">Select a folder to view its details.</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default FileVineView
