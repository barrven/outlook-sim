import { join } from 'path'
import { BrowserWindow, screen, shell } from 'electron'
import { is } from '@electron-toolkit/utils'

function loadRenderer(window: BrowserWindow, query?: Record<string, string>): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = new URL(process.env['ELECTRON_RENDERER_URL'])
    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, value)
    }
    window.loadURL(url.toString())
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'), query ? { query } : undefined)
  }
}

export function createMainWindow(): BrowserWindow {
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

  loadRenderer(mainWindow)

  return mainWindow
}

export function createComposeWindow(parent: BrowserWindow, draftId?: string): BrowserWindow {
  const composeWindow = new BrowserWindow({
    width: 640,
    height: 620,
    parent,
    autoHideMenuBar: true,
    title: draftId ? 'Edit Draft' : 'New Message',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  composeWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  loadRenderer(composeWindow, draftId ? { compose: '1', draftId } : { compose: '1' })

  return composeWindow
}
