import type { ReactElement } from 'react'
import type { ModuleId } from '../types'
import OfficeClock from './OfficeClock'

const TABS = ['File', 'Home', 'FileVine', 'View']
// Home, FileVine, and View are real, clickable tabs — File stays a
// disabled placeholder (no wired-up content yet). Send/Receive and Folder
// were placeholders too, but never wired to anything and are now hidden
// entirely rather than shown as permanently-disabled tabs (feature 033).
type ClickableTab = 'Home' | 'FileVine' | 'View'

const MAIL_ACTIONS = ['New Email', 'New Items', 'Delete', 'Reply', 'Reply All', 'Forward']
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
  onSelectHomeTab: () => void
  onSelectFileVineTab: () => void
  onSelectViewTab: () => void
  onToggleTasksPanel: () => void
  onNewEmail?: () => void
  onDelete?: () => void
  onNewEvent?: () => void
}

function RibbonBar({
  activeModule,
  showFileVine,
  viewTabActive,
  showTasksPanel,
  onSelectHomeTab,
  onSelectFileVineTab,
  onSelectViewTab,
  onToggleTasksPanel,
  onNewEmail,
  onDelete,
  onNewEvent
}: RibbonBarProps): ReactElement {
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
        <OfficeClock />
      </div>
      <div className="ribbon-actions">
        {actions.map((action) => {
          const handler = actionHandlers[action]
          const isToggle = action === 'Tasks'
          return (
            <button
              key={action}
              type="button"
              className={`ribbon-action${isToggle && showTasksPanel ? ' active' : ''}`}
              disabled={!handler}
              aria-pressed={isToggle ? showTasksPanel : undefined}
              onClick={handler}
            >
              {action}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default RibbonBar
