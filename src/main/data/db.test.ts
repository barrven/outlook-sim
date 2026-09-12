import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { DatabaseSync } from 'node:sqlite'
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

  it('persists read state, flags, and categories across a close/reopen cycle', () => {
    const message = db.createMessage({
      folderId: 'inbox',
      subject: 'Survives a restart',
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
      categories: ['Urgent', 'Client']
    })
    db.close()

    const reopened = new MailDb(baseDir)
    expect(reopened.getMessage(message.id)).toEqual(updated)
    reopened.close()
    // reassign so the outer afterEach's db.close() doesn't double-close
    db = new MailDb(baseDir)
  })

  it('persists mock attachments (filename only) across a close/reopen cycle', () => {
    const message = db.createMessage({
      folderId: 'inbox',
      subject: 'Has attachments',
      body: 'body',
      fromName: 'Carol',
      fromEmail: 'carol@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      timestamp: 1000,
      attachments: [{ filename: 'report.pdf' }, { filename: 'photo.jpg' }]
    })
    expect(message.attachments).toEqual([{ filename: 'report.pdf' }, { filename: 'photo.jpg' }])
    db.close()

    const reopened = new MailDb(baseDir)
    expect(reopened.getMessage(message.id)?.attachments).toEqual([
      { filename: 'report.pdf' },
      { filename: 'photo.jpg' }
    ])
    reopened.close()
    // reassign so the outer afterEach's db.close() doesn't double-close
    db = new MailDb(baseDir)
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

  it('defaults a new message to no previous folder', () => {
    const message = db.createMessage({
      folderId: 'inbox',
      subject: 'Fresh',
      body: 'body',
      fromName: 'Carol',
      fromEmail: 'carol@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      timestamp: 1000
    })
    expect(message.previousFolderId).toBeNull()
  })

  it('moves a message to Deleted Items tracking its previous folder, then restores it back', () => {
    const message = db.createMessage({
      folderId: 'sent',
      subject: 'Oops',
      body: 'body',
      fromName: 'Carol',
      fromEmail: 'carol@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      timestamp: 1000
    })

    const deleted = db.updateMessage(message.id, { folderId: 'deleted', previousFolderId: 'sent' })
    expect(deleted?.folderId).toBe('deleted')
    expect(deleted?.previousFolderId).toBe('sent')
    expect(db.listMessages('sent')).toEqual([])
    expect(db.listMessages('deleted').map((m) => m.id)).toEqual([message.id])

    const restored = db.updateMessage(message.id, { folderId: 'sent', previousFolderId: null })
    expect(restored?.folderId).toBe('sent')
    expect(restored?.previousFolderId).toBeNull()
    expect(db.listMessages('deleted')).toEqual([])
    expect(db.listMessages('sent').map((m) => m.id)).toEqual([message.id])
  })

  it('permanently deletes a message once it is in Deleted Items', () => {
    const message = db.createMessage({
      folderId: 'inbox',
      subject: 'Gone for good',
      body: 'body',
      fromName: 'Carol',
      fromEmail: 'carol@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      timestamp: 1000
    })
    db.updateMessage(message.id, { folderId: 'deleted', previousFolderId: 'inbox' })

    db.deleteMessage(message.id)

    expect(db.getMessage(message.id)).toBeNull()
    expect(db.listMessages('deleted')).toEqual([])
  })

  it('persists a moved-to-Deleted-Items message across a close/reopen cycle', () => {
    const message = db.createMessage({
      folderId: 'inbox',
      subject: 'Still deleted after restart',
      body: 'body',
      fromName: 'Carol',
      fromEmail: 'carol@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      timestamp: 1000
    })
    const deleted = db.updateMessage(message.id, { folderId: 'deleted', previousFolderId: 'inbox' })
    db.close()

    const reopened = new MailDb(baseDir)
    expect(reopened.getMessage(message.id)).toEqual(deleted)
    expect(reopened.listMessages('deleted').map((m) => m.id)).toEqual([message.id])
    reopened.close()
    // reassign so the outer afterEach's db.close() doesn't double-close
    db = new MailDb(baseDir)
  })

  it('adds the previous_folder_id column when opening a database created before delete/restore support existed', () => {
    db.close()
    const raw = new DatabaseSync(join(baseDir, 'outlook-sim.db'))
    raw.exec('DROP TABLE messages')
    raw.exec(`CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      folder_id TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      from_name TEXT NOT NULL DEFAULT '',
      from_email TEXT NOT NULL DEFAULT '',
      to_name TEXT NOT NULL DEFAULT '',
      to_email TEXT NOT NULL DEFAULT '',
      cc TEXT NOT NULL DEFAULT '[]',
      timestamp INTEGER NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      is_flagged INTEGER NOT NULL DEFAULT 0,
      categories TEXT NOT NULL DEFAULT '[]',
      attachments TEXT NOT NULL DEFAULT '[]'
    )`)
    raw.exec(
      `INSERT INTO messages (id, folder_id, subject, body, from_name, from_email, to_name, to_email, cc, timestamp, is_read, is_flagged, categories, attachments)
       VALUES ('legacy-1', 'inbox', 'Old message', 'body', 'Carol', 'carol@example.com', 'Trainee', 'trainee@example.com', '[]', 500, 0, 0, '[]', '[]')`
    )
    raw.close()

    const migrated = new MailDb(baseDir)
    expect(migrated.getMessage('legacy-1')?.previousFolderId).toBeNull()

    const moved = migrated.updateMessage('legacy-1', { folderId: 'deleted', previousFolderId: 'inbox' })
    expect(moved?.folderId).toBe('deleted')
    expect(moved?.previousFolderId).toBe('inbox')

    migrated.close()
    // reassign so the outer afterEach's db.close() doesn't double-close
    db = new MailDb(baseDir)
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

  it('defaults a new message to an empty Cc list, and round-trips Cc recipients through create/update', () => {
    const created = db.createMessage({
      folderId: 'inbox',
      subject: 'No cc yet',
      body: 'body',
      fromName: 'Carol',
      fromEmail: 'carol@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      timestamp: 1000
    })
    expect(created.cc).toEqual([])

    const withCc = db.updateMessage(created.id, {
      cc: [
        { name: 'Sam Lee', email: 'sam@example.com' },
        { name: 'Morgan Rivera', email: 'morgan@example.com' }
      ]
    })
    expect(withCc?.cc).toEqual([
      { name: 'Sam Lee', email: 'sam@example.com' },
      { name: 'Morgan Rivera', email: 'morgan@example.com' }
    ])
    expect(db.getMessage(created.id)?.cc).toEqual(withCc?.cc)
  })

  it('accepts an explicit Cc list on create', () => {
    const created = db.createMessage({
      folderId: 'inbox',
      subject: 'Group thread',
      body: 'body',
      fromName: 'Carol',
      fromEmail: 'carol@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      cc: [{ name: 'Sam Lee', email: 'sam@example.com' }],
      timestamp: 1000
    })
    expect(created.cc).toEqual([{ name: 'Sam Lee', email: 'sam@example.com' }])
  })

  it('adds the cc column when opening a database created before Cc support existed', () => {
    db.close()
    const raw = new DatabaseSync(join(baseDir, 'outlook-sim.db'))
    raw.exec('DROP TABLE messages')
    raw.exec(`CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      folder_id TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      from_name TEXT NOT NULL DEFAULT '',
      from_email TEXT NOT NULL DEFAULT '',
      to_name TEXT NOT NULL DEFAULT '',
      to_email TEXT NOT NULL DEFAULT '',
      timestamp INTEGER NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      is_flagged INTEGER NOT NULL DEFAULT 0,
      categories TEXT NOT NULL DEFAULT '[]',
      attachments TEXT NOT NULL DEFAULT '[]'
    )`)
    raw.exec(
      `INSERT INTO messages (id, folder_id, subject, body, from_name, from_email, to_name, to_email, timestamp, is_read, is_flagged, categories, attachments)
       VALUES ('legacy-1', 'inbox', 'Old message', 'body', 'Carol', 'carol@example.com', 'Trainee', 'trainee@example.com', 500, 0, 0, '[]', '[]')`
    )
    raw.close()

    const migrated = new MailDb(baseDir)
    expect(migrated.getMessage('legacy-1')?.cc).toEqual([])

    const created = migrated.createMessage({
      folderId: 'inbox',
      subject: 'New after migration',
      body: 'body',
      fromName: 'Carol',
      fromEmail: 'carol@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      timestamp: 600
    })
    expect(created.cc).toEqual([])

    migrated.close()
    // reassign so the outer afterEach's db.close() doesn't double-close
    db = new MailDb(baseDir)
  })

  it('reports no mailbox/calendar data on a fresh database', () => {
    expect(db.hasMailboxOrCalendarData()).toBe(false)
  })

  it('reports mailbox/calendar data present after a message is created', () => {
    db.createMessage({
      folderId: 'inbox',
      subject: 'Hi',
      body: 'body',
      fromName: 'Carol',
      fromEmail: 'carol@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      timestamp: 1000
    })
    expect(db.hasMailboxOrCalendarData()).toBe(true)
  })

  it('reports mailbox/calendar data present after a calendar item is created, even with no messages', () => {
    db.createCalendarItem({
      title: 'Standup',
      description: '',
      startTime: 1000,
      endTime: null,
      allDay: false,
      reminderMinutesBefore: null,
      recurrenceRule: null,
      itemType: 'event'
    })
    expect(db.hasMailboxOrCalendarData()).toBe(true)
  })

  it('resetMailboxAndCalendar clears all messages and calendar items but preserves folders', () => {
    db.createMessage({
      folderId: 'inbox',
      subject: 'To be wiped',
      body: 'body',
      fromName: 'Carol',
      fromEmail: 'carol@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      timestamp: 1000
    })
    db.createCalendarItem({
      title: 'To be wiped',
      description: '',
      startTime: 1000,
      endTime: null,
      allDay: false,
      reminderMinutesBefore: null,
      recurrenceRule: null,
      itemType: 'event'
    })
    db.createFolder({ id: 'projects', name: 'Projects', type: 'custom' })

    db.resetMailboxAndCalendar()

    expect(db.listMessages()).toEqual([])
    expect(db.listCalendarItems()).toEqual([])
    expect(db.hasMailboxOrCalendarData()).toBe(false)
    expect(new Set(db.listFolders().map((f) => f.id))).toEqual(
      new Set(['inbox', 'drafts', 'sent', 'deleted', 'projects'])
    )
  })

  it('reset mailbox/calendar state survives a close/reopen cycle', () => {
    db.createMessage({
      folderId: 'inbox',
      subject: 'To be wiped',
      body: 'body',
      fromName: 'Carol',
      fromEmail: 'carol@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      timestamp: 1000
    })
    db.resetMailboxAndCalendar()
    db.close()

    const reopened = new MailDb(baseDir)
    expect(reopened.listMessages()).toEqual([])
    expect(reopened.hasMailboxOrCalendarData()).toBe(false)
    reopened.close()
    // reassign so the outer afterEach's db.close() doesn't double-close
    db = new MailDb(baseDir)
  })

  it('defaults a new calendar item to reminderFired: false, and round-trips it through update', () => {
    const created = db.createCalendarItem({
      title: 'Filing deadline',
      description: '',
      startTime: 5000,
      endTime: null,
      allDay: false,
      reminderMinutesBefore: 15,
      recurrenceRule: null,
      itemType: 'deadline'
    })
    expect(created.reminderFired).toBe(false)

    const fired = db.updateCalendarItem(created.id, { reminderFired: true })
    expect(fired?.reminderFired).toBe(true)
    expect(db.getCalendarItem(created.id)?.reminderFired).toBe(true)
  })

  it('persists a fired reminder across a close/reopen cycle', () => {
    const created = db.createCalendarItem({
      title: 'Filing deadline',
      description: '',
      startTime: 5000,
      endTime: null,
      allDay: false,
      reminderMinutesBefore: 15,
      recurrenceRule: null,
      itemType: 'deadline'
    })
    db.updateCalendarItem(created.id, { reminderFired: true })
    db.close()

    const reopened = new MailDb(baseDir)
    expect(reopened.getCalendarItem(created.id)?.reminderFired).toBe(true)
    reopened.close()
    // reassign so the outer afterEach's db.close() doesn't double-close
    db = new MailDb(baseDir)
  })

  it('adds the reminder_fired column when opening a database created before reminders existed', () => {
    db.close()
    const raw = new DatabaseSync(join(baseDir, 'outlook-sim.db'))
    raw.exec('DROP TABLE calendar_items')
    raw.exec(`CREATE TABLE calendar_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      all_day INTEGER NOT NULL DEFAULT 0,
      reminder_minutes_before INTEGER,
      recurrence_rule TEXT,
      item_type TEXT NOT NULL DEFAULT 'event' CHECK (item_type IN ('event', 'deadline'))
    )`)
    raw.exec(
      `INSERT INTO calendar_items (id, title, description, start_time, end_time, all_day, reminder_minutes_before, recurrence_rule, item_type)
       VALUES ('legacy-1', 'Old deadline', '', 5000, NULL, 0, 15, NULL, 'deadline')`
    )
    raw.close()

    const migrated = new MailDb(baseDir)
    expect(migrated.getCalendarItem('legacy-1')?.reminderFired).toBe(false)

    const fired = migrated.updateCalendarItem('legacy-1', { reminderFired: true })
    expect(fired?.reminderFired).toBe(true)

    migrated.close()
    // reassign so the outer afterEach's db.close() doesn't double-close
    db = new MailDb(baseDir)
  })
})
