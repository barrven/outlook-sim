// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { FiredReminder, MailMessage } from '../../shared/data-types'

function makeFiredReminder(overrides: Partial<FiredReminder> = {}): FiredReminder {
  return {
    id: 'cal-1:1000',
    seriesId: 'cal-1',
    title: 'Filing deadline',
    startTime: new Date(2026, 2, 11, 15, 0).getTime(),
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

  // Message list multi-select (feature 039), end-to-end through the real
  // App/MessageListPane/ReadingPane wiring, not just the components in
  // isolation.
  it('039: Ctrl-click and Shift-click build a multi-selection, and the Reading Pane shows a neutral "N selected" state for it', async () => {
    const messages: MailMessage[] = ['a', 'b', 'c'].map((id, index) => ({
      id,
      folderId: 'inbox',
      previousFolderId: null,
      subject: ['Alpha', 'Bravo', 'Charlie'][index],
      body: 'Body text',
      fromName: 'Alex',
      fromEmail: 'alex@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      cc: [],
      timestamp: Date.now(),
      isRead: true,
      isFlagged: false,
      categories: [],
      attachments: []
    }))
    vi.mocked(window.api.data.messages.list).mockResolvedValue(messages)
    vi.mocked(window.api.data.messages.get).mockImplementation(
      async (id) => messages.find((message) => message.id === id) ?? null
    )

    render(<App />)
    await screen.findByText('Alpha')

    // Plain click selects Alpha alone; Reading Pane shows it.
    fireEvent.click(screen.getByText('Alpha'))
    expect(await screen.findByText('Body text')).toBeInTheDocument()

    // Ctrl-click adds Bravo — now 2 selected, neutral state.
    fireEvent.click(screen.getByText('Bravo'), { ctrlKey: true })
    expect(await screen.findByText('2 selected')).toBeInTheDocument()
    expect(screen.queryByText('Body text')).not.toBeInTheDocument()

    // A plain click on Charlie clears the multi-selection back to one.
    fireEvent.click(screen.getByText('Charlie'))
    expect(await screen.findByText('Body text')).toBeInTheDocument()
    expect(screen.queryByText('2 selected')).not.toBeInTheDocument()

    // Shift-click back to Alpha ranges across all three.
    fireEvent.click(screen.getByText('Alpha'), { shiftKey: true })
    expect(await screen.findByText('3 selected')).toBeInTheDocument()
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

  it('047 AC2: clicking the FileVine ribbon tab swaps the center/right content area, keeping the mail folder pane visible', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByText('Inbox', { selector: '.message-list-header' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'FileVine' }))

    expect(await screen.findByRole('heading', { name: 'FileVine' })).toBeInTheDocument()
    expect(screen.queryByText('Inbox', { selector: '.message-list-header' })).not.toBeInTheDocument()
    expect(screen.queryByText('Select an item to read.')).not.toBeInTheDocument()
    // left folder pane (mail folders) stays visible underneath, per spec
    expect(screen.getByText('Mailbox')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Inbox' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Home' }))

    expect(await screen.findByText('Inbox', { selector: '.message-list-header' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'FileVine' })).not.toBeInTheDocument()
  })

  it('047: selecting a mail folder while FileVine is open returns to the normal mail view', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'Inbox' })

    await user.click(screen.getByRole('button', { name: 'FileVine' }))
    await screen.findByRole('heading', { name: 'FileVine' })

    await user.click(screen.getByRole('button', { name: 'Inbox' }))

    expect(await screen.findByText('Inbox', { selector: '.message-list-header' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'FileVine' })).not.toBeInTheDocument()
  })

  it('047: switching to the Calendar module while FileVine is open closes it', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'Inbox' })

    await user.click(screen.getByRole('button', { name: 'FileVine' }))
    await screen.findByRole('heading', { name: 'FileVine' })

    await user.click(screen.getByRole('tab', { name: 'Calendar' }))

    expect(screen.getByText('My Calendars')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'FileVine' })).not.toBeInTheDocument()
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
    onPersonaReplyFailed('sent-1', 'openai API error (401): Incorrect API key provided.')

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

  it('027 AC1/AC2: a persona-reply failure banner offers Retry, which re-calls personaReply with the same sentMessageId', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.llm.personaReply).mockResolvedValue({ ok: false, error: 'still failing' })
    render(<App />)
    await screen.findByRole('button', { name: 'Inbox' })

    const [onPersonaReplyFailed] = vi.mocked(window.api.onPersonaReplyFailed).mock.calls[0]
    onPersonaReplyFailed('sent-42', 'bad key')
    const banner = await screen.findByRole('alert')

    expect(within(banner).getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(within(banner).getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()

    await user.click(within(banner).getByRole('button', { name: 'Retry' }))

    expect(window.api.llm.personaReply).toHaveBeenCalledWith('sent-42')
  })

  it('027 AC3: a successful Retry clears the persona-reply failure banner', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'Inbox' })

    const [onPersonaReplyFailed] = vi.mocked(window.api.onPersonaReplyFailed).mock.calls[0]
    onPersonaReplyFailed('sent-42', 'bad key')
    await screen.findByRole('alert')

    vi.mocked(window.api.llm.personaReply).mockResolvedValue({ ok: true, replied: false })
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('027 AC2: a second failure on Retry updates the existing banner instead of stacking a duplicate one', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'Inbox' })

    const [onPersonaReplyFailed] = vi.mocked(window.api.onPersonaReplyFailed).mock.calls[0]
    onPersonaReplyFailed('sent-1', 'first error')
    await screen.findByRole('alert')

    // A real Retry re-invokes the same IPC channel, whose main-process handler
    // re-broadcasts on a repeat failure — simulate that here since llm.personaReply
    // itself is mocked at the IPC boundary in these tests.
    vi.mocked(window.api.llm.personaReply).mockImplementation(async () => {
      onPersonaReplyFailed('sent-1', 'second error')
      return { ok: false, error: 'second error' }
    })
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('alert')).toHaveTextContent('Persona reply failed: second error')
  })

  it('027 AC1/AC2/AC3: an unsolicited-mail failure banner offers Retry, which calls retryUnsolicitedMail and clears on success', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'Inbox' })

    const [onUnsolicitedMailFailed] = vi.mocked(window.api.onUnsolicitedMailFailed).mock.calls[0]
    onUnsolicitedMailFailed('Network error: fetch failed')
    const banner = await screen.findByRole('alert')
    expect(within(banner).getByRole('button', { name: 'Retry' })).toBeInTheDocument()

    vi.mocked(window.api.llm.retryUnsolicitedMail).mockResolvedValue({ ok: true, sent: false })
    await user.click(within(banner).getByRole('button', { name: 'Retry' }))

    expect(window.api.llm.retryUnsolicitedMail).toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a dismissible banner when a calendar reminder fires', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'Inbox' })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    const [onReminderFired] = vi.mocked(window.api.onReminderFired).mock.calls[0]
    onReminderFired(makeFiredReminder({ title: 'Filing deadline' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Reminder: "Filing deadline"')

    await user.click(screen.getByRole('button', { name: 'Dismiss reminder' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows multiple fired-reminder banners independently, each dismissible on its own', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'Inbox' })

    const [onReminderFired] = vi.mocked(window.api.onReminderFired).mock.calls[0]
    onReminderFired(makeFiredReminder({ id: 'cal-1:1000', title: 'Filing deadline' }))
    onReminderFired(makeFiredReminder({ id: 'cal-2:1000', title: 'Client call' }))

    expect(await screen.findByText(/Filing deadline/)).toBeInTheDocument()
    expect(screen.getByText(/Client call/)).toBeInTheDocument()

    const dismissButtons = screen.getAllByRole('button', { name: 'Dismiss reminder' })
    await user.click(dismissButtons[0])

    expect(screen.queryByText(/Filing deadline/)).not.toBeInTheDocument()
    expect(screen.getByText(/Client call/)).toBeInTheDocument()
  })

  it('026: two occurrences of the SAME recurring series firing in one session get independent, independently-dismissible banners', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'Inbox' })

    const [onReminderFired] = vi.mocked(window.api.onReminderFired).mock.calls[0]
    // Same seriesId, different occurrence (originalStartTime) — the exact
    // shape a recurring series' 1st and 2nd occurrence firing produce.
    onReminderFired(
      makeFiredReminder({ id: 'cal-1:1000', seriesId: 'cal-1', title: 'Daily standup', startTime: 1000 })
    )
    onReminderFired(
      makeFiredReminder({ id: 'cal-1:87400000', seriesId: 'cal-1', title: 'Daily standup', startTime: 87_400_000 })
    )

    const alerts = await screen.findAllByRole('alert')
    expect(alerts).toHaveLength(2)

    const dismissButtons = screen.getAllByRole('button', { name: 'Dismiss reminder' })
    await user.click(dismissButtons[0])

    // Dismissing one occurrence's banner leaves the other series-mate intact
    // — proves dismissal keys off the per-occurrence id, not seriesId.
    expect(screen.getAllByRole('alert')).toHaveLength(1)
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

  // Right-click context menu (feature 040), end-to-end through the real
  // App/MessageListPane wiring — in particular the context menu's Delete
  // (AC5), which permanently deletes rather than re-moving once a message
  // is already in Deleted Items, a branch nothing else exercises.
  it("040: the context menu's Delete permanently deletes a message that's already in Deleted Items", async () => {
    const user = userEvent.setup()
    const deletedMessage: MailMessage = {
      id: 'msg-1',
      folderId: 'deleted',
      previousFolderId: 'inbox',
      subject: 'Already deleted',
      body: 'Body text',
      fromName: 'Alex',
      fromEmail: 'alex@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      cc: [],
      timestamp: Date.now(),
      isRead: true,
      isFlagged: false,
      categories: [],
      attachments: []
    }
    vi.mocked(window.api.data.messages.list).mockImplementation(async (folderId?: string) =>
      folderId === 'deleted' ? [deletedMessage] : []
    )

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Deleted Items' }))
    await screen.findByText('Already deleted')

    fireEvent.contextMenu(screen.getByText('Already deleted'))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))

    expect(window.api.data.messages.delete).toHaveBeenCalledWith('msg-1')
    expect(window.api.data.messages.update).not.toHaveBeenCalledWith(
      'msg-1',
      expect.objectContaining({ folderId: 'deleted' })
    )
  })

  describe('Tasks panel (feature 046)', () => {
    // AC1
    it('the View ribbon tab exposes a Tasks toggle that shows/hides the panel, without switching modules', async () => {
      const user = userEvent.setup()
      render(<App />)
      await screen.findByRole('button', { name: 'Inbox' })

      expect(screen.queryByText('Flagged Mail')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'View' }))
      expect(screen.getByRole('button', { name: 'View' })).toHaveClass('active')
      // Still on Mail underneath — View only swapped the ribbon's own actions.
      expect(screen.getByRole('button', { name: 'Inbox' })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Tasks' }))
      expect(await screen.findByText('Flagged Mail')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Tasks' }))
      expect(screen.queryByText('Flagged Mail')).not.toBeInTheDocument()
    })

    // AC6
    it('the panel stays open, and freestanding tasks stay listed, across a Mail/Calendar module switch', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.tasks.list).mockResolvedValue([
        { id: 't1', text: 'Persistent task', done: false, dueAt: null, createdAt: 0 }
      ])
      render(<App />)
      await screen.findByRole('button', { name: 'Inbox' })

      await user.click(screen.getByRole('button', { name: 'View' }))
      await user.click(screen.getByRole('button', { name: 'Tasks' }))
      await screen.findByText('Persistent task')

      await user.click(screen.getByRole('tab', { name: 'Calendar' }))
      expect(screen.getByText('My Calendars')).toBeInTheDocument()
      expect(screen.getByText('Persistent task')).toBeInTheDocument()

      await user.click(screen.getByRole('tab', { name: 'Mail' }))
      expect(screen.getByText('Persistent task')).toBeInTheDocument()
    })

    it('hides the Tasks panel while Settings is open', async () => {
      const user = userEvent.setup()
      render(<App />)
      await screen.findByRole('button', { name: 'Inbox' })

      await user.click(screen.getByRole('button', { name: 'View' }))
      await user.click(screen.getByRole('button', { name: 'Tasks' }))
      await screen.findByText('Flagged Mail')

      await user.click(screen.getByRole('button', { name: 'Settings' }))
      expect(screen.queryByText('Flagged Mail')).not.toBeInTheDocument()
    })
  })
})
