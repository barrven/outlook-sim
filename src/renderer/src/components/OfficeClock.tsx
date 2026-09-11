import { useEffect, useState, type ReactElement } from 'react'
import type { ClockState } from '../../../shared/data-types'

const SPEED_OPTIONS = [1, 2, 5, 10, 30, 60]

export function computeDisplayTime(state: ClockState): number {
  return state.running ? state.anchorSimTime + (Date.now() - state.anchorRealTime) * state.speed : state.anchorSimTime
}

function OfficeClock(): ReactElement | null {
  const [state, setState] = useState<ClockState | null>(null)
  const [, forceTick] = useState(0)

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

  if (!state) return null

  async function handleToggle(): Promise<void> {
    const updated = state?.running ? await window.api.data.clock.pause() : await window.api.data.clock.start()
    setState(updated)
  }

  async function handleSpeedChange(event: React.ChangeEvent<HTMLSelectElement>): Promise<void> {
    const updated = await window.api.data.clock.setSpeed(Number(event.target.value))
    setState(updated)
  }

  return (
    <div className="office-clock">
      <span className="office-clock-time">{new Date(computeDisplayTime(state)).toLocaleString()}</span>
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
