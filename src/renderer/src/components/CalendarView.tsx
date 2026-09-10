import type { ReactElement } from 'react'

const VIEWS = ['Day', 'Work Week', 'Week', 'Month']

function CalendarView(): ReactElement {
  return (
    <div className="calendar-view">
      <div className="calendar-view-header">
        {VIEWS.map((view, index) => (
          <span key={view} className={`calendar-view-tab${index === 2 ? ' active' : ''}`}>
            {view}
          </span>
        ))}
      </div>
      <div className="calendar-view-empty">No calendar items to show.</div>
    </div>
  )
}

export default CalendarView
