import { useCallback, useEffect, useState, type ReactElement } from 'react'
import type { FiredReminder, Folder, MailMessage } from '../../shared/data-types'

// A single-slot failure so a second failure (of either kind) replaces the
// banner rather than stacking a duplicate one (feature 027 AC2) — `kind`
// carries what Retry needs to re-attempt the same call: `personaReply`
// keeps the `sentMessageId` it was called with, `unsolicitedMail` has no
// caller-supplied input to replay (the scheduler picks its own persona and
// context each attempt), so Retry there just re-attempts generation fresh.
type LlmBackgroundFailure =
  | { kind: 'personaReply'; sentMessageId: string; error: string }
  | { kind: 'unsolicitedMail'; error: string }
import type { ModuleId } from './types'
import RibbonBar from './components/RibbonBar'
import NavSwitcher from './components/NavSwitcher'
import FolderPane from './components/FolderPane'
import CalendarFolderPane from './components/CalendarFolderPane'
import MessageListPane from './components/MessageListPane'
import ReadingPane from './components/ReadingPane'
import CalendarView from './components/CalendarView'
import FileVineView from './components/FileVineView'
import SettingsView from './components/SettingsView'

function App(): ReactElement {
  const [activeModule, setActiveModule] = useState<ModuleId>('mail')
  const [showSettings, setShowSettings] = useState(false)
  const [folders, setFolders] = useState<Folder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState('inbox')
  // Multi-select (feature 039) — order doesn't matter for rendering, only
  // membership; the last-clicked "anchor" a Shift-click ranges from is
  // tracked locally inside MessageListPane, since it's purely a click-
  // handling detail nothing else needs to read.
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([])
  // Reading Pane, Reply/Forward, and single-message delete/restore all
  // operate on exactly one message — this is `null` both when nothing is
  // selected and when multiple messages are (AC4: Reading Pane shows a
  // neutral "N selected" state in that second case, not some arbitrary one
  // of them).
  const selectedMessageId = selectedMessageIds.length === 1 ? selectedMessageIds[0] : null
  const [messagesVersion, setMessagesVersion] = useState(0)
  const [llmBackgroundFailure, setLlmBackgroundFailure] = useState<LlmBackgroundFailure | null>(null)
  const [retryingLlmFailure, setRetryingLlmFailure] = useState(false)
  const [showNewEventForm, setShowNewEventForm] = useState(false)
  const [firedReminders, setFiredReminders] = useState<FiredReminder[]>([])
  const [showFileVine, setShowFileVine] = useState(false)

  const refreshFolders = useCallback(async () => {
    const list = await window.api.data.folders.list()
    setFolders(list)
  }, [])

  useEffect(() => {
    let cancelled = false
    window.api.data.folders.list().then((list) => {
      if (!cancelled) setFolders(list)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return window.api.onMessagesChanged(() => {
      setMessagesVersion((version) => version + 1)
    })
  }, [])

  useEffect(() => {
    return window.api.onPersonaReplyFailed((sentMessageId, error) => {
      setLlmBackgroundFailure({ kind: 'personaReply', sentMessageId, error })
    })
  }, [])

  useEffect(() => {
    return window.api.onUnsolicitedMailFailed((error) => {
      setLlmBackgroundFailure({ kind: 'unsolicitedMail', error })
    })
  }, [])

  // Re-attempts the exact same failed call: personaReply with the same
  // sentMessageId (so it's genuinely "the same call, same inputs" per
  // AC2), unsolicitedMail via the same manual-retry channel the scheduler's
  // own tick() also uses. A second failure re-broadcasts through the same
  // listeners above, replacing this banner's contents rather than adding a
  // new one (AC2); success is read directly off the resolved result rather
  // than inferred from a broadcast, since `data:messages-changed` doesn't
  // fire when a persona legitimately declines to reply.
  async function handleRetryLlmFailure(): Promise<void> {
    if (!llmBackgroundFailure) return
    setRetryingLlmFailure(true)
    const result =
      llmBackgroundFailure.kind === 'personaReply'
        ? await window.api.llm.personaReply(llmBackgroundFailure.sentMessageId)
        : await window.api.llm.retryUnsolicitedMail()
    setRetryingLlmFailure(false)
    if (result.ok) setLlmBackgroundFailure(null)
  }

  useEffect(() => {
    return window.api.onReminderFired((reminder) => {
      setFiredReminders((prev) => [...prev, reminder])
    })
  }, [])

  function dismissReminder(id: string): void {
    setFiredReminders((prev) => prev.filter((reminder) => reminder.id !== id))
  }

  function handleSelectFolder(folderId: string): void {
    setSelectedFolderId(folderId)
    setSelectedMessageIds([])
    setShowSettings(false)
    setShowFileVine(false)
  }

  function handleSelectModule(moduleId: ModuleId): void {
    setActiveModule(moduleId)
    setShowSettings(false)
    setShowNewEventForm(false)
    setShowFileVine(false)
  }

  // FileVine (feature 047) is a ribbon-tab overlay scoped to the Mail
  // module — spec: "swaps the center/right content area... while the
  // left-hand folder pane keeps showing the mail folder list". Selecting
  // either tab forces activeModule to 'mail' so that pane is always what's
  // underneath it.
  function handleSelectHomeTab(): void {
    setActiveModule('mail')
    setShowSettings(false)
    setShowFileVine(false)
  }

  function handleSelectFileVineTab(): void {
    setActiveModule('mail')
    setShowSettings(false)
    setShowFileVine(true)
  }

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

  async function moveMessageToDeleted(messageId: string, currentFolderId: string): Promise<void> {
    await window.api.data.messages.update(messageId, {
      folderId: 'deleted',
      previousFolderId: currentFolderId
    })
    setSelectedMessageIds([])
  }

  async function handleDeleteMessage(message: MailMessage): Promise<void> {
    await moveMessageToDeleted(message.id, message.folderId)
  }

  // Mirrors the Reading Pane's Delete button for whatever message is
  // currently selected; disabled (via `canDeleteSelected` below) while
  // viewing Deleted Items, where "Delete" isn't a Reading Pane action
  // either — Restore/Delete permanently take its place there.
  function handleRibbonDelete(): void {
    if (!selectedMessageId) return
    moveMessageToDeleted(selectedMessageId, selectedFolderId)
  }

  async function handleRestoreMessage(message: MailMessage): Promise<void> {
    await window.api.data.messages.update(message.id, {
      folderId: message.previousFolderId ?? 'inbox',
      previousFolderId: null
    })
    setSelectedMessageIds([])
  }

  async function handlePermanentDeleteMessage(message: MailMessage): Promise<void> {
    await window.api.data.messages.delete(message.id)
    setSelectedMessageIds([])
  }

  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId)
  const canDeleteSelected = Boolean(selectedMessageId) && selectedFolderId !== 'deleted'

  return (
    <div className="app-shell">
      {llmBackgroundFailure && (
        <div className="llm-error-banner" role="alert">
          <span>
            {llmBackgroundFailure.kind === 'personaReply'
              ? `Persona reply failed: ${llmBackgroundFailure.error}`
              : `Unsolicited mail generation failed: ${llmBackgroundFailure.error}`}
          </span>
          <span className="llm-error-banner-actions">
            <button type="button" onClick={handleRetryLlmFailure} disabled={retryingLlmFailure}>
              {retryingLlmFailure ? 'Retrying…' : 'Retry'}
            </button>
            <button type="button" aria-label="Dismiss" onClick={() => setLlmBackgroundFailure(null)}>
              &times;
            </button>
          </span>
        </div>
      )}
      {firedReminders.map((reminder) => (
        <div key={reminder.id} className="reminder-banner" role="alert">
          <span>
            Reminder: &quot;{reminder.title}&quot; at {new Date(reminder.startTime).toLocaleString()}
          </span>
          <button type="button" aria-label="Dismiss reminder" onClick={() => dismissReminder(reminder.id)}>
            &times;
          </button>
        </div>
      ))}
      <RibbonBar
        activeModule={activeModule}
        showFileVine={showFileVine}
        onSelectHomeTab={handleSelectHomeTab}
        onSelectFileVineTab={handleSelectFileVineTab}
        onNewEmail={() => window.api.compose.open()}
        onDelete={canDeleteSelected ? handleRibbonDelete : undefined}
        onNewEvent={() => setShowNewEventForm(true)}
      />
      <div className="app-body">
        <div className="app-nav-rail">
          {activeModule === 'mail' ? (
            <FolderPane
              folders={folders}
              selectedFolderId={selectedFolderId}
              onSelectFolder={handleSelectFolder}
              onFoldersChanged={refreshFolders}
            />
          ) : (
            <CalendarFolderPane />
          )}
          <NavSwitcher activeModule={activeModule} onSelectModule={handleSelectModule} />
          <button type="button" className="settings-nav-button" onClick={() => setShowSettings(true)}>
            Settings
          </button>
        </div>
        {showSettings ? (
          <SettingsView
            onClose={() => setShowSettings(false)}
            onFreePlayStarted={() => setSelectedMessageIds([])}
            onScenarioPackLoaded={() => setSelectedMessageIds([])}
          />
        ) : activeModule === 'mail' ? (
          showFileVine ? (
            <FileVineView />
          ) : (
            <>
              <MessageListPane
                selectedFolderId={selectedFolderId}
                selectedFolderName={selectedFolder?.name ?? ''}
                selectedMessageIds={selectedMessageIds}
                onSelectionChange={setSelectedMessageIds}
                messagesVersion={messagesVersion}
              />
              <ReadingPane
                selectedMessageId={selectedMessageId}
                selectedCount={selectedMessageIds.length}
                messagesVersion={messagesVersion}
                onEditDraft={handleEditDraft}
                onReply={handleReply}
                onReplyAll={handleReplyAll}
                onForward={handleForward}
                onDelete={handleDeleteMessage}
                onRestore={handleRestoreMessage}
                onPermanentDelete={handlePermanentDeleteMessage}
              />
            </>
          )
        ) : (
          <CalendarView
            showCreateForm={showNewEventForm}
            onCloseCreateForm={() => setShowNewEventForm(false)}
          />
        )}
      </div>
    </div>
  )
}

export default App
