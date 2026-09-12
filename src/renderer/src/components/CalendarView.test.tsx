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

  it('an event outside the currently viewed day does not appear in Day view', async () => {
    setAnchorClock(ANCHOR_MS)
    const farAway = makeItem({ id: 'evt-2', title: 'Next month thing', startTime: ANCHOR_MS + 40 * 24 * 60 * 60 * 1000 })
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([farAway])

    render(<CalendarView showCreateForm={false} onCloseCreateForm={vi.fn()} />)

    await waitFor(() => expect(window.api.data.calendarItems.list).toHaveBeenCalled())
    expect(screen.queryByText('Next month thing')).not.toBeInTheDocument()
  })
})
