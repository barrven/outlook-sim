import type { CalendarItem } from '../../shared/data-types'
import type { SimClock } from './clock'
import type { MailDb } from './db'

const CHECK_INTERVAL_REAL_MS = 10_000

/**
 * Polls (in real time, every CHECK_INTERVAL_REAL_MS) for calendar items whose
 * reminder is due — `startTime - reminderMinutesBefore` minutes has been
 * reached by the simulated clock — and fires each one exactly once. Only
 * checks while the clock is running: `clock.now()` itself doesn't advance
 * while paused, so a paused clock already can't produce a due reminder, but
 * the explicit guard documents that intent and matches the unsolicited-mail
 * scheduler's convention.
 */
export class ReminderScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private ticking = false

  constructor(
    private db: MailDb,
    private clock: SimClock,
    private onReminderFired: (item: CalendarItem) => void
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
      const due = this.db
        .listCalendarItems()
        .filter(
          (item) =>
            item.reminderMinutesBefore !== null &&
            !item.reminderFired &&
            item.startTime - item.reminderMinutesBefore * 60_000 <= now
        )
      for (const item of due) {
        const updated = this.db.updateCalendarItem(item.id, { reminderFired: true })
        this.onReminderFired(updated ?? item)
      }
    } finally {
      this.ticking = false
    }
  }
}
