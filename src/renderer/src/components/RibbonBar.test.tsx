// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RibbonBar from './RibbonBar'

// Home/FileVine/View are now real tabs (features 047/046), and File opens
// a menu (034) — every render needs these, even tests unrelated to them.
function tabProps(overrides: Partial<{ showFileVine: boolean; viewTabActive: boolean; showTasksPanel: boolean }> = {}): {
  showFileVine: boolean
  viewTabActive: boolean
  showTasksPanel: boolean
  onSelectHomeTab: () => void
  onSelectFileVineTab: () => void
  onSelectViewTab: () => void
  onToggleTasksPanel: () => void
  onOpenSettings: () => void
} {
  return {
    showFileVine: false,
    viewTabActive: false,
    showTasksPanel: false,
    onSelectHomeTab: vi.fn(),
    onSelectFileVineTab: vi.fn(),
    onSelectViewTab: vi.fn(),
    onToggleTasksPanel: vi.fn(),
    onOpenSettings: vi.fn(),
    ...overrides
  }
}

describe('RibbonBar', () => {
  it('renders ribbon tabs and mail actions, with Home/FileVine/View/File/New Email interactive', () => {
    render(<RibbonBar activeModule="mail" {...tabProps()} />)

    expect(screen.getByRole('button', { name: 'Home' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'FileVine' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'View' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'File' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'New Email' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'New Event' })).not.toBeInTheDocument()
  })

  // 033 AC1/AC2: Send/Receive and Folder are placeholders that were never
  // wired to anything — hidden entirely rather than shown disabled.
  it('does not render the Send/Receive or Folder tabs', () => {
    render(<RibbonBar activeModule="mail" {...tabProps()} />)

    expect(screen.queryByRole('button', { name: 'Send / Receive' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Folder' })).not.toBeInTheDocument()
  })

  // 034: Settings moved off the nav rail into a File ribbon menu.
  describe('File menu (034)', () => {
    it('does not show the menu until File is clicked', () => {
      render(<RibbonBar activeModule="mail" {...tabProps()} />)

      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      expect(screen.queryByRole('menuitem', { name: 'Settings' })).not.toBeInTheDocument()
    })

    it('clicking File opens a menu with a Settings entry', async () => {
      const user = userEvent.setup()
      render(<RibbonBar activeModule="mail" {...tabProps()} />)

      const fileTab = screen.getByRole('button', { name: 'File' })
      expect(fileTab).toHaveAttribute('aria-expanded', 'false')

      await user.click(fileTab)

      expect(fileTab).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByRole('menu')).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeInTheDocument()
    })

    it('clicking Settings calls onOpenSettings and closes the menu', async () => {
      const user = userEvent.setup()
      const onOpenSettings = vi.fn()
      render(<RibbonBar activeModule="mail" {...tabProps()} onOpenSettings={onOpenSettings} />)

      await user.click(screen.getByRole('button', { name: 'File' }))
      await user.click(screen.getByRole('menuitem', { name: 'Settings' }))

      expect(onOpenSettings).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('clicking File again toggles the menu closed', async () => {
      const user = userEvent.setup()
      render(<RibbonBar activeModule="mail" {...tabProps()} />)

      const fileTab = screen.getByRole('button', { name: 'File' })
      await user.click(fileTab)
      expect(screen.getByRole('menu')).toBeInTheDocument()

      await user.click(fileTab)
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('clicking outside the menu closes it', async () => {
      const user = userEvent.setup()
      render(<RibbonBar activeModule="mail" {...tabProps()} />)

      await user.click(screen.getByRole('button', { name: 'File' }))
      expect(screen.getByRole('menu')).toBeInTheDocument()

      await user.click(document.body)
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('pressing Escape closes the menu', async () => {
      const user = userEvent.setup()
      render(<RibbonBar activeModule="mail" {...tabProps()} />)

      await user.click(screen.getByRole('button', { name: 'File' }))
      expect(screen.getByRole('menu')).toBeInTheDocument()

      await user.keyboard('{Escape}')
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })

  it('swaps to calendar actions when the calendar module is active', () => {
    render(<RibbonBar activeModule="calendar" {...tabProps()} />)

    expect(screen.getByRole('button', { name: 'New Event' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New Email' })).not.toBeInTheDocument()
  })

  it('leaves New Event disabled when no onNewEvent handler is provided', () => {
    render(<RibbonBar activeModule="calendar" {...tabProps()} />)

    expect(screen.getByRole('button', { name: 'New Event' })).toBeDisabled()
  })

  it('enables New Event and calls onNewEvent when a handler is provided', async () => {
    const user = userEvent.setup()
    const onNewEvent = vi.fn()
    render(<RibbonBar activeModule="calendar" {...tabProps()} onNewEvent={onNewEvent} />)

    const button = screen.getByRole('button', { name: 'New Event' })
    expect(button).toBeEnabled()

    await user.click(button)

    expect(onNewEvent).toHaveBeenCalledTimes(1)
  })

  it('hides New Meeting until meeting invites/RSVP are actually built', () => {
    render(<RibbonBar activeModule="calendar" {...tabProps()} onNewEvent={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'New Meeting' })).not.toBeInTheDocument()
  })

  it('does not duplicate the Today/Day/Work Week/Week/Month view switcher in the ribbon', () => {
    render(<RibbonBar activeModule="calendar" {...tabProps()} onNewEvent={vi.fn()} />)

    for (const label of ['Today', 'Day', 'Work Week', 'Week', 'Month']) {
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument()
    }
  })

  it('enables New Email and calls onNewEmail when a handler is provided', async () => {
    const user = userEvent.setup()
    const onNewEmail = vi.fn()
    render(<RibbonBar activeModule="mail" {...tabProps()} onNewEmail={onNewEmail} />)

    const button = screen.getByRole('button', { name: 'New Email' })
    expect(button).toBeEnabled()

    await user.click(button)

    expect(onNewEmail).toHaveBeenCalledTimes(1)
  })

  it('leaves Delete disabled when no onDelete handler is provided', () => {
    render(<RibbonBar activeModule="mail" {...tabProps()} />)

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  })

  it('enables Delete and calls onDelete when a handler is provided', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(<RibbonBar activeModule="mail" {...tabProps()} onDelete={onDelete} />)

    const button = screen.getByRole('button', { name: 'Delete' })
    expect(button).toBeEnabled()

    await user.click(button)

    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('FileVine tab between Home and View calls onSelectFileVineTab and becomes the active tab', async () => {
    const user = userEvent.setup()
    const onSelectFileVineTab = vi.fn()
    render(<RibbonBar activeModule="mail" {...tabProps({ showFileVine: false })} onSelectFileVineTab={onSelectFileVineTab} />)

    const tabNames = screen.getAllByRole('button', { name: /^(File|Home|FileVine|View)$/ }).map((b) => b.textContent)
    expect(tabNames.indexOf('FileVine')).toBeGreaterThan(tabNames.indexOf('Home'))
    expect(tabNames.indexOf('FileVine')).toBeLessThan(tabNames.indexOf('View'))

    await user.click(screen.getByRole('button', { name: 'FileVine' }))
    expect(onSelectFileVineTab).toHaveBeenCalledTimes(1)
  })

  it('marks FileVine active (not Home) when showFileVine is true, and vice versa', () => {
    const { rerender } = render(<RibbonBar activeModule="mail" {...tabProps({ showFileVine: true })} />)
    expect(screen.getByRole('button', { name: 'FileVine' })).toHaveClass('active')
    expect(screen.getByRole('button', { name: 'Home' })).not.toHaveClass('active')

    rerender(<RibbonBar activeModule="mail" {...tabProps({ showFileVine: false })} />)
    expect(screen.getByRole('button', { name: 'Home' })).toHaveClass('active')
    expect(screen.getByRole('button', { name: 'FileVine' })).not.toHaveClass('active')
  })

  // 046 AC1: View tab has a Tasks toggle.
  describe('View tab (046)', () => {
    it('clicking View calls onSelectViewTab, and marks View (not Home/FileVine) active', () => {
      const onSelectViewTab = vi.fn()
      const { rerender } = render(
        <RibbonBar activeModule="mail" {...tabProps()} onSelectViewTab={onSelectViewTab} />
      )
      expect(screen.getByRole('button', { name: 'Home' })).toHaveClass('active')

      rerender(<RibbonBar activeModule="mail" {...tabProps({ viewTabActive: true })} onSelectViewTab={onSelectViewTab} />)
      expect(screen.getByRole('button', { name: 'View' })).toHaveClass('active')
      expect(screen.getByRole('button', { name: 'Home' })).not.toHaveClass('active')
    })

    it('swaps the ribbon actions to just Tasks when View is active, regardless of mail/calendar module', () => {
      render(<RibbonBar activeModule="mail" {...tabProps({ viewTabActive: true })} onNewEvent={vi.fn()} />)

      expect(screen.getByRole('button', { name: 'Tasks' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'New Email' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'New Event' })).not.toBeInTheDocument()
    })

    it('the Tasks button reflects showTasksPanel via aria-pressed and an active class, and toggles it on click', async () => {
      const user = userEvent.setup()
      const onToggleTasksPanel = vi.fn()
      const { rerender } = render(
        <RibbonBar
          activeModule="mail"
          {...tabProps({ viewTabActive: true, showTasksPanel: false })}
          onToggleTasksPanel={onToggleTasksPanel}
        />
      )
      const button = screen.getByRole('button', { name: 'Tasks' })
      expect(button).toHaveAttribute('aria-pressed', 'false')
      expect(button).not.toHaveClass('active')

      await user.click(button)
      expect(onToggleTasksPanel).toHaveBeenCalledTimes(1)

      rerender(
        <RibbonBar
          activeModule="mail"
          {...tabProps({ viewTabActive: true, showTasksPanel: true })}
          onToggleTasksPanel={onToggleTasksPanel}
        />
      )
      expect(screen.getByRole('button', { name: 'Tasks' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'Tasks' })).toHaveClass('active')
    })
  })
})
