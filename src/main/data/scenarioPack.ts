import type {
  CalendarItemType,
  ScenarioPack,
  ScenarioPackCalendarItem,
  ScenarioPackMessage,
  ScenarioPackPersona,
  ScenarioPackValidationResult,
  ScheduledScenarioMessage
} from '../../shared/data-types'
import type { SimClock } from './clock'
import type { ConfigStore } from './config'
import type { MailDb } from './db'

class PackValidationError extends Error {}

function requireObject(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PackValidationError(`${path} must be an object`)
  }
  return value as Record<string, unknown>
}

function requireArray(value: unknown, path: string): unknown[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new PackValidationError(`${path} must be an array`)
  return value
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string') throw new PackValidationError(`${path} must be a string`)
  return value
}

function optionalString(value: unknown, path: string, fallback = ''): string {
  if (value === undefined) return fallback
  return requireString(value, path)
}

function requireNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new PackValidationError(`${path} must be a number`)
  }
  return value
}

function optionalNullableNumber(value: unknown, path: string): number | null {
  if (value === undefined || value === null) return null
  return requireNumber(value, path)
}

function optionalBoolean(value: unknown, path: string, fallback = false): boolean {
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') throw new PackValidationError(`${path} must be a boolean`)
  return value
}

function parsePersona(value: unknown, index: number): ScenarioPackPersona {
  const obj = requireObject(value, `personas[${index}]`)
  return {
    displayName: requireString(obj.displayName, `personas[${index}].displayName`),
    email: requireString(obj.email, `personas[${index}].email`),
    role: optionalString(obj.role, `personas[${index}].role`),
    bio: optionalString(obj.bio, `personas[${index}].bio`),
    writingStyleNotes: optionalString(obj.writingStyleNotes, `personas[${index}].writingStyleNotes`),
    extraPrompt: optionalString(obj.extraPrompt, `personas[${index}].extraPrompt`)
  }
}

function parseMessage(value: unknown, path: string): ScenarioPackMessage {
  const obj = requireObject(value, path)
  return {
    subject: requireString(obj.subject, `${path}.subject`),
    body: optionalString(obj.body, `${path}.body`),
    fromName: optionalString(obj.fromName, `${path}.fromName`),
    fromEmail: requireString(obj.fromEmail, `${path}.fromEmail`),
    toName: optionalString(obj.toName, `${path}.toName`),
    toEmail: requireString(obj.toEmail, `${path}.toEmail`),
    offsetMinutes: requireNumber(obj.offsetMinutes, `${path}.offsetMinutes`)
  }
}

const CALENDAR_ITEM_TYPES = new Set<string>(['event', 'deadline'])

function parseCalendarItem(value: unknown, index: number): ScenarioPackCalendarItem {
  const path = `calendarItems[${index}]`
  const obj = requireObject(value, path)
  const itemType = optionalString(obj.itemType, `${path}.itemType`, 'event')
  if (!CALENDAR_ITEM_TYPES.has(itemType)) {
    throw new PackValidationError(`${path}.itemType must be "event" or "deadline"`)
  }
  return {
    title: requireString(obj.title, `${path}.title`),
    description: optionalString(obj.description, `${path}.description`),
    offsetMinutes: requireNumber(obj.offsetMinutes, `${path}.offsetMinutes`),
    durationMinutes: optionalNullableNumber(obj.durationMinutes, `${path}.durationMinutes`),
    allDay: optionalBoolean(obj.allDay, `${path}.allDay`),
    reminderMinutesBefore: optionalNullableNumber(obj.reminderMinutesBefore, `${path}.reminderMinutesBefore`),
    itemType: itemType as CalendarItemType
  }
}

/**
 * Validates and normalizes an arbitrary JSON value into a ScenarioPack,
 * never throwing — a malformed file comes back as a clear, specific error
 * message (which field, what's wrong) rather than a crash.
 */
export function validateScenarioPack(data: unknown): ScenarioPackValidationResult {
  try {
    const root = requireObject(data, 'pack')
    const name = requireString(root.name, 'name')
    const description = optionalString(root.description, 'description')
    const personas = requireArray(root.personas, 'personas').map((value, index) => parsePersona(value, index))
    const inbox = requireArray(root.inbox, 'inbox').map((value, index) => parseMessage(value, `inbox[${index}]`))
    const calendarItems = requireArray(root.calendarItems, 'calendarItems').map((value, index) =>
      parseCalendarItem(value, index)
    )
    const timedMessages = requireArray(root.timedMessages, 'timedMessages').map((value, index) =>
      parseMessage(value, `timedMessages[${index}]`)
    )
    return { ok: true, pack: { name, description, personas, inbox, calendarItems, timedMessages } }
  } catch (error) {
    if (error instanceof PackValidationError) return { ok: false, error: error.message }
    return { ok: false, error: `Could not parse scenario pack: ${(error as Error).message}` }
  }
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Replaces the current mailbox/calendar/personas with a scenario pack's
 * contents. Caller is responsible for the discard-confirmation decision
 * (see `session:startFreePlay`'s handshake, which this mirrors) — by the
 * time this runs, applying is unconditional.
 */
export function applyScenarioPack(db: MailDb, config: ConfigStore, clock: SimClock, pack: ScenarioPack): void {
  db.resetMailboxAndCalendar()
  config.setPersonas(pack.personas.map((persona) => ({ id: generateId(), ...persona })))

  const now = clock.now()

  for (const message of pack.inbox) {
    db.createMessage({
      folderId: 'inbox',
      subject: message.subject,
      body: message.body,
      fromName: message.fromName,
      fromEmail: message.fromEmail,
      toName: message.toName,
      toEmail: message.toEmail,
      timestamp: now + message.offsetMinutes * 60_000
    })
  }

  for (const item of pack.calendarItems) {
    const startTime = now + item.offsetMinutes * 60_000
    db.createCalendarItem({
      title: item.title,
      description: item.description,
      startTime,
      endTime: item.durationMinutes !== null ? startTime + item.durationMinutes * 60_000 : null,
      allDay: item.allDay,
      reminderMinutesBefore: item.reminderMinutesBefore,
      recurrenceRule: null,
      itemType: item.itemType
    })
  }

  const scheduled: ScheduledScenarioMessage[] = pack.timedMessages.map((message) => ({
    id: generateId(),
    dueSimTime: now + message.offsetMinutes * 60_000,
    subject: message.subject,
    body: message.body,
    fromName: message.fromName,
    fromEmail: message.fromEmail,
    toName: message.toName,
    toEmail: message.toEmail
  }))
  config.setScheduledScenarioMessages(scheduled)
}
