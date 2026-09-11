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
