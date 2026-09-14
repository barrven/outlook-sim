import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CalendarItem,
  ClockState,
  FiredReminder,
  Folder,
  LlmGenerateResult,
  MailMessage,
  ScenarioPack,
  Settings
} from '../../shared/data-types'

type Handler = (event: unknown, ...args: unknown[]) => unknown
const handlers = new Map<string, Handler>()
type FakeWindow = { webContents: { send: (channel: string, ...args: unknown[]) => void } }
const getAllWindowsMock = vi.fn<() => FakeWindow[]>(() => [])

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: Handler) => {
      handlers.set(channel, fn)
    }
  },
  BrowserWindow: {
    getAllWindows: () => getAllWindowsMock()
  }
}))

const { broadcastReminderFired, registerDataIpcHandlers } = await import('./ipc')
const { MailDb } = await import('./db')
const { ConfigStore } = await import('./config')
const { SimClock } = await import('./clock')

describe('registerDataIpcHandlers', () => {
  let baseDir: string
  let db: InstanceType<typeof MailDb>
  let config: InstanceType<typeof ConfigStore>
  let clock: InstanceType<typeof SimClock>
  const fakeEvent = {} as never

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'outlook-sim-ipc-'))
    db = new MailDb(baseDir)
    config = new ConfigStore(baseDir)
    clock = new SimClock(baseDir)
    handlers.clear()
    getAllWindowsMock.mockReset().mockReturnValue([])
    registerDataIpcHandlers(db, config, clock)
  })

  afterEach(() => {
    db.close()
    rmSync(baseDir, { recursive: true, force: true })
  })

  it('registers every documented db and config channel', () => {
    expect([...handlers.keys()].sort()).toEqual(
      [
        'db:folders:list',
        'db:folders:create',
        'db:folders:rename',
        'db:folders:delete',
        'db:messages:list',
        'db:messages:get',
        'db:messages:create',
        'db:messages:update',
        'db:messages:delete',
        'db:calendarItems:list',
        'db:calendarItems:get',
        'db:calendarItems:create',
        'db:calendarItems:update',
        'db:calendarItems:delete',
        'db:fileVineFolders:list',
        'db:fileVineFolders:get',
        'db:fileVineFolders:create',
        'db:fileVineFolders:update',
        'db:fileVineFolders:delete',
        'config:settings:get',
        'config:settings:set',
        'config:systemPrompt:get',
        'config:systemPrompt:set',
        'config:identity:get',
        'config:identity:set',
        'config:personas:get',
        'config:personas:set',
        'clock:get',
        'clock:now',
        'clock:start',
        'clock:pause',
        'clock:setSpeed',
        'llm:generate',
        'llm:test',
        'llm:personaReply',
        'session:startFreePlay',
        'scenario:applyPack'
      ].sort()
    )
  })

  it('lists the default folders through db:folders:list', () => {
    const result = handlers.get('db:folders:list')!(fakeEvent) as Folder[]
    expect(result.map((f) => f.id)).toEqual(['inbox', 'drafts', 'sent', 'deleted'])
  })

  it('creates and reads back a message through the IPC channels', () => {
    const created = handlers.get('db:messages:create')!(fakeEvent, {
      folderId: 'inbox',
      subject: 'Hi',
      body: 'there',
      fromName: 'A',
      fromEmail: 'a@x.com',
      toName: 'B',
      toEmail: 'b@x.com',
      timestamp: 1
    }) as MailMessage

    const fetched = handlers.get('db:messages:get')!(fakeEvent, created.id) as MailMessage
    expect(fetched.subject).toBe('Hi')

    handlers.get('db:messages:update')!(fakeEvent, created.id, { isRead: true })
    expect((handlers.get('db:messages:get')!(fakeEvent, created.id) as MailMessage).isRead).toBe(true)

    handlers.get('db:messages:delete')!(fakeEvent, created.id)
    expect(handlers.get('db:messages:get')!(fakeEvent, created.id)).toBeNull()
  })

  it('creates a calendar item through the IPC channels', () => {
    const created = handlers.get('db:calendarItems:create')!(fakeEvent, {
      title: 'Deadline',
      description: '',
      startTime: 100,
      endTime: null,
      allDay: false,
      reminderMinutesBefore: null,
      recurrenceRule: null,
      itemType: 'deadline'
    }) as CalendarItem

    expect((handlers.get('db:calendarItems:list')!(fakeEvent) as CalendarItem[]).map((i) => i.id)).toEqual([
      created.id
    ])
  })

  it('broadcasts a messages-changed event to every open window on create, update, and delete', () => {
    const fakeWindow: FakeWindow = { webContents: { send: vi.fn() } }
    getAllWindowsMock.mockReturnValue([fakeWindow])

    const created = handlers.get('db:messages:create')!(fakeEvent, {
      folderId: 'inbox',
      subject: 'Hi',
      body: 'there',
      fromName: 'A',
      fromEmail: 'a@x.com',
      toName: 'B',
      toEmail: 'b@x.com',
      timestamp: 1
    }) as MailMessage
    expect(fakeWindow.webContents.send).toHaveBeenCalledWith('data:messages-changed')

    vi.mocked(fakeWindow.webContents.send).mockClear()
    handlers.get('db:messages:update')!(fakeEvent, created.id, { isRead: true })
    expect(fakeWindow.webContents.send).toHaveBeenCalledWith('data:messages-changed')

    vi.mocked(fakeWindow.webContents.send).mockClear()
    handlers.get('db:messages:delete')!(fakeEvent, created.id)
    expect(fakeWindow.webContents.send).toHaveBeenCalledWith('data:messages-changed')
  })

  it('round-trips settings through the config channels', () => {
    handlers.get('config:settings:set')!(fakeEvent, {
      provider: 'anthropic',
      model: 'm',
      apiKeys: { openai: '', anthropic: 'k', gemini: '', xai: '' }
    })
    const settings = handlers.get('config:settings:get')!(fakeEvent) as Settings
    expect(settings.provider).toBe('anthropic')
    expect(settings.apiKeys.anthropic).toBe('k')
  })

  it('drives the simulated clock through the IPC channels', () => {
    const initial = handlers.get('clock:get')!(fakeEvent) as ClockState
    expect(initial.running).toBe(false)

    const started = handlers.get('clock:start')!(fakeEvent) as ClockState
    expect(started.running).toBe(true)

    const sped = handlers.get('clock:setSpeed')!(fakeEvent, 10) as ClockState
    expect(sped.speed).toBe(10)

    const now = handlers.get('clock:now')!(fakeEvent) as number
    expect(typeof now).toBe('number')

    const paused = handlers.get('clock:pause')!(fakeEvent) as ClockState
    expect(paused.running).toBe(false)
    expect(handlers.get('clock:get')!(fakeEvent)).toEqual(paused)
  })

  describe('llm channels', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('registering the IPC handlers makes no network call by itself', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      handlers.clear()
      registerDataIpcHandlers(db, config, clock)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('llm:generate reads provider/model/key from persisted settings, not the caller', async () => {
      config.setSettings({
        provider: 'openai',
        model: 'gpt-4o',
        apiKeys: { openai: 'sk-persisted', anthropic: '', gemini: '', xai: '' }
      })
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ choices: [{ message: { content: 'Hi back' } }] })
      } as Response)

      const result = (await handlers.get('llm:generate')!(fakeEvent, { userPrompt: 'Hi' })) as LlmGenerateResult

      expect(result).toEqual({ ok: true, text: 'Hi back' })
      expect((fetchSpy.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe('Bearer sk-persisted')
    })

    it('llm:test uses the explicit settings passed by the caller, ignoring persisted config', async () => {
      config.setSettings({
        provider: 'openai',
        model: 'gpt-4o',
        apiKeys: { openai: 'sk-persisted', anthropic: '', gemini: '', xai: '' }
      })
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ content: [{ type: 'text', text: 'pong' }] })
      } as Response)

      const unsavedSettings: Settings = {
        provider: 'anthropic',
        model: 'claude-x',
        apiKeys: { openai: '', anthropic: 'sk-unsaved', gemini: '', xai: '' }
      }
      const result = (await handlers.get('llm:test')!(fakeEvent, unsavedSettings)) as LlmGenerateResult

      expect(result).toEqual({ ok: true, text: 'pong' })
      expect(fetchSpy.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages')
      expect((fetchSpy.mock.calls[0][1]?.headers as Record<string, string>)['x-api-key']).toBe('sk-unsaved')
    })

    it('llm:generate resolves with an error result instead of rejecting on failure', async () => {
      config.setSettings({
        provider: 'openai',
        model: 'gpt-4o',
        apiKeys: { openai: 'sk-persisted', anthropic: '', gemini: '', xai: '' }
      })
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'))

      const result = (await handlers.get('llm:generate')!(fakeEvent, { userPrompt: 'Hi' })) as LlmGenerateResult

      expect(result).toEqual({ ok: false, error: 'Network error: fetch failed' })
    })

    describe('llm:personaReply', () => {
      it('broadcasts data:messages-changed when the persona replies', async () => {
        config.setPersonas([
          {
            id: 'p1',
            displayName: 'Morgan Rivera',
            email: 'morgan@example.com',
            role: 'Manager',
            bio: '',
            writingStyleNotes: '',
            extraPrompt: ''
          }
        ])
        config.setIdentity({ displayName: 'Jordan', jobTitle: '', fromEmail: 'jordan@example.com' })
        config.setSettings({
          provider: 'openai',
          model: 'gpt-4o',
          apiKeys: { openai: 'sk-test', anthropic: '', gemini: '', xai: '' }
        })
        const sent = db.createMessage({
          folderId: 'sent',
          subject: 'Hi',
          body: 'Hello',
          fromName: 'Jordan',
          fromEmail: 'jordan@example.com',
          toName: 'Morgan Rivera',
          toEmail: 'morgan@example.com',
          timestamp: 1
        })
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({ choices: [{ message: { content: 'Hi there!' } }] })
        } as Response)
        const fakeWindow: FakeWindow = { webContents: { send: vi.fn() } }
        getAllWindowsMock.mockReturnValue([fakeWindow])

        await handlers.get('llm:personaReply')!(fakeEvent, sent.id)

        expect(fakeWindow.webContents.send).toHaveBeenCalledWith('data:messages-changed')
        expect(db.listMessages('inbox')).toHaveLength(1)
      })

      it('broadcasts llm:persona-reply-failed with the error, and inserts nothing, on failure', async () => {
        config.setPersonas([
          {
            id: 'p1',
            displayName: 'Morgan Rivera',
            email: 'morgan@example.com',
            role: 'Manager',
            bio: '',
            writingStyleNotes: '',
            extraPrompt: ''
          }
        ])
        config.setIdentity({ displayName: 'Jordan', jobTitle: '', fromEmail: 'jordan@example.com' })
        config.setSettings({
          provider: 'openai',
          model: 'gpt-4o',
          apiKeys: { openai: 'sk-test', anthropic: '', gemini: '', xai: '' }
        })
        const sent = db.createMessage({
          folderId: 'sent',
          subject: 'Hi',
          body: 'Hello',
          fromName: 'Jordan',
          fromEmail: 'jordan@example.com',
          toName: 'Morgan Rivera',
          toEmail: 'morgan@example.com',
          timestamp: 1
        })
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'))
        const fakeWindow: FakeWindow = { webContents: { send: vi.fn() } }
        getAllWindowsMock.mockReturnValue([fakeWindow])

        await handlers.get('llm:personaReply')!(fakeEvent, sent.id)

        expect(fakeWindow.webContents.send).toHaveBeenCalledWith(
          'llm:persona-reply-failed',
          'Network error: fetch failed'
        )
        expect(fakeWindow.webContents.send).not.toHaveBeenCalledWith('data:messages-changed')
        expect(db.listMessages('inbox')).toEqual([])
      })

      it('does nothing (no broadcast, no message) when the recipient is not a persona', async () => {
        const sent = db.createMessage({
          folderId: 'sent',
          subject: 'Hi',
          body: 'Hello',
          fromName: 'Jordan',
          fromEmail: 'jordan@example.com',
          toName: 'Stranger',
          toEmail: 'stranger@example.com',
          timestamp: 1
        })
        const fetchSpy = vi.spyOn(globalThis, 'fetch')
        const fakeWindow: FakeWindow = { webContents: { send: vi.fn() } }
        getAllWindowsMock.mockReturnValue([fakeWindow])

        await handlers.get('llm:personaReply')!(fakeEvent, sent.id)

        expect(fetchSpy).not.toHaveBeenCalled()
        expect(fakeWindow.webContents.send).not.toHaveBeenCalled()
      })
    })
  })

  describe('session:startFreePlay', () => {
    it('resets an already-empty mailbox/calendar with no confirmation needed', () => {
      const result = handlers.get('session:startFreePlay')!(fakeEvent)
      expect(result).toEqual({ ok: true })
    })

    it('refuses to wipe a non-empty mailbox without confirmation, and leaves the data intact', () => {
      const message = db.createMessage({
        folderId: 'inbox',
        subject: 'Keep me',
        body: 'body',
        fromName: 'A',
        fromEmail: 'a@x.com',
        toName: 'B',
        toEmail: 'b@x.com',
        timestamp: 1
      })

      const result = handlers.get('session:startFreePlay')!(fakeEvent)

      expect(result).toEqual({ ok: false, needsConfirmation: true })
      expect(db.getMessage(message.id)).not.toBeNull()
    })

    it('refuses to wipe non-empty calendar data without confirmation, even with no messages', () => {
      db.createCalendarItem({
        title: 'Deadline',
        description: '',
        startTime: 100,
        endTime: null,
        allDay: false,
        reminderMinutesBefore: null,
        recurrenceRule: null,
        itemType: 'deadline'
      })

      const result = handlers.get('session:startFreePlay')!(fakeEvent)

      expect(result).toEqual({ ok: false, needsConfirmation: true })
      expect(db.listCalendarItems()).toHaveLength(1)
    })

    it('wipes mailbox and calendar data when called with confirmed:true, and broadcasts the change', () => {
      const message = db.createMessage({
        folderId: 'inbox',
        subject: 'Gone',
        body: 'body',
        fromName: 'A',
        fromEmail: 'a@x.com',
        toName: 'B',
        toEmail: 'b@x.com',
        timestamp: 1
      })
      const fakeWindow: FakeWindow = { webContents: { send: vi.fn() } }
      getAllWindowsMock.mockReturnValue([fakeWindow])

      const result = handlers.get('session:startFreePlay')!(fakeEvent, true)

      expect(result).toEqual({ ok: true })
      expect(db.getMessage(message.id)).toBeNull()
      expect(fakeWindow.webContents.send).toHaveBeenCalledWith('data:messages-changed')
    })

    it('does not broadcast when confirmation is still needed', () => {
      db.createMessage({
        folderId: 'inbox',
        subject: 'Keep me',
        body: 'body',
        fromName: 'A',
        fromEmail: 'a@x.com',
        toName: 'B',
        toEmail: 'b@x.com',
        timestamp: 1
      })
      const fakeWindow: FakeWindow = { webContents: { send: vi.fn() } }
      getAllWindowsMock.mockReturnValue([fakeWindow])

      handlers.get('session:startFreePlay')!(fakeEvent)

      expect(fakeWindow.webContents.send).not.toHaveBeenCalled()
    })
  })

  describe('scenario:applyPack', () => {
    const PACK: ScenarioPack = {
      name: 'Grillo Law Intake',
      description: '',
      personas: [
        {
          displayName: 'Morgan Rivera',
          email: 'morgan@example.com',
          role: 'Claims Adjuster',
          bio: '',
          writingStyleNotes: '',
          extraPrompt: ''
        }
      ],
      inbox: [
        {
          subject: 'Welcome to the file',
          body: 'body',
          fromName: 'Morgan Rivera',
          fromEmail: 'morgan@example.com',
          toName: 'Trainee',
          toEmail: 'trainee@example.com',
          offsetMinutes: -60
        }
      ],
      calendarItems: [
        {
          title: 'Discovery deadline',
          description: '',
          offsetMinutes: 1440,
          durationMinutes: null,
          allDay: false,
          reminderMinutesBefore: null,
          itemType: 'deadline'
        }
      ],
      timedMessages: []
    }

    it('applies an already-empty mailbox/calendar with no confirmation needed', () => {
      const result = handlers.get('scenario:applyPack')!(fakeEvent, PACK)

      expect(result).toEqual({ ok: true })
      expect(db.listMessages('inbox')).toHaveLength(1)
      expect(db.listCalendarItems()).toHaveLength(1)
      expect(config.getPersonas().map((p) => p.email)).toEqual(['morgan@example.com'])
    })

    it('refuses to overwrite a non-empty mailbox without confirmation, and leaves the data intact', () => {
      const message = db.createMessage({
        folderId: 'inbox',
        subject: 'Keep me',
        body: 'body',
        fromName: 'A',
        fromEmail: 'a@x.com',
        toName: 'B',
        toEmail: 'b@x.com',
        timestamp: 1
      })

      const result = handlers.get('scenario:applyPack')!(fakeEvent, PACK)

      expect(result).toEqual({ ok: false, needsConfirmation: true })
      expect(db.getMessage(message.id)).not.toBeNull()
      expect(db.listMessages('inbox')).toHaveLength(1)
    })

    it('applies regardless when called with confirmed:true, and broadcasts the change', () => {
      db.createMessage({
        folderId: 'inbox',
        subject: 'Old message',
        body: 'body',
        fromName: 'A',
        fromEmail: 'a@x.com',
        toName: 'B',
        toEmail: 'b@x.com',
        timestamp: 1
      })
      const fakeWindow: FakeWindow = { webContents: { send: vi.fn() } }
      getAllWindowsMock.mockReturnValue([fakeWindow])

      const result = handlers.get('scenario:applyPack')!(fakeEvent, PACK, true)

      expect(result).toEqual({ ok: true })
      const messages = db.listMessages('inbox')
      expect(messages.map((m) => m.subject)).toEqual(['Welcome to the file'])
      expect(fakeWindow.webContents.send).toHaveBeenCalledWith('data:messages-changed')
    })

    it('does not broadcast, and does not apply, when confirmation is still needed', () => {
      db.createMessage({
        folderId: 'inbox',
        subject: 'Keep me',
        body: 'body',
        fromName: 'A',
        fromEmail: 'a@x.com',
        toName: 'B',
        toEmail: 'b@x.com',
        timestamp: 1
      })
      const fakeWindow: FakeWindow = { webContents: { send: vi.fn() } }
      getAllWindowsMock.mockReturnValue([fakeWindow])

      handlers.get('scenario:applyPack')!(fakeEvent, PACK)

      expect(fakeWindow.webContents.send).not.toHaveBeenCalled()
      expect(config.getPersonas()).toEqual([])
    })
  })
})

