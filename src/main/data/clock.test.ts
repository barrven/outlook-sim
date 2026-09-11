import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SimClock } from './clock'

describe('SimClock', () => {
  let baseDir: string
  let clock: SimClock

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'outlook-sim-clock-'))
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    clock = new SimClock(baseDir)
  })

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true })
    vi.useRealTimers()
  })

  it('seeds a paused clock anchored to the current time, at 1x, on first run', () => {
    const state = clock.getState()
    expect(state).toEqual({
      anchorSimTime: 1_000_000,
      anchorRealTime: 1_000_000,
      running: false,
      speed: 1
    })
    expect(clock.now()).toBe(1_000_000)
  })

  it('writes real JSON to disk, not just in-memory state', () => {
    const raw = readFileSync(join(baseDir, 'config', 'clock.json'), 'utf-8')
    expect(JSON.parse(raw)).toEqual(clock.getState())
  })

  it('does not advance while paused, no matter how much real time passes', () => {
    vi.setSystemTime(1_000_000 + 60_000)
    expect(clock.now()).toBe(1_000_000)
  })

  it('advances at the configured speed once started', () => {
    clock.start()
    vi.setSystemTime(1_000_000 + 10_000)
    expect(clock.now()).toBe(1_010_000) // 10s real elapsed * 1x

    clock.setSpeed(60)
    vi.setSystemTime(1_000_000 + 20_000) // 10 more real seconds at 60x
    expect(clock.now()).toBe(1_010_000 + 10_000 * 60)
  })

  it('freezes simulated time on pause, and resuming continues from exactly there', () => {
    clock.start()
    vi.setSystemTime(1_000_000 + 5_000)
    clock.pause()
    const pausedAt = clock.now()
    expect(pausedAt).toBe(1_005_000)

    // Real time keeps moving while paused — simulated time must not.
    vi.setSystemTime(1_000_000 + 50_000)
    expect(clock.now()).toBe(pausedAt)

    clock.start()
    expect(clock.now()).toBe(pausedAt) // resumes from exactly where it left off
    vi.setSystemTime(1_000_000 + 53_000)
    expect(clock.now()).toBe(pausedAt + 3_000)
  })

  it('starting an already-running clock is a no-op (does not re-anchor and lose elapsed time)', () => {
    clock.start()
    vi.setSystemTime(1_000_000 + 4_000)
    clock.start()
    expect(clock.now()).toBe(1_004_000)
  })

  it('pausing an already-paused clock is a no-op', () => {
    clock.pause()
    expect(clock.getState()).toEqual({
      anchorSimTime: 1_000_000,
      anchorRealTime: 1_000_000,
      running: false,
      speed: 1
    })
  })

  it('changing speed while running rebases the anchor so time does not jump', () => {
    clock.start()
    vi.setSystemTime(1_000_000 + 2_000)
    clock.setSpeed(10)
    // No real time has passed since the speed change yet — value must be continuous.
    expect(clock.now()).toBe(1_002_000)

    vi.setSystemTime(1_000_000 + 3_000)
    expect(clock.now()).toBe(1_002_000 + 1_000 * 10)
  })

  it('changing speed while paused just updates speed without moving simulated time', () => {
    clock.setSpeed(30)
    expect(clock.now()).toBe(1_000_000)
    expect(clock.getState().speed).toBe(30)
  })

  it('persists across a restart: a new SimClock over the same directory sees the same state', () => {
    clock.start()
    vi.setSystemTime(1_000_000 + 7_000)
    clock.pause()
    const stateBeforeRestart = clock.getState()

    vi.setSystemTime(1_000_000 + 999_000) // lots of real time passes while "closed"
    const reopened = new SimClock(baseDir)

    expect(reopened.getState()).toEqual(stateBeforeRestart)
    expect(reopened.now()).toBe(stateBeforeRestart.anchorSimTime)
  })
})
