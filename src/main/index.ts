import { readFileSync } from 'fs'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import type { ComposeOpenOptions, PickScenarioPackResult } from '../shared/data-types'
import { SimClock } from './data/clock'
import { ConfigStore } from './data/config'
import { MailDb } from './data/db'
import {
  broadcastMessagesChanged,
  broadcastReminderFired,
  broadcastUnsolicitedMailFailed,
  registerDataIpcHandlers
} from './data/ipc'
import { ReminderScheduler } from './data/reminderScheduler'
import { ScenarioMailScheduler } from './data/scenarioMailScheduler'
import { validateScenarioPack } from './data/scenarioPack'
import { UnsolicitedMailScheduler } from './llm/scheduler'
import { createComposeWindow, createMainWindow } from './windows'

app.whenReady().then(() => {
  const userDataDir = app.getPath('userData')
  const mailDb = new MailDb(userDataDir)
  const configStore = new ConfigStore(userDataDir)
  const simClock = new SimClock(userDataDir)
  registerDataIpcHandlers(mailDb, configStore, simClock)

  const scheduler = new UnsolicitedMailScheduler(
    mailDb,
    configStore,
    simClock,
    () => broadcastMessagesChanged(),
    (error) => broadcastUnsolicitedMailFailed(error)
  )
  scheduler.start()

  const reminderScheduler = new ReminderScheduler(mailDb, simClock, (item) => broadcastReminderFired(item))
  reminderScheduler.start()

  const scenarioMailScheduler = new ScenarioMailScheduler(mailDb, configStore, simClock, () =>
    broadcastMessagesChanged()
  )
  scenarioMailScheduler.start()

  const mainWindow = createMainWindow()

  ipcMain.handle('window:openCompose', (_event, options?: ComposeOpenOptions) => {
    createComposeWindow(mainWindow, options)
  })

  ipcMain.handle('scenario:pickPack', async (): Promise<PickScenarioPackResult> => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Load Scenario Pack',
      filters: [{ name: 'Scenario Pack', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) {
      return { ok: false, canceled: true }
    }
    let data: unknown
    try {
      data = JSON.parse(readFileSync(filePaths[0], 'utf-8'))
    } catch (error) {
      return { ok: false, error: `Could not read or parse file: ${(error as Error).message}` }
    }
    return validateScenarioPack(data)
  })

  // Freeze simulated time on quit so it doesn't silently advance while the
  // app is closed — reopening should resume exactly where it left off, not
  // jump forward by however long the app was shut.
  app.on('before-quit', () => {
    simClock.pause()
    scheduler.stop()
    reminderScheduler.stop()
    scenarioMailScheduler.stop()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
