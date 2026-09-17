import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Persona } from '../../shared/data-types'
import { ConfigStore } from '../data/config'
import { MailDb } from '../data/db'
import { SimClock } from '../data/clock'
import { attemptUnsolicitedMail, generateUnsolicitedMail, UnsolicitedMailScheduler } from './scheduler'

const PERSONA: Persona = {
  id: 'p1',
  displayName: 'Morgan Rivera',
  email: 'morgan@example.com',
  role: 'Office Manager',
  bio: 'Runs the front office.',
  writingStyleNotes: 'Warm but brief.',
  extraPrompt: '',
  isClient: false,
  reportsTo: ''
}

function subjectBodyResponse(subject: string, body: string): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({ choices: [{ message: { content: `Subject: ${subject}\n\n${body}` } }] })
  } as Response
}

describe('generateUnsolicitedMail', () => {
  let baseDir: string
  let db: MailDb
  let config: ConfigStore
  let clock: SimClock

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'outlook-sim-scheduler-'))
    db = new MailDb(baseDir)
    config = new ConfigStore(baseDir)
    clock = new SimClock(baseDir)
    config.setPersonas([PERSONA])
    config.setIdentity({
      displayName: 'Jordan Trainee',
      jobTitle: 'Analyst',
      fromEmail: 'jordan@example.com',
      reportsTo: '',
      department: ''
    })
    config.setSettings({
      provider: 'openai',
      model: 'gpt-4o',
      apiKeys: { openai: 'sk-test', anthropic: '', gemini: '', xai: '' }
    })
  })

  afterEach(() => {
    db.close()
    rmSync(baseDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('is a no-op (not a failure) when no personas are configured', async () => {
    config.setPersonas([])
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const result = await generateUnsolicitedMail(db, config, clock, baseDir)

    expect(result).toEqual({ ok: true, sent: false })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(db.listMessages('inbox')).toEqual([])
  })

  it('inserts the generated message into Inbox from the persona, with simulated time', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      subjectBodyResponse('Reminder: OCF-3 due Friday', 'Just flagging this is still outstanding.')
    )
    const nowSpy = vi.spyOn(clock, 'now').mockReturnValue(5000)

    const result = await generateUnsolicitedMail(db, config, clock, baseDir)

    expect(result.ok).toBe(true)
    expect(result).toMatchObject({ ok: true, sent: true })
    if (result.ok && result.sent) {
      expect(result.message).toMatchObject({
        folderId: 'inbox',
        subject: 'Reminder: OCF-3 due Friday',
        body: 'Just flagging this is still outstanding.',
        fromName: 'Morgan Rivera',
        fromEmail: 'morgan@example.com',
        toName: 'Jordan Trainee',
        toEmail: 'jordan@example.com',
        timestamp: 5000,
        isRead: false
      })
    }
    expect(db.listMessages('inbox')).toHaveLength(1)
    nowSpy.mockRestore()
  })

  it('sends the system prompt, persona details, recent correspondence, and upcoming calendar items', async () => {
    db.createMessage({
      folderId: 'sent',
      subject: 'Status?',
      body: 'Any update?',
      fromName: 'Jordan Trainee',
      fromEmail: 'jordan@example.com',
      toName: 'Morgan Rivera',
      toEmail: 'morgan@example.com',
      timestamp: 100
    })
    db.createCalendarItem({
      title: 'OCF-3 filing',
      description: 'Chen file',
      startTime: 999_999_999_999,
      endTime: null,
      allDay: false,
      reminderMinutesBefore: null,
      recurrenceRule: null,
      itemType: 'deadline'
    })
    config.setSystemPrompt({ systemPrompt: 'Domain: insurance office.' })
    const nowSpy = vi.spyOn(clock, 'now').mockReturnValue(500)

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(subjectBodyResponse('Following up', 'Any word on the Chen file?'))

    await generateUnsolicitedMail(db, config, clock, baseDir)

    const [, init] = fetchSpy.mock.calls[0]
    const body = JSON.parse(init?.body as string)
    const systemMessage = body.messages.find((m: { role: string }) => m.role === 'system').content
    const userMessage = body.messages.find((m: { role: string }) => m.role === 'user').content

    expect(systemMessage).toContain('Domain: insurance office.')
    expect(systemMessage).toContain('Morgan Rivera')
    expect(systemMessage).toContain('Office Manager')
    expect(systemMessage).toContain('Runs the front office.')
    expect(systemMessage).toContain('Warm but brief.')
    expect(systemMessage).toContain('Subject:')

    expect(userMessage).toContain('Any update?')
    expect(userMessage).toContain('OCF-3 filing')
    expect(userMessage).toContain('Chen file')
    nowSpy.mockRestore()
  })

  it('excludes past calendar items — only upcoming deadlines/events are referenced', async () => {
    const nowSpy = vi.spyOn(clock, 'now').mockReturnValue(1_000_000)
    db.createCalendarItem({
      title: 'Long-past deadline',
      description: '',
      startTime: 1,
      endTime: null,
      allDay: false,
      reminderMinutesBefore: null,
      recurrenceRule: null,
      itemType: 'deadline'
    })
    db.createCalendarItem({
      title: 'Upcoming deadline',
      description: '',
      startTime: 2_000_000,
      endTime: null,
      allDay: false,
      reminderMinutesBefore: null,
      recurrenceRule: null,
      itemType: 'deadline'
    })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(subjectBodyResponse('Hi', 'Body'))

    await generateUnsolicitedMail(db, config, clock, baseDir)

    const [, init] = fetchSpy.mock.calls[0]
    const body = JSON.parse(init?.body as string)
    const userMessage = body.messages.find((m: { role: string }) => m.role === 'user').content
    expect(userMessage).toContain('Upcoming deadline')
    expect(userMessage).not.toContain('Long-past deadline')
    nowSpy.mockRestore()
  })

  it('degrades gracefully — no crash, no message inserted — when the LLM call fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'))

    const result = await generateUnsolicitedMail(db, config, clock, baseDir)

    expect(result).toEqual({ ok: false, error: 'Network error: fetch failed' })
    expect(db.listMessages('inbox')).toEqual([])
  })

  it('returns an error and inserts nothing when the response is not in the Subject/body format', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({ choices: [{ message: { content: 'Just a plain sentence, no subject line.' } }] })
    } as Response)

    const result = await generateUnsolicitedMail(db, config, clock, baseDir)

    expect(result).toEqual({
      ok: false,
      error: 'Provider response was not in the expected Subject/body format.'
    })
    expect(db.listMessages('inbox')).toEqual([])
  })

  it('picks among several configured personas, always producing a valid one', async () => {
    const otherPersona: Persona = {
      id: 'p2',
      displayName: 'Alex Chen',
      email: 'alex@example.com',
      role: 'Paralegal',
      bio: '',
      writingStyleNotes: '',
      extraPrompt: '',
      isClient: false,
      reportsTo: ''
    }
    config.setPersonas([PERSONA, otherPersona])
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(subjectBodyResponse('Hi', 'Body'))

    const seenEmails = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const result = await generateUnsolicitedMail(db, config, clock, baseDir)
      expect(result).toMatchObject({ ok: true, sent: true })
      if (result.ok && result.sent) seenEmails.add(result.message.fromEmail)
    }

    for (const email of seenEmails) {
      expect(['morgan@example.com', 'alex@example.com']).toContain(email)
    }
  })

  it('only includes correspondence with the chosen persona, not other personas', async () => {
    const otherPersona: Persona = {
      id: 'p2',
      displayName: 'Alex Chen',
      email: 'alex@example.com',
      role: 'Paralegal',
      bio: '',
      writingStyleNotes: '',
      extraPrompt: '',
      isClient: false,
      reportsTo: ''
    }
    config.setPersonas([PERSONA, otherPersona])
    db.createMessage({
      folderId: 'sent',
      subject: 'A question for Alex only',
      body: 'This should never leak into Morgan-generated context.',
      fromName: 'Jordan Trainee',
      fromEmail: 'jordan@example.com',
      toName: 'Alex Chen',
      toEmail: 'alex@example.com',
      timestamp: 100
    })
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(subjectBodyResponse('Hi', 'Body'))

    // Force persona selection deterministically for this assertion.
    vi.spyOn(Math, 'random').mockReturnValue(0) // pickPersona -> index 0 -> PERSONA (Morgan)

    await generateUnsolicitedMail(db, config, clock, baseDir)

    const [, init] = fetchSpy.mock.calls[0]
    const body = JSON.parse(init?.body as string)
    const userMessage = body.messages.find((m: { role: string }) => m.role === 'user').content
    expect(userMessage).not.toContain('never leak into Morgan')
  })

  describe('049: FileVine content in the prompt', () => {
    it('AC1: includes the associated FileVine folder\'s notes (name + content) in the system prompt', async () => {
      const folder = db.createFileVineFolder({ name: 'Rivera Estate', parentId: null, clientPersonaId: PERSONA.id })
      db.createFileVineNote({
        folderId: folder.id,
        name: 'Deadline note',
        content: 'The probate filing is due 2026-06-01.'
      })
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(subjectBodyResponse('Hi', 'Body'))

      await generateUnsolicitedMail(db, config, clock, baseDir)

      const [, init] = fetchSpy.mock.calls[0]
      const body = JSON.parse(init?.body as string)
      const systemMessage = body.messages.find((m: { role: string }) => m.role === 'system').content
      expect(systemMessage).toContain('Rivera Estate')
      expect(systemMessage).toContain('Deadline note')
      expect(systemMessage).toContain('The probate filing is due 2026-06-01.')
    })

    it('AC2: a persona with no associated FileVine folder generates exactly as before (no FileVine section)', async () => {
      db.createFileVineFolder({ name: 'Unrelated Matter', parentId: null, clientPersonaId: null })
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(subjectBodyResponse('Hi', 'Body'))

      await generateUnsolicitedMail(db, config, clock, baseDir)

      const [, init] = fetchSpy.mock.calls[0]
      const body = JSON.parse(init?.body as string)
      const systemMessage = body.messages.find((m: { role: string }) => m.role === 'system').content
      expect(systemMessage).not.toContain('FileVine')
      expect(systemMessage).not.toContain('Unrelated Matter')
    })

    it('AC4: a folder content update is reflected in the very next generation, with the old content gone', async () => {
      const folder = db.createFileVineFolder({ name: 'Rivera Estate', parentId: null, clientPersonaId: PERSONA.id })
      const note = db.createFileVineNote({ folderId: folder.id, name: 'Deadline note', content: 'Due 2026-04-01.' })
      db.updateFileVineNote(note.id, { content: 'Due 2026-05-15 (moved).' })
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(subjectBodyResponse('Hi', 'Body'))

      await generateUnsolicitedMail(db, config, clock, baseDir)

      const [, init] = fetchSpy.mock.calls[0]
      const body = JSON.parse(init?.body as string)
      const systemMessage = body.messages.find((m: { role: string }) => m.role === 'system').content
      expect(systemMessage).toContain('Due 2026-05-15 (moved).')
      expect(systemMessage).not.toContain('Due 2026-04-01.')
    })
  })
})

