import http from 'http'
import https from 'https'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MailDb } from './db'
import { ConfigStore } from './config'

describe('local data layer makes no network calls', () => {
  let baseDir: string

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'outlook-sim-network-'))
  })

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('never touches http, https, or fetch while exercising every read/write API', () => {
    const httpSpy = vi.spyOn(http, 'request')
    const httpsSpy = vi.spyOn(https, 'request')
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const db = new MailDb(baseDir)
    const config = new ConfigStore(baseDir)

    const folder = db.createFolder({ id: 'projects', name: 'Projects', type: 'custom' })
    const message = db.createMessage({
      folderId: folder.id,
      subject: 'Test',
      body: 'Body',
      fromName: 'A',
      fromEmail: 'a@x.com',
      toName: 'B',
      toEmail: 'b@x.com',
      timestamp: 1
    })
    db.updateMessage(message.id, { isRead: true })
    db.listMessages(folder.id)
    db.deleteMessage(message.id)

    const item = db.createCalendarItem({
      title: 'Event',
      description: '',
      startTime: 1,
      endTime: null,
      allDay: false,
      reminderMinutesBefore: null,
      recurrenceRule: null,
      itemType: 'event'
    })
    db.updateCalendarItem(item.id, { title: 'Renamed' })
    db.listCalendarItems()
    db.deleteCalendarItem(item.id)

    config.setSettings({ provider: 'openai', model: 'x', apiKeys: { openai: 'k', anthropic: '', gemini: '', xai: '' } })
    config.setSystemPrompt({ systemPrompt: 'hello' })
    config.setIdentity({ displayName: 'Trainee', jobTitle: 'Analyst', fromEmail: 't@x.com' })
    config.setPersonas([])
    config.getSettings()
    config.getSystemPrompt()
    config.getIdentity()
    config.getPersonas()

    db.close()

    expect(httpSpy).not.toHaveBeenCalled()
    expect(httpsSpy).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
