import { useEffect, useState, type ReactElement } from 'react'
import type { CalendarItem, CalendarRecurrenceException, NewCalendarItem } from '../../../shared/data-types'
import {
  addDaysMs,
  formatRangeLabel,
  getVisibleDays,
  isSameDay,
  shiftAnchor,
  startOfDayMs,
  type CalendarViewId
} from '../calendarDates'
import { expandOccurrences, upsertException, type CalendarOccurrence } from '../../../shared/recurrence'
import CalendarItemPanel, { CalendarItemForm, formatEventTime } from './CalendarItemPanel'

const VIEW_OPTIONS: { id: CalendarViewId; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'workWeek', label: 'Work Week' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' }
]

interface CalendarViewProps {
  showCreateForm: boolean
  onCloseCreateForm: () => void
}

function CalendarView({ showCreateForm, onCloseCreateForm }: CalendarViewProps): ReactElement {
  const [view, setView] = useState<CalendarViewId>('day')
  const [anchorMs, setAnchorMs] = useState(() => Date.now())
  const [today, setToday] = useState(() => startOfDayMs(Date.now()))
  const [items, setItems] = useState<CalendarItem[]>([])
  // The occurrence the user clicked, which panel mode it's showing, and —
  // only once editing and it's been determined whether that requires asking
  // "this event or the series?" — which scope they picked. A non-recurring
  // occurrence skips straight to 'series' scope (startEdit sets it
  // directly), since there's no ambiguity to resolve for a one-off item.
  const [openOccurrence, setOpenOccurrence] = useState<CalendarOccurrence | null>(null)
  const [panelMode, setPanelMode] = useState<'view' | 'edit'>('view')
  const [editScope, setEditScope] = useState<'instance' | 'series' | null>(null)

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

  // Feature 044 — a calendar pop-out window editing/deleting an item
  // broadcasts the same way messages do, so this view refetches and
  // re-renders live, same cross-window pattern as everywhere else.
  useEffect(() => {
    return window.api.onCalendarItemsChanged(() => {
      refreshItems()
    })
  }, [])

  async function handleCreate(fields: NewCalendarItem): Promise<void> {
    await window.api.data.calendarItems.create(fields)
    refreshItems()
    onCloseCreateForm()
  }

  function closePanel(): void {
    setOpenOccurrence(null)
    setPanelMode('view')
    setEditScope(null)
  }

  // Back out of the edit form to the read-only view of the same item,
  // rather than closing the panel outright — Cancel undoes the edit
  // attempt, not the fact that you were looking at this item.
  function cancelEdit(): void {
    setPanelMode('view')
    setEditScope(null)
  }

  function startEdit(): void {
    if (!openOccurrence) return
    setPanelMode('edit')
    // Non-recurring items have no series/instance ambiguity to resolve.
    if (!openOccurrence.isRecurring) setEditScope('series')
  }

  // Edits/deletes the series' own template row directly — used both for a
  // plain non-recurring item and for "edit/delete the whole series".
  async function handleUpdateSeries(id: string, fields: NewCalendarItem): Promise<void> {
    await window.api.data.calendarItems.update(id, fields)
    refreshItems()
    closePanel()
  }

  async function handleDeleteSeries(id: string): Promise<void> {
    await window.api.data.calendarItems.delete(id)
    refreshItems()
    closePanel()
  }

  // "Edit this event only": records (or replaces) an exception on the
  // series, keyed by the occurrence's stable originalStartTime, without
  // touching the series' own template fields or any other occurrence.
  async function handleSaveInstance(occurrence: CalendarOccurrence, fields: NewCalendarItem): Promise<void> {
    const series = items.find((item) => item.id === occurrence.seriesId)
    if (!series) return
    const exception: CalendarRecurrenceException = {
      originalStartTime: occurrence.originalStartTime,
      deleted: false,
      title: fields.title,
      description: fields.description,
      startTime: fields.startTime,
      endTime: fields.endTime,
      allDay: fields.allDay,
      reminderMinutesBefore: fields.reminderMinutesBefore,
      itemType: fields.itemType
    }
    await window.api.data.calendarItems.update(series.id, {
      recurrenceExceptions: upsertException(series.recurrenceExceptions, exception)
    })
    refreshItems()
    closePanel()
  }

  async function handleDeleteInstance(occurrence: CalendarOccurrence): Promise<void> {
    const series = items.find((item) => item.id === occurrence.seriesId)
    if (!series) return
    await window.api.data.calendarItems.update(series.id, {
      recurrenceExceptions: upsertException(series.recurrenceExceptions, {
        originalStartTime: occurrence.originalStartTime,
        deleted: true
      })
    })
    refreshItems()
    closePanel()
  }

  // Clicking any calendar item — including a different one while another is
  // already open — always (re)opens fresh in read-only view mode; there's
  // never more than one item's panel open at a time.
  function openView(occurrence: CalendarOccurrence): void {
    if (showCreateForm) onCloseCreateForm()
    setOpenOccurrence(occurrence)
    setPanelMode('view')
    setEditScope(null)
  }

  // Double-clicking opens the item in its own window (feature 044) — purely
  // additive alongside the single-click inline panel above (AC4); doesn't
  // touch this window's own state at all.
  function openPopout(occurrence: CalendarOccurrence): void {
    window.api.calendarPopout.open(occurrence.seriesId, occurrence.originalStartTime)
  }

  const days = getVisibleDays(view, anchorMs)
  const rangeLabel = formatRangeLabel(view, anchorMs)
  const rangeStartMs = days[0]
  const rangeEndExclusiveMs = addDaysMs(days[days.length - 1], 1)
  const occurrences = expandOccurrences(items, rangeStartMs, rangeEndExclusiveMs)
  const seriesForEdit = openOccurrence ? (items.find((item) => item.id === openOccurrence.seriesId) ?? null) : null

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

      {occurrences.length === 0 ? (
        <div className="calendar-view-empty">No calendar items to show.</div>
      ) : view === 'month' ? (
        <div className="calendar-month-grid">
          {days.map((day) => {
            const dayOccurrences = occurrences.filter((occurrence) => isSameDay(occurrence.startTime, day))
            const inCurrentMonth = new Date(day).getMonth() === new Date(anchorMs).getMonth()
            return (
              <div
                key={day}
                className={`calendar-month-cell${inCurrentMonth ? '' : ' outside-month'}${
                  isSameDay(day, today) ? ' today' : ''
                }`}
              >
                <div className="calendar-month-cell-date">{new Date(day).getDate()}</div>
                {dayOccurrences.map((occurrence) => (
                  <button
                    key={`${occurrence.seriesId}-${occurrence.originalStartTime}`}
                    type="button"
                    className={`calendar-month-event${occurrence.itemType === 'deadline' ? ' deadline' : ''}`}
                    onClick={() => openView(occurrence)}
                    onDoubleClick={() => openPopout(occurrence)}
                  >
                    {occurrence.isRecurring && <span aria-hidden="true">🔁 </span>}
                    {occurrence.title}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="calendar-day-columns">
          {days.map((day) => {
            const dayOccurrences = occurrences
              .filter((occurrence) => isSameDay(occurrence.startTime, day))
              .sort((a, b) => a.startTime - b.startTime)
            return (
              <div key={day} className={`calendar-day-column${isSameDay(day, today) ? ' today' : ''}`}>
                <div className="calendar-day-column-header">
                  {new Date(day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                </div>
                {dayOccurrences.map((occurrence) => (
                  <button
                    key={`${occurrence.seriesId}-${occurrence.originalStartTime}`}
                    type="button"
                    className={`calendar-day-event${occurrence.itemType === 'deadline' ? ' deadline' : ''}`}
                    onClick={() => openView(occurrence)}
                    onDoubleClick={() => openPopout(occurrence)}
                  >
                    <span className="calendar-day-event-time">
                      {occurrence.isRecurring && <span aria-hidden="true">🔁 </span>}
                      {occurrence.allDay ? 'All day' : formatEventTime(occurrence.startTime)}
                    </span>
                    <span className="calendar-day-event-title">{occurrence.title}</span>
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
        openOccurrence && (
          <CalendarItemPanel
            openOccurrence={openOccurrence}
            panelMode={panelMode}
            editScope={editScope}
            seriesForEdit={seriesForEdit}
            onEdit={startEdit}
            onCancelEdit={cancelEdit}
            onChooseScope={setEditScope}
            onClose={closePanel}
            onUpdateSeries={handleUpdateSeries}
            onDeleteSeries={handleDeleteSeries}
            onSaveInstance={handleSaveInstance}
            onDeleteInstance={handleDeleteInstance}
          />
        )
      )}
    </div>
  )
}

export default CalendarView
