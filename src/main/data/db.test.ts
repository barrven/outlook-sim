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

  // FileVine folders (feature 047)

  it('047 AC3: creates, renames, and deletes a folder', () => {
    const created = db.createFileVineFolder({ name: 'Smith v. Jones' })
    expect(created.parentId).toBeNull()
    expect(created.clientPersonaId).toBeNull()
    expect(db.listFileVineFolders().map((f) => f.id)).toEqual([created.id])

    const renamed = db.updateFileVineFolder(created.id, { name: 'Smith v. Jones (Amended)' })
    expect(renamed?.name).toBe('Smith v. Jones (Amended)')
    expect(db.getFileVineFolder(created.id)?.name).toBe('Smith v. Jones (Amended)')

    db.deleteFileVineFolder(created.id)
    expect(db.listFileVineFolders()).toEqual([])
  })

  it('047 AC3: nests folders under other folders (a real tree, not a flat list)', () => {
    const root = db.createFileVineFolder({ name: 'Smith v. Jones' })
    const child = db.createFileVineFolder({ name: 'Discovery', parentId: root.id })
    const grandchild = db.createFileVineFolder({ name: 'Depositions', parentId: child.id })

    expect(db.getFileVineFolder(child.id)?.parentId).toBe(root.id)
    expect(db.getFileVineFolder(grandchild.id)?.parentId).toBe(child.id)
  })

  it('047 AC3 (regression): deleting a folder with children cascades to descendants, without a foreign-key error', () => {
    // A first implementation deleted the parent before its children (plain
    // insertion order) and threw "FOREIGN KEY constraint failed" — this
    // pins the fix (delete deepest-first).
    const root = db.createFileVineFolder({ name: 'Smith v. Jones' })
    const child = db.createFileVineFolder({ name: 'Discovery', parentId: root.id })
    const grandchild = db.createFileVineFolder({ name: 'Depositions', parentId: child.id })
    const unrelated = db.createFileVineFolder({ name: 'Unrelated matter' })

    expect(() => db.deleteFileVineFolder(root.id)).not.toThrow()

    const remaining = db.listFileVineFolders().map((f) => f.id)
    expect(remaining).toEqual([unrelated.id])
    expect(remaining).not.toContain(root.id)
    expect(remaining).not.toContain(child.id)
    expect(remaining).not.toContain(grandchild.id)
  })

  it('047 AC4: associates a folder with a persona as its client, then un-associates it', () => {
    const folder = db.createFileVineFolder({ name: 'Smith v. Jones' })

    const associated = db.updateFileVineFolder(folder.id, { clientPersonaId: 'persona-1' })
    expect(associated?.clientPersonaId).toBe('persona-1')
    expect(db.getFileVineFolder(folder.id)?.clientPersonaId).toBe('persona-1')

    const changed = db.updateFileVineFolder(folder.id, { clientPersonaId: 'persona-2' })
    expect(changed?.clientPersonaId).toBe('persona-2')

    const unassociated = db.updateFileVineFolder(folder.id, { clientPersonaId: null })
    expect(unassociated?.clientPersonaId).toBeNull()
  })

  it('047 AC5: folder structure and client association persist across a close/reopen cycle', () => {
    const root = db.createFileVineFolder({ name: 'Smith v. Jones' })
    const child = db.createFileVineFolder({ name: 'Discovery', parentId: root.id })
    db.updateFileVineFolder(root.id, { clientPersonaId: 'persona-1' })
    db.close()

    const reopened = new MailDb(baseDir)
    expect(reopened.getFileVineFolder(root.id)).toEqual({
      id: root.id,
      name: 'Smith v. Jones',
      parentId: null,
      clientPersonaId: 'persona-1'
    })
    expect(reopened.getFileVineFolder(child.id)?.parentId).toBe(root.id)
    reopened.close()
    // reassign so the outer afterEach's db.close() doesn't double-close
    db = new MailDb(baseDir)
  })

  it('returns null when getting or updating a FileVine folder that does not exist', () => {
    expect(db.getFileVineFolder('missing')).toBeNull()
    expect(db.updateFileVineFolder('missing', { name: 'x' })).toBeNull()
  })

  // FileVine notes (feature 048)

  it('048 AC1: creates, edits, and deletes a note within a folder', () => {
    const folder = db.createFileVineFolder({ name: 'Smith v. Jones' })
    const created = db.createFileVineNote({ folderId: folder.id, name: 'Intake summary', content: '# Hello' })
    expect(created.folderId).toBe(folder.id)
    expect(db.listFileVineNotes(folder.id).map((n) => n.id)).toEqual([created.id])

    const edited = db.updateFileVineNote(created.id, { name: 'Intake summary (revised)', content: '# Hi there' })
    expect(edited).toEqual({
      id: created.id,
      folderId: folder.id,
      name: 'Intake summary (revised)',
      content: '# Hi there'
    })
    expect(db.getFileVineNote(created.id)?.content).toBe('# Hi there')

    db.deleteFileVineNote(created.id)
    expect(db.listFileVineNotes(folder.id)).toEqual([])
  })

  it('048 AC1: scopes listFileVineNotes to the given folder', () => {
    const folderA = db.createFileVineFolder({ name: 'Smith v. Jones' })
    const folderB = db.createFileVineFolder({ name: 'Unrelated matter' })
    const noteA = db.createFileVineNote({ folderId: folderA.id, name: 'A note', content: '' })
    db.createFileVineNote({ folderId: folderB.id, name: 'B note', content: '' })

    expect(db.listFileVineNotes(folderA.id).map((n) => n.id)).toEqual([noteA.id])
  })

  it('048 AC4: notes persist across a close/reopen cycle, associated with their folder', () => {
    const folder = db.createFileVineFolder({ name: 'Smith v. Jones' })
    const note = db.createFileVineNote({ folderId: folder.id, name: 'Call log', content: '- called client' })
    db.close()

    const reopened = new MailDb(baseDir)
    expect(reopened.getFileVineNote(note.id)).toEqual({
      id: note.id,
      folderId: folder.id,
      name: 'Call log',
      content: '- called client'
    })
    reopened.close()
    // reassign so the outer afterEach's db.close() doesn't double-close
    db = new MailDb(baseDir)
  })

  it('048 AC5: deleting a folder also deletes its notes', () => {
    const folder = db.createFileVineFolder({ name: 'Smith v. Jones' })
    const note = db.createFileVineNote({ folderId: folder.id, name: 'Intake summary', content: '' })
    const unrelatedFolder = db.createFileVineFolder({ name: 'Unrelated matter' })
    const unrelatedNote = db.createFileVineNote({ folderId: unrelatedFolder.id, name: 'Unrelated note', content: '' })

    db.deleteFileVineFolder(folder.id)

    expect(db.getFileVineNote(note.id)).toBeNull()
    expect(db.getFileVineNote(unrelatedNote.id)).not.toBeNull()
  })

  it('048 AC5 (regression): deleting a folder with a nested child cascades notes in both, without a foreign-key error', () => {
    // Mirrors 047's own folder-cascade FK-ordering bug: notes must be
    // deleted before the folders that reference them, for every folder
    // about to be deleted (not just the one passed in).
    const root = db.createFileVineFolder({ name: 'Smith v. Jones' })
    const child = db.createFileVineFolder({ name: 'Discovery', parentId: root.id })
    const rootNote = db.createFileVineNote({ folderId: root.id, name: 'Root note', content: '' })
    const childNote = db.createFileVineNote({ folderId: child.id, name: 'Child note', content: '' })

    expect(() => db.deleteFileVineFolder(root.id)).not.toThrow()

    expect(db.getFileVineNote(rootNote.id)).toBeNull()
    expect(db.getFileVineNote(childNote.id)).toBeNull()
  })

  it('returns null when getting or updating a FileVine note that does not exist', () => {
    expect(db.getFileVineNote('missing')).toBeNull()
    expect(db.updateFileVineNote('missing', { name: 'x' })).toBeNull()
  })
})
