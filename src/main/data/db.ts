import { mkdirSync } from 'fs'
import { join } from 'path'
import { DatabaseSync } from 'node:sqlite'
import type {
  CalendarItem,
  CalendarItemPatch,
  Folder,
  MailMessage,
  MailMessagePatch,
  NewCalendarItem,
  NewFolder,
  NewMailMessage
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
  item_type TEXT NOT NULL DEFAULT 'event' CHECK (item_type IN ('event', 'deadline'))
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
  item_type: string
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
    recurrenceRule: row.recurrence_rule,
    itemType: row.item_type as CalendarItem['itemType']
  }
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
    const full: CalendarItem = { id, ...item }
    this.db
      .prepare(
        `INSERT INTO calendar_items
          (id, title, description, start_time, end_time, all_day, reminder_minutes_before, recurrence_rule, item_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        full.itemType
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
          reminder_minutes_before = ?, recurrence_rule = ?, item_type = ?
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
        updated.itemType,
        id
      )
    return updated
  }

  deleteCalendarItem(id: string): void {
    this.db.prepare('DELETE FROM calendar_items WHERE id = ?').run(id)
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
