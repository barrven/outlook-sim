import { existsSync } from 'fs'
import { join } from 'path'
import { describe, expect, it, vi } from 'vitest'
import type { BrowserWindow as ElectronBrowserWindow } from 'electron'

const workArea = { x: 0, y: 0, width: 1920, height: 1080 }

class MockBrowserWindow {
  options: Record<string, unknown>
  webContents = { setWindowOpenHandler: vi.fn() }
  setBounds = vi.fn()
  show = vi.fn()
  focus = vi.fn()
  once = vi.fn()
  loadFile = vi.fn()
  loadURL = vi.fn()

  constructor(options: Record<string, unknown>) {
    this.options = options
  }
}

vi.mock('electron', () => ({
  BrowserWindow: MockBrowserWindow,
  screen: { getPrimaryDisplay: () => ({ workArea }) },
  shell: { openExternal: vi.fn() }
}))

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false } }))

const { createMainWindow, createComposeWindow, createMessagePopoutWindow, createCalendarPopoutWindow } =
  await import('./windows')

function asMock(win: ElectronBrowserWindow): MockBrowserWindow {
  return win as unknown as MockBrowserWindow
}

describe('window icon (036)', () => {
  it('resolves the icon to the resources/email.png asset that ships with the app', () => {
    const main = asMock(createMainWindow())

    expect(main.options.icon).toBe(join(__dirname, '../../resources/email.png'))
    expect(existsSync(main.options.icon as string)).toBe(true)
  })

  it('gives the compose window the same icon as the main window', () => {
    const main = asMock(createMainWindow())
    const compose = asMock(createComposeWindow(main as unknown as ElectronBrowserWindow))

    expect(compose.options.icon).toBe(main.options.icon)
  })

  it('gives the message pop-out window the same icon as the main window', () => {
    const main = asMock(createMainWindow())
    const popout = asMock(
      createMessagePopoutWindow(main as unknown as ElectronBrowserWindow, 'msg-1', 'Subject')
    )

    expect(popout.options.icon).toBe(main.options.icon)
  })

  it('044: gives the calendar pop-out window the same icon as the main window', () => {
    const main = asMock(createMainWindow())
    const popout = asMock(
      createCalendarPopoutWindow(main as unknown as ElectronBrowserWindow, 'series-1', 1000, 'Team sync')
    )

    expect(popout.options.icon).toBe(main.options.icon)
  })
})
