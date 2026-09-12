import { useEffect, useState, type ReactElement } from 'react'
import type { CalendarItem, CalendarItemType, NewCalendarItem } from '../../../shared/data-types'
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

const ITEM_TYPE_OPTIONS: { value: CalendarItemType; label: string }[] = [
  { value: 'event', label: 'Event' },
  { value: 'deadline', label: 'Deadline' }
]

// Value is a string so it can back a <select>; '' means "no reminder"
// (reminderMinutesBefore: null).
const REMINDER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'None' },
  { value: '0', label: 'At time of event' },
  { value: '5', label: '5 minutes before' },
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '1440', label: '1 day before' }
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

// Native <input type="date"> values ("YYYY-MM-DD") parse as UTC midnight per
// the ISO-8601 spec, which would silently shift the date in most timezones —
// unlike datetime-local strings, which parse as local time. Build the local
// Date explicitly instead of handing the string to `new Date(...)`.
function msToDateOnly(ms: number): string {
  const date = new Date(ms)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function dateOnlyToMs(value: string): number | null {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day).getTime()
}

function formatEventTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

interface CalendarItemFormProps {
  initialItem?: CalendarItem
  initialStartMs: number
  onSave: (fields: NewCalendarItem) => void | Promise<void>
  onDelete?: () => void | Promise<void>
  onCancel: () => void
}

