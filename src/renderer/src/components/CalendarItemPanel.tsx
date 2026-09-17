import { useState, type ReactElement } from 'react'
import type { CalendarItem, CalendarItemType, NewCalendarItem, RecurrenceFrequency } from '../../../shared/data-types'
import type { CalendarOccurrence } from '../../../shared/recurrence'

const ITEM_TYPE_OPTIONS: { value: CalendarItemType; label: string }[] = [
  { value: 'event', label: 'Event' },
  { value: 'deadline', label: 'Deadline' }
]

// Value is a string so it can back a <select>; '' means "does not repeat"
// (recurrenceRule: null).
const RECURRENCE_OPTIONS: { value: RecurrenceFrequency | ''; label: string }[] = [
  { value: '', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' }
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

export function formatEventTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

interface CalendarItemFormProps {
  initialItem?: CalendarItem
  initialStartMs: number
  // Hidden when editing a single occurrence of a recurring series — the
  // repeat pattern belongs to the series as a whole, not one instance of it.
  hideRecurrenceField?: boolean
  onSave: (fields: NewCalendarItem) => void | Promise<void>
  onDelete?: () => void | Promise<void>
  onCancel: () => void
}

// A separate component (rather than an effect in the parent) so that
// re-mounting it fresh each time it's shown is what resets/reseeds its
// fields — no imperative "reseed on open" effect needed.
export function CalendarItemForm({
  initialItem,
  initialStartMs,
  hideRecurrenceField,
  onSave,
  onDelete,
  onCancel
}: CalendarItemFormProps): ReactElement {
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
  const [recurrenceSelection, setRecurrenceSelection] = useState<RecurrenceFrequency | ''>(
    initialItem?.recurrenceRule ?? ''
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
      recurrenceRule: hideRecurrenceField ? null : recurrenceSelection || null,
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
      {/* Kept mounted (just visually hidden) rather than unmounted when All
          day is checked, so the form's height — and everything above this
          row, like the All-day checkbox itself — doesn't shift on screen. */}
      <div className={`calendar-event-form-row${allDay ? ' calendar-event-form-row-hidden' : ''}`}>
        <label htmlFor="calendar-event-end">End</label>
        <input
          id="calendar-event-end"
          type="datetime-local"
          value={endInput}
          onChange={(event) => setEndInput(event.target.value)}
        />
      </div>
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
      {!hideRecurrenceField && (
        <div className="calendar-event-form-row">
          <label htmlFor="calendar-event-recurrence">Repeat</label>
          <select
            id="calendar-event-recurrence"
            value={recurrenceSelection}
            onChange={(event) => setRecurrenceSelection(event.target.value as RecurrenceFrequency | '')}
          >
            {RECURRENCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}
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

interface CalendarItemViewProps {
  occurrence: CalendarOccurrence
  onEdit: () => void
  onClose: () => void
}

// Read-only display of an already-existing item — no form controls, so a
// stray click can't edit anything. `Edit` is the only way into the mutable
// form.
function CalendarItemView({ occurrence, onEdit, onClose }: CalendarItemViewProps): ReactElement {
  const reminderLabel =
    REMINDER_OPTIONS.find(
      (option) => option.value === (occurrence.reminderMinutesBefore == null ? '' : String(occurrence.reminderMinutesBefore))
    )?.label ?? 'None'
  const typeLabel = ITEM_TYPE_OPTIONS.find((option) => option.value === occurrence.itemType)?.label ?? occurrence.itemType

  return (
    <div className="calendar-event-view" role="dialog" aria-label="View Calendar Item">
      <div className="calendar-event-form-row">
        <span className="calendar-event-view-label">Title</span>
        <span className="calendar-event-view-value">{occurrence.title}</span>
      </div>
      {occurrence.description && (
        <div className="calendar-event-form-row">
          <span className="calendar-event-view-label">Description</span>
          <span className="calendar-event-view-value">{occurrence.description}</span>
        </div>
      )}
      <div className="calendar-event-form-row">
        <span className="calendar-event-view-label">Type</span>
        <span className="calendar-event-view-value">
          {occurrence.isRecurring && <span aria-hidden="true">🔁 </span>}
          {typeLabel}
        </span>
      </div>
      <div className="calendar-event-form-row">
        <span className="calendar-event-view-label">When</span>
        <span className="calendar-event-view-value">
          {occurrence.allDay ? 'All day' : formatEventTime(occurrence.startTime)}
          {!occurrence.allDay && occurrence.endTime !== null && ` – ${formatEventTime(occurrence.endTime)}`}
        </span>
      </div>
      <div className="calendar-event-form-row">
        <span className="calendar-event-view-label">Reminder</span>
        <span className="calendar-event-view-value">{reminderLabel}</span>
      </div>
      <div className="calendar-event-form-actions">
        <button type="button" onClick={onEdit}>
          Edit
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}

export interface CalendarItemPanelProps {
  openOccurrence: CalendarOccurrence
  panelMode: 'view' | 'edit'
  editScope: 'instance' | 'series' | null
  // The underlying series row, needed to edit/delete the whole series —
  // null while it's being looked up, or if the series has since vanished
  // (e.g. deleted from another window).
  seriesForEdit: CalendarItem | null
  onEdit: () => void
  onCancelEdit: () => void
  onChooseScope: (scope: 'instance' | 'series') => void
  onClose: () => void
  onUpdateSeries: (id: string, fields: NewCalendarItem) => void | Promise<void>
  onDeleteSeries: (id: string) => void | Promise<void>
  onSaveInstance: (occurrence: CalendarOccurrence, fields: NewCalendarItem) => void | Promise<void>
  onDeleteInstance: (occurrence: CalendarOccurrence) => void | Promise<void>
}

// Feature 043's view/edit/recurrence-scope state machine, extracted so it can
// be driven identically from CalendarView's inline panel and from the
// feature-044 pop-out window — same component, same behavior, different
// hosts supplying the state and mutation callbacks.
function CalendarItemPanel({
  openOccurrence,
  panelMode,
  editScope,
  seriesForEdit,
  onEdit,
  onCancelEdit,
  onChooseScope,
  onClose,
  onUpdateSeries,
  onDeleteSeries,
  onSaveInstance,
  onDeleteInstance
}: CalendarItemPanelProps): ReactElement | null {
  if (panelMode === 'view') {
    return <CalendarItemView occurrence={openOccurrence} onEdit={onEdit} onClose={onClose} />
  }
  if (editScope === null) {
    return (
      <div className="calendar-recurrence-scope-chooser" role="dialog" aria-label="Edit Recurring Item">
        <p>“{openOccurrence.title}” is part of a recurring series. Apply your change to:</p>
        <div className="calendar-event-form-actions">
          <button type="button" onClick={() => onChooseScope('instance')}>
            This event
          </button>
          <button type="button" onClick={() => onChooseScope('series')}>
            The whole series
          </button>
          <button type="button" onClick={onCancelEdit}>
            Cancel
          </button>
        </div>
      </div>
    )
  }
  if (editScope === 'series' && seriesForEdit) {
    return (
      <CalendarItemForm
        initialItem={seriesForEdit}
        initialStartMs={seriesForEdit.startTime}
        onSave={(fields) => onUpdateSeries(seriesForEdit.id, fields)}
        onDelete={() => onDeleteSeries(seriesForEdit.id)}
        onCancel={onCancelEdit}
      />
    )
  }
  if (editScope === 'instance') {
    return (
      <CalendarItemForm
        initialItem={{
          id: openOccurrence.seriesId,
          title: openOccurrence.title,
          description: openOccurrence.description,
          startTime: openOccurrence.startTime,
          endTime: openOccurrence.endTime,
          allDay: openOccurrence.allDay,
          reminderMinutesBefore: openOccurrence.reminderMinutesBefore,
          recurrenceRule: null,
          recurrenceExceptions: [],
          itemType: openOccurrence.itemType,
          remindersFired: []
        }}
        initialStartMs={openOccurrence.startTime}
        hideRecurrenceField
        onSave={(fields) => onSaveInstance(openOccurrence, fields)}
        onDelete={() => onDeleteInstance(openOccurrence)}
        onCancel={onCancelEdit}
      />
    )
  }
  return null
}

export default CalendarItemPanel
