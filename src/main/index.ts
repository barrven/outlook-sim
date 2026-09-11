import { app, BrowserWindow, ipcMain } from 'electron'
import type { ComposeOpenOptions } from '../shared/data-types'
import { SimClock } from './data/clock'
import { ConfigStore } from './data/config'
import { MailDb } from './data/db'
import { broadcastMessagesChanged, broadcastUnsolicitedMailFailed, registerDataIpcHandlers } from './data/ipc'
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

  const mainWindow = createMainWindow()

  ipcMain.handle('window:openCompose', (_event, options?: ComposeOpenOptions) => {
    createComposeWindow(mainWindow, options)
  })

  // Freeze simulated time on quit so it doesn't silently advance while the
  // app is closed — reopening should resume exactly where it left off, not
  // jump forward by however long the app was shut.
  app.on('before-quit', () => {
    simClock.pause()
    scheduler.stop()
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
