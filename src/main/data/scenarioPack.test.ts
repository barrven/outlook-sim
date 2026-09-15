import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScenarioPack } from '../../shared/data-types'
import { SimClock } from './clock'
import { ConfigStore } from './config'
import { MailDb } from './db'
import { applyScenarioPack, buildScenarioPack, validateScenarioPack } from './scenarioPack'

const VALID_PERSONA = {
  displayName: 'Morgan Rivera',
  email: 'morgan@example.com',
  role: 'Claims Adjuster',
  bio: 'Handles claims for AllState.',
  writingStyleNotes: 'Formal, brief.',
  extraPrompt: ''
}

const VALID_MESSAGE = {
  subject: 'Welcome to the file',
  body: 'Please review the attached intake.',
  fromName: 'Morgan Rivera',
  fromEmail: 'morgan@example.com',
  toName: 'Trainee',
  toEmail: 'trainee@example.com',
  offsetMinutes: -120
}

const VALID_CALENDAR_ITEM = {
  title: 'Discovery deadline',
  description: 'File discovery response',
  offsetMinutes: 60 * 24 * 3,
  durationMinutes: null,
  allDay: false,
  reminderMinutesBefore: 60,
  itemType: 'deadline'
}

function validPackJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Grillo Law Intake',
    description: 'A personal injury intake scenario.',
    personas: [VALID_PERSONA],
    inbox: [VALID_MESSAGE],
    calendarItems: [VALID_CALENDAR_ITEM],
    timedMessages: [{ ...VALID_MESSAGE, offsetMinutes: -1 }],
    ...overrides
  }
}

