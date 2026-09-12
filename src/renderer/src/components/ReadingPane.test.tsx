// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReadingPane from './ReadingPane'
import type { MailMessage } from '../../../shared/data-types'

const MESSAGE: MailMessage = {
  id: 'msg-1',
  folderId: 'inbox',
  previousFolderId: null,
  subject: 'Quarterly numbers',
  body: 'See attached.',
  fromName: 'Priya Shah',
  fromEmail: 'priya@example.com',
  toName: 'Trainee',
  toEmail: 'trainee@example.com',
  cc: [],
  timestamp: new Date('2026-01-15T10:00:00').getTime(),
  isRead: true,
  isFlagged: false,
  categories: [],
  attachments: []
}

describe('ReadingPane', () => {
  it('shows a placeholder when no message is selected', () => {
    render(<ReadingPane selectedMessageId={null} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    expect(screen.getByText('Select an item to read.')).toBeInTheDocument()
  })

  it('renders the fetched message content when a message is selected', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE)

    render(<ReadingPane selectedMessageId="msg-1" messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    expect(await screen.findByText('Quarterly numbers')).toBeInTheDocument()
    expect(screen.getByText('See attached.')).toBeInTheDocument()
    expect(screen.getByText(/Priya Shah/)).toBeInTheDocument()
    expect(screen.getByText(/priya@example\.com/)).toBeInTheDocument()
    expect(window.api.data.messages.get).toHaveBeenCalledWith('msg-1')
  })

  it('goes back to the placeholder when the selection is cleared', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE)
    const { rerender } = render(<ReadingPane selectedMessageId="msg-1" messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    expect(await screen.findByText('Quarterly numbers')).toBeInTheDocument()

    rerender(<ReadingPane selectedMessageId={null} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    expect(screen.getByText('Select an item to read.')).toBeInTheDocument()
    expect(screen.queryByText('Quarterly numbers')).not.toBeInTheDocument()
  })

  it('shows the placeholder if the message cannot be found', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(null)

    render(<ReadingPane selectedMessageId="missing" messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await waitFor(() => expect(window.api.data.messages.get).toHaveBeenCalledWith('missing'))
    expect(screen.getByText('Select an item to read.')).toBeInTheDocument()
  })

  it('shows an Edit draft button for a message in Drafts and calls onEditDraft with it', async () => {
    const user = userEvent.setup()
    const draftMessage: MailMessage = { ...MESSAGE, id: 'draft-1', folderId: 'drafts' }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(draftMessage)
    const onEditDraft = vi.fn()

    render(<ReadingPane selectedMessageId="draft-1" messagesVersion={0} onEditDraft={onEditDraft} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    const editButton = await screen.findByRole('button', { name: 'Edit draft' })
    await user.click(editButton)

    expect(onEditDraft).toHaveBeenCalledWith(draftMessage)
  })

  it('does not show an Edit draft button for a message outside Drafts', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE)

    render(<ReadingPane selectedMessageId="msg-1" messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await screen.findByText('Quarterly numbers')
    expect(screen.queryByRole('button', { name: 'Edit draft' })).not.toBeInTheDocument()
  })

  it('shows Reply/Reply All/Forward buttons for a message outside Drafts, and calls the right handler with it', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE)
    const onReply = vi.fn()
    const onReplyAll = vi.fn()
    const onForward = vi.fn()

    render(
      <ReadingPane
        selectedMessageId="msg-1"
        messagesVersion={0}
        onEditDraft={vi.fn()}
        onReply={onReply}
        onReplyAll={onReplyAll}
        onForward={onForward}
        onDelete={vi.fn()}
        onRestore={vi.fn()}
        onPermanentDelete={vi.fn()}
      />
    )

    await user.click(await screen.findByRole('button', { name: 'Reply' }))
    expect(onReply).toHaveBeenCalledWith(MESSAGE)

    await user.click(screen.getByRole('button', { name: 'Reply All' }))
    expect(onReplyAll).toHaveBeenCalledWith(MESSAGE)

    await user.click(screen.getByRole('button', { name: 'Forward' }))
    expect(onForward).toHaveBeenCalledWith(MESSAGE)
  })

  it('does not show Reply/Reply All/Forward buttons for a message in Drafts', async () => {
    const draftMessage: MailMessage = { ...MESSAGE, id: 'draft-1', folderId: 'drafts' }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(draftMessage)

    render(
      <ReadingPane
        selectedMessageId="draft-1"
        messagesVersion={0}
        onEditDraft={vi.fn()}
        onReply={vi.fn()}
        onReplyAll={vi.fn()}
        onForward={vi.fn()}
        onDelete={vi.fn()}
        onRestore={vi.fn()}
        onPermanentDelete={vi.fn()}
      />
    )

    await screen.findByRole('button', { name: 'Edit draft' })
    expect(screen.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reply All' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Forward' })).not.toBeInTheDocument()
  })

  it('shows a Delete button alongside Reply/Reply All/Forward for a message outside Drafts/Deleted Items, and calls onDelete with it', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE)
    const onDelete = vi.fn()

    render(
      <ReadingPane
        selectedMessageId="msg-1"
        messagesVersion={0}
        onEditDraft={vi.fn()}
        onReply={vi.fn()}
        onReplyAll={vi.fn()}
        onForward={vi.fn()}
        onDelete={onDelete}
        onRestore={vi.fn()}
        onPermanentDelete={vi.fn()}
      />
    )

    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledWith(MESSAGE)
  })

  it('shows a Delete button alongside Edit draft for a message in Drafts, and calls onDelete with it', async () => {
    const user = userEvent.setup()
    const draftMessage: MailMessage = { ...MESSAGE, id: 'draft-1', folderId: 'drafts' }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(draftMessage)
    const onDelete = vi.fn()

    render(
      <ReadingPane
        selectedMessageId="draft-1"
        messagesVersion={0}
        onEditDraft={vi.fn()}
        onReply={vi.fn()}
        onReplyAll={vi.fn()}
        onForward={vi.fn()}
        onDelete={onDelete}
        onRestore={vi.fn()}
        onPermanentDelete={vi.fn()}
      />
    )

    await screen.findByRole('button', { name: 'Edit draft' })
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledWith(draftMessage)
  })

  it('shows Restore and Delete permanently (not Reply/Reply All/Forward/Delete) for a message in Deleted Items, and calls the right handler with it', async () => {
    const user = userEvent.setup()
    const deletedMessage: MailMessage = {
      ...MESSAGE,
      id: 'deleted-1',
      folderId: 'deleted',
      previousFolderId: 'inbox'
    }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(deletedMessage)
    const onRestore = vi.fn()
    const onPermanentDelete = vi.fn()

    render(
      <ReadingPane
        selectedMessageId="deleted-1"
        messagesVersion={0}
        onEditDraft={vi.fn()}
        onReply={vi.fn()}
        onReplyAll={vi.fn()}
        onForward={vi.fn()}
        onDelete={vi.fn()}
        onRestore={onRestore}
        onPermanentDelete={onPermanentDelete}
      />
    )

    await screen.findByText('Quarterly numbers')
    expect(screen.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reply All' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Forward' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit draft' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Restore' }))
    expect(onRestore).toHaveBeenCalledWith(deletedMessage)

    await user.click(screen.getByRole('button', { name: 'Delete permanently' }))
    expect(onPermanentDelete).toHaveBeenCalledWith(deletedMessage)
  })

  it('shows Cc recipients in the header when present', async () => {
    const messageWithCc: MailMessage = {
      ...MESSAGE,
      cc: [{ name: 'Sam Lee', email: 'sam@example.com' }]
    }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(messageWithCc)

    render(<ReadingPane selectedMessageId="msg-1" messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    expect(await screen.findByText(/Cc: Sam Lee/)).toBeInTheDocument()
  })

  it('automatically marks an unread message as read when it is opened', async () => {
    const unreadMessage: MailMessage = { ...MESSAGE, isRead: false }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(unreadMessage)

    render(<ReadingPane selectedMessageId="msg-1" messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await screen.findByText('Quarterly numbers')
    await waitFor(() => expect(window.api.data.messages.update).toHaveBeenCalledWith('msg-1', { isRead: true }))
  })

  it('does not re-mark an already-read message as read', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE) // isRead: true

    render(<ReadingPane selectedMessageId="msg-1" messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await screen.findByText('Quarterly numbers')
    expect(window.api.data.messages.update).not.toHaveBeenCalled()
  })

  it('shows a Mark as unread button for a read message, and calls update to flip it unread', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE) // isRead: true

    render(<ReadingPane selectedMessageId="msg-1" messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    const toggle = await screen.findByRole('button', { name: 'Mark as unread' })
    await user.click(toggle)

    expect(window.api.data.messages.update).toHaveBeenCalledWith('msg-1', { isRead: false })
  })

  it('shows a Mark as read button for an unread message, and calls update to flip it read', async () => {
    const user = userEvent.setup()
    const unreadMessage: MailMessage = { ...MESSAGE, isRead: false }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(unreadMessage)

    render(<ReadingPane selectedMessageId="msg-1" messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    const toggle = await screen.findByRole('button', { name: 'Mark as read' })
    await user.click(toggle)

    expect(window.api.data.messages.update).toHaveBeenCalledWith('msg-1', { isRead: true })
  })

  it('does not immediately re-mark a message read after manually marking it unread while still open (regression)', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE) // isRead: true

    const { rerender } = render(<ReadingPane selectedMessageId="msg-1" messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: 'Mark as unread' }))
    expect(window.api.data.messages.update).toHaveBeenCalledWith('msg-1', { isRead: false })
    vi.mocked(window.api.data.messages.update).mockClear()

    // Simulate what actually happens in the real app: that update broadcasts
    // data:messages-changed, which bumps messagesVersion and re-triggers the
    // fetch effect for this same still-open message — now reflecting the
    // isRead: false we just applied. It must not immediately flip it back.
    vi.mocked(window.api.data.messages.get).mockResolvedValue({ ...MESSAGE, isRead: false })
    rerender(<ReadingPane selectedMessageId="msg-1" messagesVersion={1} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await screen.findByRole('button', { name: 'Mark as read' })
    expect(window.api.data.messages.update).not.toHaveBeenCalled()
  })

  it('does re-auto-mark-read when a different, unread message is opened next', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE) // isRead: true, msg-1
    const { rerender } = render(<ReadingPane selectedMessageId="msg-1" messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)
    await screen.findByText('Quarterly numbers')

    const otherUnread: MailMessage = { ...MESSAGE, id: 'msg-2', subject: 'Different message', isRead: false }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(otherUnread)
    rerender(<ReadingPane selectedMessageId="msg-2" messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await screen.findByText('Different message')
    await waitFor(() => expect(window.api.data.messages.update).toHaveBeenCalledWith('msg-2', { isRead: true }))
  })

  it('shows a Flag button for an unflagged message, and calls update to flag it', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE) // isFlagged: false

    render(<ReadingPane selectedMessageId="msg-1" messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: 'Flag' }))

    expect(window.api.data.messages.update).toHaveBeenCalledWith('msg-1', { isFlagged: true })
  })

  it('shows an Unflag button for a flagged message, and calls update to unflag it', async () => {
    const user = userEvent.setup()
    const flaggedMessage: MailMessage = { ...MESSAGE, isFlagged: true }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(flaggedMessage)

    render(<ReadingPane selectedMessageId="msg-1" messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: 'Unflag' }))

    expect(window.api.data.messages.update).toHaveBeenCalledWith('msg-1', { isFlagged: false })
  })

  it('shows existing categories as removable tags, and calls update with the category removed', async () => {
    const user = userEvent.setup()
    const categorizedMessage: MailMessage = { ...MESSAGE, categories: ['Urgent', 'Client'] }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(categorizedMessage)

    render(<ReadingPane selectedMessageId="msg-1" messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await screen.findByText('Urgent')
    await screen.findByText('Client')

    await user.click(screen.getByRole('button', { name: 'Remove category Urgent' }))

    expect(window.api.data.messages.update).toHaveBeenCalledWith('msg-1', { categories: ['Client'] })
  })

  it('adds a typed category on Enter, and does not add a duplicate of an existing one', async () => {
    const user = userEvent.setup()
    const categorizedMessage: MailMessage = { ...MESSAGE, categories: ['Urgent'] }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(categorizedMessage)

    render(<ReadingPane selectedMessageId="msg-1" messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    const input = await screen.findByLabelText('Add category')

    await user.type(input, 'Client')
    await user.keyboard('{Enter}')
    expect(window.api.data.messages.update).toHaveBeenCalledWith('msg-1', { categories: ['Urgent', 'Client'] })
    expect(input).toHaveValue('')

    vi.mocked(window.api.data.messages.update).mockClear()
    await user.type(input, 'Urgent')
    await user.keyboard('{Enter}')
    expect(window.api.data.messages.update).not.toHaveBeenCalled()
  })

  it('refetches the message when messagesVersion changes', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE)
    const { rerender } = render(<ReadingPane selectedMessageId="msg-1" messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await screen.findByText('Quarterly numbers')
    expect(window.api.data.messages.get).toHaveBeenCalledTimes(1)

    rerender(<ReadingPane selectedMessageId="msg-1" messagesVersion={1} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await waitFor(() => expect(window.api.data.messages.get).toHaveBeenCalledTimes(2))
  })
})