// A separate component (rather than an effect in the parent) so that
// re-mounting it fresh each time it's shown is what resets/reseeds its
// fields — no imperative "reseed on open" effect needed.
function CalendarItemForm({ initialItem, initialStartMs, onSave, onDelete, onCancel }: CalendarItemFormProps): ReactElement {
  const isEditing = Boolean(initialItem)
  const [title, setTitle] = useState(initialItem?.title ?? '')
  const [description, setDescription] = useState(initialItem?.description ?? '')
  const [itemType, setItemType] = useState<CalendarItemType>(initialItem?.itemType ?? 'event')
  const [allDay, setAllDay] = useState(initialItem?.allDay ?? false)
  const [startInput, setStartInput] = useState(() =>
    initialItem?.allDay ? msToDateOnly(initialStartMs) : msToDatetimeLocal(initialStartMs)
  )
  const [endInput, setEndInput] = useState(() =>
    msToDatetimeLocal(initialItem?.endTime ?? initialStartMs + HOUR_MS)
  )
  const [reminderSelection, setReminderSelection] = useState(
    initialItem?.reminderMinutesBefore != null ? String(initialItem.reminderMinutesBefore) : ''
  )
  const [formError, setFormError] = useState<string | null>(null)

  function handleAllDayChange(checked: boolean): void {
    setAllDay(checked)
    setStartInput((prev) => (checked ? prev.slice(0, 10) : `${prev.slice(0, 10)}T09:00`))
  }

  function handleSubmit(): void {
    const startTime = allDay ? dateOnlyToMs(startInput) : datetimeLocalToMs(startInput)
    if (!title.trim() || startTime === null) {
      setFormError('Title and start time are required.')
      return
    }
    onSave({
      title: title.trim(),
      description,
      startTime,
      endTime: allDay ? null : datetimeLocalToMs(endInput),
      allDay,
      reminderMinutesBefore: reminderSelection === '' ? null : Number(reminderSelection),
      recurrenceRule: initialItem?.recurrenceRule ?? null,
      itemType
    })
  }

  return (
    <div className="calendar-event-form" role="dialog" aria-label={isEditing ? 'Edit Calendar Item' : 'New Event'}>
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
        <label htmlFor="calendar-event-type">Type</label>
        <select
          id="calendar-event-type"
          value={itemType}
          onChange={(event) => setItemType(event.target.value as CalendarItemType)}
        >
          {ITEM_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="calendar-event-form-row calendar-event-form-row-checkbox">
        <label htmlFor="calendar-event-allday">All day</label>
        <input
          id="calendar-event-allday"
          type="checkbox"
          checked={allDay}
          onChange={(event) => handleAllDayChange(event.target.checked)}
        />
      </div>
      <div className="calendar-event-form-row">
        <label htmlFor="calendar-event-start">Start</label>
        <input
          id="calendar-event-start"
          type={allDay ? 'date' : 'datetime-local'}
          value={startInput}
          onChange={(event) => setStartInput(event.target.value)}
        />
      </div>
      {!allDay && (
        <div className="calendar-event-form-row">
          <label htmlFor="calendar-event-end">End</label>
          <input
            id="calendar-event-end"
            type="datetime-local"
            value={endInput}
            onChange={(event) => setEndInput(event.target.value)}
          />
        </div>
      )}
      <div className="calendar-event-form-row">
        <label htmlFor="calendar-event-reminder">Reminder</label>
        <select
          id="calendar-event-reminder"
          value={reminderSelection}
          onChange={(event) => setReminderSelection(event.target.value)}
        >
          {REMINDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {formError && <p className="calendar-event-form-error">{formError}</p>}
      <div className="calendar-event-form-actions">
        <button type="button" onClick={handleSubmit}>
          {isEditing ? 'Save' : 'Create'}
        </button>
        {onDelete && (
          <button type="button" onClick={onDelete}>
            Delete
          </button>
        )}
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
  const [today, setToday] = useState(() => startOfDayMs(Date.now()))
  const [items, setItems] = useState<CalendarItem[]>([])
  const [editingItem, setEditingItem] = useState<CalendarItem | null>(null)

  function refreshItems(): void {
    window.api.data.calendarItems.list().then(setItems)
  }

  // "Today" follows the simulated office clock, not the real wall clock —
  // same convention as every other time-driven part of the app.
  function goToToday(): void {
    window.api.data.clock.now().then((simNow) => {
      setAnchorMs(simNow)
      setToday(startOfDayMs(simNow))
    })
  }

  useEffect(() => {
    let cancelled = false
    window.api.data.clock.now().then((simNow) => {
      if (cancelled) return
      setAnchorMs(simNow)
      setToday(startOfDayMs(simNow))
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    refreshItems()
  }, [])

  async function handleCreate(fields: NewCalendarItem): Promise<void> {
    await window.api.data.calendarItems.create(fields)
    refreshItems()
    onCloseCreateForm()
  }

  async function handleUpdate(id: string, fields: NewCalendarItem): Promise<void> {
    await window.api.data.calendarItems.update(id, fields)
    refreshItems()
    setEditingItem(null)
  }

  async function handleDelete(id: string): Promise<void> {
    await window.api.data.calendarItems.delete(id)
    refreshItems()
    setEditingItem(null)
  }

  function openEdit(item: CalendarItem): void {
    if (showCreateForm) onCloseCreateForm()
    setEditingItem(item)
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
        <button type="button" onClick={goToToday}>
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
                  <button
                    key={item.id}
                    type="button"
                    className={`calendar-month-event${item.itemType === 'deadline' ? ' deadline' : ''}`}
                    onClick={() => openEdit(item)}
                  >
                    {item.title}
                  </button>
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
                  <button
                    key={item.id}
                    type="button"
                    className={`calendar-day-event${item.itemType === 'deadline' ? ' deadline' : ''}`}
                    onClick={() => openEdit(item)}
                  >
                    <span className="calendar-day-event-time">
                      {item.allDay ? 'All day' : formatEventTime(item.startTime)}
                    </span>
                    <span className="calendar-day-event-title">{item.title}</span>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {showCreateForm ? (
        <CalendarItemForm initialStartMs={anchorMs} onSave={handleCreate} onCancel={onCloseCreateForm} />
      ) : (
        editingItem && (
          <CalendarItemForm
            initialItem={editingItem}
            initialStartMs={editingItem.startTime}
            onSave={(fields) => handleUpdate(editingItem.id, fields)}
            onDelete={() => handleDelete(editingItem.id)}
            onCancel={() => setEditingItem(null)}
          />
        )
      )}
    </div>
  )
}

export default CalendarView
