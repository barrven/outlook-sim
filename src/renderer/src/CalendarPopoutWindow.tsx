import { useEffect, useState, type ReactElement } from 'react'
import type { CalendarItem, NewCalendarItem } from '../../shared/data-types'
import { expandOccurrences, upsertException, type CalendarOccurrence } from '../../shared/recurrence'
import CalendarItemPanel from './components/CalendarItemPanel'

interface CalendarPopoutWindowProps {
  seriesId: string
  originalStartTime: number
}

// Feature 044 — a separate window showing one calendar occurrence, view
// mode by default, reusing the exact same CalendarItemPanel the inline
// panel in CalendarView uses (feature 043) so the view/edit/recurrence-
// scope behavior is identical. Unlike the mail pop-out (which fetches one
// message by id), a calendar occurrence isn't a standalone row — it's
// derived from its series plus recurrence rules/exceptions, so this window
// fetches the full items list and re-expands just this one occurrence.
function CalendarPopoutWindow({ seriesId, originalStartTime }: CalendarPopoutWindowProps): ReactElement {
  const [items, setItems] = useState<CalendarItem[]>([])
  // Distinguishes "haven't fetched yet" from "fetched and genuinely empty" —
  // items.length alone can't tell those apart when this occurrence was the
  // only item and just got deleted.
  const [hasFetched, setHasFetched] = useState(false)
  const [panelMode, setPanelMode] = useState<'view' | 'edit'>('view')
  const [editScope, setEditScope] = useState<'instance' | 'series' | null>(null)

  function refreshItems(): void {
    window.api.data.calendarItems.list().then((list) => {
      setItems(list)
      setHasFetched(true)
    })
  }

  useEffect(() => {
    refreshItems()
  }, [])

  // Same cross-window refresh pattern as messages (AC2): an edit/delete made
  // elsewhere — including from the main window — refetches into this window
  // too, keeping it consistent with the item's real current state.
  useEffect(() => {
    return window.api.onCalendarItemsChanged(() => {
      refreshItems()
    })
  }, [])

  const series = items.find((item) => item.id === seriesId) ?? null
  // A 1ms-wide range guarantees at most one natural occurrence time in it —
  // exactly this occurrence, regardless of whether an exception has since
  // moved its *displayed* startTime elsewhere (expandOccurrences ranges
  // against the natural, un-excepted time).
  const occurrence: CalendarOccurrence | undefined = series
    ? expandOccurrences([series], originalStartTime, originalStartTime + 1)[0]
    : undefined

  // The item this window was opened for no longer exists — deleted from
  // this window's own Delete action, or from elsewhere while it was open.
  // Nothing left to show, so close (AC3 doesn't require this, but leaving a
  // pop-out open on a vanished item would be a dead window).
  useEffect(() => {
    if (hasFetched && !occurrence) {
      window.close()
    }
  }, [hasFetched, occurrence])

  function cancelEdit(): void {
    setPanelMode('view')
    setEditScope(null)
  }

  function startEdit(): void {
    if (!occurrence) return
    setPanelMode('edit')
    if (!occurrence.isRecurring) setEditScope('series')
  }

  // Save/delete all close the window afterward — the pop-out's equivalent
  // of the inline panel's closePanel(), since there's no calendar grid
  // behind this window to return to.
  async function handleUpdateSeries(id: string, fields: NewCalendarItem): Promise<void> {
    await window.api.data.calendarItems.update(id, fields)
    window.close()
  }

  async function handleDeleteSeries(id: string): Promise<void> {
    await window.api.data.calendarItems.delete(id)
    window.close()
  }

  async function handleSaveInstance(targetOccurrence: CalendarOccurrence, fields: NewCalendarItem): Promise<void> {
    if (!series) return
    await window.api.data.calendarItems.update(series.id, {
      recurrenceExceptions: upsertException(series.recurrenceExceptions, {
        originalStartTime: targetOccurrence.originalStartTime,
        deleted: false,
        title: fields.title,
        description: fields.description,
        startTime: fields.startTime,
        endTime: fields.endTime,
        allDay: fields.allDay,
        reminderMinutesBefore: fields.reminderMinutesBefore,
        itemType: fields.itemType
      })
    })
    window.close()
  }

  async function handleDeleteInstance(targetOccurrence: CalendarOccurrence): Promise<void> {
    if (!series) return
    await window.api.data.calendarItems.update(series.id, {
      recurrenceExceptions: upsertException(series.recurrenceExceptions, {
        originalStartTime: targetOccurrence.originalStartTime,
        deleted: true
      })
    })
    window.close()
  }

  if (!occurrence) return <div className="calendar-popout-window" />

  return (
    <div className="calendar-popout-window">
      <CalendarItemPanel
        openOccurrence={occurrence}
        panelMode={panelMode}
        editScope={editScope}
        seriesForEdit={series}
        onEdit={startEdit}
        onCancelEdit={cancelEdit}
        onChooseScope={setEditScope}
        onClose={() => window.close()}
        onUpdateSeries={handleUpdateSeries}
        onDeleteSeries={handleDeleteSeries}
        onSaveInstance={handleSaveInstance}
        onDeleteInstance={handleDeleteInstance}
      />
    </div>
  )
}

export default CalendarPopoutWindow
