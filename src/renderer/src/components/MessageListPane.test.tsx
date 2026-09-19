// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  const defaultProps = {
    folders: [],
    searchQuery: '',
    searchScope: 'folder' as const,
    fullWidth: false,
    onReply: vi.fn(),
    onReplyAll: vi.fn(),
    onForward: vi.fn(),
    onDeleteMessages: vi.fn()
  }

  it('shows the empty state when the folder has no messages', async () => {
    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
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
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
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
        selectedMessageIds={[]}
        onSelectionChange={onSelectMessage}
        messagesVersion={0}
        {...defaultProps}
      />
    )

    await user.click(await screen.findByText('Click me'))

    expect(onSelectMessage).toHaveBeenCalledWith(['a'])
  })

  it('marks the selected message', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue([makeMessage({ id: 'a', subject: 'Selected msg' })])

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={['a']}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
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
        selectedMessageIds={[]}
        onSelectionChange={onSelectMessage}
        messagesVersion={0}
        {...defaultProps}
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

  // 055 — each row shows its timestamp

  it('055 AC1: shows each message\'s timestamp, formatted exactly like the Reading Pane\'s own toLocaleString() call', async () => {
    const timestamp = new Date('2026-01-15T10:30:00').getTime()
    vi.mocked(window.api.data.messages.list).mockResolvedValue([makeMessage({ timestamp })])

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
      />
    )

    await screen.findByText('Test subject')
    expect(screen.getByText(new Date(timestamp).toLocaleString())).toBeInTheDocument()
  })

  it('055 AC1: each row gets its own message\'s timestamp, not a shared/stale one', async () => {
    const earlier = new Date('2026-01-10T09:00:00').getTime()
    const later = new Date('2026-01-15T14:45:00').getTime()
    vi.mocked(window.api.data.messages.list).mockResolvedValue([
      makeMessage({ id: 'a', subject: 'Earlier message', timestamp: earlier }),
      makeMessage({ id: 'b', subject: 'Later message', timestamp: later })
    ])

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
      />
    )

    await screen.findByText('Earlier message')
    expect(screen.getByText('Earlier message').closest('.message-list-item')).toHaveTextContent(
      new Date(earlier).toLocaleString()
    )
    expect(screen.getByText('Later message').closest('.message-list-item')).toHaveTextContent(
      new Date(later).toLocaleString()
    )
  })

  it('055 AC2: the timestamp appears alongside from/subject/categories/flag button, none of which are displaced', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue([
      makeMessage({ fromName: 'Priya Shah', subject: 'Quarterly numbers', categories: ['Urgent', 'Finance'] })
    ])

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
      />
    )

    const item = (await screen.findByText('Quarterly numbers')).closest('.message-list-item')!
    expect(item).toHaveTextContent('Priya Shah')
    expect(item).toHaveTextContent('Urgent, Finance')
    expect(item.querySelector('.message-list-item-timestamp')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Flag message' })).toBeInTheDocument()
  })

  it('055 AC3: adding the timestamp does not change the message list\'s search/filter behavior', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue([
      makeMessage({ id: 'a', subject: 'Alpha report' }),
      makeMessage({ id: 'b', subject: 'Beta notes' })
    ])

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
        searchQuery="report"
      />
    )

    await screen.findByText('Alpha report')
    expect(screen.queryByText('Beta notes')).not.toBeInTheDocument()
  })

  // 054 — flagged-row background highlight

  it('054 AC2: a flagged row carries the highlight class; an unflagged row does not', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue([
      makeMessage({ id: 'a', subject: 'Not flagged', isFlagged: false }),
      makeMessage({ id: 'b', subject: 'Flagged one', isFlagged: true })
    ])

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
      />
    )

    await screen.findByText('Not flagged')
    expect(screen.getByText('Not flagged').closest('.message-list-item')).not.toHaveClass('flagged')
    expect(screen.getByText('Flagged one').closest('.message-list-item')).toHaveClass('flagged')
  })

  it('054 AC3: a row that is both flagged and selected carries both classes (selected wins visually via CSS cascade order)', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue([
      makeMessage({ id: 'a', subject: 'Flagged and selected', isFlagged: true })
    ])

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={['a']}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
      />
    )

    const item = (await screen.findByText('Flagged and selected')).closest('.message-list-item')
    expect(item).toHaveClass('flagged')
    expect(item).toHaveClass('selected')
  })

  it('054 AC4: flagging a message immediately adds the row highlight class on the next render', async () => {
    const message = makeMessage({ id: 'a', subject: 'Toggle me', isFlagged: false })
    vi.mocked(window.api.data.messages.list).mockResolvedValue([message])

    const { rerender } = render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
      />
    )

    await screen.findByText('Toggle me')
    expect(screen.getByText('Toggle me').closest('.message-list-item')).not.toHaveClass('flagged')

    // Simulate the broadcast-driven refetch (messagesVersion bump) this
    // component already relies on for isRead/category live updates.
    vi.mocked(window.api.data.messages.list).mockResolvedValue([{ ...message, isFlagged: true }])
    rerender(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={1}
        {...defaultProps}
      />
    )

    await waitFor(() => expect(screen.getByText('Toggle me').closest('.message-list-item')).toHaveClass('flagged'))
  })

  // Multi-select (feature 039)

  const ABCD = [
    makeMessage({ id: 'a', subject: 'Alpha' }),
    makeMessage({ id: 'b', subject: 'Bravo' }),
    makeMessage({ id: 'c', subject: 'Charlie' }),
    makeMessage({ id: 'd', subject: 'Delta' })
  ]

  it('039 AC1: Ctrl-click adds a message to the selection without clearing the rest', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue(ABCD)
    const onSelectionChange = vi.fn()

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={['a']}
        onSelectionChange={onSelectionChange}
        messagesVersion={0}
        {...defaultProps}
      />
    )
    await screen.findByText('Alpha')

    fireEvent.click(screen.getByText('Bravo'), { ctrlKey: true })

    expect(onSelectionChange).toHaveBeenCalledWith(['a', 'b'])
  })

  it('039 AC1: Cmd/Meta-click also toggles (Mac equivalent of Ctrl-click)', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue(ABCD)
    const onSelectionChange = vi.fn()

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={['a']}
        onSelectionChange={onSelectionChange}
        messagesVersion={0}
        {...defaultProps}
      />
    )
    await screen.findByText('Alpha')

    fireEvent.click(screen.getByText('Bravo'), { metaKey: true })

    expect(onSelectionChange).toHaveBeenCalledWith(['a', 'b'])
  })

  it('039 AC1: Ctrl-clicking an already-selected message removes just that one, keeping the rest', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue(ABCD)
    const onSelectionChange = vi.fn()

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={['a', 'b', 'c']}
        onSelectionChange={onSelectionChange}
        messagesVersion={0}
        {...defaultProps}
      />
    )
    await screen.findByText('Alpha')

    fireEvent.click(screen.getByText('Bravo'), { ctrlKey: true })

    expect(onSelectionChange).toHaveBeenCalledWith(['a', 'c'])
  })

  it('039 AC2: Shift-click selects the contiguous range from the last-clicked message forward', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue(ABCD)
    const onSelectionChange = vi.fn()

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={onSelectionChange}
        messagesVersion={0}
        {...defaultProps}
      />
    )
    await screen.findByText('Alpha')

    // Establish the anchor with a plain click, then Shift-click two rows down.
    fireEvent.click(screen.getByText('Alpha'))
    fireEvent.click(screen.getByText('Charlie'), { shiftKey: true })

    expect(onSelectionChange).toHaveBeenLastCalledWith(['a', 'b', 'c'])
  })

  it('039 AC2: Shift-click selects the contiguous range when the target is before the anchor', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue(ABCD)
    const onSelectionChange = vi.fn()

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={onSelectionChange}
        messagesVersion={0}
        {...defaultProps}
      />
    )
    await screen.findByText('Alpha')

    fireEvent.click(screen.getByText('Delta'))
    fireEvent.click(screen.getByText('Bravo'), { shiftKey: true })

    expect(onSelectionChange).toHaveBeenLastCalledWith(['b', 'c', 'd'])
  })

  it('039 AC2: a second Shift-click re-ranges from the same anchor, not the previous Shift-click target', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue(ABCD)
    const onSelectionChange = vi.fn()

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={onSelectionChange}
        messagesVersion={0}
        {...defaultProps}
      />
    )
    await screen.findByText('Alpha')

    fireEvent.click(screen.getByText('Alpha'))
    fireEvent.click(screen.getByText('Delta'), { shiftKey: true })
    expect(onSelectionChange).toHaveBeenLastCalledWith(['a', 'b', 'c', 'd'])

    // Shift-clicking Bravo next should re-range from Alpha (the anchor),
    // not from Delta (the last Shift-click target) — a shorter range, not
    // an extension of the previous one.
    fireEvent.click(screen.getByText('Bravo'), { shiftKey: true })
    expect(onSelectionChange).toHaveBeenLastCalledWith(['a', 'b'])
  })

  it('039 AC2: a Shift-click with no prior selection falls back to a plain single-select', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue(ABCD)
    const onSelectionChange = vi.fn()

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={onSelectionChange}
        messagesVersion={0}
        {...defaultProps}
      />
    )
    await screen.findByText('Alpha')

    fireEvent.click(screen.getByText('Charlie'), { shiftKey: true })

    expect(onSelectionChange).toHaveBeenCalledWith(['c'])
  })

  it('039 AC3: a plain click selects only that message, clearing a prior multi-selection', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue(ABCD)
    const onSelectionChange = vi.fn()

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={['a', 'b', 'c']}
        onSelectionChange={onSelectionChange}
        messagesVersion={0}
        {...defaultProps}
      />
    )
    await screen.findByText('Alpha')

    fireEvent.click(screen.getByText('Delta'))

    expect(onSelectionChange).toHaveBeenCalledWith(['d'])
  })

  it('039: every selected row is highlighted, not just one', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue(ABCD)

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={['a', 'c']}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
      />
    )
    await screen.findByText('Alpha')

    expect(screen.getByText('Alpha').closest('.message-list-item')).toHaveClass('selected')
    expect(screen.getByText('Charlie').closest('.message-list-item')).toHaveClass('selected')
    expect(screen.getByText('Bravo').closest('.message-list-item')).not.toHaveClass('selected')
    expect(screen.getByText('Delta').closest('.message-list-item')).not.toHaveClass('selected')
  })

  it('039: the selection anchor resets when the folder changes, so a stale anchor cannot leak into a new folder', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue(ABCD)
    const onSelectionChange = vi.fn()

    const { rerender } = render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={onSelectionChange}
        messagesVersion={0}
        {...defaultProps}
      />
    )
    await screen.findByText('Alpha')
    fireEvent.click(screen.getByText('Alpha'))

    vi.mocked(window.api.data.messages.list).mockResolvedValue([makeMessage({ id: 'e', subject: 'Echo' })])
    rerender(
      <MessageListPane
        selectedFolderId="drafts"
        selectedFolderName="Drafts"
        selectedMessageIds={[]}
        onSelectionChange={onSelectionChange}
        messagesVersion={0}
        {...defaultProps}
      />
    )
    await screen.findByText('Echo')

    // A Shift-click here has no valid anchor from the old folder to range
    // from, so it must fall back to a plain single-select rather than
    // erroring or silently doing nothing.
    fireEvent.click(screen.getByText('Echo'), { shiftKey: true })
    expect(onSelectionChange).toHaveBeenLastCalledWith(['e'])
  })

  it('shows each message\'s categories, and no filter select when none have any', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue([
      makeMessage({ id: 'a', subject: 'No categories', categories: [] })
    ])

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
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
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
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
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
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
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
      />
    )

    expect(await screen.findByText('Client one')).toBeInTheDocument()
  })

  it('042 AC2: applies a full-width class when the Reading Pane is Off, and not otherwise', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue([makeMessage({ id: 'a' })])

    const { rerender, container } = render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
      />
    )
    await screen.findByText('Test subject')
    expect(container.querySelector('.message-list-pane')).not.toHaveClass('full-width')

    rerender(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
        fullWidth
      />
    )
    expect(container.querySelector('.message-list-pane')).toHaveClass('full-width')
  })

  // 038: the search input itself moved to the ribbon (RibbonBar owns it);
  // MessageListPane now just receives searchQuery/searchScope as props and
  // filters against them — these tests drive that via props/rerender
  // instead of typing into an input that no longer lives here.
  it('038: no longer renders a search input of its own', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue([makeMessage({ id: 'a' })])

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
      />
    )
    await screen.findByText('Test subject')

    expect(screen.queryByLabelText('Search mail')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Search scope')).not.toBeInTheDocument()
  })

  it('filters by subject, body, sender name, or sender email — case-insensitively', async () => {
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
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
        searchQuery="BUDGET"
      />
    )

    expect(await screen.findByText('Budget Review Notes')).toBeInTheDocument() // subject match
    expect(screen.getByText('Quarterly Numbers')).toBeInTheDocument() // body match
    expect(screen.getByText('Team Sync')).toBeInTheDocument() // sender name match
    expect(screen.getByText('Random Update')).toBeInTheDocument() // sender email match
    expect(screen.queryByText('Nothing Related')).not.toBeInTheDocument()
  })

  it('scopes search to the current folder by default, and to all folders once that scope is chosen', async () => {
    vi.mocked(window.api.data.messages.list).mockImplementation((folderId?: string) => {
      if (folderId === undefined) {
        return Promise.resolve([
          makeMessage({ id: 'inbox-match', subject: 'Budget in inbox', folderId: 'inbox' }),
          makeMessage({ id: 'sent-match', subject: 'Budget in sent', folderId: 'sent' })
        ])
      }
      return Promise.resolve([makeMessage({ id: 'inbox-match', subject: 'Budget in inbox', folderId: 'inbox' })])
    })

    const { rerender } = render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
        searchQuery="budget"
        searchScope="folder"
      />
    )
    expect(await screen.findByText('Budget in inbox')).toBeInTheDocument()
    expect(screen.queryByText('Budget in sent')).not.toBeInTheDocument()

    rerender(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
        searchQuery="budget"
        searchScope="all"
      />
    )

    expect(await screen.findByText('Budget in sent')).toBeInTheDocument()
    expect(screen.getByText('Budget in inbox')).toBeInTheDocument()
  })

  it('only fetches the unscoped all-folders list once "All folders" search scope is selected', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue([])

    const { rerender } = render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
      />
    )
    await screen.findByText('No items to show.')

    expect(window.api.data.messages.list).toHaveBeenCalledWith('inbox')
    expect(window.api.data.messages.list).not.toHaveBeenCalledWith()

    rerender(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
        searchScope="all"
      />
    )

    await waitFor(() => expect(window.api.data.messages.list).toHaveBeenCalledWith())
  })

  it('updates results live as the query changes, without needing a folder change', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue([
      makeMessage({ id: 'a', subject: 'Budget review' }),
      makeMessage({ id: 'b', subject: 'Travel plans' })
    ])

    const { rerender } = render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
        searchQuery="budget"
      />
    )
    expect(await screen.findByText('Budget review')).toBeInTheDocument()
    expect(screen.queryByText('Travel plans')).not.toBeInTheDocument()

    rerender(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
        searchQuery="travel"
      />
    )
    expect(screen.getByText('Travel plans')).toBeInTheDocument()
    expect(screen.queryByText('Budget review')).not.toBeInTheDocument()

    expect(window.api.data.messages.list).not.toHaveBeenCalledWith('drafts')
  })

  it('restores the normal folder view when the search is cleared', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue([
      makeMessage({ id: 'a', subject: 'Budget review' }),
      makeMessage({ id: 'b', subject: 'Travel plans' })
    ])

    const { rerender } = render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
        searchQuery="budget"
      />
    )
    expect(await screen.findByText('Budget review')).toBeInTheDocument()
    expect(screen.queryByText('Travel plans')).not.toBeInTheDocument()

    rerender(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
        searchQuery=""
      />
    )

    expect(await screen.findByText('Travel plans')).toBeInTheDocument()
    expect(screen.getByText('Budget review')).toBeInTheDocument()
  })

  it('shows a distinct empty state for a no-results search vs a genuinely empty folder', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue([makeMessage({ id: 'a', subject: 'Budget review' })])

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
        searchQuery="nonexistent keyword"
      />
    )

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
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
        searchQuery="budget"
      />
    )
    expect(await screen.findByText('Budget review')).toBeInTheDocument()
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
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
      />
    )
    await screen.findByText('No items to show.')
    expect(window.api.data.messages.list).toHaveBeenCalledWith('inbox')

    rerender(
      <MessageListPane
        selectedFolderId="drafts"
        selectedFolderName="Drafts"
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
      />
    )

    expect(window.api.data.messages.list).toHaveBeenCalledWith('drafts')
  })

  it('refetches when messagesVersion changes (e.g. after a compose window saves)', async () => {
    const { rerender } = render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
      />
    )
    await screen.findByText('No items to show.')
    expect(window.api.data.messages.list).toHaveBeenCalledTimes(1)

    rerender(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={1}
        {...defaultProps}
      />
    )

    await waitFor(() => expect(window.api.data.messages.list).toHaveBeenCalledTimes(2))
  })

  // Right-click context menu (feature 040)

  const contextMenuFolders = [
    { id: 'inbox', name: 'Inbox', type: 'system' as const, sortOrder: 0 },
    { id: 'archive', name: 'Archive', type: 'custom' as const, sortOrder: 1 }
  ]

  it('040 AC2: right-clicking a message outside the current selection selects just that message first', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue(ABCD)
    const onSelectionChange = vi.fn()

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={['a']}
        onSelectionChange={onSelectionChange}
        messagesVersion={0}
        {...defaultProps}
      />
    )
    await screen.findByText('Bravo')

    fireEvent.contextMenu(screen.getByText('Bravo'))

    expect(onSelectionChange).toHaveBeenCalledWith(['b'])
    expect(screen.getByRole('menu')).toBeInTheDocument()
    // Menu is scoped to just the right-clicked message, so single-message
    // actions are enabled.
    expect(screen.getByRole('menuitem', { name: 'Reply' })).toBeEnabled()
  })

  it('040 AC2: right-clicking a message already inside a multi-selection keeps that selection', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue(ABCD)
    const onSelectionChange = vi.fn()

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={['a', 'b']}
        onSelectionChange={onSelectionChange}
        messagesVersion={0}
        {...defaultProps}
      />
    )
    await screen.findByText('Bravo')

    fireEvent.contextMenu(screen.getByText('Bravo'))

    expect(onSelectionChange).not.toHaveBeenCalled()
    // Menu is scoped to the full 2-message selection, so single-message
    // actions stay disabled.
    expect(screen.getByRole('menuitem', { name: 'Reply' })).toBeDisabled()
  })

  it('040 AC4: Mark as read and Flag apply to every message in the target selection', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue(ABCD)

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={['a', 'b']}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
      />
    )
    await screen.findByText('Bravo')

    fireEvent.contextMenu(screen.getByText('Bravo'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mark as read' }))
    expect(window.api.data.messages.update).toHaveBeenCalledWith('a', { isRead: true })
    expect(window.api.data.messages.update).toHaveBeenCalledWith('b', { isRead: true })

    fireEvent.contextMenu(screen.getByText('Bravo'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Flag' }))
    expect(window.api.data.messages.update).toHaveBeenCalledWith('a', { isFlagged: true })
    expect(window.api.data.messages.update).toHaveBeenCalledWith('b', { isFlagged: true })
  })

  it('040 AC4: Add to category applies only to selected messages that lack the category yet', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.list).mockResolvedValue([
      makeMessage({ id: 'a', subject: 'Alpha', categories: [] }),
      makeMessage({ id: 'b', subject: 'Bravo', categories: ['Urgent'] })
    ])

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={['a', 'b']}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
      />
    )
    await screen.findByText('Bravo')

    fireEvent.contextMenu(screen.getByText('Bravo'))
    await user.click(screen.getByRole('menuitem', { name: 'Add to category' }))
    await user.type(screen.getByLabelText('Category name'), 'Urgent{enter}')

    expect(window.api.data.messages.update).toHaveBeenCalledWith('a', { categories: ['Urgent'] })
    expect(window.api.data.messages.update).not.toHaveBeenCalledWith('b', expect.anything())
  })

  it('040 AC3: Move to folder lists the available folders and moves every selected message, clearing the selection', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.list).mockResolvedValue(ABCD)
    const onSelectionChange = vi.fn()

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={['a', 'b']}
        onSelectionChange={onSelectionChange}
        messagesVersion={0}
        {...defaultProps}
        folders={contextMenuFolders}
      />
    )
    await screen.findByText('Bravo')

    fireEvent.contextMenu(screen.getByText('Bravo'))
    await user.click(screen.getByRole('menuitem', { name: 'Move to folder' }))
    expect(screen.getByRole('menuitem', { name: 'Archive' })).toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: 'Archive' }))

    expect(window.api.data.messages.update).toHaveBeenCalledWith('a', { folderId: 'archive' })
    expect(window.api.data.messages.update).toHaveBeenCalledWith('b', { folderId: 'archive' })
    expect(onSelectionChange).toHaveBeenCalledWith([])
  })

  it('040 AC5: Delete applies to the whole target selection, any size', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue(ABCD)
    const onDeleteMessages = vi.fn()

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={['a', 'b', 'c']}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
        onDeleteMessages={onDeleteMessages}
      />
    )
    await screen.findByText('Charlie')

    fireEvent.contextMenu(screen.getByText('Charlie'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))

    expect(onDeleteMessages).toHaveBeenCalledTimes(1)
    expect(onDeleteMessages.mock.calls[0][0].map((message: MailMessage) => message.id).sort()).toEqual([
      'a',
      'b',
      'c'
    ])
  })

  it('040 AC5: Reply calls through with the single selected message when exactly one is targeted', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue(ABCD)
    const onReply = vi.fn()

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={['a']}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
        onReply={onReply}
      />
    )
    await screen.findByText('Alpha')

    fireEvent.contextMenu(screen.getByText('Alpha'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reply' }))

    expect(onReply).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }))
  })

  it('040: the context menu closes when the folder changes', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue(ABCD)

    const { rerender } = render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={['a']}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
      />
    )
    await screen.findByText('Alpha')
    fireEvent.contextMenu(screen.getByText('Alpha'))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    vi.mocked(window.api.data.messages.list).mockResolvedValue([makeMessage({ id: 'e', subject: 'Echo' })])
    rerender(
      <MessageListPane
        selectedFolderId="drafts"
        selectedFolderName="Drafts"
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
      />
    )
    await screen.findByText('Echo')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  // Double-click pop-out (feature 041)

  it('041 AC1: double-clicking a message opens the pop-out window for that message', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.list).mockResolvedValue(ABCD)

    render(
      <MessageListPane
        selectedFolderId="inbox"
        selectedFolderName="Inbox"
        selectedMessageIds={[]}
        onSelectionChange={vi.fn()}
        messagesVersion={0}
        {...defaultProps}
      />
    )
    await screen.findByText('Bravo')

    // userEvent.dblClick fires the real click/click/dblclick sequence a
    // browser would, unlike fireEvent.doubleClick which only dispatches
    // the bare dblclick event.
    await user.dblClick(screen.getByText('Bravo'))

    expect(window.api.messagePopout.open).toHaveBeenCalledWith('b')
  })
})
