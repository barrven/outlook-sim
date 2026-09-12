import type { SimClock } from './clock'
import type { ConfigStore } from './config'
import type { MailDb } from './db'

const CHECK_INTERVAL_REAL_MS = 10_000

/**
 * Delivers a scenario pack's `timedMessages` into Inbox once simulated time
 * reaches each one's due time. Same real-time-poll-but-simulated-time-check
 * shape as the unsolicited-mail and reminder schedulers: only checks while
 * the clock is running, so nothing delivers on wall-clock time while paused.
 * Pending messages are persisted via ConfigStore, so a delivery due while the
 * app is closed still arrives (once simulated time catches up) after restart,
 * rather than being lost.
 */
export class ScenarioMailScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private ticking = false

  constructor(
    private db: MailDb,
    private config: ConfigStore,
    private clock: SimClock,
    private onDelivered?: () => void
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
      const pending = this.config.getScheduledScenarioMessages()
      const due = pending.filter((message) => message.dueSimTime <= now)
      if (due.length === 0) return

      for (const message of due) {
        this.db.createMessage({
          folderId: 'inbox',
          subject: message.subject,
          body: message.body,
          fromName: message.fromName,
          fromEmail: message.fromEmail,
          toName: message.toName,
          toEmail: message.toEmail,
          timestamp: now
        })
      }
      this.config.setScheduledScenarioMessages(pending.filter((message) => message.dueSimTime > now))
      this.onDelivered?.()
    } finally {
      this.ticking = false
    }
  }
}
