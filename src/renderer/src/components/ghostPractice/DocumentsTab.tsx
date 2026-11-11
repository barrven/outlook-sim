import { useEffect, useState, type DragEvent, type FormEvent, type ReactElement } from 'react'
import { toDateString, type GpDocument, type GpFolder } from '../../../../shared/ghostPractice'
import { renderMarkdown } from '../../markdown'
import type { GpContext } from './fields'

interface DocumentsTabProps {
  matterId: string
  documents: GpDocument[]
  ctx: GpContext
  onChanged: () => void
}

interface TreeNode extends GpFolder {
  children: TreeNode[]
}

function buildTree(folders: GpFolder[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>(folders.map((folder) => [folder.id, { ...folder, children: [] }]))
  const roots: TreeNode[] = []
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

function folderPath(folderId: string | null, folders: GpFolder[]): string {
  const names: string[] = []
  let current = folders.find((folder) => folder.id === folderId)
  while (current) {
    names.unshift(current.name)
    const parentId: string | null = current.parentId
    current = folders.find((folder) => folder.id === parentId)
  }
  return names.length > 0 ? names.join(' / ') : 'Top level'
}

function descendantIds(folderId: string, folders: GpFolder[]): string[] {
  const ids = [folderId]
  for (const folder of folders) {
    if (folder.parentId === folderId) ids.push(...descendantIds(folder.id, folders))
  }
  return ids
}

// `id: null` while creating. A folder form edits name + parent; a document
// form edits name + folder, plus Markdown content for an in-app note.
type FolderForm = { id: string | null; name: string; parentId: string | null }
type DocumentForm = { id: string | null; name: string; folderId: string | null; content: string; isNote: boolean }

// The matter-centric filing cabinet (spec §6.5): a folder tree on the left,
// the selected folder's documents and an in-place preview on the right.
function DocumentsTab({ matterId, documents, ctx, onChanged }: DocumentsTabProps): ReactElement {
  const [folders, setFolders] = useState<GpFolder[]>([])
  const [foldersVersion, setFoldersVersion] = useState(0)
  // null = the matter's top level.
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [folderForm, setFolderForm] = useState<FolderForm | null>(null)
  const [documentForm, setDocumentForm] = useState<DocumentForm | null>(null)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.api.gp.folders.list(matterId).then((list) => {
      if (!cancelled) setFolders(list)
    })
    return () => {
      cancelled = true
    }
  }, [matterId, foldersVersion])

  const reloadFolders = (): void => setFoldersVersion((version) => version + 1)

  async function submitFolderForm(event: FormEvent): Promise<void> {
    event.preventDefault()
    const form = folderForm
    setFolderForm(null)
    const name = form?.name.trim()
    if (!form || !name) return
    if (form.id) {
      await window.api.gp.folders.update(form.id, { name, parentId: form.parentId })
    } else {
      await window.api.gp.folders.create({ matterId, name, parentId: form.parentId })
    }
    reloadFolders()
  }

  async function handleDeleteFolder(folder: GpFolder): Promise<void> {
    await window.api.gp.folders.delete(folder.id)
    if (selectedFolderId && descendantIds(folder.id, folders).includes(selectedFolderId)) setSelectedFolderId(null)
    reloadFolders()
    onChanged()
  }

  // DOC-07: a file goes straight onto the matter — picked or dropped, never
  // "save to disk first". Its text is extracted once here so it can be
  // previewed in place and referenced by the client persona.
  async function addFile(filename: string, path: string): Promise<void> {
    const content = (await window.api.attachments.extractText(path)) ?? ''
    await window.api.gp.documents.create({
      matterId,
      folderId: selectedFolderId,
      name: filename,
      content,
      path,
      uploadedBy: ctx.currentUser
    })
  }

  async function handleUpload(): Promise<void> {
    const picked = await window.api.attachments.pick()
    if (!picked.ok) return
    await addFile(picked.filename, picked.path)
    onChanged()
  }

  async function handleDrop(event: DragEvent): Promise<void> {
    event.preventDefault()
    setDragOver(false)
    for (const file of Array.from(event.dataTransfer.files)) {
      const path = window.api.attachments.pathForFile(file)
      if (path) await addFile(file.name, path)
    }
    onChanged()
  }

  async function submitDocumentForm(event: FormEvent): Promise<void> {
    event.preventDefault()
    const form = documentForm
    setDocumentForm(null)
    const name = form?.name.trim()
    if (!form || !name) return
    if (form.id) {
      await window.api.gp.documents.update(form.id, {
        name,
        folderId: form.folderId,
        ...(form.isNote ? { content: form.content } : {})
      })
    } else {
      await window.api.gp.documents.create({
        matterId,
        folderId: form.folderId,
        name,
        content: form.content,
        uploadedBy: ctx.currentUser
      })
    }
    onChanged()
  }

  async function handleDeleteDocument(document: GpDocument): Promise<void> {
    await window.api.gp.documents.delete(document.id)
    if (document.id === selectedDocumentId) setSelectedDocumentId(null)
    onChanged()
  }

  const needle = search.trim().toLowerCase()
  // DOC-06: a search looks across the whole matter, not just the open folder.
  const visibleDocuments = needle
    ? documents.filter((document) => document.name.toLowerCase().includes(needle))
    : documents.filter((document) => document.folderId === selectedFolderId)
  const selectedDocument = documents.find((document) => document.id === selectedDocumentId) ?? null
  const folderOptions = folders
    .map((folder) => ({ id: folder.id, label: folderPath(folder.id, folders) }))
    .sort((a, b) => a.label.localeCompare(b.label))
  // A folder can't be moved into itself or its own subtree.
  const blockedParentIds = folderForm?.id ? descendantIds(folderForm.id, folders) : []

  function renderNode(node: TreeNode, depth: number): ReactElement {
    return (
      <li key={node.id}>
        <div className="gp-tree-row" style={{ paddingLeft: 6 + depth * 14 }}>
          <button
            type="button"
            className={`gp-tree-name${node.id === selectedFolderId ? ' selected' : ''}`}
            onClick={() => setSelectedFolderId(node.id)}
          >
            {node.name}
          </button>
          <button
            type="button"
            className="gp-icon-btn"
            aria-label={`New subfolder under ${node.name}`}
            onClick={() => setFolderForm({ id: null, name: '', parentId: node.id })}
          >
            +
          </button>
          <button
            type="button"
            className="gp-icon-btn"
            aria-label={`Rename or move ${node.name}`}
            onClick={() => setFolderForm({ id: node.id, name: node.name, parentId: node.parentId })}
          >
            ✎
          </button>
          <button
            type="button"
            className="gp-icon-btn"
            aria-label={`Delete folder ${node.name}`}
            onClick={() => handleDeleteFolder(node)}
          >
            ✕
          </button>
        </div>
        {node.children.length > 0 && <ul className="gp-tree">{node.children.map((child) => renderNode(child, depth + 1))}</ul>}
      </li>
    )
  }

  return (
    <div className="gp-documents">
      <div className="gp-documents-tree">
        <button
          type="button"
          className={`gp-tree-name gp-tree-top${selectedFolderId === null ? ' selected' : ''}`}
          onClick={() => setSelectedFolderId(null)}
        >
          Top level
        </button>
        <ul className="gp-tree">{buildTree(folders).map((node) => renderNode(node, 0))}</ul>
        {folderForm ? (
          <form className="gp-form gp-folder-form" onSubmit={submitFolderForm} aria-label="Folder">
            <label htmlFor="gp-folder-name">Folder name</label>
            <input
              id="gp-folder-name"
              autoFocus
              value={folderForm.name}
              onChange={(event) => setFolderForm({ ...folderForm, name: event.target.value })}
            />
            <label htmlFor="gp-folder-parent">Inside</label>
            <select
              id="gp-folder-parent"
              value={folderForm.parentId ?? ''}
              onChange={(event) => setFolderForm({ ...folderForm, parentId: event.target.value || null })}
            >
              <option value="">Top level</option>
              {folderOptions
                .filter((option) => !blockedParentIds.includes(option.id))
                .map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
            </select>
            <div className="gp-form-actions">
              <button type="submit" className="btn-primary">
                Save folder
              </button>
              <button type="button" onClick={() => setFolderForm(null)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="gp-dashed-btn"
            onClick={() => setFolderForm({ id: null, name: '', parentId: selectedFolderId })}
          >
            + New folder
          </button>
        )}
      </div>

      <div
        className={`gp-documents-main${dragOver ? ' gp-drag-over' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="gp-toolbar">
          <input
            type="search"
            aria-label="Search documents"
            placeholder="Search file names on this matter"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="button" className="btn-primary" onClick={handleUpload}>
            Upload file
          </button>
          <button
            type="button"
            onClick={() =>
              setDocumentForm({ id: null, name: '', folderId: selectedFolderId, content: '', isNote: true })
            }
          >
            New note
          </button>
        </div>
        <div className="gp-documents-location">
          {needle ? `Search results for "${search.trim()}"` : folderPath(selectedFolderId, folders)}
          <span className="gp-muted"> — drop files here to upload</span>
        </div>

        {documentForm && (
          <form className="gp-form" onSubmit={submitDocumentForm} aria-label="Document">
            <div className="gp-form-grid">
              <div className="gp-field">
                <label htmlFor="gp-document-name">Document name</label>
                <input
                  id="gp-document-name"
                  autoFocus
                  value={documentForm.name}
                  onChange={(event) => setDocumentForm({ ...documentForm, name: event.target.value })}
                />
              </div>
              <div className="gp-field">
                <label htmlFor="gp-document-folder">Folder</label>
                <select
                  id="gp-document-folder"
                  value={documentForm.folderId ?? ''}
                  onChange={(event) => setDocumentForm({ ...documentForm, folderId: event.target.value || null })}
                >
                  <option value="">Top level</option>
                  {folderOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {documentForm.isNote && (
                <div className="gp-field gp-field-wide">
                  <label htmlFor="gp-document-content">Note content (Markdown)</label>
                  <textarea
                    id="gp-document-content"
                    className="gp-note-textarea"
                    value={documentForm.content}
                    onChange={(event) => setDocumentForm({ ...documentForm, content: event.target.value })}
                  />
                </div>
              )}
            </div>
            <div className="gp-form-actions">
              <button type="submit" className="btn-primary">
                Save document
              </button>
              <button type="button" onClick={() => setDocumentForm(null)}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {visibleDocuments.length === 0 ? (
          <div className="gp-empty">{needle ? 'No documents match.' : 'No documents in this folder yet.'}</div>
        ) : (
          <table className="gp-table">
            <thead>
              <tr>
                <th>Title</th>
                {needle && <th>Folder</th>}
                <th>Date</th>
                <th>Uploaded by</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleDocuments.map((document) => (
                <tr key={document.id} className={document.id === selectedDocumentId ? 'gp-row-selected' : undefined}>
                  <td>
                    <button type="button" className="gp-link" onClick={() => setSelectedDocumentId(document.id)}>
                      {document.name}
                    </button>
                  </td>
                  {needle && <td>{folderPath(document.folderId, folders)}</td>}
                  <td>{toDateString(document.createdAt)}</td>
                  <td>{document.uploadedBy}</td>
                  <td className="gp-row-actions">
                    <button
                      type="button"
                      aria-label={`Rename or move ${document.name}`}
                      onClick={() =>
                        setDocumentForm({
                          id: document.id,
                          name: document.name,
                          folderId: document.folderId,
                          content: document.content,
                          isNote: document.path === null
                        })
                      }
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${document.name}`}
                      onClick={() => handleDeleteDocument(document)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {selectedDocument && (
          <div className="gp-preview" aria-label={`Preview of ${selectedDocument.name}`} role="region">
            <div className="gp-preview-header">
              <strong>{selectedDocument.name}</strong>
              {selectedDocument.path && (
                <button type="button" onClick={() => void window.api.attachments.open(selectedDocument.path ?? '')}>
                  Open with your default application
                </button>
              )}
            </div>
            {selectedDocument.path === null ? (
              // An in-app note is Markdown source — rendered formatted.
              <div
                className="gp-preview-rendered"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedDocument.content) }}
              />
            ) : selectedDocument.content ? (
              // An uploaded file's extracted text is plain text, shown verbatim.
              <div className="gp-preview-text">{selectedDocument.content}</div>
            ) : (
              <div className="gp-empty">No preview is available for this file.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default DocumentsTab
