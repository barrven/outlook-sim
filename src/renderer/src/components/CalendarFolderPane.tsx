import type { ReactElement } from 'react'

function CalendarFolderPane(): ReactElement {
  return (
    <div className="folder-pane">
      <div className="folder-pane-header">My Calendars</div>
      <ul className="folder-list">
        <li>
          <button type="button" className="folder-item selected" disabled>
            Calendar
          </button>
        </li>
      </ul>
    </div>
  )
}

export default CalendarFolderPane
