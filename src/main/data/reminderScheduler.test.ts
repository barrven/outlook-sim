import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FiredReminder, NewCalendarItem } from '../../shared/data-types'
import { SimClock } from './clock'
import { MailDb } from './db'
import { ReminderScheduler } from './reminderScheduler'

function makeItem(overrides: Partial<NewCalendarItem> = {}): NewCalendarItem {
  return {
    title: 'Filing deadline',
    description: '',
    startTime: 1_000_000,
    endTime: null,
    allDay: false,
    reminderMinutesBefore: 10,
    recurrenceRule: null,
    itemType: 'deadline',
    ...overrides
  }
}

describe('ReminderScheduler', () => {
  let baseDir: string
  let db: MailDb
  let clock: SimClock

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'outlook-sim-reminder-scheduler-'))
    db = new MailDb(baseDir)
    clock = new SimClock(baseDir)
  })

  afterEach(() => {
    db.close()
    rmSync(baseDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('does nothing while the clock is paused, even once nominally due', () => {
    db.createCalendarItem(makeItem({ startTime: 1_000_000, reminderMinutesBefore: 10 }))
    vi.spyOn(clock, 'now').mockReturnValue(1_000_000)
    vi.spyOn(clock, 'getState').mockReturnValue({ anchorSimTime: 0, anchorRealTime: 0, running: false, speed: 1 })
    const onFired = vi.fn()

    const scheduler = new ReminderScheduler(db, clock, onFired)
    scheduler.tick()

    expect(onFired).not.toHaveBeenCalled()
    expect(db.listCalendarItems()[0].remindersFired).toEqual([])
  })

  it('does nothing while running but not yet due', () => {
    // Due time is startTime - reminderMinutesBefore*60000 = 1_000_000 - 600_000 = 400_000
    db.createCalendarItem(makeItem({ startTime: 1_000_000, reminderMinutesBefore: 10 }))
    vi.spyOn(clock, 'now').mockReturnValue(399_999)
    vi.spyOn(clock, 'getState').mockReturnValue({ anchorSimTime: 399_999, anchorRealTime: 0, running: true, speed: 1 })
    const onFired = vi.fn()

    const scheduler = new ReminderScheduler(db, clock, onFired)
    scheduler.tick()

    expect(onFired).not.toHaveBeenCalled()
  })

  it('fires exactly once due and running, marking the occurrence fired and calling back with it', () => {
    const created = db.createCalendarItem(makeItem({ startTime: 1_000_000, reminderMinutesBefore: 10 }))
    vi.spyOn(clock, 'now').mockReturnValue(400_000)
    vi.spyOn(clock, 'getState').mockReturnValue({ anchorSimTime: 400_000, anchorRealTime: 0, running: true, speed: 1 })
    const onFired = vi.fn()

    const scheduler = new ReminderScheduler(db, clock, onFired)
    scheduler.tick()

    expect(onFired).toHaveBeenCalledTimes(1)
    const fired = onFired.mock.calls[0][0] as FiredReminder
    expect(fired.seriesId).toBe(created.id)
    expect(fired.id).toBe(`${created.id}:${created.startTime}`)
    expect(db.getCalendarItem(created.id)?.remindersFired).toEqual([created.startTime])
  })

  it('does not refire on a subsequent tick once already fired', () => {
    db.createCalendarItem(makeItem({ startTime: 1_000_000, reminderMinutesBefore: 10 }))
    vi.spyOn(clock, 'now').mockReturnValue(400_000)
    vi.spyOn(clock, 'getState').mockReturnValue({ anchorSimTime: 400_000, anchorRealTime: 0, running: true, speed: 1 })
    const onFired = vi.fn()

    const scheduler = new ReminderScheduler(db, clock, onFired)
    scheduler.tick()
    scheduler.tick()
    scheduler.tick()

    expect(onFired).toHaveBeenCalledTimes(1)
  })

  it('fires at exactly the due boundary (reminderMinutesBefore: 0 means at start time)', () => {
    db.createCalendarItem(makeItem({ startTime: 1_000_000, reminderMinutesBefore: 0 }))
    vi.spyOn(clock, 'now').mockReturnValue(1_000_000)
    vi.spyOn(clock, 'getState').mockReturnValue({ anchorSimTime: 1_000_000, anchorRealTime: 0, running: true, speed: 1 })
    const onFired = vi.fn()

    new ReminderScheduler(db, clock, onFired).tick()

    expect(onFired).toHaveBeenCalledTimes(1)
  })

  it('never fires an item with no reminder configured', () => {
    db.createCalendarItem(makeItem({ startTime: 1, reminderMinutesBefore: null }))
    vi.spyOn(clock, 'now').mockReturnValue(1_000_000_000)
    vi.spyOn(clock, 'getState').mockReturnValue({
      anchorSimTime: 1_000_000_000,
      anchorRealTime: 0,
      running: true,
      speed: 1
    })
    const onFired = vi.fn()

    new ReminderScheduler(db, clock, onFired).tick()

    expect(onFired).not.toHaveBeenCalled()
  })

  it('fires every due item in a single tick, and leaves not-yet-due items alone', () => {
    const due1 = db.createCalendarItem(makeItem({ title: 'Due 1', startTime: 1_000_000, reminderMinutesBefore: 10 }))
    const due2 = db.createCalendarItem(
      makeItem({ title: 'Due 2', startTime: 2_000_000, reminderMinutesBefore: 60 })
    )
    const notYetDue = db.createCalendarItem(
      makeItem({ title: 'Not yet due', startTime: 100_000_000, reminderMinutesBefore: 10 })
    )
    vi.spyOn(clock, 'now').mockReturnValue(2_000_000)
    vi.spyOn(clock, 'getState').mockReturnValue({ anchorSimTime: 2_000_000, anchorRealTime: 0, running: true, speed: 1 })
    const onFired = vi.fn()

    new ReminderScheduler(db, clock, onFired).tick()

    const firedSeriesIds = onFired.mock.calls.map((call) => (call[0] as FiredReminder).seriesId)
    expect(firedSeriesIds.sort()).toEqual([due1.id, due2.id].sort())
    expect(db.getCalendarItem(notYetDue.id)?.remindersFired).toEqual([])
  })

  it('start() schedules real-time polling and stop() clears it', () => {
    vi.useFakeTimers()
    try {
      db.createCalendarItem(makeItem({ startTime: 1_000_000, reminderMinutesBefore: 10 }))
      const nowSpy = vi.spyOn(clock, 'now').mockReturnValue(400_000)
      vi.spyOn(clock, 'getState').mockReturnValue({
        anchorSimTime: 400_000,
        anchorRealTime: 0,
        running: true,
        speed: 1
      })
      const onFired = vi.fn()

      const scheduler = new ReminderScheduler(db, clock, onFired)
      scheduler.start()
      vi.advanceTimersByTime(10_000)
      expect(onFired).toHaveBeenCalledTimes(1)

      // A second due item appears later; without stop(), the next poll would
      // catch it too.
      db.createCalendarItem(makeItem({ title: 'Later item', startTime: 5_000_000, reminderMinutesBefore: 10 }))
      nowSpy.mockReturnValue(4_600_000)
      scheduler.stop()
      vi.advanceTimersByTime(60_000)
      expect(onFired).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('integrates with a real SimClock: fires while running, not while paused, across a pause/resume cycle', () => {
    const now = clock.now()
    db.createCalendarItem(makeItem({ startTime: now, reminderMinutesBefore: 10 })) // already due (now - 10min < now)
    const onFired = vi.fn()
    const scheduler = new ReminderScheduler(db, clock, onFired)

    // Real clock starts paused (013's default) — due but paused, so no-op.
    scheduler.tick()
    expect(onFired).not.toHaveBeenCalled()

    // Start the real clock: now due AND running, so it should fire.
    clock.start()
    scheduler.tick()
    expect(onFired).toHaveBeenCalledTimes(1)

    // Pause again and add a new, already-due item — still shouldn't fire
    // while paused.
    clock.pause()
    db.createCalendarItem(makeItem({ title: 'Second', startTime: clock.now(), reminderMinutesBefore: 10 }))
    scheduler.tick()
    expect(onFired).toHaveBeenCalledTimes(1)
  })
})
