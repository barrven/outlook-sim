// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OfficeClock, { computeDisplayTime } from './OfficeClock'
import type { ClockState } from '../../../shared/data-types'

const PAUSED_STATE: ClockState = {
  anchorSimTime: new Date('2026-01-15T10:00:00').getTime(),
  anchorRealTime: new Date('2026-01-15T10:00:00').getTime(),
  running: false,
  speed: 1
}

describe('OfficeClock', () => {
  it('shows the current simulated time and a Start button while paused', async () => {
    vi.mocked(window.api.data.clock.get).mockResolvedValue(PAUSED_STATE)

    render(<OfficeClock />)

    expect(await screen.findByText(new Date(PAUSED_STATE.anchorSimTime).toLocaleString())).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  it('clicking Start calls clock.start and switches the button to Pause', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.clock.get).mockResolvedValue(PAUSED_STATE)
    vi.mocked(window.api.data.clock.start).mockResolvedValue({ ...PAUSED_STATE, running: true })

    render(<OfficeClock />)

    await user.click(await screen.findByRole('button', { name: 'Start' }))

    expect(window.api.data.clock.start).toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('clicking Pause calls clock.pause and switches the button to Start', async () => {
    const user = userEvent.setup()
    const runningState: ClockState = { ...PAUSED_STATE, running: true }
    vi.mocked(window.api.data.clock.get).mockResolvedValue(runningState)
    vi.mocked(window.api.data.clock.pause).mockResolvedValue(PAUSED_STATE)

    render(<OfficeClock />)

    await user.click(await screen.findByRole('button', { name: 'Pause' }))

    expect(window.api.data.clock.pause).toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  it('changing the speed calls clock.setSpeed with the selected multiplier', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.clock.get).mockResolvedValue(PAUSED_STATE)
    vi.mocked(window.api.data.clock.setSpeed).mockResolvedValue({ ...PAUSED_STATE, speed: 10 })

    render(<OfficeClock />)

    await user.selectOptions(await screen.findByLabelText('Simulation speed'), '10')

    expect(window.api.data.clock.setSpeed).toHaveBeenCalledWith(10)
  })

  it('lists 1x through 60x as speed options', async () => {
    vi.mocked(window.api.data.clock.get).mockResolvedValue(PAUSED_STATE)

    render(<OfficeClock />)

    const select = await screen.findByLabelText('Simulation speed')
    const optionLabels = Array.from(select.querySelectorAll('option')).map((option) => option.textContent)
    expect(optionLabels).toEqual(['1x', '2x', '5x', '10x', '30x', '60x'])
  })

  it('sets up a ticking interval while running, and tears it down when paused', async () => {
    const user = userEvent.setup()
    const runningState: ClockState = { ...PAUSED_STATE, running: true }
    vi.mocked(window.api.data.clock.get).mockResolvedValue(runningState)
    vi.mocked(window.api.data.clock.pause).mockResolvedValue(PAUSED_STATE)
    const setIntervalSpy = vi.spyOn(window, 'setInterval')
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval')

    render(<OfficeClock />)
    await screen.findByRole('button', { name: 'Pause' })

    await waitFor(() => expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000))

    await user.click(screen.getByRole('button', { name: 'Pause' }))
    await screen.findByRole('button', { name: 'Start' })

    expect(clearIntervalSpy).toHaveBeenCalled()
  })

  it('does not set up a ticking interval while paused', async () => {
    vi.mocked(window.api.data.clock.get).mockResolvedValue(PAUSED_STATE)
    const setIntervalSpy = vi.spyOn(window, 'setInterval')

    render(<OfficeClock />)
    await screen.findByRole('button', { name: 'Start' })

    expect(setIntervalSpy).not.toHaveBeenCalledWith(expect.any(Function), 1000)
  })

  describe('Mini-calendar dropdown (045)', () => {
    it('045 AC2: clicking the clock opens a dropdown mini-calendar, closed by default', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.clock.get).mockResolvedValue(PAUSED_STATE)

      render(<OfficeClock />)
      const clockButton = await screen.findByText(new Date(PAUSED_STATE.anchorSimTime).toLocaleString())
      expect(screen.queryByRole('dialog', { name: 'Mini Calendar' })).not.toBeInTheDocument()

      await user.click(clockButton)
      expect(await screen.findByRole('dialog', { name: 'Mini Calendar' })).toBeInTheDocument()

      await user.click(clockButton)
      expect(screen.queryByRole('dialog', { name: 'Mini Calendar' })).not.toBeInTheDocument()
    })

    it('045 AC2: Escape and an outside click both close it', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.clock.get).mockResolvedValue(PAUSED_STATE)

      render(<OfficeClock />)
      const clockButton = await screen.findByText(new Date(PAUSED_STATE.anchorSimTime).toLocaleString())

      await user.click(clockButton)
      await screen.findByRole('dialog', { name: 'Mini Calendar' })
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('dialog', { name: 'Mini Calendar' })).not.toBeInTheDocument()

      await user.click(clockButton)
      await screen.findByRole('dialog', { name: 'Mini Calendar' })
      await user.click(document.body)
      expect(screen.queryByRole('dialog', { name: 'Mini Calendar' })).not.toBeInTheDocument()
    })

    it('045 AC3: highlights the current simulated day', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.clock.get).mockResolvedValue(PAUSED_STATE) // Jan 15, 2026

      render(<OfficeClock />)
      const clockButton = await screen.findByText(new Date(PAUSED_STATE.anchorSimTime).toLocaleString())
      await user.click(clockButton)
      await screen.findByRole('dialog', { name: 'Mini Calendar' })

      const dayButtons = screen.getAllByText('15')
      const todayButton = dayButtons.find((el) => el.className.includes('today'))
      expect(todayButton).toBeDefined()
    })

    it('045 AC4: Previous/Next navigate the dropdown by month without touching the real clock', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.clock.get).mockResolvedValue(PAUSED_STATE) // January 2026

      render(<OfficeClock />)
      const clockButton = await screen.findByText(new Date(PAUSED_STATE.anchorSimTime).toLocaleString())
      await user.click(clockButton)
      await screen.findByText('January 2026')

      await user.click(screen.getByRole('button', { name: 'Next month' }))
      expect(screen.getByText('February 2026')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Previous month' }))
      await user.click(screen.getByRole('button', { name: 'Previous month' }))
      expect(screen.getByText('December 2025')).toBeInTheDocument()

      expect(window.api.data.clock.pause).not.toHaveBeenCalled()
      expect(window.api.data.clock.start).not.toHaveBeenCalled()
      expect(window.api.data.clock.setSpeed).not.toHaveBeenCalled()
      expect(screen.getByText(new Date(PAUSED_STATE.anchorSimTime).toLocaleString())).toBeInTheDocument()
    })

    it('045 AC5: clicking a future day shows how much simulated time remains until it', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.clock.get).mockResolvedValue(PAUSED_STATE) // Jan 15, 2026, 10:00am

      render(<OfficeClock />)
      const clockButton = await screen.findByText(new Date(PAUSED_STATE.anchorSimTime).toLocaleString())
      await user.click(clockButton)
      await screen.findByRole('dialog', { name: 'Mini Calendar' })

      // Jan 20 00:00 minus Jan 15 10:00 = 4 days, 14 hours.
      const dayButtons = screen.getAllByText('20')
      await user.click(dayButtons[0])

      expect(screen.getByText('in 4 days, 14 hours')).toBeInTheDocument()
    })

    it('045 AC5: clicking a past day shows time elapsed since it, not "in"', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.clock.get).mockResolvedValue(PAUSED_STATE) // Jan 15, 2026, 10:00am

      render(<OfficeClock />)
      const clockButton = await screen.findByText(new Date(PAUSED_STATE.anchorSimTime).toLocaleString())
      await user.click(clockButton)
      await screen.findByRole('dialog', { name: 'Mini Calendar' })

      // Jan 10 00:00 is before Jan 15 10:00 — 5 days, 10 hours earlier.
      const dayButtons = screen.getAllByText('10')
      await user.click(dayButtons[0])

      expect(screen.getByText('5 days, 10 hours ago')).toBeInTheDocument()
    })

    it('045 AC5: no readout shown for today itself', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.clock.get).mockResolvedValue(PAUSED_STATE)

      render(<OfficeClock />)
      const clockButton = await screen.findByText(new Date(PAUSED_STATE.anchorSimTime).toLocaleString())
      await user.click(clockButton)
      await screen.findByRole('dialog', { name: 'Mini Calendar' })

      const dayButtons = screen.getAllByText('15')
      const todayButton = dayButtons.find((el) => el.className.includes('today'))!
      await user.click(todayButton)

      expect(screen.queryByText(/in \d+ days|ago/)).not.toBeInTheDocument()
    })
  })
})

describe('computeDisplayTime', () => {
  it('returns the frozen anchor time while paused, regardless of real time', () => {
    const state: ClockState = { anchorSimTime: 1_000_000, anchorRealTime: 1_000_000, running: false, speed: 1 }
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000 + 60_000)

    expect(computeDisplayTime(state)).toBe(1_000_000)

    vi.restoreAllMocks()
  })

  it('advances from the anchor by elapsed real time multiplied by speed while running', () => {
    const state: ClockState = { anchorSimTime: 1_000_000, anchorRealTime: 1_000_000, running: true, speed: 10 }
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000 + 2_000)

    expect(computeDisplayTime(state)).toBe(1_000_000 + 2_000 * 10)

    vi.restoreAllMocks()
  })
})
