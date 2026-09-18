import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { ModuleId } from '../types'
import OfficeClock from './OfficeClock'

// File is rendered separately, before this list — it opens a dropdown menu
// rather than switching the active tab (feature 034), so it doesn't fit the
// uniform tab-button rendering below.
const TABS = ['Home', 'FileVine', 'View']
// Home, FileVine, and View are real, clickable tabs. Send/Receive and
// Folder were disabled placeholders too, but never wired to anything and
// are now hidden entirely rather than shown as permanently-disabled tabs
// (feature 033).
type ClickableTab = 'Home' | 'FileVine' | 'View'

// Reply/Reply All/Forward/New Items were also here originally but, like
// Send/Receive and Folder above, were permanently-disabled placeholders
// never wired to anything — removed entirely (feature 053) rather than
// shown disabled forever. Those actions live in the Reading Pane instead.
const MAIL_ACTIONS = ['New Email', 'Delete']
// Semantic action coloring (058) — only for actions with a real handler in
// actionHandlers below (New Email, Delete).
const ACTION_COLOR_CLASS: Partial<Record<string, string>> = {
  'New Email': 'ribbon-action-primary',
  Delete: 'ribbon-action-danger'
}
// Day/Work Week/Week/Month/Today live in CalendarView's own view-tab header,
// not here — no need to duplicate the view switcher in the ribbon too.
// New Meeting is hidden until meeting invites/RSVP (an explicit spec
// non-goal for v1) actually get built — no point showing a button that can
// never be wired up.
const CALENDAR_ACTIONS = ['New Event']
// The View tab (feature 046) — a Tasks on/off toggle, not a fire-once
// action, so it's rendered with aria-pressed below.
const VIEW_ACTIONS = ['Tasks']

interface RibbonBarProps {
  activeModule: ModuleId
  showFileVine: boolean
  // Whether the View tab is the one currently selected — independent of
  // showFileVine/activeModule, since View doesn't change which module or
  // mail/calendar content is showing, only which action set the ribbon
  // displays.
  viewTabActive: boolean
  showTasksPanel: boolean
  // Mail search (feature 038) — whether the search box should render at
  // all (App.tsx computes this from the same conditions that used to gate
  // rendering the search box inside MessageListPane: Mail module, not
  // FileVine, not Settings), plus its current value/scope and change
  // handlers. The actual filtering happens in MessageListPane; this
  // component only owns the input.
  showMailSearch: boolean
  searchQuery: string
  searchScope: 'folder' | 'all'
  onSearchQueryChange: (query: string) => void
  onSearchScopeChange: (scope: 'folder' | 'all') => void
  // Reading Pane Right/Off toggle (feature 042) — a View-tab control, same
  // scoping as the Tasks toggle.
  readingPaneMode: 'right' | 'off'
  onReadingPaneModeChange: (mode: 'right' | 'off') => void
  onSelectHomeTab: () => void
  onSelectFileVineTab: () => void
  onSelectViewTab: () => void
  onToggleTasksPanel: () => void
  onOpenSettings: () => void
  onNewEmail?: () => void
  onDelete?: () => void
  onNewEvent?: () => void
}

