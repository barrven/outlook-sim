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

export interface CalendarItem {
  id: string
  title: string
  description: string
  startTime: number
  endTime: number | null
  allDay: boolean
  reminderMinutesBefore: number | null
  recurrenceRule: string | null
  itemType: CalendarItemType
}

export type NewCalendarItem = Omit<CalendarItem, 'id'>

export type CalendarItemPatch = Partial<Omit<CalendarItem, 'id'>>

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

export interface SystemPromptConfig {
  systemPrompt: string
}

export interface TraineeIdentity {
  displayName: string
  jobTitle: string
  fromEmail: string
}

export interface Persona {
  id: string
  displayName: string
  email: string
  role: string
  bio: string
  writingStyleNotes: string
  extraPrompt: string
}

export interface PersonasConfig {
  personas: Persona[]
}

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
