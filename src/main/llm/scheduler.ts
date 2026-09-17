import type { GenerateUnsolicitedMailResult, Persona, TraineeIdentity } from '../../shared/data-types'
import { generateText } from './client'
import { buildFileVineContextPrompt } from './fileVineContext'
import { ATTACHMENT_PROMPT_INSTRUCTION, extractAttachmentBlocks, writeGeneratedAttachment } from './generatedAttachment'
import type { SimClock } from '../data/clock'
import type { ConfigStore } from '../data/config'
import type { MailDb } from '../data/db'

// Default interval range absent any spec guidance: a new unsolicited message
// every 1-3 simulated hours (randomized so it doesn't feel mechanical),
// checked every 10 real seconds — frequent enough to stay reasonably close
// to the chosen simulated due time even at the fastest clock speed (60x).
const MIN_INTERVAL_SIM_MS = 60 * 60 * 1000
const MAX_INTERVAL_SIM_MS = 3 * 60 * 60 * 1000
const CHECK_INTERVAL_REAL_MS = 10_000
const RECENT_MESSAGE_LIMIT = 5
const UPCOMING_CALENDAR_LIMIT = 10

function randomIntervalMs(): number {
  return MIN_INTERVAL_SIM_MS + Math.random() * (MAX_INTERVAL_SIM_MS - MIN_INTERVAL_SIM_MS)
}

function pickPersona(personas: Persona[]): Persona | undefined {
  if (personas.length === 0) return undefined
  return personas[Math.floor(Math.random() * personas.length)]
}

function buildSystemPrompt(
  systemPrompt: string,
  persona: Persona,
  identity: TraineeIdentity,
  fileVineContext: string | null
): string {
  return [
    systemPrompt,
    `You are playing ${persona.displayName}${persona.role ? ` (${persona.role})` : ''} in an email training simulation. Write a NEW, unsolicited email to ${identity.displayName || 'the trainee'}${identity.jobTitle ? ` (${identity.jobTitle})` : ''} — not a reply to anything specific, but a status update, demand, reminder, or new request that makes sense given the context below.`,
    persona.bio && `Background: ${persona.bio}`,
    persona.writingStyleNotes && `Writing style: ${persona.writingStyleNotes}`,
    persona.extraPrompt,
    fileVineContext,
    'Respond in exactly this format and nothing else, except optionally the attachment block described below:\nSubject: <subject line>\n\n<body text>',
    ATTACHMENT_PROMPT_INSTRUCTION
  ]
    .filter(Boolean)
    .join('\n\n')
}

function buildContextPrompt(db: MailDb, clock: SimClock, persona: Persona, identity: TraineeIdentity): string {
  const participants = new Set([persona.email.toLowerCase(), identity.fromEmail.toLowerCase()])
  const recentMessages = db
    .listMessages()
    .filter(
      (message) =>
        participants.has(message.fromEmail.toLowerCase()) && participants.has(message.toEmail.toLowerCase())
    )
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, RECENT_MESSAGE_LIMIT)
    .reverse()

  const mailboxSection = recentMessages.length
    ? recentMessages
        .map(
          (message) => `From: ${message.fromName} <${message.fromEmail}>\nSubject: ${message.subject}\n${message.body}`
        )
        .join('\n\n---\n\n')
    : 'No prior correspondence with this persona yet.'

  const now = clock.now()
  const upcoming = db
    .listCalendarItems()
    .filter((item) => item.startTime >= now)
    .sort((a, b) => a.startTime - b.startTime)
    .slice(0, UPCOMING_CALENDAR_LIMIT)

  const calendarSection = upcoming.length
    ? upcoming
        .map(
          (item) =>
            `${item.itemType === 'deadline' ? 'Deadline' : 'Event'}: ${item.title} — ${new Date(item.startTime).toISOString()}${item.description ? ` (${item.description})` : ''}`
        )
        .join('\n')
    : 'No upcoming calendar deadlines or events.'

  return `Recent correspondence with this persona:\n${mailboxSection}\n\nUpcoming calendar deadlines/events:\n${calendarSection}`
}

function parseSubjectAndBody(text: string): { subject: string; body: string } | null {
  const match = text.trim().match(/^Subject:\s*(.+?)\r?\n+([\s\S]+)$/i)
  if (!match) return null
  const subject = match[1].trim()
  const body = match[2].trim()
  if (!subject || !body) return null
  return { subject, body }
}

