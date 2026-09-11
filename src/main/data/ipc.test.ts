import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CalendarItem, ClockState, Folder, LlmGenerateResult, MailMessage, Settings } from '../../shared/data-types'

type Handler = (event: unknown, ...args: unknown[]) => unknown
const handlers = new Map<string, Handler>()
type FakeWindow = { webContents: { send: (channel: string) => void } }
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

const { registerDataIpcHandlers } = await import('./ipc')
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
        'llm:test'
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
  })
})