describe('UnsolicitedMailScheduler', () => {
  let baseDir: string
  let db: MailDb
  let config: ConfigStore
  let clock: SimClock

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'outlook-sim-scheduler-'))
    db = new MailDb(baseDir)
    config = new ConfigStore(baseDir)
    clock = new SimClock(baseDir)
    config.setPersonas([PERSONA])
    config.setIdentity({
      displayName: 'Jordan Trainee',
      jobTitle: 'Analyst',
      fromEmail: 'jordan@example.com',
      reportsTo: '',
      department: ''
    })
    config.setSettings({
      provider: 'openai',
      model: 'gpt-4o',
      apiKeys: { openai: 'sk-test', anthropic: '', gemini: '', xai: '' }
    })
  })

  afterEach(() => {
    db.close()
    rmSync(baseDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('does nothing while the clock is paused, even once nominally due', async () => {
    config.setSchedulerState({ nextDueSimTime: 1 })
    vi.spyOn(clock, 'now').mockReturnValue(1_000_000)
    vi.spyOn(clock, 'getState').mockReturnValue({
      anchorSimTime: 0,
      anchorRealTime: 0,
      running: false,
      speed: 1
    })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const scheduler = new UnsolicitedMailScheduler(db, config, clock, baseDir)
    await scheduler.tick()

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(db.listMessages('inbox')).toEqual([])
  })

  it('does nothing while running but not yet due', async () => {
    config.setSchedulerState({ nextDueSimTime: 1_000_000 })
    vi.spyOn(clock, 'now').mockReturnValue(500)
    vi.spyOn(clock, 'getState').mockReturnValue({ anchorSimTime: 500, anchorRealTime: 0, running: true, speed: 1 })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const scheduler = new UnsolicitedMailScheduler(db, config, clock, baseDir)
    await scheduler.tick()

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('generates once due and running, advances the next due time, and calls onGenerated', async () => {
    config.setSchedulerState({ nextDueSimTime: 100 })
    vi.spyOn(clock, 'now').mockReturnValue(200)
    vi.spyOn(clock, 'getState').mockReturnValue({ anchorSimTime: 200, anchorRealTime: 0, running: true, speed: 1 })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(subjectBodyResponse('Hi', 'Body'))
    const onGenerated = vi.fn()
    const onFailed = vi.fn()

    const scheduler = new UnsolicitedMailScheduler(db, config, clock, baseDir, onGenerated, onFailed)
    await scheduler.tick()

    expect(onGenerated).toHaveBeenCalledTimes(1)
    expect(onFailed).not.toHaveBeenCalled()
    expect(db.listMessages('inbox')).toHaveLength(1)
    const newState = config.getSchedulerState()
    // Reasonable interval (AC1): 1-3 simulated hours from now, per Implementation Notes.
    expect(newState.nextDueSimTime).toBeGreaterThanOrEqual(200 + 60 * 60 * 1000)
    expect(newState.nextDueSimTime).toBeLessThanOrEqual(200 + 3 * 60 * 60 * 1000)
  })

  it('calls onFailed and still advances the next due time (no retry storm) when generation fails', async () => {
    config.setSchedulerState({ nextDueSimTime: 100 })
    vi.spyOn(clock, 'now').mockReturnValue(200)
    vi.spyOn(clock, 'getState').mockReturnValue({ anchorSimTime: 200, anchorRealTime: 0, running: true, speed: 1 })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'))
    const onFailed = vi.fn()

    const scheduler = new UnsolicitedMailScheduler(db, config, clock, baseDir, undefined, onFailed)
    await scheduler.tick()

    expect(onFailed).toHaveBeenCalledWith('Network error: fetch failed')
    // 027 AC4: the scheduler's own tick() goes through attemptUnsolicitedMail,
    // so a failure is logged durably even though nothing in this test ever
    // showed or dismissed a UI banner.
    expect(config.getLlmFailureLog()).toEqual([
      { timestamp: expect.any(Number), source: 'unsolicitedMail', error: 'Network error: fetch failed' }
    ])
    const newState = config.getSchedulerState()
    expect(newState.nextDueSimTime).toBeGreaterThan(200)

    // A second tick immediately after should not retry, since due time was pushed forward.
    fetchSpy.mockClear()
    await scheduler.tick()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('initializes nextDueSimTime on first-ever run (sentinel 0) without generating immediately', async () => {
    expect(config.getSchedulerState()).toEqual({ nextDueSimTime: 0 })
    vi.spyOn(clock, 'now').mockReturnValue(1000)
    vi.spyOn(clock, 'getState').mockReturnValue({ anchorSimTime: 1000, anchorRealTime: 0, running: true, speed: 1 })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const scheduler = new UnsolicitedMailScheduler(db, config, clock, baseDir)
    await scheduler.tick()

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(config.getSchedulerState().nextDueSimTime).toBeGreaterThan(1000)
  })

  it('start() schedules real-time polling and stop() clears it', async () => {
    vi.useFakeTimers()
    try {
      config.setSchedulerState({ nextDueSimTime: 100 })
      const nowSpy = vi.spyOn(clock, 'now').mockReturnValue(200)
      vi.spyOn(clock, 'getState').mockReturnValue({ anchorSimTime: 200, anchorRealTime: 0, running: true, speed: 1 })
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(subjectBodyResponse('Hi', 'Body'))
      const onGenerated = vi.fn()

      const scheduler = new UnsolicitedMailScheduler(db, config, clock, baseDir, onGenerated)
      scheduler.start()
      await vi.advanceTimersByTimeAsync(10_000)
      expect(onGenerated).toHaveBeenCalledTimes(1)

      // Advance simulated time well past the new due time too, so — were the
      // real-time timer still running — the next poll would generate again.
      nowSpy.mockReturnValue(1_000_000_000)
      scheduler.stop()
      await vi.advanceTimersByTimeAsync(60_000)
      expect(onGenerated).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not run two ticks concurrently — a slow in-flight generation blocks an overlapping tick', async () => {
    config.setSchedulerState({ nextDueSimTime: 100 })
    vi.spyOn(clock, 'now').mockReturnValue(200)
    vi.spyOn(clock, 'getState').mockReturnValue({ anchorSimTime: 200, anchorRealTime: 0, running: true, speed: 1 })
    let resolveFetch: (value: Response) => void
    const slowFetch = new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockReturnValue(slowFetch)

    const scheduler = new UnsolicitedMailScheduler(db, config, clock, baseDir)
    const firstTick = scheduler.tick()
    const secondTick = scheduler.tick() // fired while the first is still in flight

    resolveFetch!(subjectBodyResponse('Hi', 'Body'))
    await Promise.all([firstTick, secondTick])

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(db.listMessages('inbox')).toHaveLength(1)
  })

  it('integrates with a real SimClock: fires while running, not while paused, across a pause/resume cycle', async () => {
    config.setSchedulerState({ nextDueSimTime: clock.now() - 1 }) // already due
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(subjectBodyResponse('Hi', 'Body'))
    const onGenerated = vi.fn()
    const scheduler = new UnsolicitedMailScheduler(db, config, clock, baseDir, onGenerated)

    // Real clock starts paused (013's default) — due but paused, so no-op.
    await scheduler.tick()
    expect(onGenerated).not.toHaveBeenCalled()
    expect(db.listMessages('inbox')).toEqual([])

    // Start the real clock: now due AND running, so it should fire.
    clock.start()
    await scheduler.tick()
    expect(onGenerated).toHaveBeenCalledTimes(1)
    expect(db.listMessages('inbox')).toHaveLength(1)

    // Pause again: the freshly-advanced due time is in the (simulated)
    // future, and even so, paused means no further attempts regardless.
    clock.pause()
    await scheduler.tick()
    expect(onGenerated).toHaveBeenCalledTimes(1)
  })
})

describe('attemptUnsolicitedMail (feature 027)', () => {
  let baseDir: string
  let db: MailDb
  let config: ConfigStore
  let clock: SimClock

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'outlook-sim-scheduler-'))
    db = new MailDb(baseDir)
    config = new ConfigStore(baseDir)
    clock = new SimClock(baseDir)
  })

  afterEach(() => {
    db.close()
    rmSync(baseDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('AC4: appends a failure-log entry on a real failure', async () => {
    config.setPersonas([PERSONA])
    config.setSettings({
      provider: 'openai',
      model: 'gpt-4o',
      apiKeys: { openai: 'sk-test', anthropic: '', gemini: '', xai: '' }
    })
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'))

    const result = await attemptUnsolicitedMail(db, config, clock, baseDir)

    expect(result).toEqual({ ok: false, error: 'Network error: fetch failed' })
    expect(config.getLlmFailureLog()).toEqual([
      { timestamp: expect.any(Number), source: 'unsolicitedMail', error: 'Network error: fetch failed' }
    ])
  })

  it('does not log anything on success', async () => {
    config.setPersonas([PERSONA])
    config.setSettings({
      provider: 'openai',
      model: 'gpt-4o',
      apiKeys: { openai: 'sk-test', anthropic: '', gemini: '', xai: '' }
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(subjectBodyResponse('Hi', 'Body'))

    const result = await attemptUnsolicitedMail(db, config, clock, baseDir)

    expect(result).toMatchObject({ ok: true, sent: true })
    expect(config.getLlmFailureLog()).toEqual([])
  })

  it('does not log anything for the no-personas-configured no-op (not a failure)', async () => {
    const result = await attemptUnsolicitedMail(db, config, clock, baseDir)

    expect(result).toEqual({ ok: true, sent: false })
    expect(config.getLlmFailureLog()).toEqual([])
  })
})
