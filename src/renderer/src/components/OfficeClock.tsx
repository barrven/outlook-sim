import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { ClockState } from '../../../shared/data-types'
import { formatRangeLabel, getVisibleDays, isSameDay, shiftAnchor, startOfDayMs } from '../calendarDates'

const SPEED_OPTIONS = [1, 2, 5, 10, 30, 60]
const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

export function computeDisplayTime(state: ClockState): number {
  return state.running ? state.anchorSimTime + (Date.now() - state.anchorRealTime) * state.speed : state.anchorSimTime
}

// "in 3 days, 4 hours" (or "... ago" for a day already past) — always both
// units, matching the feature's own example format. Diffed against the
// clicked day's start, not its exact instant, since the mini-calendar picks
// a day, not a time.
function formatTimeUntil(targetDayMs: number, simulatedNowMs: number): string {
  const diffMs = startOfDayMs(targetDayMs) - simulatedNowMs
  const absMs = Math.abs(diffMs)
  const days = Math.floor(absMs / DAY_MS)
  const hours = Math.floor((absMs % DAY_MS) / HOUR_MS)
  const dayLabel = `${days} day${days === 1 ? '' : 's'}`
  const hourLabel = `${hours} hour${hours === 1 ? '' : 's'}`
  return diffMs >= 0 ? `in ${dayLabel}, ${hourLabel}` : `${dayLabel}, ${hourLabel} ago`
}

function OfficeClock(): ReactElement | null {
  const [state, setState] = useState<ClockState | null>(null)
  const [, forceTick] = useState(0)
  // The mini-calendar's own displayed month — independent of the real
  // simulated clock (AC4: Previous/Next only ever moves this, never the
  // clock itself). Non-null exactly while the dropdown is open.
  const [miniCalendarAnchorMs, setMiniCalendarAnchorMs] = useState<number | null>(null)
  const [selectedDayMs, setSelectedDayMs] = useState<number | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    window.api.data.clock.get().then((clockState) => {
      if (!cancelled) setState(clockState)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!state?.running) return undefined
    const interval = setInterval(() => forceTick((n) => n + 1), 1000)
    return () => clearInterval(interval)
  }, [state?.running])

  // Mirrors RibbonBar's file-menu click-outside/Escape-to-close pattern.
  useEffect(() => {
    if (miniCalendarAnchorMs === null) return
    function handlePointerDown(event: MouseEvent): void {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setMiniCalendarAnchorMs(null)
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setMiniCalendarAnchorMs(null)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [miniCalendarAnchorMs])

  if (!state) return null

  async function handleToggle(): Promise<void> {
    const updated = state?.running ? await window.api.data.clock.pause() : await window.api.data.clock.start()
    setState(updated)
  }

  async function handleSpeedChange(event: React.ChangeEvent<HTMLSelectElement>): Promise<void> {
    const updated = await window.api.data.clock.setSpeed(Number(event.target.value))
    setState(updated)
  }

  const simulatedNowMs = computeDisplayTime(state)

  function toggleMiniCalendar(): void {
    if (miniCalendarAnchorMs !== null) {
      setMiniCalendarAnchorMs(null)
      return
    }
    setMiniCalendarAnchorMs(startOfDayMs(simulatedNowMs))
    setSelectedDayMs(null)
  }

  return (
    <div className="office-clock">
      <div className="office-clock-minicalendar-wrapper" ref={wrapperRef}>
        <button
          type="button"
          className="office-clock-time"
          aria-haspopup="dialog"
          aria-expanded={miniCalendarAnchorMs !== null}
          onClick={toggleMiniCalendar}
        >
          {new Date(simulatedNowMs).toLocaleString()}
        </button>
        {miniCalendarAnchorMs !== null && (
          <div className="office-clock-minicalendar" role="dialog" aria-label="Mini Calendar">
            <div className="office-clock-minicalendar-nav">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setMiniCalendarAnchorMs((anchor) => shiftAnchor('month', anchor!, -1))}
              >
                ‹
              </button>
              <span className="office-clock-minicalendar-label">
                {formatRangeLabel('month', miniCalendarAnchorMs)}
              </span>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setMiniCalendarAnchorMs((anchor) => shiftAnchor('month', anchor!, 1))}
              >
                ›
              </button>
            </div>
            <div className="office-clock-minicalendar-grid">
              {getVisibleDays('month', miniCalendarAnchorMs).map((day) => (
                <button
                  key={day}
                  type="button"
                  className={`office-clock-minicalendar-day${isSameDay(day, simulatedNowMs) ? ' today' : ''}${
                    selectedDayMs !== null && isSameDay(day, selectedDayMs) ? ' selected' : ''
                  }`}
                  onClick={() => setSelectedDayMs(day)}
                >
                  {new Date(day).getDate()}
                </button>
              ))}
            </div>
            {selectedDayMs !== null && !isSameDay(selectedDayMs, simulatedNowMs) && (
              <div className="office-clock-minicalendar-readout">{formatTimeUntil(selectedDayMs, simulatedNowMs)}</div>
            )}
          </div>
        )}
      </div>
      <button type="button" className="office-clock-toggle" onClick={handleToggle}>
        {state.running ? 'Pause' : 'Start'}
      </button>
      <select
        aria-label="Simulation speed"
        className="office-clock-speed"
        value={state.speed}
        onChange={handleSpeedChange}
      >
        {SPEED_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}x
          </option>
        ))}
      </select>
    </div>
  )
}

export default OfficeClock
