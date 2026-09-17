import { join } from 'path'
import { BrowserWindow, screen, shell } from 'electron'
import { is } from '@electron-toolkit/utils'
import type { ComposeOpenOptions } from '../shared/data-types'

const COMPOSE_TITLES: Record<NonNullable<ComposeOpenOptions['intent']>, string> = {
  reply: 'Reply',
  replyAll: 'Reply All',
  forward: 'Forward'
}

const ICON_PATH = join(__dirname, '../../resources/email.png')

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
    icon: ICON_PATH,
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

export function createComposeWindow(parent: BrowserWindow, options?: ComposeOpenOptions): BrowserWindow {
  const { draftId, sourceMessageId, intent } = options ?? {}
  const title = draftId ? 'Edit Draft' : intent ? COMPOSE_TITLES[intent] : 'New Message'

  const composeWindow = new BrowserWindow({
    width: 640,
    height: 620,
    parent,
    autoHideMenuBar: true,
    title,
    backgroundColor: '#ffffff',
    icon: ICON_PATH,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  composeWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const query: Record<string, string> = { compose: '1' }
  if (draftId) query.draftId = draftId
  if (sourceMessageId) query.sourceMessageId = sourceMessageId
  if (intent) query.intent = intent
  loadRenderer(composeWindow, query)

  return composeWindow
}

export function createMessagePopoutWindow(parent: BrowserWindow, messageId: string, title: string): BrowserWindow {
  const popoutWindow = new BrowserWindow({
    width: 640,
    height: 620,
    parent,
    autoHideMenuBar: true,
    title,
    backgroundColor: '#ffffff',
    icon: ICON_PATH,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  popoutWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  loadRenderer(popoutWindow, { messagePopout: '1', messageId })

  return popoutWindow
}

export function createCalendarPopoutWindow(
  parent: BrowserWindow,
  seriesId: string,
  originalStartTime: number,
  title: string
): BrowserWindow {
  const popoutWindow = new BrowserWindow({
    width: 480,
    height: 520,
    parent,
    autoHideMenuBar: true,
    title,
    backgroundColor: '#ffffff',
    icon: ICON_PATH,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  popoutWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  loadRenderer(popoutWindow, {
    calendarPopout: '1',
    seriesId,
    originalStartTime: String(originalStartTime)
  })

  return popoutWindow
}
