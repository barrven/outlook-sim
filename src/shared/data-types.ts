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
  'id' | 'isRead' | 'isFlagged' | 'categories' | 'attachments' | 'cc'
> &
  Partial<Pick<MailMessage, 'isRead' | 'isFlagged' | 'categories' | 'attachments' | 'cc'>>

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
