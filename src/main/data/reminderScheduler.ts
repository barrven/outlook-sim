import type { FiredReminder } from '../../shared/data-types'
import { expandOccurrences } from '../../shared/recurrence'
import type { SimClock } from './clock'
import type { MailDb } from './db'

const CHECK_INTERVAL_REAL_MS = 10_000

// How far past `now` to expand occurrences looking for one whose reminder
// is already due — a reminder can be due before its occurrence *starts*, so
// the search window has to reach past `now` by at least the longest
// reminder lead time offered in the UI (1 day before). Doubled for margin.
const REMINDER_LOOKAHEAD_MS = 2 * 24 * 60 * 60_000

/**
 * Polls (in real time, every CHECK_INTERVAL_REAL_MS) for calendar
 * occurrences — including each individual occurrence of a recurring series,
 * not just the series' own template start time — whose reminder is due
 * (`startTime - reminderMinutesBefore` minutes has been reached by the
 * simulated clock) and fires each one exactly once. Only checks while the
 * clock is running: `clock.now()` itself doesn't advance while paused, so a
 * paused clock already can't produce a due reminder, but the explicit guard
 * documents that intent and matches the unsolicited-mail scheduler's
 * convention.
 */
export class ReminderScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private ticking = false

  constructor(
    private db: MailDb,
    private clock: SimClock,
    private onReminderFired: (reminder: FiredReminder) => void
  ) {}

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => {
      this.tick()
    }, CHECK_INTERVAL_REAL_MS)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  tick(): void {
    if (this.ticking) return
    this.ticking = true
    try {
      if (!this.clock.getState().running) return
      const now = this.clock.now()
      for (const item of this.db.listCalendarItems()) {
        // Range starts at the series' own startTime (not `now`) so an
        // occurrence that became due while the app was closed/paused is
        // still caught and fired on the next tick, same as the old
        // single-boolean behavior did for a series' first occurrence.
        const occurrences = expandOccurrences([item], item.startTime, now + REMINDER_LOOKAHEAD_MS + 1)
        const due = occurrences.filter(
          (occurrence) =>
            occurrence.reminderMinutesBefore !== null &&
            !item.remindersFired.includes(occurrence.originalStartTime) &&
            occurrence.startTime - occurrence.reminderMinutesBefore * 60_000 <= now
        )
        if (due.length === 0) continue
        this.db.updateCalendarItem(item.id, {
          remindersFired: [...item.remindersFired, ...due.map((occurrence) => occurrence.originalStartTime)]
        })
        for (const occurrence of due) {
          this.onReminderFired({
            id: `${occurrence.seriesId}:${occurrence.originalStartTime}`,
            seriesId: occurrence.seriesId,
            title: occurrence.title,
            startTime: occurrence.startTime
          })
        }
      }
    } finally {
      this.ticking = false
    }
  }
}