describe('validateScenarioPack', () => {
  it('accepts a fully-populated, well-formed pack', () => {
    const result = validateScenarioPack(validPackJson())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.pack.name).toBe('Grillo Law Intake')
      expect(result.pack.personas).toHaveLength(1)
      expect(result.pack.inbox).toHaveLength(1)
      expect(result.pack.calendarItems).toHaveLength(1)
      expect(result.pack.timedMessages).toHaveLength(1)
    }
  })

  it.each([
    [null, 'pack must be an object'],
    ['just a string', 'pack must be an object'],
    [42, 'pack must be an object'],
    [['array', 'not', 'object'], 'pack must be an object'],
    [{}, 'name must be a string']
  ])('rejects %p with a clear, specific error, not a crash', (input, expectedError) => {
    const result = validateScenarioPack(input)
    expect(result).toEqual({ ok: false, error: expectedError })
  })

  it('rejects personas that are not an array', () => {
    const result = validateScenarioPack(validPackJson({ personas: 'not an array' }))
    expect(result).toEqual({ ok: false, error: 'personas must be an array' })
  })

  it('rejects a persona missing a required field', () => {
    const result = validateScenarioPack(validPackJson({ personas: [{ email: 'a@x.com' }] }))
    expect(result).toEqual({ ok: false, error: 'personas[0].displayName must be a string' })
  })

  it('defaults optional persona fields to empty strings', () => {
    const result = validateScenarioPack(
      validPackJson({ personas: [{ displayName: 'Alex', email: 'alex@example.com' }] })
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.pack.personas[0]).toEqual({
        displayName: 'Alex',
        email: 'alex@example.com',
        role: '',
        bio: '',
        writingStyleNotes: '',
        extraPrompt: ''
      })
    }
  })

  it('rejects an inbox message missing offsetMinutes', () => {
    const { offsetMinutes: _omit, ...withoutOffset } = VALID_MESSAGE
    const result = validateScenarioPack(validPackJson({ inbox: [withoutOffset] }))
    expect(result).toEqual({ ok: false, error: 'inbox[0].offsetMinutes must be a number' })
  })

  it('rejects a message missing a required fromEmail/toEmail', () => {
    const { fromEmail: _omit, ...withoutFromEmail } = VALID_MESSAGE
    const result = validateScenarioPack(validPackJson({ inbox: [withoutFromEmail] }))
    expect(result).toEqual({ ok: false, error: 'inbox[0].fromEmail must be a string' })
  })

  it('defaults optional message fields (body, fromName, toName) to empty strings', () => {
    const result = validateScenarioPack(
      validPackJson({
        inbox: [{ subject: 'Hi', fromEmail: 'a@x.com', toEmail: 'b@x.com', offsetMinutes: -5 }]
      })
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.pack.inbox[0]).toEqual({
        subject: 'Hi',
        body: '',
        fromName: '',
        fromEmail: 'a@x.com',
        toName: '',
        toEmail: 'b@x.com',
        offsetMinutes: -5
      })
    }
  })

  it('rejects a calendar item with an invalid itemType', () => {
    const result = validateScenarioPack(
      validPackJson({ calendarItems: [{ ...VALID_CALENDAR_ITEM, itemType: 'bogus' }] })
    )
    expect(result).toEqual({ ok: false, error: 'calendarItems[0].itemType must be "event" or "deadline"' })
  })

  it('defaults a calendar item\'s itemType to "event" when omitted', () => {
    const { itemType: _omit, ...withoutType } = VALID_CALENDAR_ITEM
    const result = validateScenarioPack(validPackJson({ calendarItems: [withoutType] }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.pack.calendarItems[0].itemType).toBe('event')
  })

  it('defaults allDay to false and durationMinutes/reminderMinutesBefore to null when omitted', () => {
    const result = validateScenarioPack(
      validPackJson({ calendarItems: [{ title: 'Kickoff', offsetMinutes: 30 }] })
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.pack.calendarItems[0]).toEqual({
        title: 'Kickoff',
        description: '',
        offsetMinutes: 30,
        durationMinutes: null,
        allDay: false,
        reminderMinutesBefore: null,
        itemType: 'event'
      })
    }
  })

  it('rejects a calendar item missing the required title', () => {
    const { title: _omit, ...withoutTitle } = VALID_CALENDAR_ITEM
    const result = validateScenarioPack(validPackJson({ calendarItems: [withoutTitle] }))
    expect(result).toEqual({ ok: false, error: 'calendarItems[0].title must be a string' })
  })

  it('rejects a timedMessages entry the same way as an inbox entry', () => {
    const { toEmail: _omit, ...withoutToEmail } = VALID_MESSAGE
    const result = validateScenarioPack(validPackJson({ timedMessages: [withoutToEmail] }))
    expect(result).toEqual({ ok: false, error: 'timedMessages[0].toEmail must be a string' })
  })

  it('defaults personas/inbox/calendarItems/timedMessages to empty arrays when omitted entirely', () => {
    const result = validateScenarioPack({ name: 'Minimal pack' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.pack).toEqual({
        name: 'Minimal pack',
        description: '',
        personas: [],
        inbox: [],
        calendarItems: [],
        timedMessages: []
      })
    }
  })
})

