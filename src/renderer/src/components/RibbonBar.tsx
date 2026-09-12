import type { ReactElement } from 'react'
import type { ModuleId } from '../types'
import OfficeClock from './OfficeClock'

const TABS = ['File', 'Home', 'Send / Receive', 'Folder', 'View']

const MAIL_ACTIONS = ['New Email', 'New Items', 'Delete', 'Reply', 'Reply All', 'Forward']
// Day/Work Week/Week/Month/Today live in CalendarView's own view-tab header,
// not here — no need to duplicate the view switcher in the ribbon too.
// New Meeting is hidden until meeting invites/RSVP (an explicit spec
// non-goal for v1) actually get built — no point showing a button that can
// never be wired up.
const CALENDAR_ACTIONS = ['New Event']

interface RibbonBarProps {
  activeModule: ModuleId
  onNewEmail?: () => void
  onDelete?: () => void
  onNewEvent?: () => void
}

function RibbonBar({ activeModule, onNewEmail, onDelete, onNewEvent }: RibbonBarProps): ReactElement {
  const actions = activeModule === 'mail' ? MAIL_ACTIONS : CALENDAR_ACTIONS
  const actionHandlers: Partial<Record<string, () => void>> = {
    'New Email': onNewEmail,
    Delete: onDelete,
    'New Event': onNewEvent
  }

  return (
    <div className="ribbon">
      <div className="ribbon-tabs">
        <div className="ribbon-tabs-list" role="tablist" aria-label="Ribbon tabs">
          {TABS.map((tab, index) => (
            <button key={tab} type="button" className={`ribbon-tab${index === 1 ? ' active' : ''}`} disabled>
              {tab}
            </button>
          ))}
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
