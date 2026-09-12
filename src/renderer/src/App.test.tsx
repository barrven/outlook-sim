// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { CalendarItem, MailMessage } from '../../shared/data-types'

function makeCalendarItem(overrides: Partial<CalendarItem> = {}): CalendarItem {
  return {
    id: 'cal-1',
    title: 'Filing deadline',
    description: '',
    startTime: new Date(2026, 2, 11, 15, 0).getTime(),
    endTime: null,
    allDay: false,
    reminderMinutesBefore: 15,
    recurrenceRule: null,
    itemType: 'deadline',
    reminderFired: true,
    ...overrides
  }
}

describe('App shell', () => {
  it('renders the classic three-pane layout with a ribbon on launch', async () => {
    render(<App />)

    expect(screen.getByRole('tablist', { name: 'Ribbon tabs' })).toBeInTheDocument()
    expect(screen.getByText('Mailbox')).toBeInTheDocument() // left folder pane
    expect(await screen.findByRole('button', { name: 'Inbox' })).toBeInTheDocument()
    expect(await screen.findByText('Inbox', { selector: '.message-list-header' })).toBeInTheDocument() // center message list
    expect(screen.getByText('Select an item to read.')).toBeInTheDocument() // right reading pane
  })

  it('exposes only Mail and Calendar as switchable modules', () => {
    render(<App />)

    const tabs = screen.getByRole('tablist', { name: 'Modules' })
    const moduleNames = Array.from(tabs.querySelectorAll('[role="tab"]')).map((el) => el.textContent)

    expect(moduleNames).toEqual(['Mail', 'Calendar'])
    for (const disallowed of ['People', 'Tasks', 'Notes']) {
      expect(screen.queryByText(disallowed)).not.toBeInTheDocument()
    }
  })

  it('switches from Mail to Calendar and renders the calendar shell', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByRole('button', { name: 'Inbox' })).toBeInTheDocument()
    expect(screen.queryByText('My Calendars')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Calendar' }))

    expect(screen.getByText('My Calendars')).toBeInTheDocument()
    expect(screen.getByText('No calendar items to show.')).toBeInTheDocument()
    expect(screen.queryByText('Mailbox')).not.toBeInTheDocument()
    expect(screen.queryByText('Select an item to read.')).not.toBeInTheDocument()
  })

  it('ribbon New Event opens the calendar create-event form, and switching modules closes it', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('tab', { name: 'Calendar' }))
    expect(screen.queryByRole('dialog', { name: 'New Event' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'New Event' }))
    expect(await screen.findByRole('dialog', { name: 'New Event' })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Mail' }))
    await user.click(screen.getByRole('tab', { name: 'Calendar' }))

    expect(screen.queryByRole('dialog', { name: 'New Event' })).not.toBeInTheDocument()
  })

  it('switches the ribbon actions when the active module changes', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('button', { name: 'New Email' })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Calendar' }))

    expect(screen.getByRole('button', { name: 'New Event' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New Email' })).not.toBeInTheDocument()
  })

  it('selecting a mail folder updates the message list header', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByText('Inbox', { selector: '.message-list-header' })).toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: 'Drafts' }))

    expect(await screen.findByText('Drafts', { selector: '.message-list-header' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Drafts' })).toHaveClass('selected')
  })

  it('selecting a message renders it in the reading pane, and switching folders clears the selection', async () => {
    const user = userEvent.setup()
    const message: MailMessage = {
      id: 'msg-1',
      folderId: 'inbox',
      previousFolderId: null,
      subject: 'Hello there',
      body: 'Body text',
      fromName: 'Alex',
      fromEmail: 'alex@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      cc: [],
      timestamp: Date.now(),
      isRead: false,
      isFlagged: false,
      categories: [],
      attachments: []
    }
    vi.mocked(window.api.data.messages.list).mockResolvedValue([message])
    vi.mocked(window.api.data.messages.get).mockResolvedValue(message)

    render(<App />)

    await user.click(await screen.findByText('Hello there'))
    expect(await screen.findByText('Body text')).toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: 'Drafts' }))
    expect(screen.getByText('Select an item to read.')).toBeInTheDocument()
    expect(screen.queryByText('Body text')).not.toBeInTheDocument()
  })

  it('opens a reply/reply-all/forward compose window for the selected message', async () => {
    const user = userEvent.setup()
    const message: MailMessage = {
      id: 'msg-1',
      folderId: 'inbox',
      previousFolderId: null,
      subject: 'Hello there',
      body: 'Body text',
      fromName: 'Alex',
      fromEmail: 'alex@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      cc: [],
      timestamp: Date.now(),
      isRead: false,
      isFlagged: false,
      categories: [],
      attachments: []
    }
    vi.mocked(window.api.data.messages.list).mockResolvedValue([message])
    vi.mocked(window.api.data.messages.get).mockResolvedValue(message)

    const { container } = render(<App />)

    await user.click(await screen.findByText('Hello there'))
    await screen.findByText('Body text')
    const readingPane = within(container.querySelector('.reading-pane') as HTMLElement)

    await user.click(readingPane.getByRole('button', { name: 'Reply' }))
    expect(window.api.compose.open).toHaveBeenCalledWith({ sourceMessageId: 'msg-1', intent: 'reply' })

    await user.click(readingPane.getByRole('button', { name: 'Reply All' }))
    expect(window.api.compose.open).toHaveBeenCalledWith({ sourceMessageId: 'msg-1', intent: 'replyAll' })

    await user.click(readingPane.getByRole('button', { name: 'Forward' }))
    expect(window.api.compose.open).toHaveBeenCalledWith({ sourceMessageId: 'msg-1', intent: 'forward' })
  })

  it('deleting a message moves it to Deleted Items and clears the selection', async () => {
    const user = userEvent.setup()
    const message: MailMessage = {
      id: 'msg-1',
      folderId: 'inbox',
      previousFolderId: null,
      subject: 'Hello there',
      body: 'Body text',
      fromName: 'Alex',
      fromEmail: 'alex@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      cc: [],
      timestamp: Date.now(),
      isRead: false,
      isFlagged: false,
      categories: [],
      attachments: []
    }
    vi.mocked(window.api.data.messages.list).mockResolvedValue([message])
    vi.mocked(window.api.data.messages.get).mockResolvedValue(message)

    const { container } = render(<App />)

    await user.click(await screen.findByText('Hello there'))
    await screen.findByText('Body text')
    const readingPane = within(container.querySelector('.reading-pane') as HTMLElement)

    await user.click(readingPane.getByRole('button', { name: 'Delete' }))

    expect(window.api.data.messages.update).toHaveBeenCalledWith('msg-1', {
      folderId: 'deleted',
      previousFolderId: 'inbox'
    })
    expect(await screen.findByText('Select an item to read.')).toBeInTheDocument()
    expect(screen.queryByText('Body text')).not.toBeInTheDocument()
  })

  it('ribbon Delete is disabled with nothing selected, enables once a message is selected, and deletes it', async () => {
    const user = userEvent.setup()
    const message: MailMessage = {
      id: 'msg-1',
      folderId: 'inbox',
      previousFolderId: null,
      subject: 'Hello there',
      body: 'Body text',
      fromName: 'Alex',
      fromEmail: 'alex@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      cc: [],
      timestamp: Date.now(),
      isRead: false,
      isFlagged: false,
      categories: [],
      attachments: []
    }
    vi.mocked(window.api.data.messages.list).mockResolvedValue([message])
    vi.mocked(window.api.data.messages.get).mockResolvedValue(message)

    const { container } = render(<App />)
    const ribbonActions = within(container.querySelector('.ribbon-actions') as HTMLElement)

    await screen.findByRole('button', { name: 'Inbox' })
    expect(ribbonActions.getByRole('button', { name: 'Delete' })).toBeDisabled()

    await user.click(await screen.findByText('Hello there'))
    await screen.findByText('Body text')
    expect(ribbonActions.getByRole('button', { name: 'Delete' })).toBeEnabled()

    await user.click(ribbonActions.getByRole('button', { name: 'Delete' }))

    expect(window.api.data.messages.update).toHaveBeenCalledWith('msg-1', {
      folderId: 'deleted',
      previousFolderId: 'inbox'
    })
    expect(await screen.findByText('Select an item to read.')).toBeInTheDocument()
  })

  it('ribbon Delete stays disabled while viewing Deleted Items even with a message selected', async () => {
    const user = userEvent.setup()
    const deletedMessage: MailMessage = {
      id: 'msg-1',
      folderId: 'deleted',
      previousFolderId: 'inbox',
      subject: 'Hello there',
      body: 'Body text',
      fromName: 'Alex',
      fromEmail: 'alex@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      cc: [],
      timestamp: Date.now(),
      isRead: false,
      isFlagged: false,
      categories: [],
      attachments: []
    }
    vi.mocked(window.api.data.messages.list).mockResolvedValue([deletedMessage])
    vi.mocked(window.api.data.messages.get).mockResolvedValue(deletedMessage)

    const { container } = render(<App />)
    const ribbonActions = within(container.querySelector('.ribbon-actions') as HTMLElement)

    await user.click(await screen.findByRole('button', { name: 'Deleted Items' }))
    await user.click(await screen.findByText('Hello there'))
    await screen.findByText('Body text')

    expect(ribbonActions.getByRole('button', { name: 'Delete' })).toBeDisabled()
  })

  it('restoring a message from Deleted Items returns it to its previous folder and clears the selection', async () => {
    const user = userEvent.setup()
    const deletedMessage: MailMessage = {
      id: 'msg-1',
      folderId: 'deleted',
      previousFolderId: 'sent',
      subject: 'Hello there',
      body: 'Body text',
      fromName: 'Alex',
      fromEmail: 'alex@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      cc: [],
      timestamp: Date.now(),
      isRead: false,
      isFlagged: false,
      categories: [],
      attachments: []
    }
    vi.mocked(window.api.data.messages.list).mockResolvedValue([deletedMessage])
    vi.mocked(window.api.data.messages.get).mockResolvedValue(deletedMessage)

    const { container } = render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Deleted Items' }))
    await user.click(await screen.findByText('Hello there'))
    await screen.findByText('Body text')
    const readingPane = within(container.querySelector('.reading-pane') as HTMLElement)

    await user.click(readingPane.getByRole('button', { name: 'Restore' }))

    expect(window.api.data.messages.update).toHaveBeenCalledWith('msg-1', {
      folderId: 'sent',
      previousFolderId: null
    })
    expect(await screen.findByText('Select an item to read.')).toBeInTheDocument()
  })

  it('permanently deleting a message from Deleted Items removes it and clears the selection', async () => {
    const user = userEvent.setup()
    const deletedMessage: MailMessage = {
      id: 'msg-1',
      folderId: 'deleted',
      previousFolderId: 'inbox',
      subject: 'Hello there',
      body: 'Body text',
      fromName: 'Alex',
      fromEmail: 'alex@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      cc: [],
      timestamp: Date.now(),
      isRead: false,
      isFlagged: false,
      categories: [],
      attachments: []
    }
    vi.mocked(window.api.data.messages.list).mockResolvedValue([deletedMessage])
    vi.mocked(window.api.data.messages.get).mockResolvedValue(deletedMessage)

    const { container } = render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Deleted Items' }))
    await user.click(await screen.findByText('Hello there'))
    await screen.findByText('Body text')
    const readingPane = within(container.querySelector('.reading-pane') as HTMLElement)

    await user.click(readingPane.getByRole('button', { name: 'Delete permanently' }))

    expect(window.api.data.messages.delete).toHaveBeenCalledWith('msg-1')
    expect(await screen.findByText('Select an item to read.')).toBeInTheDocument()
  })

  it('opens Settings from the nav rail, replacing the mail panes, and returns to Mail when that tab is clicked', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByText('Inbox', { selector: '.message-list-header' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Settings' }))

    expect(await screen.findByLabelText('Provider')).toBeInTheDocument()
    expect(screen.queryByText('Inbox', { selector: '.message-list-header' })).not.toBeInTheDocument()
    expect(screen.queryByText('Select an item to read.')).not.toBeInTheDocument()
    // nav rail (folder pane + module switcher) stays visible while Settings is open
    expect(screen.getByText('Mailbox')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Mail' })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Mail' }))

    expect(await screen.findByText('Inbox', { selector: '.message-list-header' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Provider')).not.toBeInTheDocument()
  })

  it('starting free-play from Settings clears a previously-selected message', async () => {
    const user = userEvent.setup()
    const message: MailMessage = {
      id: 'msg-1',
      folderId: 'inbox',
      previousFolderId: null,
      subject: 'Hello there',
      body: 'Body text',
      fromName: 'Alex',
      fromEmail: 'alex@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      cc: [],
      timestamp: Date.now(),
      isRead: false,
      isFlagged: false,
      categories: [],
      attachments: []
    }
    vi.mocked(window.api.data.messages.list).mockResolvedValue([message])
    vi.mocked(window.api.data.messages.get).mockResolvedValue(message)
    vi.mocked(window.api.session.startFreePlay).mockResolvedValue({ ok: true })

    render(<App />)

    await user.click(await screen.findByText('Hello there'))
    await screen.findByText('Body text')

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: 'Start Free-Play' }))
    await screen.findByText(/fresh and empty/)

    await user.click(screen.getByRole('tab', { name: 'Mail' }))

    expect(await screen.findByText('Select an item to read.')).toBeInTheDocument()
  })

  it('shows a dismissible banner when a persona reply generation fails, and does not show one otherwise', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'Inbox' })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    const [onPersonaReplyFailed] = vi.mocked(window.api.onPersonaReplyFailed).mock.calls[0]
    onPersonaReplyFailed('openai API error (401): Incorrect API key provided.')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Persona reply failed: openai API error (401): Incorrect API key provided.'
    )

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a dismissible banner when unsolicited mail generation fails', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'Inbox' })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    const [onUnsolicitedMailFailed] = vi.mocked(window.api.onUnsolicitedMailFailed).mock.calls[0]
    onUnsolicitedMailFailed('Network error: fetch failed')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unsolicited mail generation failed: Network error: fetch failed'
    )

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a dismissible banner when a calendar reminder fires', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'Inbox' })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    const [onReminderFired] = vi.mocked(window.api.onReminderFired).mock.calls[0]
    onReminderFired(makeCalendarItem({ title: 'Filing deadline' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Reminder: "Filing deadline"')

    await user.click(screen.getByRole('button', { name: 'Dismiss reminder' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows multiple fired-reminder banners independently, each dismissible on its own', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'Inbox' })

    const [onReminderFired] = vi.mocked(window.api.onReminderFired).mock.calls[0]
    onReminderFired(makeCalendarItem({ id: 'cal-1', title: 'Filing deadline' }))
    onReminderFired(makeCalendarItem({ id: 'cal-2', title: 'Client call' }))

    expect(await screen.findByText(/Filing deadline/)).toBeInTheDocument()
    expect(screen.getByText(/Client call/)).toBeInTheDocument()

    const dismissButtons = screen.getAllByRole('button', { name: 'Dismiss reminder' })
    await user.click(dismissButtons[0])

    expect(screen.queryByText(/Filing deadline/)).not.toBeInTheDocument()
    expect(screen.getByText(/Client call/)).toBeInTheDocument()
  })

  it('leaving Settings via the Calendar tab shows the calendar, not stale mail panes', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    await screen.findByLabelText('Provider')

    await user.click(screen.getByRole('tab', { name: 'Calendar' }))

    expect(screen.getByText('My Calendars')).toBeInTheDocument()
    expect(screen.queryByLabelText('Provider')).not.toBeInTheDocument()
  })
})
