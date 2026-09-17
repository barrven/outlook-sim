// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CalendarPopoutWindow from './CalendarPopoutWindow'
import type { CalendarItem } from '../../shared/data-types'

function makeItem(overrides: Partial<CalendarItem> = {}): CalendarItem {
  return {
    id: 'series-1',
    title: 'Team sync',
    description: 'Weekly check-in',
    startTime: new Date(2026, 2, 10, 9, 0).getTime(),
    endTime: new Date(2026, 2, 10, 9, 30).getTime(),
    allDay: false,
    reminderMinutesBefore: null,
    recurrenceRule: null,
    recurrenceExceptions: [],
    itemType: 'event',
    remindersFired: [],
    ...overrides
  }
}

describe('CalendarPopoutWindow', () => {
  // AC1: the pop-out shows the given occurrence read-only by default — via
  // the real CalendarItemPanel/CalendarItemView (feature 043), not a
  // reimplementation.
  it('044 AC1: shows the given occurrence in read-only view mode by default', async () => {
    const item = makeItem()
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([item])

    render(<CalendarPopoutWindow seriesId="series-1" originalStartTime={item.startTime} />)

    expect(await screen.findByRole('dialog', { name: 'View Calendar Item' })).toBeInTheDocument()
    expect(screen.getByText('Team sync')).toBeInTheDocument()
    expect(screen.getByText('Weekly check-in')).toBeInTheDocument()
    expect(window.api.data.calendarItems.list).toHaveBeenCalled()
  })

  it('044 AC1: Edit reaches the pre-filled editable form for a non-recurring item', async () => {
    const user = userEvent.setup()
    const item = makeItem()
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([item])

    render(<CalendarPopoutWindow seriesId="series-1" originalStartTime={item.startTime} />)
    await screen.findByRole('dialog', { name: 'View Calendar Item' })

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    expect(await screen.findByRole('dialog', { name: 'Edit Calendar Item' })).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveValue('Team sync')
  })

  it('044 AC1: a recurring item shows the this-event/whole-series chooser before editing', async () => {
    const user = userEvent.setup()
    const item = makeItem({ recurrenceRule: 'daily' })
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([item])

    render(<CalendarPopoutWindow seriesId="series-1" originalStartTime={item.startTime} />)
    await screen.findByRole('dialog', { name: 'View Calendar Item' })

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    expect(await screen.findByRole('dialog', { name: 'Edit Recurring Item' })).toBeInTheDocument()
  })

  it('044 AC2: saving an edit calls the real update IPC, then closes the window', async () => {
    const user = userEvent.setup()
    const item = makeItem()
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([item])
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {})

    render(<CalendarPopoutWindow seriesId="series-1" originalStartTime={item.startTime} />)
    await screen.findByRole('dialog', { name: 'View Calendar Item' })
    await user.click(screen.getByRole('button', { name: 'Edit' }))

    const titleInput = await screen.findByLabelText('Title')
    await user.clear(titleInput)
    await user.type(titleInput, 'Renamed sync')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(window.api.data.calendarItems.update).toHaveBeenCalledWith(
        'series-1',
        expect.objectContaining({ title: 'Renamed sync' })
      )
    )
    expect(closeSpy).toHaveBeenCalled()
  })

  it('044 AC2: deleting the whole item calls the real delete IPC, then closes the window', async () => {
    const user = userEvent.setup()
    const item = makeItem()
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([item])
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {})

    render(<CalendarPopoutWindow seriesId="series-1" originalStartTime={item.startTime} />)
    await screen.findByRole('dialog', { name: 'View Calendar Item' })
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(window.api.data.calendarItems.delete).toHaveBeenCalledWith('series-1'))
    expect(closeSpy).toHaveBeenCalled()
  })

  it('044 AC2: editing just this occurrence of a recurring series adds an exception via update, then closes', async () => {
    const user = userEvent.setup()
    const item = makeItem({ recurrenceRule: 'daily' })
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([item])
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {})

    render(<CalendarPopoutWindow seriesId="series-1" originalStartTime={item.startTime} />)
    await screen.findByRole('dialog', { name: 'View Calendar Item' })
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(await screen.findByRole('button', { name: 'This event' }))

    const titleInput = await screen.findByLabelText('Title')
    await user.clear(titleInput)
    await user.type(titleInput, 'Just today')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(window.api.data.calendarItems.update).toHaveBeenCalledWith(
        'series-1',
        expect.objectContaining({
          recurrenceExceptions: [
            expect.objectContaining({ originalStartTime: item.startTime, title: 'Just today', deleted: false })
          ]
        })
      )
    )
    expect(closeSpy).toHaveBeenCalled()
  })

  it('Close in view mode closes the window without any mutation', async () => {
    const user = userEvent.setup()
    const item = makeItem()
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([item])
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {})

    render(<CalendarPopoutWindow seriesId="series-1" originalStartTime={item.startTime} />)
    await screen.findByRole('dialog', { name: 'View Calendar Item' })

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(closeSpy).toHaveBeenCalled()
    expect(window.api.data.calendarItems.update).not.toHaveBeenCalled()
    expect(window.api.data.calendarItems.delete).not.toHaveBeenCalled()
  })

  it('Cancel from the edit form returns to view mode rather than closing the window', async () => {
    const user = userEvent.setup()
    const item = makeItem()
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([item])
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {})

    render(<CalendarPopoutWindow seriesId="series-1" originalStartTime={item.startTime} />)
    await screen.findByRole('dialog', { name: 'View Calendar Item' })
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await screen.findByRole('dialog', { name: 'Edit Calendar Item' })

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(await screen.findByRole('dialog', { name: 'View Calendar Item' })).toBeInTheDocument()
    expect(closeSpy).not.toHaveBeenCalled()
  })

  // AC2: reflects live state via the same cross-window broadcast pattern
  // messages already use.
  it('044 AC2: refetches when the main-process data:calendar-items-changed broadcast fires', async () => {
    const item = makeItem()
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([item])

    render(<CalendarPopoutWindow seriesId="series-1" originalStartTime={item.startTime} />)
    await screen.findByRole('dialog', { name: 'View Calendar Item' })
    expect(window.api.data.calendarItems.list).toHaveBeenCalledTimes(1)

    const [onCalendarItemsChanged] = vi.mocked(window.api.onCalendarItemsChanged).mock.calls[0]
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([{ ...item, title: 'Renamed elsewhere' }])
    onCalendarItemsChanged()

    await waitFor(() => expect(screen.getByText('Renamed elsewhere')).toBeInTheDocument())
  })

  it('044: subscribes to onCalendarItemsChanged and unsubscribes on unmount', async () => {
    const unsubscribe = vi.fn()
    vi.mocked(window.api.onCalendarItemsChanged).mockReturnValue(unsubscribe)
    const item = makeItem()
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValue([item])

    const { unmount } = render(<CalendarPopoutWindow seriesId="series-1" originalStartTime={item.startTime} />)
    await screen.findByRole('dialog', { name: 'View Calendar Item' })
    expect(window.api.onCalendarItemsChanged).toHaveBeenCalledTimes(1)

    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('closes itself if the item no longer exists after a refetch (e.g. deleted elsewhere)', async () => {
    const item = makeItem()
    vi.mocked(window.api.data.calendarItems.list).mockResolvedValueOnce([item]).mockResolvedValueOnce([])
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {})
    let broadcastCallback: (() => void) | undefined
    vi.mocked(window.api.onCalendarItemsChanged).mockImplementation((cb) => {
      broadcastCallback = cb
      return () => {}
    })

    render(<CalendarPopoutWindow seriesId="series-1" originalStartTime={item.startTime} />)
    await screen.findByRole('dialog', { name: 'View Calendar Item' })

    broadcastCallback?.()

    await waitFor(() => expect(closeSpy).toHaveBeenCalled())
  })
})
