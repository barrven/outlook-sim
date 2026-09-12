// @vitest-environment jsdom
import { useState, type ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CalendarView from './CalendarView'
import type { CalendarItem } from '../../../shared/data-types'

// Wednesday, March 11, 2026, 9:00am local — matches the reference date used
// in calendarDates.test.ts so the two suites agree on what "the anchor week"
// and "the anchor month" mean.
const ANCHOR_MS = new Date(2026, 2, 11, 9, 0).getTime()

function setAnchorClock(ms: number): void {
  vi.mocked(window.api.data.clock.now).mockResolvedValue(ms)
}

function makeItem(overrides: Partial<CalendarItem> = {}): CalendarItem {
  return {
    id: 'evt-1',
    title: 'Team sync',
    description: '',
    startTime: ANCHOR_MS,
    endTime: ANCHOR_MS + 60 * 60 * 1000,
    allDay: false,
    reminderMinutesBefore: null,
    recurrenceRule: null,
    itemType: 'event',
    reminderFired: false,
    ...overrides
  }
}

// A tiny stateful wrapper so tests can exercise the full open → create/cancel
// → auto-close round trip, the way App.tsx actually drives showCreateForm.
function Harness(): ReactElement {
  const [show, setShow] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setShow(true)}>
        Open New Event
      </button>
      <CalendarView showCreateForm={show} onCloseCreateForm={() => setShow(false)} />
    </>
  )
}

