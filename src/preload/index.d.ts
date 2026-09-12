import type {
  CalendarItem,
  CalendarItemPatch,
  ClockState,
  ComposeOpenOptions,
  Folder,
  LlmGenerateInput,
  LlmGenerateResult,
  MailMessage,
  MailMessagePatch,
  NewCalendarItem,
  NewFolder,
  NewMailMessage,
  Persona,
  Settings,
  StartFreePlayResult,
  SystemPromptConfig,
  TraineeIdentity
} from '../shared/data-types'

export interface DataApi {
  folders: {
    list: () => Promise<Folder[]>
    create: (folder: NewFolder) => Promise<Folder>
    rename: (id: string, name: string) => Promise<void>
    delete: (id: string) => Promise<void>
  }
  messages: {
    list: (folderId?: string) => Promise<MailMessage[]>
    get: (id: string) => Promise<MailMessage | null>
    create: (message: NewMailMessage) => Promise<MailMessage>
    update: (id: string, patch: MailMessagePatch) => Promise<MailMessage | null>
    delete: (id: string) => Promise<void>
  }
  calendarItems: {
    list: () => Promise<CalendarItem[]>
    get: (id: string) => Promise<CalendarItem | null>
    create: (item: NewCalendarItem) => Promise<CalendarItem>
    update: (id: string, patch: CalendarItemPatch) => Promise<CalendarItem | null>
    delete: (id: string) => Promise<void>
  }
  settings: {
    get: () => Promise<Settings>
    set: (settings: Settings) => Promise<void>
  }
  systemPrompt: {
    get: () => Promise<SystemPromptConfig>
    set: (value: SystemPromptConfig) => Promise<void>
  }
  identity: {
    get: () => Promise<TraineeIdentity>
    set: (identity: TraineeIdentity) => Promise<void>
  }
  personas: {
    get: () => Promise<Persona[]>
    set: (personas: Persona[]) => Promise<void>
  }
  clock: {
    get: () => Promise<ClockState>
    now: () => Promise<number>
    start: () => Promise<ClockState>
    pause: () => Promise<ClockState>
    setSpeed: (speed: number) => Promise<ClockState>
  }
}

export interface ComposeApi {
  open: (options?: ComposeOpenOptions) => Promise<void>
}

export interface SessionApi {
  startFreePlay: (confirmed?: boolean) => Promise<StartFreePlayResult>
}

export interface LlmApi {
  generate: (input: LlmGenerateInput) => Promise<LlmGenerateResult>
  test: (settings: Settings) => Promise<LlmGenerateResult>
  personaReply: (sentMessageId: string) => Promise<void>
}

export {}

declare global {
  interface Window {
    api: {
      data: DataApi
      compose: ComposeApi
      session: SessionApi
      llm: LlmApi
      onMessagesChanged: (callback: () => void) => () => void
      onPersonaReplyFailed: (callback: (error: string) => void) => () => void
      onUnsolicitedMailFailed: (callback: (error: string) => void) => () => void
      onReminderFired: (callback: (item: CalendarItem) => void) => () => void
    }
  }
}
