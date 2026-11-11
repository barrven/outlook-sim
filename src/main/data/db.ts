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
  NewMailMessage,
  NewTask,
  RecurrenceFrequency,
  Task,
  TaskPatch
} from '../../shared/data-types'
import {
  BLANK_GP_MATTER_FIELDS,
  DEFAULT_GP_ADMIN,
  DEFAULT_GP_FOLDERS,
  type GpAdmin,
  type GpDocument,
  type GpDocumentPatch,
  type GpFolder,
  type GpFolderPatch,
  type GpFolderTemplate,
  type GpMatter,
  type GpMatterPatch,
  type GpRecord,
  type GpRecordData,
  type GpRecordKind,
  type NewGpDocument,
  type NewGpFolder,
  type NewGpMatter,
  type NewGpRecord
} from '../../shared/ghostPractice'

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

CREATE TABLE IF NOT EXISTS gp_matters (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gp_records (
  id TEXT PRIMARY KEY,
  matter_id TEXT NOT NULL REFERENCES gp_matters(id),
  kind TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_gp_records_matter_id ON gp_records(matter_id);

CREATE TABLE IF NOT EXISTS gp_folders (
  id TEXT PRIMARY KEY,
  matter_id TEXT NOT NULL REFERENCES gp_matters(id),
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES gp_folders(id)
);

CREATE TABLE IF NOT EXISTS gp_documents (
  id TEXT PRIMARY KEY,
  matter_id TEXT NOT NULL REFERENCES gp_matters(id),
  folder_id TEXT REFERENCES gp_folders(id),
  name TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  path TEXT,
  uploaded_by TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gp_documents_matter_id ON gp_documents(matter_id);

CREATE TABLE IF NOT EXISTS gp_admin (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL
);

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

interface GpJsonRow {
  id: string
  data: string
}

interface GpRecordRow {
  id: string
  matter_id: string
  kind: string
  data: string
  created_at: number
  updated_at: number | null
}

interface GpFolderRow {
  id: string
  matter_id: string
  name: string
  parent_id: string | null
}

interface GpDocumentRow {
  id: string
  matter_id: string
  folder_id: string | null
  name: string
  content: string
  path: string | null
  uploaded_by: string
  created_at: number
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

// Blank defaults first, so a matter saved before a field existed still
// loads with every field present.
function gpMatterFromRow(row: GpJsonRow): GpMatter {
  return { ...BLANK_GP_MATTER_FIELDS, ...JSON.parse(row.data), id: row.id }
}

function gpRecordFromRow(row: GpRecordRow): GpRecord {
  return {
    id: row.id,
    matterId: row.matter_id,
    kind: row.kind as GpRecordKind,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    data: JSON.parse(row.data)
  }
}

function gpFolderFromRow(row: GpFolderRow): GpFolder {
  return { id: row.id, matterId: row.matter_id, name: row.name, parentId: row.parent_id }
}

function gpDocumentFromRow(row: GpDocumentRow): GpDocument {
  return {
    id: row.id,
    matterId: row.matter_id,
    folderId: row.folder_id,
    name: row.name,
    content: row.content,
    path: row.path,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at
  }
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
    this.migrateFileVineData()
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

  // Ghost Practice (features/ghost-practice/SPEC.md) — AB matters, their
  // generic list records, document folders/documents, and firm admin.
  // Like tasks below, none of this is touched by
  // resetMailboxAndCalendar/free-play/scenario-pack loads.

  // One-time carry-over of the FileVine module's data (features 047/048),
  // which Ghost Practice replaced. Each root FileVine folder becomes a
  // matter (keeping its client persona association); its subfolders become
  // that matter's document folders and its notes become documents. The old
  // tables are then renamed rather than dropped, so the migration never
  // runs twice and the original rows stay recoverable.
  private migrateFileVineData(): void {
    const hasTable = (name: string): boolean =>
      this.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) !== undefined
    if (!hasTable('filevine_folders')) return

    const folders = this.db.prepare('SELECT * FROM filevine_folders ORDER BY name ASC').all() as unknown as {
      id: string
      name: string
      parent_id: string | null
      client_persona_id: string | null
    }[]
    const notes = hasTable('filevine_notes')
      ? (this.db.prepare('SELECT * FROM filevine_notes ORDER BY name ASC').all() as unknown as {
          folder_id: string
          name: string
          content: string
        }[])
      : []

    const migrateChildren = (oldParentId: string, matterId: string, newParentId: string | null): void => {
      for (const note of notes.filter((candidate) => candidate.folder_id === oldParentId)) {
        this.createGpDocument({ matterId, folderId: newParentId, name: note.name, content: note.content })
      }
      for (const child of folders.filter((candidate) => candidate.parent_id === oldParentId)) {
        const created = this.createGpFolder({ matterId, name: child.name, parentId: newParentId })
        migrateChildren(child.id, matterId, created.id)
      }
    }

    const ids = new Set(folders.map((folder) => folder.id))
    for (const root of folders.filter((folder) => !folder.parent_id || !ids.has(folder.parent_id))) {
      const matter = this.createGpMatter(
        { clientName: root.name, clientPersonaId: root.client_persona_id },
        { seedDefaultFolders: false }
      )
      migrateChildren(root.id, matter.id, null)
    }

    this.db.exec('ALTER TABLE filevine_folders RENAME TO filevine_folders_migrated')
    if (hasTable('filevine_notes')) this.db.exec('ALTER TABLE filevine_notes RENAME TO filevine_notes_migrated')
  }

  listGpMatters(): GpMatter[] {
    const rows = this.db.prepare('SELECT * FROM gp_matters').all() as unknown as GpJsonRow[]
    return rows
      .map(gpMatterFromRow)
      .sort((a, b) => a.matterNumber.localeCompare(b.matterNumber))
  }

  getGpMatter(id: string): GpMatter | null {
    const row = this.db.prepare('SELECT * FROM gp_matters WHERE id = ?').get(id) as GpJsonRow | undefined
    return row ? gpMatterFromRow(row) : null
  }

  // Matter numbers are `AB-<year>-<sequence>`; the sequence is one more than
  // the highest ever issued that is still on file, so deleting a matter in
  // the middle never causes a later one to reuse a live number.
  private nextGpMatterNumber(createdAt: number): string {
    const highest = this.listGpMatters().reduce((max, matter) => {
      const sequence = Number(matter.matterNumber.split('-').pop())
      return Number.isFinite(sequence) ? Math.max(max, sequence) : max
    }, 0)
    return `AB-${new Date(createdAt).getFullYear()}-${String(highest + 1).padStart(4, '0')}`
  }

  // Every new AB matter starts with the default document folder tree
  // (DOC-02) unless the caller opts out (the FileVine migration, which
  // brings its own folders).
  createGpMatter(matter: NewGpMatter, options: { seedDefaultFolders?: boolean } = {}): GpMatter {
    const id = generateId()
    const createdAt = matter.createdAt ?? Date.now()
    const full: GpMatter = {
      ...BLANK_GP_MATTER_FIELDS,
      ...matter,
      id,
      createdAt,
      matterNumber: this.nextGpMatterNumber(createdAt)
    }
    this.db.prepare('INSERT INTO gp_matters (id, data) VALUES (?, ?)').run(id, JSON.stringify(full))
    if (options.seedDefaultFolders ?? true) {
      const seed = (templates: GpFolderTemplate[], parentId: string | null): void => {
        for (const template of templates) {
          const folder = this.createGpFolder({ matterId: id, name: template.name, parentId })
          if (template.children) seed(template.children, folder.id)
        }
      }
      seed(DEFAULT_GP_FOLDERS, null)
    }
    return full
  }

  updateGpMatter(id: string, patch: GpMatterPatch): GpMatter | null {
    const existing = this.getGpMatter(id)
    if (!existing) return null
    const updated: GpMatter = {
      ...existing,
      ...patch,
      id,
      matterNumber: existing.matterNumber,
      createdAt: existing.createdAt
    }
    this.db.prepare('UPDATE gp_matters SET data = ? WHERE id = ?').run(JSON.stringify(updated), id)
    return updated
  }

  deleteGpMatter(id: string): void {
    this.db.prepare('DELETE FROM gp_records WHERE matter_id = ?').run(id)
    this.db.prepare('DELETE FROM gp_documents WHERE matter_id = ?').run(id)
    this.db.prepare('DELETE FROM gp_folders WHERE matter_id = ?').run(id)
    this.db.prepare('DELETE FROM gp_matters WHERE id = ?').run(id)
  }

  // Omitting matterId lists every matter's records — the files list needs
  // them all at once for its next-deadline column and the global diary.
  listGpRecords(matterId?: string): GpRecord[] {
    const rows = (
      matterId
        ? this.db.prepare('SELECT * FROM gp_records WHERE matter_id = ? ORDER BY created_at ASC, rowid ASC').all(matterId)
        : this.db.prepare('SELECT * FROM gp_records ORDER BY created_at ASC, rowid ASC').all()
    ) as unknown as GpRecordRow[]
    return rows.map(gpRecordFromRow)
  }

  getGpRecord(id: string): GpRecord | null {
    const row = this.db.prepare('SELECT * FROM gp_records WHERE id = ?').get(id) as GpRecordRow | undefined
    return row ? gpRecordFromRow(row) : null
  }

  createGpRecord(record: NewGpRecord): GpRecord {
    const full: GpRecord = {
      id: generateId(),
      matterId: record.matterId,
      kind: record.kind,
      createdAt: record.createdAt ?? Date.now(),
      updatedAt: null,
      data: record.data
    }
    this.db
      .prepare('INSERT INTO gp_records (id, matter_id, kind, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(full.id, full.matterId, full.kind, JSON.stringify(full.data), full.createdAt, full.updatedAt)
    return full
  }

  // `data` is merged into the existing values, not replaced, so a caller
  // can change one field (e.g. void a time entry) without resending the rest.
  updateGpRecord(id: string, data: GpRecordData, updatedAt: number = Date.now()): GpRecord | null {
    const existing = this.getGpRecord(id)
    if (!existing) return null
    const updated: GpRecord = { ...existing, data: { ...existing.data, ...data }, updatedAt }
    this.db
      .prepare('UPDATE gp_records SET data = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(updated.data), updated.updatedAt, id)
    return updated
  }

  deleteGpRecord(id: string): void {
    this.db.prepare('DELETE FROM gp_records WHERE id = ?').run(id)
  }

  listGpFolders(matterId: string): GpFolder[] {
    const rows = this.db
      .prepare('SELECT * FROM gp_folders WHERE matter_id = ? ORDER BY name ASC')
      .all(matterId) as unknown as GpFolderRow[]
    return rows.map(gpFolderFromRow)
  }

  getGpFolder(id: string): GpFolder | null {
    const row = this.db.prepare('SELECT * FROM gp_folders WHERE id = ?').get(id) as GpFolderRow | undefined
    return row ? gpFolderFromRow(row) : null
  }

  createGpFolder(folder: NewGpFolder): GpFolder {
    const full: GpFolder = { id: generateId(), parentId: null, ...folder }
    this.db
      .prepare('INSERT INTO gp_folders (id, matter_id, name, parent_id) VALUES (?, ?, ?, ?)')
      .run(full.id, full.matterId, full.name, full.parentId)
    return full
  }

  private gpFolderSubtreeIds(folder: GpFolder): string[] {
    const all = this.listGpFolders(folder.matterId)
    const ids: string[] = []
    const collect = (folderId: string): void => {
      ids.push(folderId)
      for (const candidate of all) {
        if (candidate.parentId === folderId) collect(candidate.id)
      }
    }
    collect(folder.id)
    return ids
  }

  // Renames and/or moves a folder. A move into the folder itself or one of
  // its own descendants would detach the whole subtree from the matter's
  // tree, so that part of the patch is ignored.
  updateGpFolder(id: string, patch: GpFolderPatch): GpFolder | null {
    const existing = this.getGpFolder(id)
    if (!existing) return null
    const updated: GpFolder = { ...existing, ...patch, id, matterId: existing.matterId }
    if (updated.parentId && this.gpFolderSubtreeIds(existing).includes(updated.parentId)) {
      updated.parentId = existing.parentId
    }
    this.db.prepare('UPDATE gp_folders SET name = ?, parent_id = ? WHERE id = ?').run(updated.name, updated.parentId, id)
    return updated
  }

  // Deletes a folder, all of its descendants, and every document inside
  // them — mirrors a real file-system folder delete.
  deleteGpFolder(id: string): void {
    const existing = this.getGpFolder(id)
    if (!existing) return
    // Pre-order (parent before child), so reversing deletes children first
    // — required by the parent_id foreign key.
    for (const folderId of this.gpFolderSubtreeIds(existing).reverse()) {
      this.db.prepare('DELETE FROM gp_documents WHERE folder_id = ?').run(folderId)
      this.db.prepare('DELETE FROM gp_folders WHERE id = ?').run(folderId)
    }
  }

  listGpDocuments(matterId: string): GpDocument[] {
    const rows = this.db
      .prepare('SELECT * FROM gp_documents WHERE matter_id = ? ORDER BY name ASC')
      .all(matterId) as unknown as GpDocumentRow[]
    return rows.map(gpDocumentFromRow)
  }

  getGpDocument(id: string): GpDocument | null {
    const row = this.db.prepare('SELECT * FROM gp_documents WHERE id = ?').get(id) as GpDocumentRow | undefined
    return row ? gpDocumentFromRow(row) : null
  }

  createGpDocument(document: NewGpDocument): GpDocument {
    const full: GpDocument = {
      id: generateId(),
      folderId: null,
      path: null,
      uploadedBy: '',
      createdAt: Date.now(),
      ...document
    }
    this.db
      .prepare(
        `INSERT INTO gp_documents (id, matter_id, folder_id, name, content, path, uploaded_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(full.id, full.matterId, full.folderId, full.name, full.content, full.path, full.uploadedBy, full.createdAt)
    return full
  }

  updateGpDocument(id: string, patch: GpDocumentPatch): GpDocument | null {
    const existing = this.getGpDocument(id)
    if (!existing) return null
    const updated: GpDocument = { ...existing, ...patch, id }
    this.db
      .prepare('UPDATE gp_documents SET name = ?, content = ?, folder_id = ? WHERE id = ?')
      .run(updated.name, updated.content, updated.folderId, id)
    return updated
  }

  deleteGpDocument(id: string): void {
    this.db.prepare('DELETE FROM gp_documents WHERE id = ?').run(id)
  }

  // Missing keys fall back to the defaults, so admin data saved by an
  // earlier version keeps loading as fields are added.
  getGpAdmin(): GpAdmin {
    const row = this.db.prepare('SELECT data FROM gp_admin WHERE id = 1').get() as { data: string } | undefined
    return row ? { ...DEFAULT_GP_ADMIN, ...JSON.parse(row.data) } : DEFAULT_GP_ADMIN
  }

  setGpAdmin(admin: GpAdmin): void {
    this.db
      .prepare('INSERT INTO gp_admin (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data')
      .run(JSON.stringify(admin))
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
