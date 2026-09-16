// Types shared between main, preload, and renderer for the local data layer
// (SQLite runtime store + JSON config store).

export type FolderType = 'system' | 'custom'

export interface Folder {
  id: string
  name: string
  type: FolderType
  sortOrder: number
}

export interface NewFolder {
  id: string
  name: string
  type: FolderType
  sortOrder?: number
}

export interface MessageAttachment {
  filename: string
}

export interface MessageRecipient {
  name: string
  email: string
}

export interface MailMessage {
  id: string
  folderId: string
  // Folder the message lived in before being moved to Deleted Items, so it
  // can be restored there; null unless the message is currently deleted.
  previousFolderId: string | null
  subject: string
  body: string
  fromName: string
  fromEmail: string
  toName: string
  toEmail: string
  cc: MessageRecipient[]
  timestamp: number
  isRead: boolean
  isFlagged: boolean
  categories: string[]
  attachments: MessageAttachment[]
}

export type ComposeIntent = 'reply' | 'replyAll' | 'forward'

export interface ComposeOpenOptions {
  draftId?: string
  sourceMessageId?: string
  intent?: ComposeIntent
}

export type NewMailMessage = Omit<
  MailMessage,
  'id' | 'isRead' | 'isFlagged' | 'categories' | 'attachments' | 'cc' | 'previousFolderId'
> &
  Partial<Pick<MailMessage, 'isRead' | 'isFlagged' | 'categories' | 'attachments' | 'cc' | 'previousFolderId'>>

export type MailMessagePatch = Partial<Omit<MailMessage, 'id'>>

export type CalendarItemType = 'event' | 'deadline'

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly'

// An edit or delete applied to a single occurrence of a recurring series,
// keyed by that occurrence's *natural* (un-excepted) start time so it keeps
// matching the same occurrence across repeated edits, even after the
// occurrence's own displayed startTime has been overridden. `deleted: true`
// skips the occurrence entirely; otherwise every field is a full snapshot
// of that occurrence's overridden values (not a partial diff).
export type CalendarRecurrenceException =
  | { originalStartTime: number; deleted: true }
  | {
      originalStartTime: number
      deleted: false
      title: string
      description: string
      startTime: number
      endTime: number | null
      allDay: boolean
      reminderMinutesBefore: number | null
      itemType: CalendarItemType
    }

export interface CalendarItem {
  id: string
  title: string
  description: string
  startTime: number
  endTime: number | null
  allDay: boolean
  reminderMinutesBefore: number | null
  // Only the series' anchor/template item carries this; individual
  // occurrences are computed, not stored (see `src/shared/recurrence.ts`).
  recurrenceRule: RecurrenceFrequency | null
  // Per-occurrence overrides/deletions for a recurring series; empty for a
  // non-recurring item.
  recurrenceExceptions: CalendarRecurrenceException[]
  itemType: CalendarItemType
  // The `originalStartTime` (see CalendarOccurrence) of every occurrence
  // whose reminder has already fired, so none of them fire twice —
  // including across app restarts. For a non-recurring item this holds at
  // most its own `startTime`, the same "has it fired yet" behavior a plain
  // boolean gave before recurring reminders needed per-occurrence tracking.
  remindersFired: number[]
}

export type NewCalendarItem = Omit<CalendarItem, 'id' | 'remindersFired' | 'recurrenceExceptions'> &
  Partial<Pick<CalendarItem, 'remindersFired' | 'recurrenceExceptions'>>

export type CalendarItemPatch = Partial<Omit<CalendarItem, 'id'>>

// A freestanding to-do item in the Tasks panel (feature 046) — distinct
// from a flagged email, which the panel also shows but derives from
// `MailMessage.isFlagged` rather than storing here. `dueAt` is an optional
// due-date "indicator" per the spec, not a full scheduling feature.
export interface Task {
  id: string
  text: string
  done: boolean
  dueAt: number | null
  // Stable creation-order sort key — not otherwise user-facing.
  createdAt: number
}

export type NewTask = Omit<Task, 'id' | 'createdAt'> & Partial<Pick<Task, 'createdAt'>>

export type TaskPatch = Partial<Omit<Task, 'id'>>

// A case-file/matter folder in the FileVine module (feature 047). Folders
// nest via `parentId` (file-system-like, not the flat list mail folders
// use); `clientPersonaId` optionally associates a folder with a configured
// persona as its "client". Notes/files (feature 048) and LLM context
// wiring (feature 049) are out of this type's scope.
export interface FileVineFolder {
  id: string
  name: string
  parentId: string | null
  clientPersonaId: string | null
}

