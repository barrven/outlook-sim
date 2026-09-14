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

  describe('026: recurring reminders fire per occurrence', () => {
    it('AC1: fires a distinct reminder for the 2nd and 3rd occurrence, not only the 1st', () => {
      const dayMs = 24 * 60 * 60_000
      const series = db.createCalendarItem(
        makeItem({
          title: 'Daily standup',
          startTime: 1_000_000, // occurrence 1
          reminderMinutesBefore: 10,
          recurrenceRule: 'daily'
        })
      )
      const onFired = vi.fn()
      const scheduler = new ReminderScheduler(db, clock, onFired)
      const getState = (now: number): ReturnType<typeof clock.getState> => ({
        anchorSimTime: now,
        anchorRealTime: 0,
        running: true,
        speed: 1
      })

      // Occurrence 1 due (startTime - 10min = 400_000).
      vi.spyOn(clock, 'now').mockReturnValue(400_000)
      vi.spyOn(clock, 'getState').mockReturnValue(getState(400_000))
      scheduler.tick()
      expect(onFired).toHaveBeenCalledTimes(1)

      // Occurrence 2 (next day) due.
      vi.spyOn(clock, 'now').mockReturnValue(1_000_000 + dayMs - 600_000)
      vi.spyOn(clock, 'getState').mockReturnValue(getState(1_000_000 + dayMs - 600_000))
      scheduler.tick()
      expect(onFired).toHaveBeenCalledTimes(2)

      // Occurrence 3 (two days later) due.
      vi.spyOn(clock, 'now').mockReturnValue(1_000_000 + 2 * dayMs - 600_000)
      vi.spyOn(clock, 'getState').mockReturnValue(getState(1_000_000 + 2 * dayMs - 600_000))
      scheduler.tick()
      expect(onFired).toHaveBeenCalledTimes(3)

      const occurrenceIds = onFired.mock.calls.map((call) => (call[0] as FiredReminder).id)
      expect(new Set(occurrenceIds).size).toBe(3) // all distinct
      expect(occurrenceIds.every((id) => id.startsWith(`${series.id}:`))).toBe(true)
      expect(db.getCalendarItem(series.id)?.remindersFired).toHaveLength(3)
    })

    it('AC2: does not refire the same occurrence twice, even across many ticks, while still firing later ones', () => {
      const dayMs = 24 * 60 * 60_000
      db.createCalendarItem(
        makeItem({ startTime: 1_000_000, reminderMinutesBefore: 10, recurrenceRule: 'daily' })
      )
      const onFired = vi.fn()
      const scheduler = new ReminderScheduler(db, clock, onFired)

      vi.spyOn(clock, 'now').mockReturnValue(400_000)
      vi.spyOn(clock, 'getState').mockReturnValue({ anchorSimTime: 400_000, anchorRealTime: 0, running: true, speed: 1 })
      scheduler.tick()
      scheduler.tick()
      scheduler.tick()
      expect(onFired).toHaveBeenCalledTimes(1) // occurrence 1 only ever once

      vi.spyOn(clock, 'now').mockReturnValue(1_000_000 + dayMs - 600_000)
      vi.spyOn(clock, 'getState').mockReturnValue({
        anchorSimTime: 1_000_000 + dayMs - 600_000,
        anchorRealTime: 0,
        running: true,
        speed: 1
      })
      scheduler.tick()
      scheduler.tick()
      expect(onFired).toHaveBeenCalledTimes(2) // occurrence 2 fires once, occurrence 1 still doesn't refire
    })

    it('AC3: a deleted occurrence (recurrence exception) never fires, even when due', () => {
      const dayMs = 24 * 60 * 60_000
      const series = db.createCalendarItem(
        makeItem({ startTime: 1_000_000, reminderMinutesBefore: 10, recurrenceRule: 'daily' })
      )
      const occurrence2NaturalStart = 1_000_000 + dayMs
      db.updateCalendarItem(series.id, {
        recurrenceExceptions: [{ originalStartTime: occurrence2NaturalStart, deleted: true }]
      })
      const onFired = vi.fn()
      const scheduler = new ReminderScheduler(db, clock, onFired)

      // Occurrence 1 due — fires normally.
      vi.spyOn(clock, 'now').mockReturnValue(400_000)
      vi.spyOn(clock, 'getState').mockReturnValue({ anchorSimTime: 400_000, anchorRealTime: 0, running: true, speed: 1 })
      scheduler.tick()
      expect(onFired).toHaveBeenCalledTimes(1)

      // Occurrence 2's natural due time passes — deleted, must not fire.
      vi.spyOn(clock, 'now').mockReturnValue(occurrence2NaturalStart - 600_000)
      vi.spyOn(clock, 'getState').mockReturnValue({
        anchorSimTime: occurrence2NaturalStart - 600_000,
        anchorRealTime: 0,
        running: true,
        speed: 1
      })
      scheduler.tick()
      expect(onFired).toHaveBeenCalledTimes(1) // still just occurrence 1

      // Occurrence 3's due time passes — unaffected by occurrence 2's deletion.
      vi.spyOn(clock, 'now').mockReturnValue(1_000_000 + 2 * dayMs - 600_000)
      vi.spyOn(clock, 'getState').mockReturnValue({
        anchorSimTime: 1_000_000 + 2 * dayMs - 600_000,
        anchorRealTime: 0,
        running: true,
        speed: 1
      })
      scheduler.tick()
      expect(onFired).toHaveBeenCalledTimes(2)
    })

    it('AC3: an occurrence edited to a new start time fires its reminder relative to the new time, not the natural one', () => {
      const dayMs = 24 * 60 * 60_000
      const series = db.createCalendarItem(
        makeItem({ startTime: 1_000_000, reminderMinutesBefore: 10, recurrenceRule: 'daily' })
      )
      const occurrence2NaturalStart = 1_000_000 + dayMs
      // Moved later the same day (not to another day) so no other daily
      // occurrence's own natural due time falls in between — keeps this test
      // isolated to occurrence 2's behavior specifically.
      const occurrence2NewStart = occurrence2NaturalStart + 3 * 60 * 60_000
      db.updateCalendarItem(series.id, {
        recurrenceExceptions: [
          {
            originalStartTime: occurrence2NaturalStart,
            deleted: false,
            title: 'Daily standup (moved)',
            description: '',
            startTime: occurrence2NewStart,
            endTime: null,
            allDay: false,
            reminderMinutesBefore: 10,
            itemType: 'deadline'
          }
        ]
      })
      const onFired = vi.fn()
      const scheduler = new ReminderScheduler(db, clock, onFired)

      // Occurrence 1 fires and is out of the way first, so only occurrence 2's
      // behavior is under test below.
      vi.spyOn(clock, 'now').mockReturnValue(400_000)
      vi.spyOn(clock, 'getState').mockReturnValue({ anchorSimTime: 400_000, anchorRealTime: 0, running: true, speed: 1 })
      scheduler.tick()
      onFired.mockClear()

      // At the OLD natural due time, the occurrence has moved — must not fire yet.
      vi.spyOn(clock, 'now').mockReturnValue(occurrence2NaturalStart - 600_000)
      vi.spyOn(clock, 'getState').mockReturnValue({
        anchorSimTime: occurrence2NaturalStart - 600_000,
        anchorRealTime: 0,
        running: true,
        speed: 1
      })
      scheduler.tick()
      expect(onFired).not.toHaveBeenCalled()

      // At the NEW due time, it fires — keyed by originalStartTime (stable)
      // but reporting the overridden title/startTime.
      vi.spyOn(clock, 'now').mockReturnValue(occurrence2NewStart - 600_000)
      vi.spyOn(clock, 'getState').mockReturnValue({
        anchorSimTime: occurrence2NewStart - 600_000,
        anchorRealTime: 0,
        running: true,
        speed: 1
      })
      scheduler.tick()
      expect(onFired).toHaveBeenCalledTimes(1)
      const fired = onFired.mock.calls[0][0] as FiredReminder
      expect(fired.title).toBe('Daily standup (moved)')
      expect(fired.startTime).toBe(occurrence2NewStart)
      expect(fired.id).toBe(`${series.id}:${occurrence2NaturalStart}`)
    })

    it('AC4 (regression): a non-recurring item still fires at most once, same as before per-occurrence tracking existed', () => {
      const created = db.createCalendarItem(makeItem({ startTime: 1_000_000, reminderMinutesBefore: 10 }))
      const onFired = vi.fn()
      const scheduler = new ReminderScheduler(db, clock, onFired)

      vi.spyOn(clock, 'now').mockReturnValue(400_000)
      vi.spyOn(clock, 'getState').mockReturnValue({ anchorSimTime: 400_000, anchorRealTime: 0, running: true, speed: 1 })
      scheduler.tick()
      scheduler.tick()

      expect(onFired).toHaveBeenCalledTimes(1)
      expect(db.getCalendarItem(created.id)?.remindersFired).toEqual([created.startTime])
    })
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
