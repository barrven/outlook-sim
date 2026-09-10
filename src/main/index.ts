import { app, BrowserWindow, ipcMain } from 'electron'
import { ConfigStore } from './data/config'
import { MailDb } from './data/db'
import { registerDataIpcHandlers } from './data/ipc'
import { createComposeWindow, createMainWindow } from './windows'

app.whenReady().then(() => {
  const userDataDir = app.getPath('userData')
  const mailDb = new MailDb(userDataDir)
  const configStore = new ConfigStore(userDataDir)
  registerDataIpcHandlers(mailDb, configStore)

  const mainWindow = createMainWindow()

  ipcMain.handle('window:openCompose', (_event, draftId?: string) => {
    createComposeWindow(mainWindow, draftId)
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
