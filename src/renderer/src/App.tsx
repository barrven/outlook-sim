import { useState, type ReactElement } from 'react'
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
  const [selectedFolderId, setSelectedFolderId] = useState('inbox')

  return (
    <div className="app-shell">
      <RibbonBar activeModule={activeModule} />
      <div className="app-body">
        <div className="app-nav-rail">
          {activeModule === 'mail' ? (
            <FolderPane selectedFolderId={selectedFolderId} onSelectFolder={setSelectedFolderId} />
          ) : (
            <CalendarFolderPane />
          )}
          <NavSwitcher activeModule={activeModule} onSelectModule={setActiveModule} />
        </div>
        {activeModule === 'mail' ? (
          <>
            <MessageListPane selectedFolderId={selectedFolderId} />
            <ReadingPane />
          </>
        ) : (
          <CalendarView />
        )}
      </div>
    </div>
  )
}

export default App
