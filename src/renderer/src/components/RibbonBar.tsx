import type { ReactElement } from 'react'
import type { ModuleId } from '../types'
import OfficeClock from './OfficeClock'

const TABS = ['File', 'Home', 'Send / Receive', 'Folder', 'FileVine', 'View']
// Only Home and FileVine are real, clickable tabs right now — the rest stay
// disabled placeholders (File/Send-Receive/Folder/View have no wired-up
// content yet; View's Tasks-panel toggle is a separate future feature).
type ClickableTab = 'Home' | 'FileVine'

const MAIL_ACTIONS = ['New Email', 'New Items', 'Delete', 'Reply', 'Reply All', 'Forward']
// Day/Work Week/Week/Month/Today live in CalendarView's own view-tab header,
// not here — no need to duplicate the view switcher in the ribbon too.
// New Meeting is hidden until meeting invites/RSVP (an explicit spec
// non-goal for v1) actually get built — no point showing a button that can
// never be wired up.
const CALENDAR_ACTIONS = ['New Event']

interface RibbonBarProps {
  activeModule: ModuleId
  showFileVine: boolean
  onSelectHomeTab: () => void
  onSelectFileVineTab: () => void
  onNewEmail?: () => void
  onDelete?: () => void
  onNewEvent?: () => void
}

function RibbonBar({
  activeModule,
  showFileVine,
  onSelectHomeTab,
  onSelectFileVineTab,
  onNewEmail,
  onDelete,
  onNewEvent
}: RibbonBarProps): ReactElement {
  const actions = activeModule === 'mail' ? MAIL_ACTIONS : CALENDAR_ACTIONS
  const actionHandlers: Partial<Record<string, () => void>> = {
    'New Email': onNewEmail,
    Delete: onDelete,
    'New Event': onNewEvent
  }
  const tabHandlers: Partial<Record<ClickableTab, () => void>> = {
    Home: onSelectHomeTab,
    FileVine: onSelectFileVineTab
  }
  const activeTab: ClickableTab = showFileVine ? 'FileVine' : 'Home'

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
          return (
            <button key={action} type="button" className="ribbon-action" disabled={!handler} onClick={handler}>
              {action}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default RibbonBar
