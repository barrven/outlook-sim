import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { ClockState } from '../../shared/data-types'

const CONFIG_DIR_NAME = 'config'
const DEFAULT_SPEED = 1

export class SimClock {
  private path: string

  constructor(baseDir: string) {
    const configDir = join(baseDir, CONFIG_DIR_NAME)
    mkdirSync(configDir, { recursive: true })
    this.path = join(configDir, 'clock.json')
    if (!existsSync(this.path)) {
      const now = Date.now()
      this.write({ anchorSimTime: now, anchorRealTime: now, running: false, speed: DEFAULT_SPEED })
    }
  }

  private read(): ClockState {
    return JSON.parse(readFileSync(this.path, 'utf-8')) as ClockState
  }

  private write(state: ClockState): void {
    writeFileSync(this.path, JSON.stringify(state, null, 2))
  }

  private computeNow(state: ClockState): number {
    return state.running ? state.anchorSimTime + (Date.now() - state.anchorRealTime) * state.speed : state.anchorSimTime
  }

  getState(): ClockState {
    return this.read()
  }

  now(): number {
    return this.computeNow(this.read())
  }

  start(): ClockState {
    const state = this.read()
    if (!state.running) {
      state.anchorRealTime = Date.now()
      state.running = true
      this.write(state)
    }
    return state
  }

  pause(): ClockState {
    const state = this.read()
    if (state.running) {
      state.anchorSimTime = this.computeNow(state)
      state.running = false
      this.write(state)
    }
    return state
  }

  setSpeed(speed: number): ClockState {
    const state = this.read()
    if (state.running) {
      state.anchorSimTime = this.computeNow(state)
      state.anchorRealTime = Date.now()
    }
    state.speed = speed
    this.write(state)
    return state
  }
}