describe('broadcastReminderFired', () => {
  it('sends the fired reminder to every open window on the calendar:reminder-fired channel', () => {
    const reminder: FiredReminder = {
      id: 'cal-1:5000',
      seriesId: 'cal-1',
      title: 'Filing deadline',
      startTime: 5000
    }
    const fakeWindow: FakeWindow = { webContents: { send: vi.fn() } }
    getAllWindowsMock.mockReset().mockReturnValue([fakeWindow])

    broadcastReminderFired(reminder)

    expect(fakeWindow.webContents.send).toHaveBeenCalledWith('calendar:reminder-fired', reminder)
  })

  it('sends to every open window, not just the first', () => {
    const reminder: FiredReminder = {
      id: 'cal-1:5000',
      seriesId: 'cal-1',
      title: 'Filing deadline',
      startTime: 5000
    }
    const windowA: FakeWindow = { webContents: { send: vi.fn() } }
    const windowB: FakeWindow = { webContents: { send: vi.fn() } }
    getAllWindowsMock.mockReset().mockReturnValue([windowA, windowB])

    broadcastReminderFired(reminder)

    expect(windowA.webContents.send).toHaveBeenCalledWith('calendar:reminder-fired', reminder)
    expect(windowB.webContents.send).toHaveBeenCalledWith('calendar:reminder-fired', reminder)
  })
})
