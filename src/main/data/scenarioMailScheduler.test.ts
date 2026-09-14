import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScheduledScenarioMessage } from '../../shared/data-types'
import { SimClock } from './clock'
import { ConfigStore } from './config'
import { MailDb } from './db'
import { ScenarioMailScheduler } from './scenarioMailScheduler'

function makePending(overrides: Partial<ScheduledScenarioMessage> = {}): ScheduledScenarioMessage {
  return {
    id: 'sm-1',
    dueSimTime: 1_000_000,
    subject: 'Following up',
    body: 'Any update on discovery?',
    fromName: 'Morgan Rivera',
    fromEmail: 'morgan@example.com',
    toName: 'Trainee',
    toEmail: 'trainee@example.com',
    ...overrides
  }
}

describe('ScenarioMailScheduler', () => {
  let baseDir: string
  let db: MailDb
  let config: ConfigStore
  let clock: SimClock

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'outlook-sim-scenario-mail-scheduler-'))
    db = new MailDb(baseDir)
    config = new ConfigStore(baseDir)
    clock = new SimClock(baseDir)
  })

  afterEach(() => {
    db.close()
    rmSync(baseDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('does nothing while the clock is paused, even once nominally due', () => {
    config.setScheduledScenarioMessages([makePending({ dueSimTime: 1_000_000 })])
    vi.spyOn(clock, 'now').mockReturnValue(1_000_000)
    vi.spyOn(clock, 'getState').mockReturnValue({ anchorSimTime: 0, anchorRealTime: 0, running: false, speed: 1 })
    const onDelivered = vi.fn()

    new ScenarioMailScheduler(db, config, clock, onDelivered).tick()

    expect(onDelivered).not.toHaveBeenCalled()
    expect(db.listMessages('inbox')).toEqual([])
    expect(config.getScheduledScenarioMessages()).toHaveLength(1)
  })

  it('does nothing while running but not yet due', () => {
    config.setScheduledScenarioMessages([makePending({ dueSimTime: 1_000_000 })])
    vi.spyOn(clock, 'now').mockReturnValue(999_999)
    vi.spyOn(clock, 'getState').mockReturnValue({ anchorSimTime: 999_999, anchorRealTime: 0, running: true, speed: 1 })
    const onDelivered = vi.fn()

    new ScenarioMailScheduler(db, config, clock, onDelivered).tick()

    expect(onDelivered).not.toHaveBeenCalled()
    expect(db.listMessages('inbox')).toEqual([])
  })

  it('delivers a due message into Inbox with the right fields, and removes it from pending', () => {
    config.setScheduledScenarioMessages([makePending({ dueSimTime: 1_000_000 })])
    vi.spyOn(clock, 'now').mockReturnValue(1_000_000)
    vi.spyOn(clock, 'getState').mockReturnValue({ anchorSimTime: 1_000_000, anchorRealTime: 0, running: true, speed: 1 })
    const onDelivered = vi.fn()

    new ScenarioMailScheduler(db, config, clock, onDelivered).tick()

    expect(onDelivered).toHaveBeenCalledTimes(1)
    const messages = db.listMessages('inbox')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      subject: 'Following up',
      body: 'Any update on discovery?',
      fromName: 'Morgan Rivera',
      fromEmail: 'morgan@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      timestamp: 1_000_000,
      isRead: false
    })
    expect(config.getScheduledScenarioMessages()).toEqual([])
  })

  it('does not redeliver once a message has already been delivered', () => {
    config.setScheduledScenarioMessages([makePending({ dueSimTime: 1_000_000 })])
    vi.spyOn(clock, 'now').mockReturnValue(1_000_000)
    vi.spyOn(clock, 'getState').mockReturnValue({ anchorSimTime: 1_000_000, anchorRealTime: 0, running: true, speed: 1 })
    const onDelivered = vi.fn()
    const scheduler = new ScenarioMailScheduler(db, config, clock, onDelivered)

    scheduler.tick()
    scheduler.tick()
    scheduler.tick()

    expect(onDelivered).toHaveBeenCalledTimes(1)
    expect(db.listMessages('inbox')).toHaveLength(1)
  })

  it('delivers every due message in one tick, leaving not-yet-due messages pending', () => {
    config.setScheduledScenarioMessages([
      makePending({ id: 'due-1', subject: 'Due 1', dueSimTime: 1_000_000 }),
      makePending({ id: 'due-2', subject: 'Due 2', dueSimTime: 1_500_000 }),
      makePending({ id: 'not-due', subject: 'Not due yet', dueSimTime: 100_000_000 })
    ])
    vi.spyOn(clock, 'now').mockReturnValue(2_000_000)
    vi.spyOn(clock, 'getState').mockReturnValue({ anchorSimTime: 2_000_000, anchorRealTime: 0, running: true, speed: 1 })
    const onDelivered = vi.fn()

    new ScenarioMailScheduler(db, config, clock, onDelivered).tick()

    expect(onDelivered).toHaveBeenCalledTimes(1)
    const subjects = db.listMessages('inbox').map((m) => m.subject)
    expect(subjects.sort()).toEqual(['Due 1', 'Due 2'])
    const pending = config.getScheduledScenarioMessages()
    expect(pending).toHaveLength(1)
    expect(pending[0].id).toBe('not-due')
  })

  it('start() schedules real-time polling and stop() clears it', () => {
    vi.useFakeTimers()
    try {
      config.setScheduledScenarioMessages([makePending({ dueSimTime: 1_000_000 })])
      const nowSpy = vi.spyOn(clock, 'now').mockReturnValue(1_000_000)
      vi.spyOn(clock, 'getState').mockReturnValue({ anchorSimTime: 1_000_000, anchorRealTime: 0, running: true, speed: 1 })
      const onDelivered = vi.fn()

      const scheduler = new ScenarioMailScheduler(db, config, clock, onDelivered)
      scheduler.start()
      vi.advanceTimersByTime(10_000)
      expect(onDelivered).toHaveBeenCalledTimes(1)

      config.setScheduledScenarioMessages([makePending({ id: 'later', dueSimTime: 5_000_000 })])
      nowSpy.mockReturnValue(6_000_000)
      scheduler.stop()
      vi.advanceTimersByTime(60_000)
      expect(onDelivered).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('integrates with a real SimClock: delivers while running, not while paused, across a pause/resume cycle', () => {
    config.setScheduledScenarioMessages([makePending({ dueSimTime: clock.now() - 1 })]) // already due
    const onDelivered = vi.fn()
    const scheduler = new ScenarioMailScheduler(db, config, clock, onDelivered)

    // Real clock starts paused (013's default) — due but paused, so no-op.
    scheduler.tick()
    expect(onDelivered).not.toHaveBeenCalled()
    expect(db.listMessages('inbox')).toEqual([])

    // Start the real clock: now due AND running, so it should deliver.
    clock.start()
    scheduler.tick()
    expect(onDelivered).toHaveBeenCalledTimes(1)
    expect(db.listMessages('inbox')).toHaveLength(1)

    // Pause again: nothing left pending anyway, but confirm no further calls.
    clock.pause()
    scheduler.tick()
    expect(onDelivered).toHaveBeenCalledTimes(1)
  })
})
