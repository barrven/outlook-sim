// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MessageListPane from './MessageListPane'
import type { MailMessage } from '../../../shared/data-types'

function makeMessage(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    id: 'msg-1',
    folderId: 'inbox',
    previousFolderId: null,
    subject: 'Test subject',
    body: 'Body',
    fromName: 'Alex',
    fromEmail: 'alex@example.com',
    toName: 'Trainee',
    toEmail: 'trainee@example.com',
    cc: [],
    timestamp: Date.now(),
    isRead: false,
    isFlagged: false,
    categories: [],
    attachments: [],
    ...overrides
  }
}

describe('MessageListPane', () => {
  it('shows the empty state when the folder has no messages', async () => {
    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageId={null}
        onSelectMessage={vi.fn()}
        messagesVersion={0}
      />
    )

    expect(await screen.findByText('No items to show.')).toBeInTheDocument()
  })

  it('renders messages for the folder, bolding unread ones', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue([
      makeMessage({ id: 'a', subject: 'Unread one', isRead: false }),
      makeMessage({ id: 'b', subject: 'Read one', isRead: true })
    ])

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageId={null}
        onSelectMessage={vi.fn()}
        messagesVersion={0}
      />
    )

    const unreadItem = (await screen.findByText('Unread one')).closest('.message-list-item')
    const readItem = screen.getByText('Read one').closest('.message-list-item')

    expect(unreadItem).toHaveClass('unread')
    expect(readItem).not.toHaveClass('unread')
  })

  it('calls onSelectMessage when a message is clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.list).mockResolvedValue([makeMessage({ id: 'a', subject: 'Click me' })])
    const onSelectMessage = vi.fn()

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageId={null}
        onSelectMessage={onSelectMessage}
        messagesVersion={0}
      />
    )

    await user.click(await screen.findByText('Click me'))

    expect(onSelectMessage).toHaveBeenCalledWith('a')
  })

  it('marks the selected message', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue([makeMessage({ id: 'a', subject: 'Selected msg' })])

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageId="a"
        onSelectMessage={vi.fn()}
        messagesVersion={0}
      />
    )

    const item = (await screen.findByText('Selected msg')).closest('.message-list-item')
    expect(item).toHaveClass('selected')
  })

  it('shows a flag button per row that toggles isFlagged without selecting the message', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.list).mockResolvedValue([
      makeMessage({ id: 'a', subject: 'Unflagged one', isFlagged: false }),
      makeMessage({ id: 'b', subject: 'Flagged one', isFlagged: true })
    ])
    const onSelectMessage = vi.fn()

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageId={null}
        onSelectMessage={onSelectMessage}
        messagesVersion={0}
      />
    )

    await screen.findByText('Unflagged one')
    const flagButton = screen.getByRole('button', { name: 'Flag message' })
    const unflagButton = screen.getByRole('button', { name: 'Unflag message' })

    await user.click(flagButton)
    expect(window.api.data.messages.update).toHaveBeenCalledWith('a', { isFlagged: true })

    await user.click(unflagButton)
    expect(window.api.data.messages.update).toHaveBeenCalledWith('b', { isFlagged: false })

    expect(onSelectMessage).not.toHaveBeenCalled()
  })

  it('shows each message\'s categories, and no filter select when none have any', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue([
      makeMessage({ id: 'a', subject: 'No categories', categories: [] })
    ])

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageId={null}
        onSelectMessage={vi.fn()}
        messagesVersion={0}
      />
    )

    await screen.findByText('No categories')
    expect(screen.queryByLabelText('Filter by category')).not.toBeInTheDocument()
  })

  it('shows a category filter once messages have categories, and filters the list by the chosen one', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.list).mockResolvedValue([
      makeMessage({ id: 'a', subject: 'Urgent one', categories: ['Urgent'] }),
      makeMessage({ id: 'b', subject: 'Client one', categories: ['Client'] }),
      makeMessage({ id: 'c', subject: 'Both one', categories: ['Urgent', 'Client'] })
    ])

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageId={null}
        onSelectMessage={vi.fn()}
        messagesVersion={0}
      />
    )

    await screen.findByText('Urgent one')
    expect(screen.getByText('Client one')).toBeInTheDocument()
    expect(screen.getByText('Both one')).toBeInTheDocument()

    const filter = screen.getByLabelText('Filter by category')
    await user.selectOptions(filter, 'Urgent')

    expect(screen.getByText('Urgent one')).toBeInTheDocument()
    expect(screen.getByText('Both one')).toBeInTheDocument()
    expect(screen.queryByText('Client one')).not.toBeInTheDocument()

    await user.selectOptions(filter, 'All categories')
    expect(screen.getByText('Client one')).toBeInTheDocument()
  })

  it('resets the category filter when the folder changes', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue([
      makeMessage({ id: 'a', subject: 'Urgent one', categories: ['Urgent'] }),
      makeMessage({ id: 'b', subject: 'Client one', categories: ['Client'] })
    ])
    const user = userEvent.setup()

    const { rerender } = render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageId={null}
        onSelectMessage={vi.fn()}
        messagesVersion={0}
      />
    )
    await screen.findByText('Urgent one')
    await user.selectOptions(screen.getByLabelText('Filter by category'), 'Urgent')
    expect(screen.queryByText('Client one')).not.toBeInTheDocument()

    vi.mocked(window.api.data.messages.list).mockResolvedValue([
      makeMessage({ id: 'a', subject: 'Urgent one', categories: ['Urgent'] }),
      makeMessage({ id: 'b', subject: 'Client one', categories: ['Client'] })
    ])
    rerender(
      <MessageListPane
        selectedFolderId="drafts"
        selectedFolderName="Drafts"
        selectedMessageId={null}
        onSelectMessage={vi.fn()}
        messagesVersion={0}
      />
    )

    expect(await screen.findByText('Client one')).toBeInTheDocument()
  })

  it('filters by subject, body, sender name, or sender email — case-insensitively', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.list).mockResolvedValue([
      makeMessage({ id: 'subj', subject: 'Budget Review Notes', body: 'irrelevant', fromName: 'Alex', fromEmail: 'alex@example.com' }),
      makeMessage({ id: 'body', subject: 'Quarterly Numbers', body: 'please review the budget figures', fromName: 'Sam', fromEmail: 'sam@example.com' }),
      makeMessage({ id: 'name', subject: 'Team Sync', body: 'irrelevant', fromName: 'Budget Team', fromEmail: 'lead@example.com' }),
      makeMessage({ id: 'email', subject: 'Random Update', body: 'irrelevant', fromName: 'Morgan', fromEmail: 'budget-lead@example.com' }),
      makeMessage({ id: 'none', subject: 'Nothing Related', body: 'irrelevant', fromName: 'Nobody', fromEmail: 'nobody@example.com' })
    ])

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageId={null}
        onSelectMessage={vi.fn()}
        messagesVersion={0}
      />
    )
    await screen.findByText('Nothing Related')

    await user.type(screen.getByLabelText('Search mail'), 'budget')

    expect(screen.getByText('Budget Review Notes')).toBeInTheDocument() // subject match
    expect(screen.getByText('Quarterly Numbers')).toBeInTheDocument() // body match
    expect(screen.getByText('Team Sync')).toBeInTheDocument() // sender name match
    expect(screen.getByText('Random Update')).toBeInTheDocument() // sender email match
    expect(screen.queryByText('Nothing Related')).not.toBeInTheDocument()
  })

  it('scopes search to the current folder by default, and to all folders once that scope is chosen', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.list).mockImplementation((folderId?: string) => {
      if (folderId === undefined) {
        return Promise.resolve([
          makeMessage({ id: 'inbox-match', subject: 'Budget in inbox', folderId: 'inbox' }),
          makeMessage({ id: 'sent-match', subject: 'Budget in sent', folderId: 'sent' })
        ])
      }
      return Promise.resolve([makeMessage({ id: 'inbox-match', subject: 'Budget in inbox', folderId: 'inbox' })])
    })

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageId={null}
        onSelectMessage={vi.fn()}
        messagesVersion={0}
      />
    )
    await screen.findByText('Budget in inbox')

    await user.type(screen.getByLabelText('Search mail'), 'budget')
    expect(screen.getByText('Budget in inbox')).toBeInTheDocument()
    expect(screen.queryByText('Budget in sent')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Search scope'), 'All folders')

    expect(await screen.findByText('Budget in sent')).toBeInTheDocument()
    expect(screen.getByText('Budget in inbox')).toBeInTheDocument()
  })

  it('only fetches the unscoped all-folders list once "All folders" search scope is selected', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.list).mockResolvedValue([])

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageId={null}
        onSelectMessage={vi.fn()}
        messagesVersion={0}
      />
    )
    await screen.findByText('No items to show.')

    expect(window.api.data.messages.list).toHaveBeenCalledWith('inbox')
    expect(window.api.data.messages.list).not.toHaveBeenCalledWith()

    await user.selectOptions(screen.getByLabelText('Search scope'), 'All folders')

    await waitFor(() => expect(window.api.data.messages.list).toHaveBeenCalledWith())
  })

  it('updates results live as the query changes, without needing a folder change', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.list).mockResolvedValue([
      makeMessage({ id: 'a', subject: 'Budget review' }),
      makeMessage({ id: 'b', subject: 'Travel plans' })
    ])

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageId={null}
        onSelectMessage={vi.fn()}
        messagesVersion={0}
      />
    )
    await screen.findByText('Budget review')

    const input = screen.getByLabelText('Search mail')
    await user.type(input, 'budget')
    expect(screen.getByText('Budget review')).toBeInTheDocument()
    expect(screen.queryByText('Travel plans')).not.toBeInTheDocument()

    await user.clear(input)
    await user.type(input, 'travel')
    expect(screen.getByText('Travel plans')).toBeInTheDocument()
    expect(screen.queryByText('Budget review')).not.toBeInTheDocument()

    expect(window.api.data.messages.list).not.toHaveBeenCalledWith('drafts')
  })

  it('restores the normal folder view when the search is cleared', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.list).mockResolvedValue([
      makeMessage({ id: 'a', subject: 'Budget review' }),
      makeMessage({ id: 'b', subject: 'Travel plans' })
    ])

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageId={null}
        onSelectMessage={vi.fn()}
        messagesVersion={0}
      />
    )
    await screen.findByText('Budget review')

    const input = screen.getByLabelText('Search mail')
    await user.type(input, 'budget')
    expect(screen.queryByText('Travel plans')).not.toBeInTheDocument()

    await user.clear(input)

    expect(await screen.findByText('Travel plans')).toBeInTheDocument()
    expect(screen.getByText('Budget review')).toBeInTheDocument()
  })

  it('shows a distinct empty state for a no-results search vs a genuinely empty folder', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.list).mockResolvedValue([makeMessage({ id: 'a', subject: 'Budget review' })])

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageId={null}
        onSelectMessage={vi.fn()}
        messagesVersion={0}
      />
    )
    await screen.findByText('Budget review')

    await user.type(screen.getByLabelText('Search mail'), 'nonexistent keyword')

    expect(await screen.findByText('No results found.')).toBeInTheDocument()
    expect(screen.queryByText('No items to show.')).not.toBeInTheDocument()
  })

  it('combines an active search with the category filter', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.list).mockResolvedValue([
      makeMessage({ id: 'a', subject: 'Budget review', categories: ['Urgent'] }),
      makeMessage({ id: 'b', subject: 'Budget forecast', categories: ['Client'] })
    ])

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageId={null}
        onSelectMessage={vi.fn()}
        messagesVersion={0}
      />
    )
    await screen.findByText('Budget review')

    await user.type(screen.getByLabelText('Search mail'), 'budget')
    expect(screen.getByText('Budget forecast')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Filter by category'), 'Urgent')

    expect(screen.getByText('Budget review')).toBeInTheDocument()
    expect(screen.queryByText('Budget forecast')).not.toBeInTheDocument()
  })

  it('refetches messages when the folder changes', async () => {
    const { rerender } = render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageId={null}
        onSelectMessage={vi.fn()}
        messagesVersion={0}
      />
    )
    await screen.findByText('No items to show.')
    expect(window.api.data.messages.list).toHaveBeenCalledWith('inbox')

    rerender(
      <MessageListPane
        selectedFolderId="drafts"
        selectedFolderName="Drafts"
        selectedMessageId={null}
        onSelectMessage={vi.fn()}
        messagesVersion={0}
      />
    )

    expect(window.api.data.messages.list).toHaveBeenCalledWith('drafts')
  })

  it('refetches when messagesVersion changes (e.g. after a compose window saves)', async () => {
    const { rerender } = render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageId={null}
        onSelectMessage={vi.fn()}
        messagesVersion={0}
      />
    )
    await screen.findByText('No items to show.')
    expect(window.api.data.messages.list).toHaveBeenCalledTimes(1)

    rerender(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageId={null}
        onSelectMessage={vi.fn()}
        messagesVersion={1}
      />
    )

    await waitFor(() => expect(window.api.data.messages.list).toHaveBeenCalledTimes(2))
  })
})
