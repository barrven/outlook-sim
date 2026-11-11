import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react'
import type { MailMessage, MessageAttachment } from '../../../shared/data-types'
import type { GpMatter } from '../../../shared/ghostPractice'

interface ReadingPaneProps {
  selectedMessageId: string | null
  // Total number of currently selected messages (feature 039) — used only
  // to distinguish "nothing selected" from "multiple selected" in the
  // empty state below; `selectedMessageId` itself is already `null` in
  // both cases.
  selectedCount: number
  messagesVersion: number
  onEditDraft: (message: MailMessage) => void
  onReply: (message: MailMessage) => void
  onReplyAll: (message: MailMessage) => void
  onForward: (message: MailMessage) => void
  onDelete: (message: MailMessage) => void
  onRestore: (message: MailMessage) => void
  onPermanentDelete: (message: MailMessage) => void
}

function ReadingPane({
  selectedMessageId,
  selectedCount,
  messagesVersion,
  onEditDraft,
  onReply,
  onReplyAll,
  onForward,
  onDelete,
  onRestore,
  onPermanentDelete
}: ReadingPaneProps): ReactElement {
  const [message, setMessage] = useState<MailMessage | null>(null)
  const [categoryDraft, setCategoryDraft] = useState('')
  // Reset the draft when the selected message changes — done during render
  // (React's recommended pattern for "adjusting state when a prop changes")
  // rather than in an effect, since setState-in-effect triggers a lint error.
  const [categoryDraftMessageId, setCategoryDraftMessageId] = useState(selectedMessageId)
  // Which attachment (if any) is showing its "no real file behind this"
  // placeholder note, reset alongside categoryDraft below.
  const [openAttachmentIndex, setOpenAttachmentIndex] = useState<number | null>(null)
  // Which attachment (if any) has its "Save to Ghost Practice" dialog open
  // (feature 066, retargeted from FileVine folders to Ghost Practice
  // files), plus that dialog's own transient state — all reset alongside
  // categoryDraft/openAttachmentIndex when the selection changes.
  const [saveToFileIndex, setSaveToFileIndex] = useState<number | null>(null)
  const [gpMatters, setGpMatters] = useState<GpMatter[]>([])
  const [selectedGpMatterId, setSelectedGpMatterId] = useState('')
  const [newFileClientName, setNewFileClientName] = useState('')
  if (selectedMessageId !== categoryDraftMessageId) {
    setCategoryDraftMessageId(selectedMessageId)
    setCategoryDraft('')
    setOpenAttachmentIndex(null)
    setSaveToFileIndex(null)
  }

  // Tracks which message id we've already run the open/auto-mark-read check
  // for, so that a messagesVersion-triggered refetch of the *same* open
  // message (e.g. from the user's own "Mark as unread" click below) doesn't
  // immediately flip it back to read. Only a genuinely new selection
  // re-runs the check.
  const lastCheckedIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!selectedMessageId) {
      lastCheckedIdRef.current = null
      return
    }
    let cancelled = false
    window.api.data.messages.get(selectedMessageId).then((result) => {
      if (cancelled) return
      setMessage(result)
      const alreadyChecked = lastCheckedIdRef.current === selectedMessageId
      lastCheckedIdRef.current = selectedMessageId
      if (result && !result.isRead && !alreadyChecked) {
        window.api.data.messages.update(result.id, { isRead: true })
      }
    })
    return () => {
      cancelled = true
    }
  }, [selectedMessageId, messagesVersion])

  const displayedMessage = selectedMessageId ? message : null

  if (!displayedMessage) {
    return (
      <div className="reading-pane">
        <div className="reading-pane-empty">
          {selectedCount > 1 ? `${selectedCount} selected` : 'Select an item to read.'}
        </div>
      </div>
    )
  }

  // A separate, non-nullable binding so the handlers below (nested function
  // declarations) type-check without TS losing the null-narrowing on
  // `displayedMessage` across the closure boundary.
  const currentMessage: MailMessage = displayedMessage

  function handleToggleRead(): void {
    window.api.data.messages.update(currentMessage.id, { isRead: !currentMessage.isRead })
  }

  function handleToggleFlag(): void {
    window.api.data.messages.update(currentMessage.id, { isFlagged: !currentMessage.isFlagged })
  }

  function handleAddCategory(event: FormEvent): void {
    event.preventDefault()
    const category = categoryDraft.trim()
    setCategoryDraft('')
    if (!category || currentMessage.categories.includes(category)) return
    window.api.data.messages.update(currentMessage.id, {
      categories: [...currentMessage.categories, category]
    })
  }

  function handleRemoveCategory(category: string): void {
    window.api.data.messages.update(currentMessage.id, {
      categories: currentMessage.categories.filter((existing) => existing !== category)
    })
  }

  // A real attachment (a trainee-picked file, feature 062, or an
  // LLM-generated document, feature 065) opens in its own dedicated
  // pop-out window (feature 067) — the "open with your default
  // application" affordance now lives inside that window as a fallback,
  // not the primary click action. A true mock attachment (no `path`,
  // pre-062 data) falls back to the old placeholder-note toggle, since
  // there's no real file behind it to view.
  function handleAttachmentClick(attachment: MessageAttachment, index: number): void {
    if (attachment.path) {
      void window.api.attachmentPopout.open(currentMessage.id, index)
      return
    }
    setOpenAttachmentIndex((current) => (current === index ? null : index))
  }

  // Opens the "Save to Ghost Practice" dialog for an attachment with
  // content to save (feature 066 — real or LLM-generated, no distinction
  // made), fetching the current file list fresh each time so a file
  // created/renamed/deleted elsewhere is never stale here.
  async function handleOpenSaveToFile(index: number): Promise<void> {
    setSaveToFileIndex(index)
    setNewFileClientName('')
    const matters = await window.api.gp.matters.list()
    setGpMatters(matters)
    setSelectedGpMatterId(matters[0]?.id ?? '')
  }

  function closeSaveToFile(): void {
    setSaveToFileIndex(null)
  }

  // The copy lands at the file's top level, keeping a pointer to the
  // original on disk (when there is one) so it can still be opened in its
  // own application from the Documents tab.
  async function saveAttachmentToMatter(matterId: string, attachment: MessageAttachment): Promise<void> {
    if (attachment.extractedText === undefined) return
    await window.api.gp.documents.create({
      matterId,
      name: attachment.filename,
      content: attachment.extractedText,
      path: attachment.path ?? null
    })
    closeSaveToFile()
  }

  async function handleSaveToFile(attachment: MessageAttachment): Promise<void> {
    if (!selectedGpMatterId) return
    await saveAttachmentToMatter(selectedGpMatterId, attachment)
  }

  // AC4: no Ghost Practice files exist yet — rather than a dead end, the
  // dialog itself lets the user create one and save into it in the same step.
  async function handleCreateFileAndSave(attachment: MessageAttachment): Promise<void> {
    const clientName = newFileClientName.trim()
    if (!clientName || attachment.extractedText === undefined) return
    const matter = await window.api.gp.matters.create({ clientName })
    await saveAttachmentToMatter(matter.id, attachment)
  }

  const readToggleLabel = displayedMessage.isRead ? 'Mark as unread' : 'Mark as read'
  const flagToggleLabel = displayedMessage.isFlagged ? 'Unflag' : 'Flag'
  const flagToggleClassName = `reading-pane-flag-toggle${displayedMessage.isFlagged ? ' flagged' : ''}`

  return (
    <div className="reading-pane">
      <div className="reading-pane-header">
        <div className="reading-pane-subject-row">
          <div className="reading-pane-subject">{displayedMessage.subject || '(no subject)'}</div>
          {displayedMessage.folderId === 'drafts' ? (
            <div className="reading-pane-actions">
              <button type="button" onClick={() => onEditDraft(displayedMessage)}>
                Edit draft
              </button>
              <button type="button" className="reading-pane-delete-btn" onClick={() => onDelete(displayedMessage)}>
                Delete
              </button>
              <button type="button" className="reading-pane-read-toggle" onClick={handleToggleRead}>
                {readToggleLabel}
              </button>
              <button type="button" className={flagToggleClassName} onClick={handleToggleFlag}>
                {flagToggleLabel}
              </button>
            </div>
          ) : displayedMessage.folderId === 'deleted' ? (
            <div className="reading-pane-actions">
              <button type="button" onClick={() => onRestore(displayedMessage)}>
                Restore
              </button>
              <button
                type="button"
                className="reading-pane-delete-btn"
                onClick={() => onPermanentDelete(displayedMessage)}
              >
                Delete permanently
              </button>
              <button type="button" className="reading-pane-read-toggle" onClick={handleToggleRead}>
                {readToggleLabel}
              </button>
              <button type="button" className={flagToggleClassName} onClick={handleToggleFlag}>
                {flagToggleLabel}
              </button>
            </div>
          ) : (
            <div className="reading-pane-actions">
              <button type="button" className="btn-primary" onClick={() => onReply(displayedMessage)}>
                Reply
              </button>
              <button type="button" className="btn-primary" onClick={() => onReplyAll(displayedMessage)}>
                Reply All
              </button>
              <button type="button" className="btn-primary" onClick={() => onForward(displayedMessage)}>
                Forward
              </button>
              <button type="button" className="reading-pane-delete-btn" onClick={() => onDelete(displayedMessage)}>
                Delete
              </button>
              <button type="button" className="reading-pane-read-toggle" onClick={handleToggleRead}>
                {readToggleLabel}
              </button>
              <button type="button" className={flagToggleClassName} onClick={handleToggleFlag}>
                {flagToggleLabel}
              </button>
            </div>
          )}
        </div>
        <div className="reading-pane-meta">
          <span className="reading-pane-from">
            {displayedMessage.fromName} &lt;{displayedMessage.fromEmail}&gt;
          </span>
          <span className="reading-pane-timestamp">
            {new Date(displayedMessage.timestamp).toLocaleString()}
          </span>
        </div>
        <div className="reading-pane-to">
          To: {displayedMessage.toName} &lt;{displayedMessage.toEmail}&gt;
          {displayedMessage.cc.length > 0 && (
            <>
              {' '}
              &middot; Cc: {displayedMessage.cc.map((recipient) => recipient.name || recipient.email).join(', ')}
            </>
          )}
        </div>
        <div className="reading-pane-categories">
          {displayedMessage.categories.map((category) => (
            <span key={category} className="category-tag">
              {category}
              <button
                type="button"
                aria-label={`Remove category ${category}`}
                onClick={() => handleRemoveCategory(category)}
              >
                &times;
              </button>
            </span>
          ))}
          <form className="category-add-form" onSubmit={handleAddCategory}>
            <input
              aria-label="Add category"
              placeholder="Add category"
              value={categoryDraft}
              onChange={(event) => setCategoryDraft(event.target.value)}
            />
          </form>
        </div>
        {displayedMessage.attachments.length > 0 && (
          <div className="reading-pane-attachments">
            {displayedMessage.attachments.map((attachment, index) => (
              <div key={index} className="attachment-item">
                <button
                  type="button"
                  className="attachment-button"
                  onClick={() => handleAttachmentClick(attachment, index)}
                >
                  <span aria-hidden="true">📎</span>
                  {attachment.filename}
                </button>
                {!attachment.path && openAttachmentIndex === index && (
                  <span className="attachment-placeholder-note">Mock attachment — no file content.</span>
                )}
                {attachment.extractedText !== undefined && (
                  <button
                    type="button"
                    className="attachment-save-file-btn"
                    onClick={() => handleOpenSaveToFile(index)}
                  >
                    Save to Ghost Practice…
                  </button>
                )}
                {saveToFileIndex === index && (
                  <div
                    className="attachment-save-file-dialog"
                    role="dialog"
                    aria-label={`Save ${attachment.filename} to Ghost Practice`}
                  >
                    {gpMatters.length > 0 ? (
                      <>
                        <label htmlFor="attachment-gp-matter-select">File</label>
                        <select
                          id="attachment-gp-matter-select"
                          value={selectedGpMatterId}
                          onChange={(event) => setSelectedGpMatterId(event.target.value)}
                        >
                          {gpMatters.map((matter) => (
                            <option key={matter.id} value={matter.id}>
                              {matter.matterNumber} — {matter.clientName}
                            </option>
                          ))}
                        </select>
                        <div className="attachment-save-file-actions">
                          <button type="button" onClick={() => handleSaveToFile(attachment)}>
                            Save
                          </button>
                          <button type="button" onClick={closeSaveToFile}>
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <form
                        className="attachment-save-file-create-form"
                        onSubmit={(event: FormEvent) => {
                          event.preventDefault()
                          handleCreateFileAndSave(attachment)
                        }}
                      >
                        <p className="attachment-save-file-empty-note">
                          No Ghost Practice files yet — create one to save into.
                        </p>
                        <input
                          autoFocus
                          aria-label="New file client name"
                          placeholder="Client name"
                          value={newFileClientName}
                          onChange={(event) => setNewFileClientName(event.target.value)}
                        />
                        <div className="attachment-save-file-actions">
                          <button type="submit">Create file &amp; save</button>
                          <button type="button" onClick={closeSaveToFile}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="reading-pane-body">{displayedMessage.body}</div>
    </div>
  )
}

export default ReadingPane
