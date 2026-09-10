import { useCallback, useEffect, useState, type ReactElement } from 'react'
import type { Folder } from '../../shared/data-types'
import type { ModuleId } from './types'
import RibbonBar from './components/RibbonBar'
import NavSwitcher from './components/NavSwitcher'
import FolderPane from './components/FolderPane'
import CalendarFolderPane from './components/CalendarFolderPane'
import MessageListPane from './components/MessageListPane'
import ReadingPane from './components/ReadingPane'
import CalendarView from './components/CalendarView'

function App(): ReactElement {
  const [activeModule, setActiveModule] = useState<ModuleId>('mail')
  const [folders, setFolders] = useState<Folder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState('inbox')
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)

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

  function handleSelectFolder(folderId: string): void {
    setSelectedFolderId(folderId)
    setSelectedMessageId(null)
  }

  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId)

  return (
    <div className="app-shell">
      <RibbonBar activeModule={activeModule} />
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
          <NavSwitcher activeModule={activeModule} onSelectModule={setActiveModule} />
        </div>
        {activeModule === 'mail' ? (
          <>
            <MessageListPane
              selectedFolderId={selectedFolderId}
              selectedFolderName={selectedFolder?.name ?? ''}
              selectedMessageId={selectedMessageId}
              onSelectMessage={setSelectedMessageId}
            />
            <ReadingPane selectedMessageId={selectedMessageId} />
          </>
        ) : (
          <CalendarView />
        )}
      </div>
    </div>
  )
}

export default App
