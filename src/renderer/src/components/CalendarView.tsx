import { useEffect, useState, type ReactElement } from 'react'
import type { CalendarItem, NewCalendarItem } from '../../../shared/data-types'
import {
  formatRangeLabel,
  getVisibleDays,
  isSameDay,
  shiftAnchor,
  startOfDayMs,
  type CalendarViewId
} from '../calendarDates'

const VIEW_OPTIONS: { id: CalendarViewId; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'workWeek', label: 'Work Week' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' }
]

const HOUR_MS = 60 * 60 * 1000

interface CalendarViewProps {
  showCreateForm: boolean
  onCloseCreateForm: () => void
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function msToDatetimeLocal(ms: number): string {
  const date = new Date(ms)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function datetimeLocalToMs(value: string): number | null {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}

function formatEventTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

interface CalendarEventFormProps {
  initialStartMs: number
  onCreate: (item: NewCalendarItem) => void | Promise<void>
  onCancel: () => void
}

// A separate component (rather than an effect in the parent) so that
// re-mounting it fresh each time it's shown is what resets its fields —
// no imperative "reseed on open" effect needed.
function CalendarEventForm({ initialStartMs, onCreate, onCancel }: CalendarEventFormProps): ReactElement {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startInput, setStartInput] = useState(() => msToDatetimeLocal(initialStartMs))
  const [endInput, setEndInput] = useState(() => msToDatetimeLocal(initialStartMs + HOUR_MS))
  const [formError, setFormError] = useState<string | null>(null)

  function handleSubmit(): void {
    const startTime = datetimeLocalToMs(startInput)
    if (!title.trim() || startTime === null) {
      setFormError('Title and start time are required.')
      return
    }
    const endTime = datetimeLocalToMs(endInput)
    onCreate({
      title: title.trim(),
      description,
      startTime,
      endTime,
      allDay: false,
      reminderMinutesBefore: null,
      recurrenceRule: null,
      itemType: 'event'
    })
  }

  return (
    <div className="calendar-event-form" role="dialog" aria-label="New Event">
      <div className="calendar-event-form-row">
        <label htmlFor="calendar-event-title">Title</label>
        <input
          id="calendar-event-title"
          autoFocus
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className="calendar-event-form-row">
        <label htmlFor="calendar-event-description">Description</label>
        <textarea
          id="calendar-event-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <div className="calendar-event-form-row">
        <label htmlFor="calendar-event-start">Start</label>
        <input
          id="calendar-event-start"
          type="datetime-local"
          value={startInput}
          onChange={(event) => setStartInput(event.target.value)}
        />
      </div>
      <div className="calendar-event-form-row">
        <label htmlFor="calendar-event-end">End</label>
        <input
          id="calendar-event-end"
          type="datetime-local"
          value={endInput}
          onChange={(event) => setEndInput(event.target.value)}
        />
      </div>
      {formError && <p className="calendar-event-form-error">{formError}</p>}
      <div className="calendar-event-form-actions">
        <button type="button" onClick={handleSubmit}>
          Create
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function CalendarView({ showCreateForm, onCloseCreateForm }: CalendarViewProps): ReactElement {
  const [view, setView] = useState<CalendarViewId>('day')
  const [anchorMs, setAnchorMs] = useState(() => Date.now())
  const [today] = useState(() => startOfDayMs(Date.now()))
  const [items, setItems] = useState<CalendarItem[]>([])

  function refreshItems(): void {
    window.api.data.calendarItems.list().then(setItems)
  }

  useEffect(() => {
    let cancelled = false
    window.api.data.clock.now().then((simNow) => {
      if (!cancelled) setAnchorMs(simNow)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    refreshItems()
  }, [])

  async function handleCreate(item: NewCalendarItem): Promise<void> {
    await window.api.data.calendarItems.create(item)
    refreshItems()
    onCloseCreateForm()
  }

  const days = getVisibleDays(view, anchorMs)
  const rangeLabel = formatRangeLabel(view, anchorMs)

  return (
    <div className="calendar-view">
      <div className="calendar-view-header" role="tablist" aria-label="Calendar views">
        {VIEW_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={view === option.id}
            className={`calendar-view-tab${view === option.id ? ' active' : ''}`}
            onClick={() => setView(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="calendar-view-nav">
        <button type="button" aria-label="Previous" onClick={() => setAnchorMs((ms) => shiftAnchor(view, ms, -1))}>
          ‹
        </button>
        <button type="button" onClick={() => setAnchorMs(Date.now())}>
          Today
        </button>
        <button type="button" aria-label="Next" onClick={() => setAnchorMs((ms) => shiftAnchor(view, ms, 1))}>
          ›
        </button>
        <span className="calendar-view-range-label">{rangeLabel}</span>
      </div>

      {items.length === 0 ? (
        <div className="calendar-view-empty">No calendar items to show.</div>
      ) : view === 'month' ? (
        <div className="calendar-month-grid">
          {days.map((day) => {
            const dayItems = items.filter((item) => isSameDay(item.startTime, day))
            const inCurrentMonth = new Date(day).getMonth() === new Date(anchorMs).getMonth()
            return (
              <div
                key={day}
                className={`calendar-month-cell${inCurrentMonth ? '' : ' outside-month'}${
                  isSameDay(day, today) ? ' today' : ''
                }`}
              >
                <div className="calendar-month-cell-date">{new Date(day).getDate()}</div>
                {dayItems.map((item) => (
                  <div key={item.id} className="calendar-month-event">
                    {item.title}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="calendar-day-columns">
          {days.map((day) => {
            const dayItems = items
              .filter((item) => isSameDay(item.startTime, day))
              .sort((a, b) => a.startTime - b.startTime)
            return (
              <div key={day} className={`calendar-day-column${isSameDay(day, today) ? ' today' : ''}`}>
                <div className="calendar-day-column-header">
                  {new Date(day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                </div>
                {dayItems.map((item) => (
                  <div key={item.id} className="calendar-day-event">
                    <span className="calendar-day-event-time">{formatEventTime(item.startTime)}</span>
                    <span className="calendar-day-event-title">{item.title}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {showCreateForm && (
        <CalendarEventForm initialStartMs={anchorMs} onCreate={handleCreate} onCancel={onCloseCreateForm} />
      )}
    </div>
  )
}

export default CalendarView
