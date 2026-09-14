import { useCallback, useEffect, useState, type ReactElement } from 'react'
import type { FiredReminder, Folder, MailMessage } from '../../shared/data-types'
import type { ModuleId } from './types'
import RibbonBar from './components/RibbonBar'
import NavSwitcher from './components/NavSwitcher'
import FolderPane from './components/FolderPane'
import CalendarFolderPane from './components/CalendarFolderPane'
import MessageListPane from './components/MessageListPane'
import ReadingPane from './components/ReadingPane'
import CalendarView from './components/CalendarView'
import SettingsView from './components/SettingsView'

function App(): ReactElement {
  const [activeModule, setActiveModule] = useState<ModuleId>('mail')
  const [showSettings, setShowSettings] = useState(false)
  const [folders, setFolders] = useState<Folder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState('inbox')
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [messagesVersion, setMessagesVersion] = useState(0)
  const [llmBackgroundError, setLlmBackgroundError] = useState<string | null>(null)
  const [showNewEventForm, setShowNewEventForm] = useState(false)
  const [firedReminders, setFiredReminders] = useState<FiredReminder[]>([])

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
    return window.api.onPersonaReplyFailed((error) => {
      setLlmBackgroundError(`Persona reply failed: ${error}`)
    })
  }, [])

  useEffect(() => {
    return window.api.onUnsolicitedMailFailed((error) => {
      setLlmBackgroundError(`Unsolicited mail generation failed: ${error}`)
    })
  }, [])

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
    setSelectedMessageId(null)
    setShowSettings(false)
  }

  function handleSelectModule(moduleId: ModuleId): void {
    setActiveModule(moduleId)
    setShowSettings(false)
    setShowNewEventForm(false)
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
    setSelectedMessageId(null)
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
    setSelectedMessageId(null)
  }

  async function handlePermanentDeleteMessage(message: MailMessage): Promise<void> {
    await window.api.data.messages.delete(message.id)
    setSelectedMessageId(null)
  }

  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId)
  const canDeleteSelected = Boolean(selectedMessageId) && selectedFolderId !== 'deleted'

  return (
    <div className="app-shell">
      {llmBackgroundError && (
        <div className="llm-error-banner" role="alert">
          <span>{llmBackgroundError}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setLlmBackgroundError(null)}>
            &times;
          </button>
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
            onFreePlayStarted={() => setSelectedMessageId(null)}
            onScenarioPackLoaded={() => setSelectedMessageId(null)}
          />
        ) : activeModule === 'mail' ? (
          <>
            <MessageListPane
              selectedFolderId={selectedFolderId}
              selectedFolderName={selectedFolder?.name ?? ''}
              selectedMessageId={selectedMessageId}
              onSelectMessage={setSelectedMessageId}
              messagesVersion={messagesVersion}
            />
            <ReadingPane
              selectedMessageId={selectedMessageId}
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
