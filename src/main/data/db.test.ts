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

  it('does not infer isRead from folderId — the caller (e.g. ComposeWindow) decides, not the db layer', () => {
    const sent = db.createMessage({
      folderId: 'sent',
      subject: 'Sent without an explicit isRead',
      body: 'body',
      fromName: 'Trainee',
      fromEmail: 'trainee@example.com',
      toName: 'Carol',
      toEmail: 'carol@example.com',
      timestamp: 1000
    })

    expect(sent.isRead).toBe(false)
  })

  it('does not retroactively change isRead on existing sent messages when the db is reopened (no bulk migration)', () => {
    const sent = db.createMessage({
      folderId: 'sent',
      subject: 'Old sent mail from before the read-on-send fix',
      body: 'body',
      fromName: 'Trainee',
      fromEmail: 'trainee@example.com',
      toName: 'Carol',
      toEmail: 'carol@example.com',
      timestamp: 1000,
      isRead: false
    })
    expect(sent.isRead).toBe(false)

    db.close()
    db = new MailDb(baseDir)

    expect(db.getMessage(sent.id)?.isRead).toBe(false)
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

  it('B004/025 AC1+AC2: a Sent Items message created with attachments keeps them, including after a close/reopen', () => {
    const sent = db.createMessage({
      folderId: 'sent',
      subject: 'Signed contract attached',
      body: 'Please see attached.',
      fromName: 'Trainee',
      fromEmail: 'trainee@example.com',
      toName: 'Carol',
      toEmail: 'carol@example.com',
      timestamp: 1000,
      attachments: [{ filename: 'contract.pdf' }],
      isRead: true
    })
    expect(sent.attachments).toEqual([{ filename: 'contract.pdf' }])
    // "Reopening" the sent message (AC2) is a plain re-fetch, same as the
    // Reading Pane does — not tied to a close/reopen of the whole DB.
    expect(db.getMessage(sent.id)?.attachments).toEqual([{ filename: 'contract.pdf' }])

    db.close()
    const reopened = new MailDb(baseDir)
    expect(reopened.getMessage(sent.id)?.attachments).toEqual([{ filename: 'contract.pdf' }])
    reopened.close()
    // reassign so the outer afterEach's db.close() doesn't double-close
    db = new MailDb(baseDir)
  })

  it('B004/025 AC1: sending an existing draft (create-then-update-to-sent, as ComposeWindow does) keeps its attachments', () => {
    const draft = db.createMessage({
      folderId: 'drafts',
      subject: 'Draft with attachment',
      body: '',
      fromName: '',
      fromEmail: '',
      toName: '',
      toEmail: '',
      timestamp: 500,
      attachments: [{ filename: 'notes.txt' }]
    })

    const sent = db.updateMessage(draft.id, {
      folderId: 'sent',
      toName: 'Carol',
      toEmail: 'carol@example.com',
      attachments: [{ filename: 'notes.txt' }, { filename: 'addendum.pdf' }],
      isRead: true
    })

    expect(sent?.attachments).toEqual([{ filename: 'notes.txt' }, { filename: 'addendum.pdf' }])
    expect(db.getMessage(draft.id)?.attachments).toEqual([{ filename: 'notes.txt' }, { filename: 'addendum.pdf' }])
  })

  it('B004/025 AC4: a reply/forward-shaped Sent Items message with a freshly-added attachment persists it', () => {
    const replySent = db.createMessage({
      folderId: 'sent',
      subject: 'Re: Quarterly numbers',
      body: 'Here you go.\n\n> original text',
      fromName: 'Trainee',
      fromEmail: 'trainee@example.com',
      toName: 'Priya Shah',
      toEmail: 'priya@example.com',
      timestamp: 2000,
      attachments: [{ filename: 'updated-numbers.xlsx' }],
      isRead: true
    })

    expect(db.getMessage(replySent.id)?.attachments).toEqual([{ filename: 'updated-numbers.xlsx' }])
  })

  it('B004/025 AC3 (regression): editing a draft without touching attachments leaves its attachments untouched', () => {
    const draft = db.createMessage({
      folderId: 'drafts',
      subject: 'Draft',
      body: '',
      fromName: '',
      fromEmail: '',
      toName: '',
      toEmail: '',
      timestamp: 500,
      attachments: [{ filename: 'keep-me.txt' }]
    })

    const resaved = db.updateMessage(draft.id, { subject: 'Draft, edited' })

    expect(resaved?.attachments).toEqual([{ filename: 'keep-me.txt' }])
    expect(db.getMessage(draft.id)?.attachments).toEqual([{ filename: 'keep-me.txt' }])
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

  it('046: creates, updates, and deletes freestanding tasks', () => {
    const task = db.createTask({ text: 'Call client', done: false, dueAt: null })

    expect(task.done).toBe(false)
    expect(task.dueAt).toBeNull()
    expect(db.listTasks().map((t) => t.id)).toEqual([task.id])

    const updated = db.updateTask(task.id, { done: true, dueAt: 5000 })
    expect(updated?.done).toBe(true)
    expect(updated?.dueAt).toBe(5000)

    db.deleteTask(task.id)
    expect(db.getTask(task.id)).toBeNull()
  })

  it('046: returns null when getting or updating a task that does not exist', () => {
    expect(db.getTask('missing')).toBeNull()
    expect(db.updateTask('missing', { done: true })).toBeNull()
  })

  it('046: persists tasks across a close/reopen cycle', () => {
    const task = db.createTask({ text: 'Persisted task', done: false, dueAt: 9000 })
    db.close()

    const reopened = new MailDb(baseDir)
    expect(reopened.getTask(task.id)).toEqual(task)
    reopened.close()
    // reassign so the outer afterEach's db.close() doesn't double-close
    db = new MailDb(baseDir)
  })

  it('046 (regression): resetMailboxAndCalendar does not clear freestanding tasks', () => {
    const task = db.createTask({ text: 'Survives a scenario reset', done: false, dueAt: null })

    db.resetMailboxAndCalendar()

    expect(db.listTasks().map((t) => t.id)).toEqual([task.id])
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
      recurrenceRule: 'daily',
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

  it('defaults a new calendar item to remindersFired: [], and round-trips it through update', () => {
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
    expect(created.remindersFired).toEqual([])

    const fired = db.updateCalendarItem(created.id, { remindersFired: [5000] })
    expect(fired?.remindersFired).toEqual([5000])
    expect(db.getCalendarItem(created.id)?.remindersFired).toEqual([5000])
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
    db.updateCalendarItem(created.id, { remindersFired: [5000] })
    db.close()

    const reopened = new MailDb(baseDir)
    expect(reopened.getCalendarItem(created.id)?.remindersFired).toEqual([5000])
    reopened.close()
    // reassign so the outer afterEach's db.close() doesn't double-close
    db = new MailDb(baseDir)
  })

  it('adds the reminders_fired column when opening a database created before reminders existed', () => {
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
    expect(migrated.getCalendarItem('legacy-1')?.remindersFired).toEqual([])

    const fired = migrated.updateCalendarItem('legacy-1', { remindersFired: [5000] })
    expect(fired?.remindersFired).toEqual([5000])

    migrated.close()
    // reassign so the outer afterEach's db.close() doesn't double-close
    db = new MailDb(baseDir)
  })

  it('backfills reminders_fired from a pre-026 reminder_fired boolean column, using the item\'s own startTime as the fired occurrence', () => {
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
      recurrence_exceptions TEXT NOT NULL DEFAULT '[]',
      item_type TEXT NOT NULL DEFAULT 'event' CHECK (item_type IN ('event', 'deadline')),
      reminder_fired INTEGER NOT NULL DEFAULT 0
    )`)
    raw.exec(
      `INSERT INTO calendar_items (id, title, description, start_time, end_time, all_day, reminder_minutes_before, recurrence_rule, item_type, reminder_fired)
       VALUES ('fired-1', 'Already fired', '', 5000, NULL, 0, 15, NULL, 'deadline', 1)`
    )
    raw.exec(
      `INSERT INTO calendar_items (id, title, description, start_time, end_time, all_day, reminder_minutes_before, recurrence_rule, item_type, reminder_fired)
       VALUES ('not-fired-1', 'Not fired yet', '', 6000, NULL, 0, 15, NULL, 'deadline', 0)`
    )
    raw.close()

    const migrated = new MailDb(baseDir)
    expect(migrated.getCalendarItem('fired-1')?.remindersFired).toEqual([5000])
    expect(migrated.getCalendarItem('not-fired-1')?.remindersFired).toEqual([])

    migrated.close()
    // reassign so the outer afterEach's db.close() doesn't double-close
    db = new MailDb(baseDir)
  })

  it('defaults a new calendar item to recurrenceExceptions: [], and round-trips recurrenceRule/recurrenceExceptions through update', () => {
    const created = db.createCalendarItem({
      title: 'Standup',
      description: '',
      startTime: 5000,
      endTime: 5600,
      allDay: false,
      reminderMinutesBefore: null,
      recurrenceRule: 'daily',
      itemType: 'event'
    })
    expect(created.recurrenceRule).toBe('daily')
    expect(created.recurrenceExceptions).toEqual([])

    const updated = db.updateCalendarItem(created.id, {
      recurrenceExceptions: [{ originalStartTime: 5000 + 86_400_000, deleted: true }]
    })
    expect(updated?.recurrenceExceptions).toEqual([{ originalStartTime: 5000 + 86_400_000, deleted: true }])
    expect(db.getCalendarItem(created.id)?.recurrenceExceptions).toEqual([
      { originalStartTime: 5000 + 86_400_000, deleted: true }
    ])
  })

  it('persists recurrenceRule and recurrenceExceptions across a close/reopen cycle', () => {
    const created = db.createCalendarItem({
      title: 'Standup',
      description: '',
      startTime: 5000,
      endTime: 5600,
      allDay: false,
      reminderMinutesBefore: null,
      recurrenceRule: 'weekly',
      itemType: 'event'
    })
    const exception = {
      originalStartTime: 5000 + 7 * 86_400_000,
      deleted: false,
      title: 'Standup (special)',
      description: 'Moved',
      startTime: 5000 + 7 * 86_400_000 + 3_600_000,
      endTime: null,
      allDay: false,
      reminderMinutesBefore: null,
      itemType: 'event' as const
    }
    db.updateCalendarItem(created.id, { recurrenceExceptions: [exception] })
    db.close()

    const reopened = new MailDb(baseDir)
    const persisted = reopened.getCalendarItem(created.id)
    expect(persisted?.recurrenceRule).toBe('weekly')
    expect(persisted?.recurrenceExceptions).toEqual([exception])
    reopened.close()
    // reassign so the outer afterEach's db.close() doesn't double-close
    db = new MailDb(baseDir)
  })

  it('adds the recurrence_exceptions column when opening a database created before recurring events existed', () => {
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
      item_type TEXT NOT NULL DEFAULT 'event' CHECK (item_type IN ('event', 'deadline')),
      reminder_fired INTEGER NOT NULL DEFAULT 0
    )`)
    raw.exec(
      `INSERT INTO calendar_items (id, title, description, start_time, end_time, all_day, reminder_minutes_before, recurrence_rule, item_type, reminder_fired)
       VALUES ('legacy-1', 'Old standup', '', 5000, NULL, 0, NULL, 'daily', 'event', 0)`
    )
    raw.close()

    const migrated = new MailDb(baseDir)
    expect(migrated.getCalendarItem('legacy-1')?.recurrenceExceptions).toEqual([])
    expect(migrated.getCalendarItem('legacy-1')?.recurrenceRule).toBe('daily')

    const updated = migrated.updateCalendarItem('legacy-1', {
      recurrenceExceptions: [{ originalStartTime: 5000, deleted: true }]
    })
    expect(updated?.recurrenceExceptions).toEqual([{ originalStartTime: 5000, deleted: true }])

    migrated.close()
    // reassign so the outer afterEach's db.close() doesn't double-close
    db = new MailDb(baseDir)
  })

  // Ghost Practice (features/ghost-practice/SPEC.md)

  describe('Ghost Practice', () => {
    it('FILE-01/07: creates a matter with a sequential matter number, blank defaults, and intake status', () => {
      const createdAt = new Date('2026-03-04T12:00:00').getTime()
      const first = db.createGpMatter({ clientName: 'Rivera, Ana', createdAt })
      const second = db.createGpMatter({ clientName: 'Doe, John', claimNumber: 'C-99', createdAt })

      expect(first.matterNumber).toBe('AB-2026-0001')
      expect(second.matterNumber).toBe('AB-2026-0002')
      expect(first).toMatchObject({ status: 'intake', clientPersonaId: null, insurerCompany: '', latOpen: false })
      expect(db.getGpMatter(second.id)?.claimNumber).toBe('C-99')
      expect(db.listGpMatters().map((matter) => matter.id)).toEqual([first.id, second.id])
    })

    it('never reuses a live matter number after an earlier matter is deleted', () => {
      const first = db.createGpMatter({ clientName: 'A' })
      const second = db.createGpMatter({ clientName: 'B' })
      db.deleteGpMatter(first.id)

      const third = db.createGpMatter({ clientName: 'C' })

      expect(third.matterNumber.endsWith('-0003')).toBe(true)
      expect(third.matterNumber).not.toBe(second.matterNumber)
    })

    it('updates a matter without letting a patch change its id, number, or creation time', () => {
      const matter = db.createGpMatter({ clientName: 'Rivera, Ana', createdAt: 1000 })

      const updated = db.updateGpMatter(matter.id, {
        status: 'lat',
        coverageIrb: true,
        ...({ matterNumber: 'HACKED', createdAt: 5 } as object)
      })

      expect(updated).toMatchObject({ status: 'lat', coverageIrb: true, matterNumber: matter.matterNumber, createdAt: 1000 })
      expect(db.updateGpMatter('missing', { status: 'closed' })).toBeNull()
      expect(db.getGpMatter('missing')).toBeNull()
    })

    it('persists matters, records, and documents across a reopen', () => {
      const matter = db.createGpMatter({ clientName: 'Rivera, Ana', clientPersonaId: 'persona-1' })
      const record = db.createGpRecord({ matterId: matter.id, kind: 'charge', data: { vendor: 'LAT', amount: 106 } })
      const document = db.createGpDocument({ matterId: matter.id, name: 'Retainer', content: '# Signed' })
      db.close()

      db = new MailDb(baseDir)

      expect(db.getGpMatter(matter.id)?.clientPersonaId).toBe('persona-1')
      expect(db.getGpRecord(record.id)?.data).toEqual({ vendor: 'LAT', amount: 106 })
      expect(db.getGpDocument(document.id)).toMatchObject({ name: 'Retainer', content: '# Signed', path: null })
    })

    it('DOC-02: seeds every new matter with the default AB folder tree, nested as in the spec', () => {
      const matter = db.createGpMatter({ clientName: 'Rivera, Ana' })

      const folders = db.listGpFolders(matter.id)
      const names = folders.map((folder) => folder.name)
      expect(names).toContain('01 Intake and retainer')
      expect(names).toContain('99 Closed / archive')
      expect(folders).toHaveLength(21)
      const lat = folders.find((folder) => folder.name === '08 LAT')
      const caseConference = folders.find((folder) => folder.name === '08.02 Case conference')
      expect(lat?.parentId).toBeNull()
      expect(caseConference?.parentId).toBe(lat?.id)
    })

    it('scopes folders to their own matter', () => {
      const first = db.createGpMatter({ clientName: 'A' }, { seedDefaultFolders: false })
      const second = db.createGpMatter({ clientName: 'B' }, { seedDefaultFolders: false })
      const folder = db.createGpFolder({ matterId: first.id, name: 'Scans' })

      expect(db.listGpFolders(first.id).map((f) => f.id)).toEqual([folder.id])
      expect(db.listGpFolders(second.id)).toEqual([])
    })

    it('DOC-03: renames and moves a folder, but refuses a move into its own subtree', () => {
      const matter = db.createGpMatter({ clientName: 'A' }, { seedDefaultFolders: false })
      const parent = db.createGpFolder({ matterId: matter.id, name: 'Parent' })
      const child = db.createGpFolder({ matterId: matter.id, name: 'Child', parentId: parent.id })
      const other = db.createGpFolder({ matterId: matter.id, name: 'Other' })

      expect(db.updateGpFolder(child.id, { name: 'Renamed', parentId: other.id })).toMatchObject({
        name: 'Renamed',
        parentId: other.id
      })

      db.updateGpFolder(child.id, { parentId: parent.id })
      const cyclic = db.updateGpFolder(parent.id, { parentId: child.id })
      expect(cyclic?.parentId).toBeNull()
      expect(db.updateGpFolder(parent.id, { parentId: parent.id })?.parentId).toBeNull()
      expect(db.updateGpFolder('missing', { name: 'x' })).toBeNull()
    })

    it('deleting a folder removes its descendants and their documents, leaving the rest of the matter alone', () => {
      const matter = db.createGpMatter({ clientName: 'A' }, { seedDefaultFolders: false })
      const root = db.createGpFolder({ matterId: matter.id, name: 'Root' })
      const child = db.createGpFolder({ matterId: matter.id, name: 'Child', parentId: root.id })
      const unrelated = db.createGpFolder({ matterId: matter.id, name: 'Unrelated' })
      const inChild = db.createGpDocument({ matterId: matter.id, folderId: child.id, name: 'In child', content: '' })
      const topLevel = db.createGpDocument({ matterId: matter.id, name: 'Top level', content: '' })

      expect(() => db.deleteGpFolder(root.id)).not.toThrow()

      expect(db.listGpFolders(matter.id).map((f) => f.id)).toEqual([unrelated.id])
      expect(db.getGpDocument(inChild.id)).toBeNull()
      expect(db.getGpDocument(topLevel.id)).not.toBeNull()
    })

    it('DOC-03/05: stores a document\'s uploader and date, and renames, edits, and moves it', () => {
      const matter = db.createGpMatter({ clientName: 'A' }, { seedDefaultFolders: false })
      const folder = db.createGpFolder({ matterId: matter.id, name: 'Scans' })
      const document = db.createGpDocument({
        matterId: matter.id,
        name: 'eob.pdf',
        content: 'text',
        path: '/tmp/eob.pdf',
        uploadedBy: 'Trainee',
        createdAt: 4242
      })

      expect(document).toMatchObject({ uploadedBy: 'Trainee', createdAt: 4242, folderId: null })
      expect(db.updateGpDocument(document.id, { name: 'April EOB.pdf', folderId: folder.id })).toMatchObject({
        name: 'April EOB.pdf',
        folderId: folder.id,
        content: 'text',
        path: '/tmp/eob.pdf'
      })
      db.deleteGpDocument(document.id)
      expect(db.listGpDocuments(matter.id)).toEqual([])
      expect(db.updateGpDocument('missing', { name: 'x' })).toBeNull()
    })

    it('TIME-05: updating a record merges into its data and stamps updatedAt, so an edit or void leaves a trace', () => {
      const matter = db.createGpMatter({ clientName: 'A' })
      const entry = db.createGpRecord({
        matterId: matter.id,
        kind: 'time',
        data: { date: '2026-03-01', hours: 1, description: 'Draft LAT application' },
        createdAt: 100
      })
      expect(entry.updatedAt).toBeNull()

      const voided = db.updateGpRecord(entry.id, { voided: true }, 200)

      expect(voided).toMatchObject({
        createdAt: 100,
        updatedAt: 200,
        data: { date: '2026-03-01', hours: 1, description: 'Draft LAT application', voided: true }
      })
      expect(db.listGpRecords(matter.id)).toHaveLength(1)
      expect(db.updateGpRecord('missing', { voided: true })).toBeNull()
    })

    it('lists records for one matter in creation order, or for every matter when no id is given', () => {
      const first = db.createGpMatter({ clientName: 'A' })
      const second = db.createGpMatter({ clientName: 'B' })
      const later = db.createGpRecord({ matterId: first.id, kind: 'task', data: { text: 'later' }, createdAt: 200 })
      const earlier = db.createGpRecord({ matterId: first.id, kind: 'log', data: { summary: 'earlier' }, createdAt: 100 })
      db.createGpRecord({ matterId: second.id, kind: 'task', data: { text: 'other file' }, createdAt: 150 })

      expect(db.listGpRecords(first.id).map((record) => record.id)).toEqual([earlier.id, later.id])
      expect(db.listGpRecords()).toHaveLength(3)

      db.deleteGpRecord(later.id)
      expect(db.listGpRecords(first.id).map((record) => record.id)).toEqual([earlier.id])
    })

    it('deleting a matter removes its records, folders, and documents but not another matter\'s', () => {
      const doomed = db.createGpMatter({ clientName: 'A' })
      const kept = db.createGpMatter({ clientName: 'B' })
      db.createGpRecord({ matterId: doomed.id, kind: 'task', data: { text: 'x' } })
      const folder = db.listGpFolders(doomed.id)[0]
      db.createGpDocument({ matterId: doomed.id, folderId: folder.id, name: 'doc', content: '' })
      const keptRecord = db.createGpRecord({ matterId: kept.id, kind: 'task', data: { text: 'y' } })

      expect(() => db.deleteGpMatter(doomed.id)).not.toThrow()

      expect(db.getGpMatter(doomed.id)).toBeNull()
      expect(db.listGpRecords(doomed.id)).toEqual([])
      expect(db.listGpFolders(doomed.id)).toEqual([])
      expect(db.listGpDocuments(doomed.id)).toEqual([])
      expect(db.listGpRecords().map((record) => record.id)).toEqual([keptRecord.id])
      expect(db.listGpFolders(kept.id).length).toBeGreaterThan(0)
    })

    it('ADM-02..04: admin starts from the default pick-lists and round-trips, filling in keys an older save lacks', () => {
      expect(db.getGpAdmin().activityTypes).toContain('LAT prep')

      db.setGpAdmin({
        firmName: 'Example LLP',
        letterhead: '1 Main St',
        users: [{ name: 'Sam', role: 'Assistant', defaultRate: 90 }],
        activityTypes: ['Call'],
        chargeCategories: ['Filing']
      })
      expect(db.getGpAdmin()).toMatchObject({ firmName: 'Example LLP', activityTypes: ['Call'] })

      db.setGpAdmin({ firmName: 'Only a name' } as never)
      expect(db.getGpAdmin()).toMatchObject({ firmName: 'Only a name', users: [], chargeCategories: ['Records', 'Filing', 'Expert', 'Travel', 'Other'] })
    })

    it('is left alone by a free-play / scenario reset, like tasks', () => {
      const matter = db.createGpMatter({ clientName: 'A' })
      db.resetMailboxAndCalendar()
      expect(db.getGpMatter(matter.id)).not.toBeNull()
    })
  })

  describe('FileVine → Ghost Practice migration', () => {
    // Recreates the tables exactly as the FileVine features (047/048) left
    // them in an existing user's database.
    function seedLegacyFileVine(): void {
      db.close()
      const raw = new DatabaseSync(join(baseDir, 'outlook-sim.db'))
      raw.exec(`
        CREATE TABLE filevine_folders (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          parent_id TEXT REFERENCES filevine_folders(id),
          client_persona_id TEXT
        );
        CREATE TABLE filevine_notes (
          id TEXT PRIMARY KEY,
          folder_id TEXT NOT NULL REFERENCES filevine_folders(id),
          name TEXT NOT NULL,
          content TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX idx_filevine_notes_folder_id ON filevine_notes(folder_id);
        INSERT INTO filevine_folders VALUES ('root', 'Smith v. Jones', NULL, 'persona-1');
        INSERT INTO filevine_folders VALUES ('child', 'Discovery', 'root', NULL);
        INSERT INTO filevine_folders VALUES ('grandchild', 'Depositions', 'child', NULL);
        INSERT INTO filevine_folders VALUES ('other', 'Doe Estate', NULL, NULL);
        INSERT INTO filevine_notes VALUES ('n1', 'root', 'Intake summary', '# Intake');
        INSERT INTO filevine_notes VALUES ('n2', 'grandchild', 'Transcript', 'Q. A.');
      `)
      raw.close()
      db = new MailDb(baseDir)
    }

    it('turns each root FileVine folder into a matter, keeping its client persona, subfolders, and notes', () => {
      seedLegacyFileVine()

      const matters = db.listGpMatters()
      expect(matters.map((matter) => matter.clientName).sort()).toEqual(['Doe Estate', 'Smith v. Jones'])
      const smith = matters.find((matter) => matter.clientName === 'Smith v. Jones')!
      expect(smith.clientPersonaId).toBe('persona-1')

      // Its own folders came across — no default template layered on top.
      const folders = db.listGpFolders(smith.id)
      expect(folders.map((folder) => folder.name).sort()).toEqual(['Depositions', 'Discovery'])
      const discovery = folders.find((folder) => folder.name === 'Discovery')!
      const depositions = folders.find((folder) => folder.name === 'Depositions')!
      expect(discovery.parentId).toBeNull()
      expect(depositions.parentId).toBe(discovery.id)

      const documents = db.listGpDocuments(smith.id)
      expect(documents.find((document) => document.name === 'Intake summary')).toMatchObject({
        folderId: null,
        content: '# Intake',
        path: null
      })
      expect(documents.find((document) => document.name === 'Transcript')).toMatchObject({
        folderId: depositions.id,
        content: 'Q. A.'
      })
    })

    it('runs once: reopening does not duplicate the migrated matters, and the old rows are kept, renamed', () => {
      seedLegacyFileVine()
      db.close()
      db = new MailDb(baseDir)

      expect(db.listGpMatters()).toHaveLength(2)

      db.close()
      const raw = new DatabaseSync(join(baseDir, 'outlook-sim.db'))
      const tables = (raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(
        (row) => row.name
      )
      const keptNotes = raw.prepare('SELECT COUNT(*) AS count FROM filevine_notes_migrated').get() as { count: number }
      raw.close()
      db = new MailDb(baseDir)

      expect(tables).toContain('filevine_folders_migrated')
      expect(tables).not.toContain('filevine_folders')
      expect(keptNotes.count).toBe(2)
    })

    it('does nothing on a database that never had FileVine data', () => {
      expect(db.listGpMatters()).toEqual([])
    })
  })
})
