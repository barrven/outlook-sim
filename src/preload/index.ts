import { contextBridge, ipcRenderer } from 'electron'
import type {
  ApplyScenarioPackResult,
  CalendarItemPatch,
  ComposeOpenOptions,
  FileVineFolderPatch,
  FileVineNotePatch,
  FiredReminder,
  LlmGenerateInput,
  MailMessagePatch,
  NewCalendarItem,
  NewFileVineFolder,
  NewFileVineNote,
  NewFolder,
  NewMailMessage,
  Persona,
  PickScenarioPackResult,
  SaveScenarioPackResult,
  ScenarioPack,
  Settings,
  StartFreePlayResult,
  SystemPromptConfig,
  TraineeIdentity
} from '../shared/data-types'

const api = {
  data: {
    folders: {
      list: () => ipcRenderer.invoke('db:folders:list'),
      create: (folder: NewFolder) => ipcRenderer.invoke('db:folders:create', folder),
      rename: (id: string, name: string) => ipcRenderer.invoke('db:folders:rename', id, name),
      delete: (id: string) => ipcRenderer.invoke('db:folders:delete', id)
    },
    messages: {
      list: (folderId?: string) => ipcRenderer.invoke('db:messages:list', folderId),
      get: (id: string) => ipcRenderer.invoke('db:messages:get', id),
      create: (message: NewMailMessage) => ipcRenderer.invoke('db:messages:create', message),
      update: (id: string, patch: MailMessagePatch) => ipcRenderer.invoke('db:messages:update', id, patch),
      delete: (id: string) => ipcRenderer.invoke('db:messages:delete', id)
    },
    calendarItems: {
      list: () => ipcRenderer.invoke('db:calendarItems:list'),
      get: (id: string) => ipcRenderer.invoke('db:calendarItems:get', id),
      create: (item: NewCalendarItem) => ipcRenderer.invoke('db:calendarItems:create', item),
      update: (id: string, patch: CalendarItemPatch) => ipcRenderer.invoke('db:calendarItems:update', id, patch),
      delete: (id: string) => ipcRenderer.invoke('db:calendarItems:delete', id)
    },
    fileVineFolders: {
      list: () => ipcRenderer.invoke('db:fileVineFolders:list'),
      get: (id: string) => ipcRenderer.invoke('db:fileVineFolders:get', id),
      create: (folder: NewFileVineFolder) => ipcRenderer.invoke('db:fileVineFolders:create', folder),
      update: (id: string, patch: FileVineFolderPatch) =>
        ipcRenderer.invoke('db:fileVineFolders:update', id, patch),
      delete: (id: string) => ipcRenderer.invoke('db:fileVineFolders:delete', id)
    },
    fileVineNotes: {
      list: (folderId: string) => ipcRenderer.invoke('db:fileVineNotes:list', folderId),
      get: (id: string) => ipcRenderer.invoke('db:fileVineNotes:get', id),
      create: (note: NewFileVineNote) => ipcRenderer.invoke('db:fileVineNotes:create', note),
      update: (id: string, patch: FileVineNotePatch) => ipcRenderer.invoke('db:fileVineNotes:update', id, patch),
      delete: (id: string) => ipcRenderer.invoke('db:fileVineNotes:delete', id)
    },
    settings: {
      get: () => ipcRenderer.invoke('config:settings:get'),
      set: (settings: Settings) => ipcRenderer.invoke('config:settings:set', settings)
    },
    systemPrompt: {
      get: () => ipcRenderer.invoke('config:systemPrompt:get'),
      set: (value: SystemPromptConfig) => ipcRenderer.invoke('config:systemPrompt:set', value)
    },
    identity: {
      get: () => ipcRenderer.invoke('config:identity:get'),
      set: (identity: TraineeIdentity) => ipcRenderer.invoke('config:identity:set', identity)
    },
    personas: {
      get: () => ipcRenderer.invoke('config:personas:get'),
      set: (personas: Persona[]) => ipcRenderer.invoke('config:personas:set', personas)
    },
    clock: {
      get: () => ipcRenderer.invoke('clock:get'),
      now: () => ipcRenderer.invoke('clock:now'),
      start: () => ipcRenderer.invoke('clock:start'),
      pause: () => ipcRenderer.invoke('clock:pause'),
      setSpeed: (speed: number) => ipcRenderer.invoke('clock:setSpeed', speed)
    }
  },
  compose: {
    open: (options?: ComposeOpenOptions) => ipcRenderer.invoke('window:openCompose', options)
  },
  session: {
    startFreePlay: (confirmed?: boolean): Promise<StartFreePlayResult> =>
      ipcRenderer.invoke('session:startFreePlay', confirmed)
  },
  scenario: {
    pickPack: (): Promise<PickScenarioPackResult> => ipcRenderer.invoke('scenario:pickPack'),
    applyPack: (pack: ScenarioPack, confirmed?: boolean): Promise<ApplyScenarioPackResult> =>
      ipcRenderer.invoke('scenario:applyPack', pack, confirmed),
    savePack: (): Promise<SaveScenarioPackResult> => ipcRenderer.invoke('scenario:savePack')
  },
  llm: {
    generate: (input: LlmGenerateInput) => ipcRenderer.invoke('llm:generate', input),
    test: (settings: Settings) => ipcRenderer.invoke('llm:test', settings),
    personaReply: (sentMessageId: string) => ipcRenderer.invoke('llm:personaReply', sentMessageId),
    retryUnsolicitedMail: () => ipcRenderer.invoke('llm:retryUnsolicitedMail')
  },
  onMessagesChanged: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('data:messages-changed', listener)
    return () => ipcRenderer.removeListener('data:messages-changed', listener)
  },
  onPersonaReplyFailed: (callback: (sentMessageId: string, error: string) => void) => {
    const listener = (_event: unknown, sentMessageId: string, error: string): void => callback(sentMessageId, error)
    ipcRenderer.on('llm:persona-reply-failed', listener)
    return () => ipcRenderer.removeListener('llm:persona-reply-failed', listener)
  },
  onUnsolicitedMailFailed: (callback: (error: string) => void) => {
    const listener = (_event: unknown, error: string): void => callback(error)
    ipcRenderer.on('llm:unsolicited-mail-failed', listener)
    return () => ipcRenderer.removeListener('llm:unsolicited-mail-failed', listener)
  },
  onReminderFired: (callback: (reminder: FiredReminder) => void) => {
    const listener = (_event: unknown, reminder: FiredReminder): void => callback(reminder)
    ipcRenderer.on('calendar:reminder-fired', listener)
    return () => ipcRenderer.removeListener('calendar:reminder-fired', listener)
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  // @ts-expect-error (define in dts)
  window.api = api
}
