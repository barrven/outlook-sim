import { join } from 'path'
import { app, BrowserWindow, screen, shell } from 'electron'
import { is } from '@electron-toolkit/utils'

function createMainWindow(): void {
  const workArea = screen.getPrimaryDisplay().workArea
  const width = Math.min(1280, workArea.width)
  const height = Math.min(800, workArea.height)
  const x = Math.round(workArea.x + (workArea.width - width) / 2)
  const y = Math.round(workArea.y + (workArea.height - height) / 2)

  const mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: Math.min(960, width),
    minHeight: Math.min(600, height),
    show: true,
    autoHideMenuBar: true,
    title: 'Outlook Trainer',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Native Wayland ignores constructor x/y; XWayland still sometimes places
  // the window on a secondary display. Re-assert bounds after the window exists.
  mainWindow.setBounds({ x, y, width, height })
  mainWindow.show()
  mainWindow.focus()

  mainWindow.once('ready-to-show', () => {
    mainWindow.setBounds({ x, y, width, height })
    mainWindow.show()
    mainWindow.focus()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createMainWindow()

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