function RibbonBar({
  activeModule,
  showFileVine,
  viewTabActive,
  showTasksPanel,
  showMailSearch,
  searchQuery,
  searchScope,
  onSearchQueryChange,
  onSearchScopeChange,
  readingPaneMode,
  onReadingPaneModeChange,
  onSelectHomeTab,
  onSelectFileVineTab,
  onSelectViewTab,
  onToggleTasksPanel,
  onOpenSettings,
  onNewEmail,
  onDelete,
  onNewEvent
}: RibbonBarProps): ReactElement {
  const [fileMenuOpen, setFileMenuOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  const fileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.app.getVersion().then(setAppVersion)
  }, [])

  // Closes the whole File menu, including its About panel — used by every
  // close path (click-outside, Escape, re-clicking File) so About never
  // stays expanded into the next time the menu opens.
  function closeFileMenu(): void {
    setFileMenuOpen(false)
    setAboutOpen(false)
  }

  // Mirrors MessageContextMenu's click-outside/Escape-to-close pattern.
  useEffect(() => {
    if (!fileMenuOpen) return
    function handlePointerDown(event: MouseEvent): void {
      if (fileMenuRef.current && !fileMenuRef.current.contains(event.target as Node)) closeFileMenu()
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') closeFileMenu()
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [fileMenuOpen])

  const actions = viewTabActive ? VIEW_ACTIONS : activeModule === 'mail' ? MAIL_ACTIONS : CALENDAR_ACTIONS
  const actionHandlers: Partial<Record<string, () => void>> = {
    'New Email': onNewEmail,
    Delete: onDelete,
    'New Event': onNewEvent,
    Tasks: onToggleTasksPanel
  }
  const tabHandlers: Partial<Record<ClickableTab, () => void>> = {
    Home: onSelectHomeTab,
    FileVine: onSelectFileVineTab,
    View: onSelectViewTab
  }
  const activeTab: ClickableTab = viewTabActive ? 'View' : showFileVine ? 'FileVine' : 'Home'

  return (
    <div className="ribbon">
      <div className="ribbon-tabs">
        <div className="ribbon-tabs-list" role="tablist" aria-label="Ribbon tabs">
          <div className="ribbon-tab-file" ref={fileMenuRef}>
            <button
              type="button"
              className="ribbon-tab"
              aria-haspopup="menu"
              aria-expanded={fileMenuOpen}
              onClick={() => (fileMenuOpen ? closeFileMenu() : setFileMenuOpen(true))}
            >
              File
            </button>
            {fileMenuOpen && (
              <div className="file-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    closeFileMenu()
                    onOpenSettings()
                  }}
                >
                  Settings
                </button>
                <div className="file-menu-divider" />
                <button
                  type="button"
                  role="menuitem"
                  aria-expanded={aboutOpen}
                  onClick={() => setAboutOpen((open) => !open)}
                >
                  About
                </button>
                {aboutOpen && (
                  <div className="file-menu-about">
                    <div>Version {appVersion}</div>
                    <a href="https://github.com/barrven/outlook-sim/" target="_blank" rel="noreferrer">
                      https://github.com/barrven/outlook-sim/
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
          {TABS.map((tab) => {
            const handler = tabHandlers[tab as ClickableTab]
            return (
              <button
                key={tab}
                type="button"
                className={`ribbon-tab${tab === activeTab ? ' active' : ''}`}
                disabled={!handler}
                onClick={handler}
              >
                {tab}
              </button>
            )
          })}
        </div>
        {showMailSearch && (
          <div className="ribbon-search">
            <input
              type="search"
              aria-label="Search mail"
              placeholder="Search mail"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
            />
            <select
              aria-label="Search scope"
              value={searchScope}
              onChange={(event) => onSearchScopeChange(event.target.value as 'folder' | 'all')}
            >
              <option value="folder">This folder</option>
              <option value="all">All folders</option>
            </select>
          </div>
        )}
        <OfficeClock />
      </div>
      <div className="ribbon-actions">
        {actions.map((action) => {
          const handler = actionHandlers[action]
          const isToggle = action === 'Tasks'
          const colorClass = handler ? ACTION_COLOR_CLASS[action] : undefined
          return (
            <button
              key={action}
              type="button"
              className={`ribbon-action${colorClass ? ` ${colorClass}` : ''}${isToggle && showTasksPanel ? ' active' : ''}`}
              disabled={!handler}
              aria-pressed={isToggle ? showTasksPanel : undefined}
              onClick={handler}
            >
              {action}
            </button>
          )
        })}
        {viewTabActive && (
          <div className="ribbon-reading-pane-control">
            <label htmlFor="ribbon-reading-pane-mode">Reading Pane</label>
            <select
              id="ribbon-reading-pane-mode"
              aria-label="Reading Pane"
              value={readingPaneMode}
              onChange={(event) => onReadingPaneModeChange(event.target.value as 'right' | 'off')}
            >
              <option value="right">Right</option>
              <option value="off">Off</option>
            </select>
          </div>
        )}
      </div>
    </div>
  )
}

export default RibbonBar
