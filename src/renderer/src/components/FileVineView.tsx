import { useEffect, useState, type FormEvent, type ReactElement } from 'react'
import type { FileVineFolder, Persona } from '../../../shared/data-types'

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
    if (folder.id === selectedFolderId) setSelectedFolderId(null)
    await refreshFolders()
  }

  async function handleClientChange(id: string, personaId: string): Promise<void> {
    await window.api.data.fileVineFolders.update(id, { clientPersonaId: personaId || null })
    await refreshFolders()
  }

  const tree = buildTree(folders)
  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) ?? null
  const selectedClientPersona = selectedFolder
    ? personas.find((persona) => persona.id === selectedFolder.clientPersonaId)
    : undefined

  const treeItemProps = {
    selectedFolderId,
    renamingId,
    renameValue,
    createTarget,
    newFolderName,
    onSelect: setSelectedFolderId,
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
                  {personas.map((persona) => (
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
