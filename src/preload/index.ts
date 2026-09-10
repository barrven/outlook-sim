import { contextBridge, ipcRenderer } from 'electron'
import type {
  CalendarItemPatch,
  ComposeOpenOptions,
  MailMessagePatch,
  NewCalendarItem,
  NewFolder,
  NewMailMessage,
  Persona,
  Settings,
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
    }
  },
  compose: {
    open: (options?: ComposeOpenOptions) => ipcRenderer.invoke('window:openCompose', options)
  },
  onMessagesChanged: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('data:messages-changed', listener)
    return () => ipcRenderer.removeListener('data:messages-changed', listener)
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  // @ts-expect-error (define in dts)
  window.api = api
}
