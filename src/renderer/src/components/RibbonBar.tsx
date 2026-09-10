import type { ReactElement } from 'react'
import type { ModuleId } from '../types'

const TABS = ['File', 'Home', 'Send / Receive', 'Folder', 'View']

const MAIL_ACTIONS = ['New Email', 'New Items', 'Delete', 'Reply', 'Reply All', 'Forward']
const CALENDAR_ACTIONS = ['New Event', 'New Meeting', 'Today', 'Day', 'Work Week', 'Week', 'Month']

interface RibbonBarProps {
  activeModule: ModuleId
}

function RibbonBar({ activeModule }: RibbonBarProps): ReactElement {
  const actions = activeModule === 'mail' ? MAIL_ACTIONS : CALENDAR_ACTIONS

  return (
    <div className="ribbon">
      <div className="ribbon-tabs" role="tablist" aria-label="Ribbon tabs">
        {TABS.map((tab, index) => (
          <button key={tab} type="button" className={`ribbon-tab${index === 1 ? ' active' : ''}`} disabled>
            {tab}
          </button>
        ))}
      </div>
      <div className="ribbon-actions">
        {actions.map((action) => (
          <button key={action} type="button" className="ribbon-action" disabled>
            {action}
          </button>
        ))}
      </div>
    </div>
  )
}

export default RibbonBar
