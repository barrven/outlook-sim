import { mkdirSync } from 'fs'
import { join } from 'path'
import { DatabaseSync } from 'node:sqlite'
import type {
  CalendarItem,
  CalendarItemPatch,
  FileVineFolder,
  FileVineFolderPatch,
  FileVineNote,
  FileVineNotePatch,
  Folder,
  MailMessage,
  MailMessagePatch,
  NewCalendarItem,
  NewFileVineFolder,
  NewFileVineNote,
  NewFolder,
  NewMailMessage,
  NewTask,
  RecurrenceFrequency,
  Task,
  TaskPatch
} from '../../shared/data-types'

const DB_FILE_NAME = 'outlook-sim.db'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('system', 'custom')),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL REFERENCES folders(id),
  previous_folder_id TEXT REFERENCES folders(id),
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
);

CREATE INDEX IF NOT EXISTS idx_messages_folder_id ON messages(folder_id);

CREATE TABLE IF NOT EXISTS calendar_items (
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
  reminders_fired TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS filevine_folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES filevine_folders(id),
  client_persona_id TEXT
);

CREATE TABLE IF NOT EXISTS filevine_notes (
  id TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL REFERENCES filevine_folders(id),
  name TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_filevine_notes_folder_id ON filevine_notes(folder_id);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  due_at INTEGER,
  created_at INTEGER NOT NULL
);
`

const DEFAULT_FOLDERS: NewFolder[] = [
  { id: 'inbox', name: 'Inbox', type: 'system', sortOrder: 0 },
  { id: 'drafts', name: 'Drafts', type: 'system', sortOrder: 1 },
  { id: 'sent', name: 'Sent Items', type: 'system', sortOrder: 2 },
  { id: 'deleted', name: 'Deleted Items', type: 'system', sortOrder: 3 }
]

interface FolderRow {
  id: string
  name: string
  type: string
  sort_order: number
}

interface MessageRow {
  id: string
  folder_id: string
  previous_folder_id: string | null
  subject: string
  body: string
  from_name: string
  from_email: string
  to_name: string
  to_email: string
  cc: string
  timestamp: number
  is_read: number
  is_flagged: number
  categories: string
  attachments: string
}

interface CalendarItemRow {
  id: string
  title: string
  description: string
  start_time: number
  end_time: number | null
  all_day: number
  reminder_minutes_before: number | null
  recurrence_rule: string | null
  recurrence_exceptions: string
  item_type: string
  reminders_fired: string
}

interface FileVineFolderRow {
  id: string
  name: string
  parent_id: string | null
  client_persona_id: string | null
}

interface FileVineNoteRow {
  id: string
  folder_id: string
  name: string
  content: string
}

interface TaskRow {
  id: string
  text: string
  done: number
  due_at: number | null
  created_at: number
}

function folderFromRow(row: FolderRow): Folder {
  return { id: row.id, name: row.name, type: row.type as Folder['type'], sortOrder: row.sort_order }
}

function messageFromRow(row: MessageRow): MailMessage {
  return {
    id: row.id,
    folderId: row.folder_id,
    previousFolderId: row.previous_folder_id,
    subject: row.subject,
    body: row.body,
    fromName: row.from_name,
    fromEmail: row.from_email,
    toName: row.to_name,
    toEmail: row.to_email,
    cc: JSON.parse(row.cc),
    timestamp: row.timestamp,
    isRead: row.is_read === 1,
    isFlagged: row.is_flagged === 1,
    categories: JSON.parse(row.categories),
    attachments: JSON.parse(row.attachments)
  }
}

function calendarItemFromRow(row: CalendarItemRow): CalendarItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startTime: row.start_time,
    endTime: row.end_time,
    allDay: row.all_day === 1,
    reminderMinutesBefore: row.reminder_minutes_before,
    recurrenceRule: row.recurrence_rule as RecurrenceFrequency | null,
    recurrenceExceptions: JSON.parse(row.recurrence_exceptions),
    itemType: row.item_type as CalendarItem['itemType'],
    remindersFired: JSON.parse(row.reminders_fired)
  }
}

function fileVineFolderFromRow(row: FileVineFolderRow): FileVineFolder {
  return { id: row.id, name: row.name, parentId: row.parent_id, clientPersonaId: row.client_persona_id }
}

function fileVineNoteFromRow(row: FileVineNoteRow): FileVineNote {
  return { id: row.id, folderId: row.folder_id, name: row.name, content: row.content }
}

function taskFromRow(row: TaskRow): Task {
  return { id: row.id, text: row.text, done: row.done === 1, dueAt: row.due_at, createdAt: row.created_at }
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export class MailDb {
  private db: DatabaseSync

  constructor(baseDir: string) {
    mkdirSync(baseDir, { recursive: true })
    this.db = new DatabaseSync(join(baseDir, DB_FILE_NAME))
    this.db.exec(SCHEMA)
    this.migrateMessagesCcColumn()
    this.migrateMessagesPreviousFolderIdColumn()
    this.migrateCalendarItemsRemindersFiredColumn()
    this.migrateCalendarItemsRecurrenceExceptionsColumn()
    this.seedDefaultFolders()
  }

  // `CREATE TABLE IF NOT EXISTS` doesn't add new columns to a pre-existing
  // messages table from an earlier version of the app, so backfill it here.
  private migrateMessagesCcColumn(): void {
    const columns = this.db.prepare('PRAGMA table_info(messages)').all() as { name: string }[]
    if (!columns.some((column) => column.name === 'cc')) {
      this.db.exec("ALTER TABLE messages ADD COLUMN cc TEXT NOT NULL DEFAULT '[]'")
    }
  }

  private migrateMessagesPreviousFolderIdColumn(): void {
    const columns = this.db.prepare('PRAGMA table_info(messages)').all() as { name: string }[]
    if (!columns.some((column) => column.name === 'previous_folder_id')) {
      this.db.exec('ALTER TABLE messages ADD COLUMN previous_folder_id TEXT REFERENCES folders(id)')
    }
  }

  // Replaces the single reminder_fired boolean (feature 019) with a JSON
  // array of fired occurrences' originalStartTime (feature 026, so a
  // recurring series' reminder can fire once per occurrence instead of only
  // ever once for the whole series). A pre-026 database still has the old
  // column; back-fill it into the new one before it goes unused — a
  // previously-fired item's only fireable occurrence was its own template
  // start time, so that's the correct (and only) originalStartTime to carry
  // forward.
  private migrateCalendarItemsRemindersFiredColumn(): void {
    const columns = this.db.prepare('PRAGMA table_info(calendar_items)').all() as { name: string }[]
    if (columns.some((column) => column.name === 'reminders_fired')) return
    this.db.exec("ALTER TABLE calendar_items ADD COLUMN reminders_fired TEXT NOT NULL DEFAULT '[]'")
    if (columns.some((column) => column.name === 'reminder_fired')) {
      const firedRows = this.db
        .prepare('SELECT id, start_time FROM calendar_items WHERE reminder_fired = 1')
        .all() as { id: string; start_time: number }[]
      for (const row of firedRows) {
        this.db
          .prepare('UPDATE calendar_items SET reminders_fired = ? WHERE id = ?')
          .run(JSON.stringify([row.start_time]), row.id)
      }
    }
  }

  private migrateCalendarItemsRecurrenceExceptionsColumn(): void {
    const columns = this.db.prepare('PRAGMA table_info(calendar_items)').all() as { name: string }[]
    if (!columns.some((column) => column.name === 'recurrence_exceptions')) {
      this.db.exec("ALTER TABLE calendar_items ADD COLUMN recurrence_exceptions TEXT NOT NULL DEFAULT '[]'")
    }
  }

  private seedDefaultFolders(): void {
    const existing = this.db.prepare('SELECT COUNT(*) as count FROM folders').get() as { count: number }
    if (existing.count > 0) return
    for (const folder of DEFAULT_FOLDERS) {
      this.createFolder(folder)
    }
  }

  close(): void {
    this.db.close()
  }

  // Folders

  listFolders(): Folder[] {
    const rows = this.db.prepare('SELECT * FROM folders ORDER BY sort_order ASC').all() as unknown as FolderRow[]
    return rows.map(folderFromRow)
  }

  createFolder(folder: NewFolder): Folder {
    this.db
      .prepare('INSERT INTO folders (id, name, type, sort_order) VALUES (?, ?, ?, ?)')
      .run(folder.id, folder.name, folder.type, folder.sortOrder ?? 0)
    return { id: folder.id, name: folder.name, type: folder.type, sortOrder: folder.sortOrder ?? 0 }
  }

  renameFolder(id: string, name: string): void {
    this.db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(name, id)
  }

  deleteFolder(id: string): void {
    this.db.prepare('DELETE FROM folders WHERE id = ?').run(id)
  }

  // Messages

  listMessages(folderId?: string): MailMessage[] {
    const rows = (
      folderId
        ? this.db.prepare('SELECT * FROM messages WHERE folder_id = ? ORDER BY timestamp DESC').all(folderId)
        : this.db.prepare('SELECT * FROM messages ORDER BY timestamp DESC').all()
    ) as unknown as MessageRow[]
    return rows.map(messageFromRow)
  }

  getMessage(id: string): MailMessage | null {
    const row = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow | undefined
    return row ? messageFromRow(row) : null
  }

  createMessage(message: NewMailMessage): MailMessage {
    const id = generateId()
    const full: MailMessage = {
      id,
      previousFolderId: null,
      isRead: false,
      isFlagged: false,
      categories: [],
      attachments: [],
      cc: [],
      ...message
    }
    this.db
      .prepare(
        `INSERT INTO messages
          (id, folder_id, previous_folder_id, subject, body, from_name, from_email, to_name, to_email, cc, timestamp, is_read, is_flagged, categories, attachments)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        full.id,
        full.folderId,
        full.previousFolderId,
        full.subject,
        full.body,
        full.fromName,
        full.fromEmail,
        full.toName,
        full.toEmail,
        JSON.stringify(full.cc),
        full.timestamp,
        full.isRead ? 1 : 0,
        full.isFlagged ? 1 : 0,
        JSON.stringify(full.categories),
        JSON.stringify(full.attachments)
      )
    return full
  }

  updateMessage(id: string, patch: MailMessagePatch): MailMessage | null {
    const existing = this.getMessage(id)
    if (!existing) return null
    const updated: MailMessage = { ...existing, ...patch, id }
    this.db
      .prepare(
        `UPDATE messages SET
          folder_id = ?, previous_folder_id = ?, subject = ?, body = ?, from_name = ?, from_email = ?,
          to_name = ?, to_email = ?, cc = ?, timestamp = ?, is_read = ?, is_flagged = ?,
          categories = ?, attachments = ?
         WHERE id = ?`
      )
      .run(
        updated.folderId,
        updated.previousFolderId,
        updated.subject,
        updated.body,
        updated.fromName,
        updated.fromEmail,
        updated.toName,
        updated.toEmail,
        JSON.stringify(updated.cc),
        updated.timestamp,
        updated.isRead ? 1 : 0,
        updated.isFlagged ? 1 : 0,
        JSON.stringify(updated.categories),
        JSON.stringify(updated.attachments),
        id
      )
    return updated
  }

  deleteMessage(id: string): void {
    this.db.prepare('DELETE FROM messages WHERE id = ?').run(id)
  }

  // Calendar items

  listCalendarItems(): CalendarItem[] {
    const rows = this.db
      .prepare('SELECT * FROM calendar_items ORDER BY start_time ASC')
      .all() as unknown as CalendarItemRow[]
    return rows.map(calendarItemFromRow)
  }

  getCalendarItem(id: string): CalendarItem | null {
    const row = this.db.prepare('SELECT * FROM calendar_items WHERE id = ?').get(id) as
      | CalendarItemRow
      | undefined
    return row ? calendarItemFromRow(row) : null
  }

  createCalendarItem(item: NewCalendarItem): CalendarItem {
    const id = generateId()
    const full: CalendarItem = { id, remindersFired: [], recurrenceExceptions: [], ...item }
    this.db
      .prepare(
        `INSERT INTO calendar_items
          (id, title, description, start_time, end_time, all_day, reminder_minutes_before, recurrence_rule, recurrence_exceptions, item_type, reminders_fired)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        full.id,
        full.title,
        full.description,
        full.startTime,
        full.endTime,
        full.allDay ? 1 : 0,
        full.reminderMinutesBefore,
        full.recurrenceRule,
        JSON.stringify(full.recurrenceExceptions),
        full.itemType,
        JSON.stringify(full.remindersFired)
      )
    return full
  }

  updateCalendarItem(id: string, patch: CalendarItemPatch): CalendarItem | null {
    const existing = this.getCalendarItem(id)
    if (!existing) return null
    const updated: CalendarItem = { ...existing, ...patch, id }
    this.db
      .prepare(
        `UPDATE calendar_items SET
          title = ?, description = ?, start_time = ?, end_time = ?, all_day = ?,
          reminder_minutes_before = ?, recurrence_rule = ?, recurrence_exceptions = ?, item_type = ?, reminders_fired = ?
         WHERE id = ?`
      )
      .run(
        updated.title,
        updated.description,
        updated.startTime,
        updated.endTime,
        updated.allDay ? 1 : 0,
        updated.reminderMinutesBefore,
        updated.recurrenceRule,
        JSON.stringify(updated.recurrenceExceptions),
        updated.itemType,
        JSON.stringify(updated.remindersFired),
        id
      )
    return updated
  }

  deleteCalendarItem(id: string): void {
    this.db.prepare('DELETE FROM calendar_items WHERE id = ?').run(id)
  }

  // FileVine folders

  listFileVineFolders(): FileVineFolder[] {
    const rows = this.db
      .prepare('SELECT * FROM filevine_folders ORDER BY name ASC')
      .all() as unknown as FileVineFolderRow[]
    return rows.map(fileVineFolderFromRow)
  }

  getFileVineFolder(id: string): FileVineFolder | null {
    const row = this.db.prepare('SELECT * FROM filevine_folders WHERE id = ?').get(id) as
      | FileVineFolderRow
      | undefined
    return row ? fileVineFolderFromRow(row) : null
  }

  createFileVineFolder(folder: NewFileVineFolder): FileVineFolder {
    const id = generateId()
    const full: FileVineFolder = { id, parentId: null, clientPersonaId: null, ...folder }
    this.db
      .prepare('INSERT INTO filevine_folders (id, name, parent_id, client_persona_id) VALUES (?, ?, ?, ?)')
      .run(full.id, full.name, full.parentId, full.clientPersonaId)
    return full
  }

  updateFileVineFolder(id: string, patch: FileVineFolderPatch): FileVineFolder | null {
    const existing = this.getFileVineFolder(id)
    if (!existing) return null
    const updated: FileVineFolder = { ...existing, ...patch, id }
    this.db
      .prepare('UPDATE filevine_folders SET name = ?, parent_id = ?, client_persona_id = ? WHERE id = ?')
      .run(updated.name, updated.parentId, updated.clientPersonaId, id)
    return updated
  }

  // Deletes a folder and all of its descendants — mirrors a real
  // file-system folder delete removing its contents, rather than silently
  // orphaning/reparenting children to the root. Also removes every deleted
  // folder's notes (feature 048) — otherwise their folder_id foreign key
  // would block the folder deletes below, and orphaned notes would be an
  // undefined, not deliberate, outcome.
  deleteFileVineFolder(id: string): void {
    const all = this.listFileVineFolders()
    const toDelete = new Set<string>()
    const collect = (folderId: string): void => {
      toDelete.add(folderId)
      for (const folder of all) {
        if (folder.parentId === folderId) collect(folder.id)
      }
    }
    collect(id)
    for (const folderId of toDelete) {
      this.db.prepare('DELETE FROM filevine_notes WHERE folder_id = ?').run(folderId)
    }
    // `collect` visits a folder before its children (pre-order), so
    // reversing guarantees every descendant is deleted before its parent —
    // required by the parent_id foreign key, since a parent can't be
    // deleted while a still-existing child still references it.
    for (const folderId of [...toDelete].reverse()) {
      this.db.prepare('DELETE FROM filevine_folders WHERE id = ?').run(folderId)
    }
  }

  // FileVine notes (feature 048)

  listFileVineNotes(folderId: string): FileVineNote[] {
    const rows = this.db
      .prepare('SELECT * FROM filevine_notes WHERE folder_id = ? ORDER BY name ASC')
      .all(folderId) as unknown as FileVineNoteRow[]
    return rows.map(fileVineNoteFromRow)
  }

  getFileVineNote(id: string): FileVineNote | null {
    const row = this.db.prepare('SELECT * FROM filevine_notes WHERE id = ?').get(id) as
      | FileVineNoteRow
      | undefined
    return row ? fileVineNoteFromRow(row) : null
  }

  createFileVineNote(note: NewFileVineNote): FileVineNote {
    const id = generateId()
    const full: FileVineNote = { id, ...note }
    this.db
      .prepare('INSERT INTO filevine_notes (id, folder_id, name, content) VALUES (?, ?, ?, ?)')
      .run(full.id, full.folderId, full.name, full.content)
    return full
  }

  updateFileVineNote(id: string, patch: FileVineNotePatch): FileVineNote | null {
    const existing = this.getFileVineNote(id)
    if (!existing) return null
    const updated: FileVineNote = { ...existing, ...patch, id }
    this.db
      .prepare('UPDATE filevine_notes SET name = ?, content = ? WHERE id = ?')
      .run(updated.name, updated.content, id)
    return updated
  }

  deleteFileVineNote(id: string): void {
    this.db.prepare('DELETE FROM filevine_notes WHERE id = ?').run(id)
  }

  // Freestanding tasks (feature 046) — deliberately not touched by
  // resetMailboxAndCalendar/free-play/scenario-pack loads below: these are
  // the trainee's own to-do list, not scenario data, so they persist across
  // a scenario reset the same way Settings/personas already do.

  listTasks(): Task[] {
    const rows = this.db.prepare('SELECT * FROM tasks ORDER BY created_at ASC').all() as unknown as TaskRow[]
    return rows.map(taskFromRow)
  }

  getTask(id: string): Task | null {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined
    return row ? taskFromRow(row) : null
  }

  createTask(task: NewTask): Task {
    const id = generateId()
    const full: Task = { id, createdAt: Date.now(), ...task }
    this.db
      .prepare('INSERT INTO tasks (id, text, done, due_at, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(full.id, full.text, full.done ? 1 : 0, full.dueAt, full.createdAt)
    return full
  }

  updateTask(id: string, patch: TaskPatch): Task | null {
    const existing = this.getTask(id)
    if (!existing) return null
    const updated: Task = { ...existing, ...patch, id }
    this.db
      .prepare('UPDATE tasks SET text = ?, done = ?, due_at = ?, created_at = ? WHERE id = ?')
      .run(updated.text, updated.done ? 1 : 0, updated.dueAt, updated.createdAt, id)
    return updated
  }

  deleteTask(id: string): void {
    this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  }

  // Free-play session

  hasMailboxOrCalendarData(): boolean {
    const messageCount = this.db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number }
    if (messageCount.count > 0) return true
    const calendarCount = this.db.prepare('SELECT COUNT(*) as count FROM calendar_items').get() as {
      count: number
    }
    return calendarCount.count > 0
  }

  resetMailboxAndCalendar(): void {
    this.db.exec('DELETE FROM messages')
    this.db.exec('DELETE FROM calendar_items')
  }
}