describe('applyScenarioPack', () => {
  let baseDir: string
  let db: MailDb
  let config: ConfigStore
  let clock: SimClock

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'outlook-sim-scenario-pack-'))
    db = new MailDb(baseDir)
    config = new ConfigStore(baseDir)
    clock = new SimClock(baseDir)
  })

  afterEach(() => {
    db.close()
    rmSync(baseDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  function parsedPack(overrides: Record<string, unknown> = {}): ScenarioPack {
    const result = validateScenarioPack(validPackJson(overrides))
    if (!result.ok) throw new Error(`test setup produced an invalid pack: ${result.error}`)
    return result.pack
  }

  it('replaces existing mailbox/calendar data rather than adding to it', () => {
    db.createMessage({
      folderId: 'inbox',
      subject: 'Pre-existing',
      body: '',
      fromName: 'X',
      fromEmail: 'x@example.com',
      toName: 'Y',
      toEmail: 'y@example.com',
      timestamp: 1
    })
    db.createCalendarItem({
      title: 'Pre-existing item',
      description: '',
      startTime: 1,
      endTime: null,
      allDay: false,
      reminderMinutesBefore: null,
      recurrenceRule: null,
      itemType: 'event'
    })

    applyScenarioPack(db, config, clock, parsedPack())

    expect(db.listMessages().map((m) => m.subject)).not.toContain('Pre-existing')
    expect(db.listCalendarItems().map((i) => i.title)).not.toContain('Pre-existing item')
  })

  it('sets personas from the pack, replacing any existing ones, with fresh generated ids', () => {
    config.setPersonas([
      {
        id: 'old-1',
        displayName: 'Old Persona',
        email: 'old@example.com',
        role: '',
        bio: '',
        writingStyleNotes: '',
        extraPrompt: '',
        isClient: false,
        reportsTo: ''
      }
    ])

    applyScenarioPack(db, config, clock, parsedPack())

    const personas = config.getPersonas()
    expect(personas).toHaveLength(1)
    expect(personas[0].email).toBe('morgan@example.com')
    expect(personas[0].id).not.toBe('old-1')
    expect(personas[0].id.length).toBeGreaterThan(0)
  })

  it('creates each inbox message in Inbox with timestamp = clock.now() + offsetMinutes*60000', () => {
    vi.spyOn(clock, 'now').mockReturnValue(1_000_000)

    applyScenarioPack(db, config, clock, parsedPack())

    const messages = db.listMessages('inbox')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      subject: 'Welcome to the file',
      fromName: 'Morgan Rivera',
      fromEmail: 'morgan@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      timestamp: 1_000_000 + -120 * 60_000,
      isRead: false,
      isFlagged: false
    })
  })

  it('creates each calendar item with startTime/endTime computed from offsetMinutes/durationMinutes', () => {
    vi.spyOn(clock, 'now').mockReturnValue(2_000_000)

    applyScenarioPack(
      db,
      config,
      clock,
      parsedPack({
        calendarItems: [{ ...VALID_CALENDAR_ITEM, durationMinutes: 30 }]
      })
    )

    const items = db.listCalendarItems()
    expect(items).toHaveLength(1)
    const expectedStart = 2_000_000 + 60 * 24 * 3 * 60_000
    expect(items[0]).toMatchObject({
      title: 'Discovery deadline',
      startTime: expectedStart,
      endTime: expectedStart + 30 * 60_000,
      reminderMinutesBefore: 60,
      itemType: 'deadline',
      remindersFired: []
    })
  })

  it('a calendar item with durationMinutes: null gets endTime: null', () => {
    applyScenarioPack(db, config, clock, parsedPack())

    expect(db.listCalendarItems()[0].endTime).toBeNull()
  })

  it('persists timedMessages as pending scheduled messages, not delivered immediately', () => {
    vi.spyOn(clock, 'now').mockReturnValue(500_000)

    applyScenarioPack(db, config, clock, parsedPack())

    expect(db.listMessages('inbox')).toHaveLength(1) // only the `inbox` entry, not the timed one
    const pending = config.getScheduledScenarioMessages()
    expect(pending).toHaveLength(1)
    expect(pending[0]).toMatchObject({
      subject: 'Welcome to the file',
      fromEmail: 'morgan@example.com',
      toEmail: 'trainee@example.com',
      dueSimTime: 500_000 + -1 * 60_000
    })
    expect(pending[0].id).toBeTruthy()
  })

  it('replaces any still-pending scheduled messages from a previously loaded pack', () => {
    config.setScheduledScenarioMessages([
      {
        id: 'stale-1',
        dueSimTime: 999_999_999,
        subject: 'Stale',
        body: '',
        fromName: '',
        fromEmail: 'stale@example.com',
        toName: '',
        toEmail: 'trainee@example.com'
      }
    ])

    applyScenarioPack(db, config, clock, parsedPack())

    const pending = config.getScheduledScenarioMessages()
    expect(pending).toHaveLength(1)
    expect(pending[0].id).not.toBe('stale-1')
  })

  it('an empty pack clears personas and leaves the mailbox/calendar empty', () => {
    applyScenarioPack(
      db,
      config,
      clock,
      parsedPack({ personas: [], inbox: [], calendarItems: [], timedMessages: [] })
    )

    expect(config.getPersonas()).toEqual([])
    expect(db.listMessages()).toEqual([])
    expect(db.listCalendarItems()).toEqual([])
    expect(config.getScheduledScenarioMessages()).toEqual([])
  })
})