export type NewFileVineFolder = Omit<FileVineFolder, 'id' | 'parentId' | 'clientPersonaId'> &
  Partial<Pick<FileVineFolder, 'parentId' | 'clientPersonaId'>>

export type FileVineFolderPatch = Partial<Omit<FileVineFolder, 'id'>>

// A note/file entry within a FileVine folder (feature 048). `content` is
// Markdown source, rendered formatted in the view UI and edited as raw
// source in edit mode — this type only stores the source, not any rendered
// form.
export interface FileVineNote {
  id: string
  folderId: string
  name: string
  content: string
}

export type NewFileVineNote = Omit<FileVineNote, 'id'>

export type FileVineNotePatch = Partial<Omit<FileVineNote, 'id' | 'folderId'>>

// Broadcast when the reminder scheduler fires a specific occurrence's
// reminder. Deliberately not `CalendarItem` itself: `id` here is unique per
// *occurrence* firing (`seriesId:originalStartTime`), not per series, so two
// occurrences of the same recurring series firing in the same tick get
// distinct, independently-dismissible banners; `title`/`startTime` reflect
// that occurrence's actual (possibly exception-overridden) values.
export interface FiredReminder {
  id: string
  seriesId: string
  title: string
  startTime: number
}

export type LlmProvider = 'openai' | 'anthropic' | 'gemini' | 'xai'

export interface Settings {
  provider: LlmProvider
  model: string
  apiKeys: Record<LlmProvider, string>
}

export interface LlmGenerateInput {
  systemPrompt?: string
  userPrompt: string
}

export type LlmGenerateResult = { ok: true; text: string } | { ok: false; error: string }

// Persona-reply generation's result (feature 015), lifted to shared so the
// renderer can inspect it directly for the Retry flow (feature 027) rather
// than only reacting to the llm:persona-reply-failed broadcast.
export type PersonaReplyResult =
  | { ok: true; replied: true; message: MailMessage }
  | { ok: true; replied: false }
  | { ok: false; error: string }

// Unsolicited-mail generation's result (feature 016), lifted to shared for
// the same reason (feature 027's Retry flow needs the resolved value, not
// just the failure broadcast).
export type GenerateUnsolicitedMailResult =
  | { ok: true; sent: true; message: MailMessage }
  | { ok: true; sent: false }
  | { ok: false; error: string }

// Every LLM call failure (feature 027) — persona replies, unsolicited mail,
// and Settings' Test Connection — gets appended here regardless of whether
// its UI banner/message was dismissed, so a trainer can inspect a durable
// history of failures for troubleshooting.
export type LlmFailureSource = 'personaReply' | 'unsolicitedMail' | 'testConnection' | 'generatePersonas'

export interface LlmFailureLogEntry {
  timestamp: number
  source: LlmFailureSource
  error: string
}

export interface SystemPromptConfig {
  systemPrompt: string
}

export interface TraineeIdentity {
  displayName: string
  jobTitle: string
  fromEmail: string
  // Org-structure fields (feature 028) — free text, both optional (empty
  // is valid). Data saved before this feature lacks them; readers must
  // default to '' rather than assume presence.
  reportsTo: string
  department: string
}

export interface Persona {
  id: string
  displayName: string
  email: string
  role: string
  bio: string
  writingStyleNotes: string
  extraPrompt: string
  // Whether this persona represents a client of the firm, as opposed to
  // firm staff or another external contact (adjuster, opposing counsel,
  // etc.) — gates which personas can be assigned as a FileVine folder's
  // client.
  isClient: boolean
  // Free text, not a reference to another configured persona — a persona
  // may report to someone outside the configured cast entirely (feature
  // 028). Optional in spirit (empty is valid); data saved before this
  // feature lacks it, so readers must default to ''.
  reportsTo: string
}

export interface PersonasConfig {
  personas: Persona[]
}

// A standalone personas-only import file (feature 031) — distinct from a
// full scenario pack: just a bare JSON array of persona entries, no
// name/description/inbox/calendar/timedMessages. Unlike
// `ScenarioPackPersona` (which omits `isClient`/`reportsTo` entirely,
// since scenario packs treat those as trainer-side data, not scenario
// data), this feature is specifically about managing the persona cast, so
// both are importable here — optional in the file, defaulting to
// false/'' when absent.
export interface PersonasFilePersona {
  displayName: string
  email: string
  role: string
  bio: string
  writingStyleNotes: string
  extraPrompt: string
  isClient: boolean
  reportsTo: string
}

export type PersonasFileValidationResult =
  | { ok: true; personas: PersonasFilePersona[] }
  | { ok: false; error: string }