/**
 * Generates one unsolicited message from a randomly-chosen configured
 * persona, referencing recent correspondence and upcoming calendar
 * deadlines/events, and delivers it into Inbox. A no-op (not a failure) when
 * no personas are configured; never inserts a message unless the LLM call
 * succeeded and its response parsed cleanly.
 */
export async function generateUnsolicitedMail(
  db: MailDb,
  config: ConfigStore,
  clock: SimClock,
  userDataDir: string
): Promise<GenerateUnsolicitedMailResult> {
  const persona = pickPersona(config.getPersonas())
  if (!persona) {
    return { ok: true, sent: false }
  }

  const identity = config.getIdentity()
  const { systemPrompt } = config.getSystemPrompt()
  const fileVineContext = buildFileVineContextPrompt(db, persona.id)

  const result = await generateText(config.getSettings(), {
    systemPrompt: buildSystemPrompt(systemPrompt, persona, identity, fileVineContext),
    userPrompt: buildContextPrompt(db, clock, persona, identity)
  })

  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  const { text: withoutAttachments, attachments: parsedAttachments } = extractAttachmentBlocks(result.text)
  const parsed = parseSubjectAndBody(withoutAttachments)
  if (!parsed) {
    return { ok: false, error: 'Provider response was not in the expected Subject/body format.' }
  }

  // Most unsolicited messages have no document attached (AC5) — only
  // written to disk for each attachment the model actually included.
  const attachments = parsedAttachments.map((attachment) =>
    writeGeneratedAttachment(userDataDir, attachment.filename, attachment.markdown)
  )

  const message = db.createMessage({
    folderId: 'inbox',
    subject: parsed.subject,
    body: parsed.body,
    fromName: persona.displayName,
    fromEmail: persona.email,
    toName: identity.displayName,
    toEmail: identity.fromEmail,
    timestamp: clock.now(),
    attachments
  })
  return { ok: true, sent: true, message }
}

/**
 * Wraps `generateUnsolicitedMail` with the durable failure-log append
 * (feature 027) — used both by the scheduler's own tick and by a manual
 * Retry from the UI, so a failure is logged exactly once regardless of
 * which caller triggered the attempt.
 */
export async function attemptUnsolicitedMail(
  db: MailDb,
  config: ConfigStore,
  clock: SimClock,
  userDataDir: string
): Promise<GenerateUnsolicitedMailResult> {
  const result = await generateUnsolicitedMail(db, config, clock, userDataDir)
  if (!result.ok) {
    config.appendLlmFailureLog({ timestamp: Date.now(), source: 'unsolicitedMail', error: result.error })
  }
  return result
}

/**
 * Polls (in real time, every CHECK_INTERVAL_REAL_MS) whether the simulated
 * clock has reached the next due simulated time and, if so and the clock is
 * currently running, generates one unsolicited message. Due time is
 * persisted via ConfigStore so it survives app restarts; advanced on every
 * attempt (success or failure) so a broken key/model can't retry in a tight
 * loop, and so a real-world gap while the app was closed (during which the
 * paused simulated clock doesn't advance) doesn't cause a catch-up flood.
 */
export class UnsolicitedMailScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private ticking = false

  constructor(
    private db: MailDb,
    private config: ConfigStore,
    private clock: SimClock,
    private userDataDir: string,
    private onGenerated?: () => void,
    private onFailed?: (error: string) => void
  ) {}

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => {
      void this.tick()
    }, CHECK_INTERVAL_REAL_MS)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  async tick(): Promise<void> {
    if (this.ticking) return
    this.ticking = true
    try {
      if (!this.clock.getState().running) return

      let state = this.config.getSchedulerState()
      if (state.nextDueSimTime === 0) {
        state = { nextDueSimTime: this.clock.now() + randomIntervalMs() }
        this.config.setSchedulerState(state)
      }

      const now = this.clock.now()
      if (now < state.nextDueSimTime) return

      this.config.setSchedulerState({ nextDueSimTime: now + randomIntervalMs() })

      const result = await attemptUnsolicitedMail(this.db, this.config, this.clock, this.userDataDir)
      if (result.ok && result.sent) {
        this.onGenerated?.()
      } else if (!result.ok) {
        this.onFailed?.(result.error)
      }
    } finally {
      this.ticking = false
    }
  }
}
