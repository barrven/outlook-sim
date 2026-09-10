import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MailDb } from './db'

describe('MailDb', () => {
  let baseDir: string
  let db: MailDb

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'outlook-sim-db-'))
    db = new MailDb(baseDir)
  })

  afterEach(() => {
    db.close()
    rmSync(baseDir, { recursive: true, force: true })
  })

  it('creates the default folders on first run', () => {
    const folders = db.listFolders()
    expect(folders.map((f) => f.id)).toEqual(['inbox', 'drafts', 'sent', 'deleted'])
    expect(folders.every((f) => f.type === 'system')).toBe(true)
  })

  it('does not duplicate default folders when reopened', () => {
    db.close()
    db = new MailDb(baseDir)
    expect(db.listFolders()).toHaveLength(4)
  })

  it('supports creating, renaming, and deleting custom folders', () => {
    const custom = db.createFolder({ id: 'projects', name: 'Projects', type: 'custom' })
    expect(custom.sortOrder).toBe(0)
    expect(db.listFolders().map((f) => f.id)).toContain('projects')

    db.renameFolder('projects', 'Client Projects')
    expect(db.listFolders().find((f) => f.id === 'projects')?.name).toBe('Client Projects')

    db.deleteFolder('projects')
    expect(db.listFolders().map((f) => f.id)).not.toContain('projects')
  })

  it('creates a message with read/flag state defaulted, and lists it by folder', () => {
    const message = db.createMessage({
      folderId: 'inbox',
      subject: 'Welcome',
      body: 'Hello there',
      fromName: 'Carol',
      fromEmail: 'carol@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      timestamp: 1000
    })

    expect(message.isRead).toBe(false)
    expect(message.isFlagged).toBe(false)
    expect(message.categories).toEqual([])
    expect(message.attachments).toEqual([])

    expect(db.listMessages('inbox').map((m) => m.id)).toEqual([message.id])
    expect(db.listMessages('drafts')).toEqual([])
  })

  it('updates a message read state, flag, and categories', () => {
    const message = db.createMessage({
      folderId: 'inbox',
      subject: 'Update me',
      body: 'body',
      fromName: 'Carol',
      fromEmail: 'carol@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      timestamp: 1000
    })

    const updated = db.updateMessage(message.id, {
      isRead: true,
      isFlagged: true,
      categories: ['Urgent']
    })

    expect(updated?.isRead).toBe(true)
    expect(updated?.isFlagged).toBe(true)
    expect(updated?.categories).toEqual(['Urgent'])
    expect(db.getMessage(message.id)).toEqual(updated)
  })

  it('returns null when getting or updating a message that does not exist', () => {
    expect(db.getMessage('missing')).toBeNull()
    expect(db.updateMessage('missing', { isRead: true })).toBeNull()
  })

  it('deletes a message', () => {
    const message = db.createMessage({
      folderId: 'inbox',
      subject: 'Bye',
      body: 'body',
      fromName: 'Carol',
      fromEmail: 'carol@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      timestamp: 1000
    })
    db.deleteMessage(message.id)
    expect(db.getMessage(message.id)).toBeNull()
  })

  it('creates, updates, and deletes calendar items', () => {
    const item = db.createCalendarItem({
      title: 'Filing deadline',
      description: 'Submit the brief',
      startTime: 5000,
      endTime: null,
      allDay: false,
      reminderMinutesBefore: 15,
      recurrenceRule: null,
      itemType: 'deadline'
    })

    expect(db.listCalendarItems().map((i) => i.id)).toEqual([item.id])

    const updated = db.updateCalendarItem(item.id, { title: 'Filing deadline (extended)', allDay: true })
    expect(updated?.title).toBe('Filing deadline (extended)')
    expect(updated?.allDay).toBe(true)

    db.deleteCalendarItem(item.id)
    expect(db.getCalendarItem(item.id)).toBeNull()
  })

  it('persists folders, messages, and calendar items across a close/reopen cycle', () => {
    const message = db.createMessage({
      folderId: 'inbox',
      subject: 'Persisted',
      body: 'still here',
      fromName: 'Carol',
      fromEmail: 'carol@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      timestamp: 2000
    })
    const item = db.createCalendarItem({
      title: 'Recurring standup',
      description: '',
      startTime: 3000,
      endTime: 3600,
      allDay: false,
      reminderMinutesBefore: null,
      recurrenceRule: 'FREQ=DAILY',
      itemType: 'event'
    })
    db.createFolder({ id: 'projects', name: 'Projects', type: 'custom' })
    db.close()

    const reopened = new MailDb(baseDir)
    expect(reopened.getMessage(message.id)).toEqual(message)
    expect(reopened.getCalendarItem(item.id)).toEqual(item)
    expect(reopened.listFolders().map((f) => f.id)).toContain('projects')
    reopened.close()
    // reassign so the outer afterEach's db.close() doesn't double-close
    db = new MailDb(baseDir)
  })
})
