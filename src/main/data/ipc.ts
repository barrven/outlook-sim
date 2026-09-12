import { BrowserWindow, ipcMain } from 'electron'
import type {
  CalendarItem,
  CalendarItemPatch,
  LlmGenerateInput,
  MailMessagePatch,
  NewCalendarItem,
  NewFolder,
  NewMailMessage,
  Persona,
  Settings,
  StartFreePlayResult,
  SystemPromptConfig,
  TraineeIdentity
} from '../../shared/data-types'
import { generateText } from '../llm/client'
import { generatePersonaReply } from '../llm/personaReply'
import type { SimClock } from './clock'
import type { ConfigStore } from './config'
import type { MailDb } from './db'

export function broadcastMessagesChanged(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('data:messages-changed')
  }
}

function broadcastPersonaReplyFailed(error: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('llm:persona-reply-failed', error)
  }
}

export function broadcastUnsolicitedMailFailed(error: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('llm:unsolicited-mail-failed', error)
  }
}

export function broadcastReminderFired(item: CalendarItem): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('calendar:reminder-fired', item)
  }
}

export function registerDataIpcHandlers(db: MailDb, config: ConfigStore, clock: SimClock): void {
  ipcMain.handle('db:folders:list', () => db.listFolders())
  ipcMain.handle('db:folders:create', (_event, folder: NewFolder) => db.createFolder(folder))
  ipcMain.handle('db:folders:rename', (_event, id: string, name: string) => db.renameFolder(id, name))
  ipcMain.handle('db:folders:delete', (_event, id: string) => db.deleteFolder(id))

  ipcMain.handle('db:messages:list', (_event, folderId?: string) => db.listMessages(folderId))
  ipcMain.handle('db:messages:get', (_event, id: string) => db.getMessage(id))
  ipcMain.handle('db:messages:create', (_event, message: NewMailMessage) => {
    const created = db.createMessage(message)
    broadcastMessagesChanged()
    return created
  })
  ipcMain.handle('db:messages:update', (_event, id: string, patch: MailMessagePatch) => {
    const updated = db.updateMessage(id, patch)
    broadcastMessagesChanged()
    return updated
  })
  ipcMain.handle('db:messages:delete', (_event, id: string) => {
    db.deleteMessage(id)
    broadcastMessagesChanged()
  })

  ipcMain.handle('db:calendarItems:list', () => db.listCalendarItems())
  ipcMain.handle('db:calendarItems:get', (_event, id: string) => db.getCalendarItem(id))
  ipcMain.handle('db:calendarItems:create', (_event, item: NewCalendarItem) => db.createCalendarItem(item))
  ipcMain.handle('db:calendarItems:update', (_event, id: string, patch: CalendarItemPatch) =>
    db.updateCalendarItem(id, patch)
  )
  ipcMain.handle('db:calendarItems:delete', (_event, id: string) => db.deleteCalendarItem(id))

  ipcMain.handle('config:settings:get', () => config.getSettings())
  ipcMain.handle('config:settings:set', (_event, settings: Settings) => config.setSettings(settings))

  ipcMain.handle('config:systemPrompt:get', () => config.getSystemPrompt())
  ipcMain.handle('config:systemPrompt:set', (_event, value: SystemPromptConfig) => config.setSystemPrompt(value))

  ipcMain.handle('config:identity:get', () => config.getIdentity())
  ipcMain.handle('config:identity:set', (_event, identity: TraineeIdentity) => config.setIdentity(identity))

  ipcMain.handle('config:personas:get', () => config.getPersonas())
  ipcMain.handle('config:personas:set', (_event, personas: Persona[]) => config.setPersonas(personas))

  ipcMain.handle('clock:get', () => clock.getState())
  ipcMain.handle('clock:now', () => clock.now())
  ipcMain.handle('clock:start', () => clock.start())
  ipcMain.handle('clock:pause', () => clock.pause())
  ipcMain.handle('clock:setSpeed', (_event, speed: number) => clock.setSpeed(speed))

  ipcMain.handle('llm:generate', (_event, input: LlmGenerateInput) => generateText(config.getSettings(), input))
  ipcMain.handle('llm:test', (_event, settings: Settings) =>
    generateText(settings, { userPrompt: 'Reply with exactly one word: pong' })
  )
  ipcMain.handle('llm:personaReply', async (_event, sentMessageId: string) => {
    const result = await generatePersonaReply(db, config, clock, sentMessageId)
    if (!result.ok) {
      broadcastPersonaReplyFailed(result.error)
    } else if (result.replied) {
      broadcastMessagesChanged()
    }
    return result
  })

  ipcMain.handle('session:startFreePlay', (_event, confirmed?: boolean): StartFreePlayResult => {
    if (!confirmed && db.hasMailboxOrCalendarData()) {
      return { ok: false, needsConfirmation: true }
    }
    db.resetMailboxAndCalendar()
    broadcastMessagesChanged()
    return { ok: true }
  })
}
