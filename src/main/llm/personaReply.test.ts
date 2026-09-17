import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MailMessage, Persona, Settings } from '../../shared/data-types'
import { ConfigStore } from '../data/config'
import { MailDb } from '../data/db'
import { SimClock } from '../data/clock'
import { findThread, generatePersonaReply } from './personaReply'
import { quoteBody } from '../../shared/quoteBody'

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

const SETTINGS: Settings = {
  provider: 'openai',
  model: 'gpt-4o',
  apiKeys: { openai: 'sk-test', anthropic: '', gemini: '', xai: '' }
}

function chatResponse(text: string): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({ choices: [{ message: { content: text } }] })
  } as Response
}

describe('generatePersonaReply', () => {
  let baseDir: string
  let db: MailDb
  let config: ConfigStore
  let clock: SimClock

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'outlook-sim-persona-reply-'))
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
    config.setSettings(SETTINGS)
  })

  afterEach(() => {
    db.close()
    rmSync(baseDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  function sendMessage(overrides: Partial<MailMessage> = {}): MailMessage {
    return db.createMessage({
      folderId: 'sent',
      subject: 'Lunch plans',
      body: 'Want to grab lunch?',
      fromName: 'Jordan Trainee',
      fromEmail: 'jordan@example.com',
      toName: 'Morgan Rivera',
      toEmail: 'morgan@example.com',
      timestamp: 1000,
      ...overrides
    })
  }

  it('does nothing when the recipient is not a configured persona', async () => {
    const message = sendMessage({ toEmail: 'stranger@example.com', toName: 'Stranger' })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const result = await generatePersonaReply(db, config, clock, message.id, baseDir)

    expect(result).toEqual({ ok: true, replied: false })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(db.listMessages('inbox')).toEqual([])
  })

  it('returns an error, without throwing, when the message id does not exist', async () => {
    const result = await generatePersonaReply(db, config, clock, 'does-not-exist', baseDir)
    expect(result).toEqual({ ok: false, error: 'Sent message not found.' })
  })

  it('AC4: guards against a missing prior message — no crash, no malformed quote, no message inserted', async () => {
    // There is no real "reply with nothing to quote" case (a reply always
    // has the sentMessage that triggered it), so the guard is the early
    // not-found return above: it's exercised the same way, and asserted
    // again here under the AC's own name for traceability.
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const result = await generatePersonaReply(db, config, clock, 'does-not-exist', baseDir)

    expect(result).toEqual({ ok: false, error: 'Sent message not found.' })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(db.listMessages('inbox')).toEqual([])
  })

  it('inserts the generated reply into Inbox from the persona, addressed to the trainee, with simulated time', async () => {
    const message = sendMessage()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(chatResponse('Sure, noon works!'))
    const nowSpy = vi.spyOn(clock, 'now').mockReturnValue(5000)

    const result = await generatePersonaReply(db, config, clock, message.id, baseDir)

    expect(result.ok).toBe(true)
    expect(result).toMatchObject({ ok: true, replied: true })
    if (result.ok && result.replied) {
      expect(result.message).toMatchObject({
        folderId: 'inbox',
        subject: 'Lunch plans',
        fromName: 'Morgan Rivera',
        fromEmail: 'morgan@example.com',
        toName: 'Jordan Trainee',
        toEmail: 'jordan@example.com',
        timestamp: 5000,
        isRead: false
      })
      expect(result.message.body).toContain('Sure, noon works!')
      // AC1/AC2: the immediately-preceding message (the one that triggered
      // this reply) is quoted using the same "On <date>, Name <email>
      // wrote:" + "> "-per-line convention as the trainee's own
      // Reply/Reply All/Forward (feature 005, composeIntent.ts's quoteBody).
      expect(result.message.body).toContain('Jordan Trainee <jordan@example.com> wrote:')
      expect(result.message.body).toContain('> Want to grab lunch?')
    }
    expect(db.listMessages('inbox')).toHaveLength(1)
    nowSpy.mockRestore()
  })

  it('quotes the sent message using the exact same shared quoteBody() format the trainee\'s own replies use', async () => {
    const message = sendMessage({ body: 'Line one\nLine two' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(chatResponse('Sure, noon works!'))

    const result = await generatePersonaReply(db, config, clock, message.id, baseDir)

    expect(result).toMatchObject({ ok: true, replied: true })
    if (result.ok && result.replied) {
      const expectedQuote = quoteBody(message)
      expect(result.message.body).toBe(`Sure, noon works!${expectedQuote}`)
    }
  })

  it('sends the system prompt, persona details, and thread history to the LLM', async () => {
    // Prior turns in the same thread (subject normalizes the same across Re:).
    db.createMessage({
      folderId: 'inbox',
      subject: 'Lunch plans',
      body: 'Are you free this week?',
      fromName: 'Morgan Rivera',
      fromEmail: 'morgan@example.com',
      toName: 'Jordan Trainee',
      toEmail: 'jordan@example.com',
      timestamp: 500
    })
    config.setSystemPrompt({ systemPrompt: 'Domain: insurance office.' })
    const message = sendMessage({ subject: 'Re: Lunch plans', timestamp: 1000 })

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(chatResponse('Sure, noon works!'))

    await generatePersonaReply(db, config, clock, message.id, baseDir)

    const [, init] = fetchSpy.mock.calls[0]
    const body = JSON.parse(init?.body as string)
    const systemMessage = body.messages.find((m: { role: string }) => m.role === 'system').content
    const userMessage = body.messages.find((m: { role: string }) => m.role === 'user').content

    expect(systemMessage).toContain('Domain: insurance office.')
    expect(systemMessage).toContain('Morgan Rivera')
    expect(systemMessage).toContain('Office Manager')
    expect(systemMessage).toContain('Runs the front office.')
    expect(systemMessage).toContain('Warm but brief.')
    expect(systemMessage).toContain('NO_REPLY')

    expect(userMessage).toContain('Are you free this week?')
    expect(userMessage).toContain('Want to grab lunch?')
    // Chronological order: the earlier message appears before the later one.
    expect(userMessage.indexOf('Are you free this week?')).toBeLessThan(userMessage.indexOf('Want to grab lunch?'))
  })

  it('tells the LLM about a mock attachment by filename, so the persona does not deny seeing one', async () => {
    const message = sendMessage({ attachments: [{ filename: 'report.pdf' }, { filename: 'photo.jpg' }] })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(chatResponse('Thanks, got it!'))

    await generatePersonaReply(db, config, clock, message.id, baseDir)

    const [, init] = fetchSpy.mock.calls[0]
    const body = JSON.parse(init?.body as string)
    const userMessage = body.messages.find((m: { role: string }) => m.role === 'user').content
    expect(userMessage).toContain('Attachments: report.pdf, photo.jpg')
  })

  it('063 AC2: includes an attachment\'s extracted content in the prompt, alongside the filename line', async () => {
    const message = sendMessage({
      attachments: [
        { filename: 'report.pdf', path: '/tmp/report.pdf', extractedText: 'Q3 revenue grew 12% year over year.' },
        { filename: 'photo.jpg', path: '/tmp/photo.jpg' }
      ]
    })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(chatResponse('Thanks, got it!'))

    await generatePersonaReply(db, config, clock, message.id, baseDir)

    const [, init] = fetchSpy.mock.calls[0]
    const body = JSON.parse(init?.body as string)
    const userMessage = body.messages.find((m: { role: string }) => m.role === 'user').content
    expect(userMessage).toContain('Attachments: report.pdf, photo.jpg')
    expect(userMessage).toContain('--- Content of report.pdf ---')
    expect(userMessage).toContain('Q3 revenue grew 12% year over year.')
    // The second attachment has no extractedText (e.g. unsupported type, or
    // extraction failed/never ran) — no content block for it, just the
    // filename line above.
    expect(userMessage).not.toContain('--- Content of photo.jpg ---')
  })

  it('063 AC4: omits the content block entirely when no attachment has extracted text', async () => {
    const message = sendMessage({ attachments: [{ filename: 'report.pdf', path: '/tmp/report.pdf' }] })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(chatResponse('Thanks, got it!'))

    await generatePersonaReply(db, config, clock, message.id, baseDir)

    const [, init] = fetchSpy.mock.calls[0]
    const body = JSON.parse(init?.body as string)
    const userMessage = body.messages.find((m: { role: string }) => m.role === 'user').content
    expect(userMessage).toContain('Attachments: report.pdf')
    expect(userMessage).not.toContain('--- Content of')
  })

  it('065 AC1/AC2: a reply that includes an attachment block produces a real generated attachment', async () => {
    const message = sendMessage()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      chatResponse(
        'Sure, attached is the breakdown.\n---ATTACHMENT: breakdown.html---\n# Breakdown\n\nMedical: $12,000\n---END ATTACHMENT---'
      )
    )

    const result = await generatePersonaReply(db, config, clock, message.id, baseDir)

    expect(result.ok).toBe(true)
    if (result.ok && result.replied) {
      expect(result.message.body.startsWith('Sure, attached is the breakdown.')).toBe(true)
      expect(result.message.body).not.toContain('---ATTACHMENT')
      expect(result.message.attachments).toHaveLength(1)
      const attachment = result.message.attachments[0]
      expect(attachment.filename).toBe('breakdown.html')
      expect(existsSync(attachment.path!)).toBe(true)
      expect(readFileSync(attachment.path!, 'utf-8')).toContain('Medical: $12,000')
    } else {
      expect.fail('expected a reply to be sent')
    }
  })

  it('065 AC5: a reply with no attachment block still sends normally, with an empty attachments array', async () => {
    const message = sendMessage()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(chatResponse('Sure, noon works!'))

    const result = await generatePersonaReply(db, config, clock, message.id, baseDir)

    expect(result.ok).toBe(true)
    if (result.ok && result.replied) {
      expect(result.message.attachments).toEqual([])
      expect(result.message.body.startsWith('Sure, noon works!')).toBe(true)
    } else {
      expect.fail('expected a reply to be sent')
    }
  })

  it('065: an attachment block alongside a NO_REPLY response is discarded, no file written, no message created', async () => {
    const message = sendMessage()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      chatResponse('NO_REPLY\n---ATTACHMENT: report.html---\n# Report\n---END ATTACHMENT---')
    )

    const result = await generatePersonaReply(db, config, clock, message.id, baseDir)

    expect(result).toEqual({ ok: true, replied: false })
    expect(db.listMessages('inbox')).toEqual([])
  })

  it('omits the Attachments line entirely for a message with none', async () => {
    const message = sendMessage() // attachments: [] by default
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(chatResponse('Sure, noon works!'))

    await generatePersonaReply(db, config, clock, message.id, baseDir)

    const [, init] = fetchSpy.mock.calls[0]
    const body = JSON.parse(init?.body as string)
    const userMessage = body.messages.find((m: { role: string }) => m.role === 'user').content
    expect(userMessage).not.toContain('Attachments:')
  })

  it('excludes unrelated threads (different subject) from the prompt sent to the LLM', async () => {
    db.createMessage({
      folderId: 'sent',
      subject: 'Totally unrelated topic',
      body: 'This should never be seen by the model for the lunch thread.',
      fromName: 'Jordan Trainee',
      fromEmail: 'jordan@example.com',
      toName: 'Morgan Rivera',
      toEmail: 'morgan@example.com',
      timestamp: 500
    })
    const message = sendMessage()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(chatResponse('Sure, noon works!'))

    await generatePersonaReply(db, config, clock, message.id, baseDir)

    const [, init] = fetchSpy.mock.calls[0]
    const body = JSON.parse(init?.body as string)
    const userMessage = body.messages.find((m: { role: string }) => m.role === 'user').content
    expect(userMessage).not.toContain('Totally unrelated topic')
    expect(userMessage).not.toContain('never be seen')
  })

  it('matches the correct persona among several configured, and stamps the reply from that persona only', async () => {
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
    const message = sendMessage({ toEmail: 'alex@example.com', toName: 'Alex Chen' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(chatResponse('Sounds good.'))

    const result = await generatePersonaReply(db, config, clock, message.id, baseDir)

    expect(result).toMatchObject({ ok: true, replied: true })
    if (result.ok && result.replied) {
      expect(result.message.fromEmail).toBe('alex@example.com')
      expect(result.message.fromName).toBe('Alex Chen')
    }
  })

  it('matches the persona case-insensitively by email', async () => {
    config.setPersonas([{ ...PERSONA, email: 'Morgan@Example.com' }])
    const message = sendMessage({ toEmail: 'morgan@example.com' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(chatResponse('Sure, noon works!'))

    const result = await generatePersonaReply(db, config, clock, message.id, baseDir)

    expect(result).toMatchObject({ ok: true, replied: true })
  })

  it('stamps the reply with simulated time, independent of wall-clock time', async () => {
    const message = sendMessage()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(chatResponse('Sure, noon works!'))
    vi.spyOn(clock, 'now').mockReturnValue(new Date('2027-06-01T00:00:00').getTime())
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-01-01T00:00:00').getTime())

    const result = await generatePersonaReply(db, config, clock, message.id, baseDir)

    expect(result).toMatchObject({ ok: true, replied: true })
    if (result.ok && result.replied) {
      expect(result.message.timestamp).toBe(new Date('2027-06-01T00:00:00').getTime())
    }
    dateNowSpy.mockRestore()
  })

  it('only replies as the primary To persona, not as a persona who was only Cc’d', async () => {
    const ccPersona: Persona = {
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
    config.setPersonas([PERSONA, ccPersona])
    const message = sendMessage({ cc: [{ name: 'Alex Chen', email: 'alex@example.com' }] })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(chatResponse('Sure, noon works!'))

    const result = await generatePersonaReply(db, config, clock, message.id, baseDir)

    expect(result).toMatchObject({ ok: true, replied: true })
    const inboxMessages = db.listMessages('inbox')
    expect(inboxMessages).toHaveLength(1)
    expect(inboxMessages[0].fromEmail).toBe('morgan@example.com')
  })

  it('does not reply, and inserts nothing, when the model responds with the NO_REPLY marker', async () => {
    const message = sendMessage()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(chatResponse('NO_REPLY'))

    const result = await generatePersonaReply(db, config, clock, message.id, baseDir)

    expect(result).toEqual({ ok: true, replied: false })
    expect(db.listMessages('inbox')).toEqual([])
  })

  it('tolerates surrounding whitespace around the NO_REPLY marker', async () => {
    const message = sendMessage()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(chatResponse('  NO_REPLY  \n'))

    const result = await generatePersonaReply(db, config, clock, message.id, baseDir)

    expect(result).toEqual({ ok: true, replied: false })
  })

  it('degrades gracefully — no crash, no message inserted, clear error — when the LLM call fails', async () => {
    const message = sendMessage()
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'))

    const result = await generatePersonaReply(db, config, clock, message.id, baseDir)

    expect(result).toEqual({ ok: false, error: 'Network error: fetch failed' })
    expect(db.listMessages('inbox')).toEqual([])
  })

  it('degrades gracefully when the provider returns a real error response (e.g. bad key)', async () => {
    const message = sendMessage()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({ error: { message: 'Incorrect API key provided.' } })
    } as Response)

    const result = await generatePersonaReply(db, config, clock, message.id, baseDir)

    expect(result).toEqual({ ok: false, error: 'openai API error (401): Incorrect API key provided.' })
    expect(db.listMessages('inbox')).toEqual([])
  })

  describe('049: FileVine content in the prompt', () => {
    it('AC1: includes the associated FileVine folder\'s notes (name + content) in the system prompt', async () => {
      const folder = db.createFileVineFolder({ name: 'Rivera Estate', parentId: null, clientPersonaId: PERSONA.id })
      db.createFileVineNote({
        folderId: folder.id,
        name: 'Deadline note',
        content: 'The probate filing is due 2026-06-01.'
      })
      const message = sendMessage()
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(chatResponse('Sure, noon works!'))

      await generatePersonaReply(db, config, clock, message.id, baseDir)

      const [, init] = fetchSpy.mock.calls[0]
      const body = JSON.parse(init?.body as string)
      const systemMessage = body.messages.find((m: { role: string }) => m.role === 'system').content
      expect(systemMessage).toContain('Rivera Estate')
      expect(systemMessage).toContain('Deadline note')
      expect(systemMessage).toContain('The probate filing is due 2026-06-01.')
    })

    it('AC2: a persona with no associated FileVine folder generates exactly as before (no FileVine section)', async () => {
      // An unrelated folder exists, but is not associated with this persona.
      db.createFileVineFolder({ name: 'Unrelated Matter', parentId: null, clientPersonaId: null })
      const message = sendMessage()
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(chatResponse('Sure, noon works!'))

      await generatePersonaReply(db, config, clock, message.id, baseDir)

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
      const message = sendMessage()
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(chatResponse('Sure, noon works!'))

      await generatePersonaReply(db, config, clock, message.id, baseDir)

      const [, init] = fetchSpy.mock.calls[0]
      const body = JSON.parse(init?.body as string)
      const systemMessage = body.messages.find((m: { role: string }) => m.role === 'system').content
      expect(systemMessage).toContain('Due 2026-05-15 (moved).')
      expect(systemMessage).not.toContain('Due 2026-04-01.')
    })

    it('includes a folder with no notes yet as an explicit "no notes/files yet" line, not silently omitted', async () => {
      db.createFileVineFolder({ name: 'Empty Matter', parentId: null, clientPersonaId: PERSONA.id })
      const message = sendMessage()
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(chatResponse('Sure, noon works!'))

      await generatePersonaReply(db, config, clock, message.id, baseDir)

      const [, init] = fetchSpy.mock.calls[0]
      const body = JSON.parse(init?.body as string)
      const systemMessage = body.messages.find((m: { role: string }) => m.role === 'system').content
      expect(systemMessage).toContain('Empty Matter')
      expect(systemMessage).toContain('no notes/files yet')
    })
  })
})

describe('findThread', () => {
  const PERSONA_EMAIL = 'morgan@example.com'
  const TRAINEE_EMAIL = 'jordan@example.com'

  function msg(overrides: Partial<MailMessage>): MailMessage {
    return {
      id: 'x',
      folderId: 'inbox',
      previousFolderId: null,
      subject: 'Lunch plans',
      body: '',
      fromName: '',
      fromEmail: TRAINEE_EMAIL,
      toName: '',
      toEmail: PERSONA_EMAIL,
      cc: [],
      timestamp: 0,
      isRead: false,
      isFlagged: false,
      categories: [],
      attachments: [],
      ...overrides
    }
  }

  it('matches messages regardless of Re:/Fwd: prefixing and repeated prefixes', () => {
    const a = msg({ id: 'a', subject: 'Lunch plans', timestamp: 1 })
    const b = msg({ id: 'b', subject: 'Re: Lunch plans', timestamp: 2 })
    const c = msg({ id: 'c', subject: 'Re: Re: Fwd: Lunch plans', timestamp: 3 })

    const thread = findThread([c, a, b], PERSONA_EMAIL, TRAINEE_EMAIL, 'Re: Lunch Plans')
    expect(thread.map((m) => m.id)).toEqual(['a', 'b', 'c'])
  })

  it('excludes messages with a different subject or uninvolved participants', () => {
    const relevant = msg({ id: 'relevant', timestamp: 1 })
    const differentSubject = msg({ id: 'different-subject', subject: 'Something else', timestamp: 2 })
    const differentParticipant = msg({
      id: 'different-participant',
      fromEmail: 'someone-else@example.com',
      toEmail: 'another@example.com',
      timestamp: 3
    })

    const thread = findThread(
      [relevant, differentSubject, differentParticipant],
      PERSONA_EMAIL,
      TRAINEE_EMAIL,
      'Lunch plans'
    )
    expect(thread.map((m) => m.id)).toEqual(['relevant'])
  })

  it('sorts chronologically regardless of input order', () => {
    const later = msg({ id: 'later', timestamp: 200 })
    const earlier = msg({ id: 'earlier', timestamp: 100 })

    const thread = findThread([later, earlier], PERSONA_EMAIL, TRAINEE_EMAIL, 'Lunch plans')
    expect(thread.map((m) => m.id)).toEqual(['earlier', 'later'])
  })
})