// Picking a file adds a third outcome on top of validation — the user
// closing the file-picker dialog without choosing anything, mirroring
// `PickScenarioPackResult`.
export type PickPersonasFileResult = PersonasFileValidationResult | { ok: false; canceled: true }

// LLM-generated persona cast (feature 032) — the model is instructed to
// produce exactly a `PersonasFilePersona[]`-shaped JSON array, so its
// output is validated with the same `validatePersonasFile` a hand-edited
// import file goes through; this just names that reused result shape for
// the generation call.
export type GeneratePersonasResult =
  | { ok: true; personas: PersonasFilePersona[] }
  | { ok: false; error: string }

export interface ClockState {
  // Simulated time (ms epoch) as of the last start/pause/speed-change boundary.
  anchorSimTime: number
  // Real wall-clock time (ms epoch) at that same boundary.
  anchorRealTime: number
  running: boolean
  // Multiplier applied to elapsed real time while running (1 = real-time).
  speed: number
}

// Starting free-play wipes the current mailbox/calendar, so a first attempt
// that would discard existing data comes back unconfirmed for the caller to
// prompt the user; retrying with confirmed:true proceeds regardless.
export type StartFreePlayResult = { ok: true } | { ok: false; needsConfirmation: true }

export interface SchedulerState {
  // Simulated time (ms epoch) at which the next unsolicited message is due.
  // 0 means "never scheduled yet" (sentinel — real simulated timestamps are
  // always far larger).
  nextDueSimTime: number
}

// --- Scenario packs (021/022) ---
//
// All timing in a pack is relative to the moment it's loaded (or, for a
// saved pack, relative to the moment it was saved) rather than absolute —
// packs are meant to be reusable across different sessions/dates, so an
// absolute timestamp baked into the file wouldn't make sense. `offsetMinutes`
// is added to the simulated clock's time at load to get the actual timestamp;
// negative values are in the past (already-arrived starting inbox mail),
// positive values are in the future (timed incoming messages, most
// deadlines/events).

export interface ScenarioPackPersona {
  displayName: string
  email: string
  role: string
  bio: string
  writingStyleNotes: string
  extraPrompt: string
}

export interface ScenarioPackMessage {
  subject: string
  body: string
  fromName: string
  fromEmail: string
  toName: string
  toEmail: string
  offsetMinutes: number
}

export interface ScenarioPackCalendarItem {
  title: string
  description: string
  offsetMinutes: number
  // Minutes after the start time that the item ends; null means no end time.
  durationMinutes: number | null
  allDay: boolean
  reminderMinutesBefore: number | null
  itemType: CalendarItemType
}

export interface ScenarioPack {
  name: string
  description: string
  personas: ScenarioPackPersona[]
  // Starting Inbox contents — present (usually negative offsetMinutes).
  inbox: ScenarioPackMessage[]
  calendarItems: ScenarioPackCalendarItem[]
  // Incoming messages delivered later, once simulated time reaches each
  // one's offset from load time (usually positive offsetMinutes).
  timedMessages: ScenarioPackMessage[]
  // Optional (feature 029) — genuinely absent (not '') for a pack saved
  // before this feature, so applying it can distinguish "no system prompt
  // in this pack, leave the current one alone" from "this pack explicitly
  // clears the system prompt to empty."
  systemPrompt?: string
}

export type ScenarioPackValidationResult =
  | { ok: true; pack: ScenarioPack }
  | { ok: false; error: string }

// Picking a pack adds a third outcome on top of validation — the user
// closing the file-picker dialog without choosing anything, which isn't an
// error worth showing.
export type PickScenarioPackResult = ScenarioPackValidationResult | { ok: false; canceled: true }

// A `timedMessages` entry, persisted with its due time resolved to an
// absolute simulated timestamp at load time, so a scheduler can deliver it
// later regardless of app restarts in between.
export interface ScheduledScenarioMessage {
  id: string
  dueSimTime: number
  subject: string
  body: string
  fromName: string
  fromEmail: string
  toName: string
  toEmail: string
}

// Loading a pack replaces the current mailbox/calendar/personas, so a first
// attempt that would discard existing data comes back unconfirmed for the
// caller to prompt the user; retrying with confirmed:true proceeds
// regardless. Mirrors `StartFreePlayResult`.
export type ApplyScenarioPackResult = { ok: true } | { ok: false; needsConfirmation: true }

// Saving a pack adds the same "user closed the dialog without choosing a
// destination" outcome as `PickScenarioPackResult`, plus a write error.
export type SaveScenarioPackResult =
  | { ok: true; filePath: string }
  | { ok: false; error: string }
  | { ok: false; canceled: true }