describe('CalendarView', () => {
  it('fetches calendar items from the persisted store on mount, not from local/hardcoded data', async () => {
    setAnchorClock(ANCHOR_MS)
    render(<CalendarView showCreateForm={false} onCloseCreateForm={vi.fn()} />)

    await waitFor(() => expect(window.api.data.calendarItems.list).toHaveBeenCalled())
  })

  it('shows the empty state when there are no calendar items', async () => {
    setAnchorClock(ANCHOR_MS)
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([])

    render(<CalendarView showCreateForm={false} onCloseCreateForm={vi.fn()} />)

    expect(await screen.findByText('No calendar items to show.')).toBeInTheDocument()
  })

  it('defaults to Day view and lets the user switch between Day, Work Week, Week, and Month', async () => {
    const user = userEvent.setup()
    setAnchorClock(ANCHOR_MS)
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([])

    render(<CalendarView showCreateForm={false} onCloseCreateForm={vi.fn()} />)
    await screen.findByText('No calendar items to show.')

    const tabs = screen.getByRole('tablist', { name: 'Calendar views' })
    expect(within(tabs).getByRole('tab', { name: 'Day' })).toHaveAttribute('aria-selected', 'true')

    for (const label of ['Work Week', 'Week', 'Month', 'Day']) {
      await user.click(within(tabs).getByRole('tab', { name: label }))
      expect(within(tabs).getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true')
      for (const other of ['Day', 'Work Week', 'Week', 'Month'].filter((l) => l !== label)) {
        expect(within(tabs).getByRole('tab', { name: other })).toHaveAttribute('aria-selected', 'false')
      }
    }
  })

  it('Previous and Next change the displayed range', async () => {
    const user = userEvent.setup()
    setAnchorClock(ANCHOR_MS)
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([])

    render(<CalendarView showCreateForm={false} onCloseCreateForm={vi.fn()} />)
    await screen.findByText('No calendar items to show.')

    const initialLabel = document.querySelector('.calendar-view-range-label')?.textContent
    await user.click(screen.getByRole('button', { name: 'Next' }))
    const afterNext = document.querySelector('.calendar-view-range-label')?.textContent
    expect(afterNext).not.toBe(initialLabel)

    await user.click(screen.getByRole('button', { name: 'Previous' }))
    await user.click(screen.getByRole('button', { name: 'Previous' }))
    const afterPrev = document.querySelector('.calendar-view-range-label')?.textContent
    expect(afterPrev).not.toBe(afterNext)
  })

  it('an event created for the anchor day is visible in Day view, and stays visible after switching to Week and Month', async () => {
    const user = userEvent.setup()
    setAnchorClock(ANCHOR_MS)
    const created = makeItem()
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValueOnce([]).mockResolvedValueOnce([created])
    vi.mocked(window.api.data.calendarItems.create).mockResolvedValue(created)

    render(<Harness />)
    await screen.findByText('No calendar items to show.')

    await user.click(screen.getByRole('button', { name: 'Open New Event' }))
    const dialog = await screen.findByRole('dialog', { name: 'New Event' })
    await user.type(within(dialog).getByLabelText('Title'), 'Team sync')
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))

    await waitFor(() =>
      expect(window.api.data.calendarItems.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Team sync', itemType: 'event', allDay: false })
      )
    )
    // The form auto-closes on successful create.
    expect(screen.queryByRole('dialog', { name: 'New Event' })).not.toBeInTheDocument()

    expect(await screen.findByText('Team sync')).toBeInTheDocument()

    const tabs = screen.getByRole('tablist', { name: 'Calendar views' })
    await user.click(within(tabs).getByRole('tab', { name: 'Week' }))
    expect(screen.getByText('Team sync')).toBeInTheDocument()

    await user.click(within(tabs).getByRole('tab', { name: 'Month' }))
    expect(screen.getByText('Team sync')).toBeInTheDocument()
  })

  it('Cancel closes the form without creating anything', async () => {
    const user = userEvent.setup()
    setAnchorClock(ANCHOR_MS)
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([])

    render(<Harness />)
    await screen.findByText('No calendar items to show.')

    await user.click(screen.getByRole('button', { name: 'Open New Event' }))
    const dialog = await screen.findByRole('dialog', { name: 'New Event' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog', { name: 'New Event' })).not.toBeInTheDocument()
    expect(window.api.data.calendarItems.create).not.toHaveBeenCalled()
  })

  it('shows a validation error and does not create when the title is blank', async () => {
    const user = userEvent.setup()
    setAnchorClock(ANCHOR_MS)
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([])

    render(<Harness />)
    await screen.findByText('No calendar items to show.')

    await user.click(screen.getByRole('button', { name: 'Open New Event' }))
    const dialog = await screen.findByRole('dialog', { name: 'New Event' })
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))

    expect(await within(dialog).findByText('Title and start time are required.')).toBeInTheDocument()
    expect(window.api.data.calendarItems.create).not.toHaveBeenCalled()
    // Still open — a failed validation doesn't close the form.
    expect(screen.getByRole('dialog', { name: 'New Event' })).toBeInTheDocument()
  })

  it('reopening the create form after a cancel starts with fresh, empty fields', async () => {
    const user = userEvent.setup()
    setAnchorClock(ANCHOR_MS)
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([])

    render(<Harness />)
    await screen.findByText('No calendar items to show.')

    await user.click(screen.getByRole('button', { name: 'Open New Event' }))
    let dialog = await screen.findByRole('dialog', { name: 'New Event' })
    await user.type(within(dialog).getByLabelText('Title'), 'Draft title')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await user.click(screen.getByRole('button', { name: 'Open New Event' }))
    dialog = await screen.findByRole('dialog', { name: 'New Event' })
    expect(within(dialog).getByLabelText('Title')).toHaveValue('')
  })

  it('"today" highlighting follows the simulated clock, not the real wall clock', async () => {
    // Pick a simulated date guaranteed to differ from whatever the real
    // system date is when this test runs.
    const simulatedToday = new Date(2031, 5, 17, 10, 0).getTime()
    setAnchorClock(simulatedToday)
    // The month grid only renders once there's at least one calendar item
    // anywhere (an existing, deliberate empty-state design decision) — this
    // item just needs to exist somewhere in the visible month.
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([
      makeItem({ startTime: new Date(2031, 5, 1, 9, 0).getTime() })
    ])

    render(<CalendarView showCreateForm={false} onCloseCreateForm={vi.fn()} />)
    await waitFor(() => expect(window.api.data.calendarItems.list).toHaveBeenCalled())

    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'Month' }))
    await screen.findByText('June 2031')

    const todayCells = document.querySelectorAll('.calendar-month-cell.today')
    expect(todayCells).toHaveLength(1)
    expect(todayCells[0].textContent).toContain('17')
    expect(screen.getByText('June 2031')).toBeInTheDocument()
  })

  it('the Today button returns to the simulated clock\'s date, not the real date, after navigating away', async () => {
    const user = userEvent.setup()
    const simulatedToday = new Date(2031, 5, 17, 10, 0).getTime()
    setAnchorClock(simulatedToday)
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([])

    render(<CalendarView showCreateForm={false} onCloseCreateForm={vi.fn()} />)
    await screen.findByText('No calendar items to show.')
    expect(await screen.findByText(/June 17, 2031/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.queryByText(/June 17, 2031/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Today' }))
    expect(await screen.findByText(/June 17, 2031/)).toBeInTheDocument()
  })

  it('an event outside the currently viewed day does not appear in Day view', async () => {
    setAnchorClock(ANCHOR_MS)
    const farAway = makeItem({ id: 'evt-2', title: 'Next month thing', startTime: ANCHOR_MS + 40 * 24 * 60 * 60 * 1000 })
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([farAway])

    render(<CalendarView showCreateForm={false} onCloseCreateForm={vi.fn()} />)

    await waitFor(() => expect(window.api.data.calendarItems.list).toHaveBeenCalled())
    expect(screen.queryByText('Next month thing')).not.toBeInTheDocument()
  })

  it('creating a Deadline sets itemType: "deadline"', async () => {
    const user = userEvent.setup()
    setAnchorClock(ANCHOR_MS)
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([])
    vi.mocked(window.api.data.calendarItems.create).mockResolvedValue(makeItem({ itemType: 'deadline' }))

    render(<Harness />)
    await screen.findByText('No calendar items to show.')
    await user.click(screen.getByRole('button', { name: 'Open New Event' }))
    const dialog = await screen.findByRole('dialog', { name: 'New Event' })

    await user.type(within(dialog).getByLabelText('Title'), 'OCF-3 filing')
    await user.selectOptions(within(dialog).getByLabelText('Type'), 'deadline')
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))

    await waitFor(() =>
      expect(window.api.data.calendarItems.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'OCF-3 filing', itemType: 'deadline' })
      )
    )
  })

  it('checking "All day" switches the Start field from a datetime picker to a date-only picker', async () => {
    const user = userEvent.setup()
    setAnchorClock(ANCHOR_MS)
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([])

    render(<Harness />)
    await screen.findByText('No calendar items to show.')
    await user.click(screen.getByRole('button', { name: 'Open New Event' }))
    const dialog = await screen.findByRole('dialog', { name: 'New Event' })

    expect(within(dialog).getByLabelText('Start')).toHaveAttribute('type', 'datetime-local')
    await user.click(within(dialog).getByLabelText('All day'))
    expect(within(dialog).getByLabelText('Start')).toHaveAttribute('type', 'date')
    // The End field only makes sense for timed events.
    expect(within(dialog).queryByLabelText('End')).not.toBeInTheDocument()
  })

  it('creating an all-day item sends allDay: true, endTime: null, and a start time at local midnight of the anchor date', async () => {
    const user = userEvent.setup()
    setAnchorClock(ANCHOR_MS) // 2026-03-11 09:00 local
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([])
    vi.mocked(window.api.data.calendarItems.create).mockResolvedValue(makeItem({ allDay: true }))

    render(<Harness />)
    await screen.findByText('No calendar items to show.')
    await user.click(screen.getByRole('button', { name: 'Open New Event' }))
    const dialog = await screen.findByRole('dialog', { name: 'New Event' })

    await user.type(within(dialog).getByLabelText('Title'), 'Office closed')
    await user.click(within(dialog).getByLabelText('All day'))
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(window.api.data.calendarItems.create).toHaveBeenCalled())
    expect(window.api.data.calendarItems.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Office closed',
        allDay: true,
        endTime: null,
        startTime: new Date(2026, 2, 11).getTime()
      })
    )
  })

  it('selecting a reminder option sets reminderMinutesBefore accordingly', async () => {
    const user = userEvent.setup()
    setAnchorClock(ANCHOR_MS)
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([])
    vi.mocked(window.api.data.calendarItems.create).mockResolvedValue(makeItem())

    render(<Harness />)
    await screen.findByText('No calendar items to show.')
    await user.click(screen.getByRole('button', { name: 'Open New Event' }))
    const dialog = await screen.findByRole('dialog', { name: 'New Event' })

    await user.type(within(dialog).getByLabelText('Title'), 'Client call')
    await user.selectOptions(within(dialog).getByLabelText('Reminder'), '15 minutes before')
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))

    await waitFor(() =>
      expect(window.api.data.calendarItems.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Client call', reminderMinutesBefore: 15 })
      )
    )
  })

  it('leaving the reminder as "None" sends reminderMinutesBefore: null', async () => {
    const user = userEvent.setup()
    setAnchorClock(ANCHOR_MS)
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([])
    vi.mocked(window.api.data.calendarItems.create).mockResolvedValue(makeItem())

    render(<Harness />)
    await screen.findByText('No calendar items to show.')
    await user.click(screen.getByRole('button', { name: 'Open New Event' }))
    const dialog = await screen.findByRole('dialog', { name: 'New Event' })

    await user.type(within(dialog).getByLabelText('Title'), 'Client call')
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))

    await waitFor(() =>
      expect(window.api.data.calendarItems.create).toHaveBeenCalledWith(
        expect.objectContaining({ reminderMinutesBefore: null })
      )
    )
  })

  it('shows "All day" instead of a time for an all-day item in Day view', async () => {
    setAnchorClock(ANCHOR_MS)
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([
      makeItem({ allDay: true, title: 'Office closed' })
    ])

    render(<CalendarView showCreateForm={false} onCloseCreateForm={vi.fn()} />)

    expect(await screen.findByText('Office closed')).toBeInTheDocument()
    expect(screen.getByText('All day')).toBeInTheDocument()
  })

  describe('editing and deleting an existing item', () => {
    function existingItem(): CalendarItem {
      return makeItem({
        id: 'evt-edit',
        title: 'Team sync',
        itemType: 'event',
        allDay: false,
        reminderMinutesBefore: 30
      })
    }

    it('clicking an existing item opens it for editing, pre-filled with its current fields', async () => {
      const user = userEvent.setup()
      setAnchorClock(ANCHOR_MS)
      vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([existingItem()])

      render(<CalendarView showCreateForm={false} onCloseCreateForm={vi.fn()} />)
      await user.click(await screen.findByText('Team sync'))

      const dialog = await screen.findByRole('dialog', { name: 'Edit Calendar Item' })
      expect(within(dialog).getByLabelText('Title')).toHaveValue('Team sync')
      expect(within(dialog).getByLabelText('Type')).toHaveValue('event')
      expect(within(dialog).getByLabelText('All day')).not.toBeChecked()
      expect(within(dialog).getByLabelText('Reminder')).toHaveValue('30')
      expect(within(dialog).getByRole('button', { name: 'Save' })).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    })

    it('saving an edit calls update with the item id and the new fields, then reflects the change', async () => {
      const user = userEvent.setup()
      setAnchorClock(ANCHOR_MS)
      const original = existingItem()
      const updated = { ...original, title: 'Team sync (moved)' }
      vi.mocked(window.api.data.calendarItems.list)
        .mockResolvedValueOnce([original])
        .mockResolvedValueOnce([updated])
      vi.mocked(window.api.data.calendarItems.update).mockResolvedValue(updated)

      render(<CalendarView showCreateForm={false} onCloseCreateForm={vi.fn()} />)
      await user.click(await screen.findByText('Team sync'))
      const dialog = await screen.findByRole('dialog', { name: 'Edit Calendar Item' })

      const titleInput = within(dialog).getByLabelText('Title')
      await user.clear(titleInput)
      await user.type(titleInput, 'Team sync (moved)')
      await user.click(within(dialog).getByRole('button', { name: 'Save' }))

      await waitFor(() =>
        expect(window.api.data.calendarItems.update).toHaveBeenCalledWith(
          original.id,
          expect.objectContaining({ title: 'Team sync (moved)' })
        )
      )
      expect(screen.queryByRole('dialog', { name: 'Edit Calendar Item' })).not.toBeInTheDocument()
      expect(await screen.findByText('Team sync (moved)')).toBeInTheDocument()
    })

    it('clicking Delete removes the item via the delete IPC and closes the form', async () => {
      const user = userEvent.setup()
      setAnchorClock(ANCHOR_MS)
      const original = existingItem()
      vi.mocked(window.api.data.calendarItems.list).mockResolvedValueOnce([original]).mockResolvedValueOnce([])
      vi.mocked(window.api.data.calendarItems.delete).mockResolvedValue(undefined)

      render(<CalendarView showCreateForm={false} onCloseCreateForm={vi.fn()} />)
      await user.click(await screen.findByText('Team sync'))
      const dialog = await screen.findByRole('dialog', { name: 'Edit Calendar Item' })

      await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

      await waitFor(() => expect(window.api.data.calendarItems.delete).toHaveBeenCalledWith(original.id))
      expect(screen.queryByRole('dialog', { name: 'Edit Calendar Item' })).not.toBeInTheDocument()
      await waitFor(() => expect(screen.queryByText('Team sync')).not.toBeInTheDocument())
    })

    it('opening "New Event" while editing an item closes the edit form in favor of the create form', async () => {
      const user = userEvent.setup()
      setAnchorClock(ANCHOR_MS)
      vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([existingItem()])

      function EditThenCreateHarness(): ReactElement {
        const [showCreate, setShowCreate] = useState(false)
        return (
          <>
            <button type="button" onClick={() => setShowCreate(true)}>
              Open New Event
            </button>
            <CalendarView showCreateForm={showCreate} onCloseCreateForm={() => setShowCreate(false)} />
          </>
        )
      }

      render(<EditThenCreateHarness />)
      await user.click(await screen.findByText('Team sync'))
      expect(await screen.findByRole('dialog', { name: 'Edit Calendar Item' })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Open New Event' }))

      expect(screen.queryByRole('dialog', { name: 'Edit Calendar Item' })).not.toBeInTheDocument()
      expect(await screen.findByRole('dialog', { name: 'New Event' })).toBeInTheDocument()
    })
  })
})