describe('buildScenarioPack', () => {
  let baseDir: string
  let db: MailDb
  let config: ConfigStore
  let clock: SimClock

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'outlook-sim-scenario-pack-build-'))
    db = new MailDb(baseDir)
    config = new ConfigStore(baseDir)
    clock = new SimClock(baseDir)
    vi.spyOn(clock, 'now').mockReturnValue(1_000_000)
  })

  afterEach(() => {
    db.close()
    rmSync(baseDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('includes the given name and description', () => {
    const pack = buildScenarioPack(db, config, clock, 'My Pack', 'A description')
    expect(pack.name).toBe('My Pack')
    expect(pack.description).toBe('A description')
  })

  it('defaults description to an empty string when omitted', () => {
    const pack = buildScenarioPack(db, config, clock, 'My Pack')
    expect(pack.description).toBe('')
  })

  it('includes current personas, dropping the internal id', () => {
    config.setPersonas([{ id: 'p1', isClient: false, reportsTo: '', ...VALID_PERSONA }])

    const pack = buildScenarioPack(db, config, clock, 'name')

    expect(pack.personas).toEqual([VALID_PERSONA])
  })

  it('includes only inbox-folder messages, converting timestamp to offsetMinutes relative to clock.now()', () => {
    db.createMessage({
      folderId: 'inbox',
      subject: 'In the inbox',
      body: 'body',
      fromName: 'A',
      fromEmail: 'a@example.com',
      toName: 'B',
      toEmail: 'b@example.com',
      timestamp: 1_000_000 - 120 * 60_000
    })
    db.createMessage({
      folderId: 'sent',
      subject: 'Not in the inbox',
      body: '',
      fromName: 'B',
      fromEmail: 'b@example.com',
      toName: 'A',
      toEmail: 'a@example.com',
      timestamp: 1_000_000
    })

    const pack = buildScenarioPack(db, config, clock, 'name')

    expect(pack.inbox).toHaveLength(1)
    expect(pack.inbox[0]).toMatchObject({
      subject: 'In the inbox',
      fromEmail: 'a@example.com',
      toEmail: 'b@example.com',
      offsetMinutes: -120
    })
  })

  it('includes calendar items with offsetMinutes/durationMinutes computed from startTime/endTime', () => {
    db.createCalendarItem({
      title: 'Deadline',
      description: 'desc',
      startTime: 1_000_000 + 180 * 60_000,
      endTime: 1_000_000 + 210 * 60_000,
      allDay: false,
      reminderMinutesBefore: 15,
      recurrenceRule: null,
      itemType: 'deadline'
    })

    const pack = buildScenarioPack(db, config, clock, 'name')

    expect(pack.calendarItems).toEqual([
      {
        title: 'Deadline',
        description: 'desc',
        offsetMinutes: 180,
        durationMinutes: 30,
        allDay: false,
        reminderMinutesBefore: 15,
        itemType: 'deadline'
      }
    ])
  })

  it('a calendar item with endTime: null gets durationMinutes: null', () => {
    db.createCalendarItem({
      title: 'No end time',
      description: '',
      startTime: 1_000_000,
      endTime: null,
      allDay: true,
      reminderMinutesBefore: null,
      recurrenceRule: null,
      itemType: 'event'
    })

    const pack = buildScenarioPack(db, config, clock, 'name')

    expect(pack.calendarItems[0].durationMinutes).toBeNull()
  })

  it('includes pending scheduled scenario messages as timedMessages', () => {
    config.setScheduledScenarioMessages([
      {
        id: 'sched-1',
        dueSimTime: 1_000_000 + 300_000,
        subject: 'Later',
        body: 'later body',
        fromName: 'A',
        fromEmail: 'a@example.com',
        toName: 'B',
        toEmail: 'b@example.com'
      }
    ])

    const pack = buildScenarioPack(db, config, clock, 'name')

    expect(pack.timedMessages).toEqual([
      {
        subject: 'Later',
        body: 'later body',
        fromName: 'A',
        fromEmail: 'a@example.com',
        toName: 'B',
        toEmail: 'b@example.com',
        offsetMinutes: 5
      }
    ])
  })

  it('never includes Settings/API keys, even when a real key is configured', () => {
    config.setSettings({
      provider: 'openai',
      model: 'gpt-4',
      apiKeys: { openai: 'sk-super-secret-key', anthropic: '', gemini: '', xai: '' }
    })

    const pack = buildScenarioPack(db, config, clock, 'name')

    expect(JSON.stringify(pack)).not.toContain('sk-super-secret-key')
    expect(pack).not.toHaveProperty('apiKeys')
    expect(pack).not.toHaveProperty('settings')
  })

  it('an empty mailbox/calendar/personas/schedule produces an empty pack', () => {
    const pack = buildScenarioPack(db, config, clock, 'Empty')
    expect(pack).toEqual({
      name: 'Empty',
      description: '',
      personas: [],
      inbox: [],
      calendarItems: [],
      timedMessages: []
    })
  })

  it('round-trips through validateScenarioPack and applyScenarioPack without data loss', () => {
    config.setPersonas([{ id: 'p1', isClient: false, reportsTo: '', ...VALID_PERSONA }])
    db.createMessage({
      folderId: 'inbox',
      subject: 'Hello',
      body: 'body text',
      fromName: 'Morgan Rivera',
      fromEmail: 'morgan@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      timestamp: 1_000_000 - 60_000
    })
    db.createCalendarItem({
      title: 'Discovery deadline',
      description: 'File discovery response',
      startTime: 1_000_000 + 120_000,
      endTime: 1_000_000 + 180_000,
      allDay: false,
      reminderMinutesBefore: 15,
      recurrenceRule: null,
      itemType: 'deadline'
    })
    config.setScheduledScenarioMessages([
      {
        id: 'sched-1',
        dueSimTime: 1_000_000 + 300_000,
        subject: 'Later',
        body: 'later body',
        fromName: 'Morgan Rivera',
        fromEmail: 'morgan@example.com',
        toName: 'Trainee',
        toEmail: 'trainee@example.com'
      }
    ])

    const built = buildScenarioPack(db, config, clock, 'Round Trip Pack', 'desc')

    // Simulate a save-to-disk-then-load-from-disk round trip via JSON (de)serialization.
    const validated = validateScenarioPack(JSON.parse(JSON.stringify(built)))
    expect(validated.ok).toBe(true)
    if (!validated.ok) return

    const baseDir2 = mkdtempSync(join(tmpdir(), 'outlook-sim-scenario-pack-roundtrip-'))
    const db2 = new MailDb(baseDir2)
    const config2 = new ConfigStore(baseDir2)
    const clock2 = new SimClock(baseDir2)
    vi.spyOn(clock2, 'now').mockReturnValue(1_000_000)
    try {
      applyScenarioPack(db2, config2, clock2, validated.pack)

      expect(db2.listMessages('inbox')).toMatchObject([
        {
          subject: 'Hello',
          body: 'body text',
          fromEmail: 'morgan@example.com',
          toEmail: 'trainee@example.com',
          timestamp: 1_000_000 - 60_000
        }
      ])
      expect(db2.listCalendarItems()).toMatchObject([
        {
          title: 'Discovery deadline',
          startTime: 1_000_000 + 120_000,
          endTime: 1_000_000 + 180_000,
          reminderMinutesBefore: 15,
          itemType: 'deadline'
        }
      ])
      expect(config2.getPersonas()).toMatchObject([{ ...VALID_PERSONA }])
      expect(config2.getScheduledScenarioMessages()).toMatchObject([
        {
          subject: 'Later',
          body: 'later body',
          fromEmail: 'morgan@example.com',
          toEmail: 'trainee@example.com',
          dueSimTime: 1_000_000 + 300_000
        }
      ])
    } finally {
      db2.close()
      rmSync(baseDir2, { recursive: true, force: true })
    }
  })
})
