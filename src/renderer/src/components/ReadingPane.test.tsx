// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReadingPane from './ReadingPane'
import type { FileVineFolder, MailMessage } from '../../../shared/data-types'

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
    render(<ReadingPane selectedMessageId={null} selectedCount={0} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    expect(screen.getByText('Select an item to read.')).toBeInTheDocument()
  })

  it('renders the fetched message content when a message is selected', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE)

    render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    expect(await screen.findByText('Quarterly numbers')).toBeInTheDocument()
    expect(screen.getByText('See attached.')).toBeInTheDocument()
    expect(screen.getByText(/Priya Shah/)).toBeInTheDocument()
    expect(screen.getByText(/priya@example\.com/)).toBeInTheDocument()
    expect(window.api.data.messages.get).toHaveBeenCalledWith('msg-1')
  })

  it('goes back to the placeholder when the selection is cleared', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE)
    const { rerender } = render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    expect(await screen.findByText('Quarterly numbers')).toBeInTheDocument()

    rerender(<ReadingPane selectedMessageId={null} selectedCount={0} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    expect(screen.getByText('Select an item to read.')).toBeInTheDocument()
    expect(screen.queryByText('Quarterly numbers')).not.toBeInTheDocument()
  })

  it('shows the placeholder if the message cannot be found', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(null)

    render(<ReadingPane selectedMessageId="missing" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await waitFor(() => expect(window.api.data.messages.get).toHaveBeenCalledWith('missing'))
    expect(screen.getByText('Select an item to read.')).toBeInTheDocument()
  })

  it('shows an Edit draft button for a message in Drafts and calls onEditDraft with it', async () => {
    const user = userEvent.setup()
    const draftMessage: MailMessage = { ...MESSAGE, id: 'draft-1', folderId: 'drafts' }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(draftMessage)
    const onEditDraft = vi.fn()

    render(<ReadingPane selectedMessageId="draft-1" selectedCount={1} messagesVersion={0} onEditDraft={onEditDraft} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    const editButton = await screen.findByRole('button', { name: 'Edit draft' })
    await user.click(editButton)

    expect(onEditDraft).toHaveBeenCalledWith(draftMessage)
  })

  it('does not show an Edit draft button for a message outside Drafts', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE)

    render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

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
        selectedMessageId="msg-1" selectedCount={1}
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
        selectedMessageId="draft-1" selectedCount={1}
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
        selectedMessageId="msg-1" selectedCount={1}
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
        selectedMessageId="draft-1" selectedCount={1}
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
        selectedMessageId="deleted-1" selectedCount={1}
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

    render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    expect(await screen.findByText(/Cc: Sam Lee/)).toBeInTheDocument()
  })

  it('automatically marks an unread message as read when it is opened', async () => {
    const unreadMessage: MailMessage = { ...MESSAGE, isRead: false }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(unreadMessage)

    render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await screen.findByText('Quarterly numbers')
    await waitFor(() => expect(window.api.data.messages.update).toHaveBeenCalledWith('msg-1', { isRead: true }))
  })

  it('does not re-mark an already-read message as read', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE) // isRead: true

    render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await screen.findByText('Quarterly numbers')
    expect(window.api.data.messages.update).not.toHaveBeenCalled()
  })

  it('shows a Mark as unread button for a read message, and calls update to flip it unread', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE) // isRead: true

    render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    const toggle = await screen.findByRole('button', { name: 'Mark as unread' })
    await user.click(toggle)

    expect(window.api.data.messages.update).toHaveBeenCalledWith('msg-1', { isRead: false })
  })

  it('shows a Mark as read button for an unread message, and calls update to flip it read', async () => {
    const user = userEvent.setup()
    const unreadMessage: MailMessage = { ...MESSAGE, isRead: false }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(unreadMessage)

    render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    const toggle = await screen.findByRole('button', { name: 'Mark as read' })
    await user.click(toggle)

    expect(window.api.data.messages.update).toHaveBeenCalledWith('msg-1', { isRead: true })
  })

  it('does not immediately re-mark a message read after manually marking it unread while still open (regression)', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE) // isRead: true

    const { rerender } = render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: 'Mark as unread' }))
    expect(window.api.data.messages.update).toHaveBeenCalledWith('msg-1', { isRead: false })
    vi.mocked(window.api.data.messages.update).mockClear()

    // Simulate what actually happens in the real app: that update broadcasts
    // data:messages-changed, which bumps messagesVersion and re-triggers the
    // fetch effect for this same still-open message — now reflecting the
    // isRead: false we just applied. It must not immediately flip it back.
    vi.mocked(window.api.data.messages.get).mockResolvedValue({ ...MESSAGE, isRead: false })
    rerender(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={1} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await screen.findByRole('button', { name: 'Mark as read' })
    expect(window.api.data.messages.update).not.toHaveBeenCalled()
  })

  it('does re-auto-mark-read when a different, unread message is opened next', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE) // isRead: true, msg-1
    const { rerender } = render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)
    await screen.findByText('Quarterly numbers')

    const otherUnread: MailMessage = { ...MESSAGE, id: 'msg-2', subject: 'Different message', isRead: false }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(otherUnread)
    rerender(<ReadingPane selectedMessageId="msg-2" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await screen.findByText('Different message')
    await waitFor(() => expect(window.api.data.messages.update).toHaveBeenCalledWith('msg-2', { isRead: true }))
  })

  it('shows a Flag button for an unflagged message, and calls update to flag it', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE) // isFlagged: false

    render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: 'Flag' }))

    expect(window.api.data.messages.update).toHaveBeenCalledWith('msg-1', { isFlagged: true })
  })

  it('shows an Unflag button for a flagged message, and calls update to unflag it', async () => {
    const user = userEvent.setup()
    const flaggedMessage: MailMessage = { ...MESSAGE, isFlagged: true }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(flaggedMessage)

    render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: 'Unflag' }))

    expect(window.api.data.messages.update).toHaveBeenCalledWith('msg-1', { isFlagged: false })
  })

  it('shows existing categories as removable tags, and calls update with the category removed', async () => {
    const user = userEvent.setup()
    const categorizedMessage: MailMessage = { ...MESSAGE, categories: ['Urgent', 'Client'] }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(categorizedMessage)

    render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await screen.findByText('Urgent')
    await screen.findByText('Client')

    await user.click(screen.getByRole('button', { name: 'Remove category Urgent' }))

    expect(window.api.data.messages.update).toHaveBeenCalledWith('msg-1', { categories: ['Client'] })
  })

  it('adds a typed category on Enter, and does not add a duplicate of an existing one', async () => {
    const user = userEvent.setup()
    const categorizedMessage: MailMessage = { ...MESSAGE, categories: ['Urgent'] }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(categorizedMessage)

    render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

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

  it('renders each attachment as a filename with a placeholder icon, with no note shown until clicked', async () => {
    const messageWithAttachments: MailMessage = {
      ...MESSAGE,
      attachments: [{ filename: 'report.pdf' }, { filename: 'photo.jpg' }]
    }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(messageWithAttachments)

    render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    expect(await screen.findByRole('button', { name: /report\.pdf/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /photo\.jpg/ })).toBeInTheDocument()
    expect(screen.queryByText(/no file content/)).not.toBeInTheDocument()
  })

  it('B004/025 AC2: reopening a Sent Items message shows its attachments same as any other folder', async () => {
    const sentMessageWithAttachment: MailMessage = {
      ...MESSAGE,
      folderId: 'sent',
      attachments: [{ filename: 'contract.pdf' }]
    }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(sentMessageWithAttachment)

    render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    expect(await screen.findByRole('button', { name: /contract\.pdf/ })).toBeInTheDocument()
  })

  it('shows no attachments row for a message with none', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE) // attachments: []

    render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await screen.findByText('Quarterly numbers')
    expect(screen.queryByText(/no file content/)).not.toBeInTheDocument()
  })

  it('"opening" a mock attachment only toggles a placeholder note, with no file/network API called', async () => {
    const user = userEvent.setup()
    const messageWithAttachment: MailMessage = { ...MESSAGE, attachments: [{ filename: 'report.pdf' }] }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(messageWithAttachment)

    render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    const attachmentButton = await screen.findByRole('button', { name: /report\.pdf/ })
    await user.click(attachmentButton)

    expect(screen.getByText('Mock attachment — no file content.')).toBeInTheDocument()

    await user.click(attachmentButton)
    expect(screen.queryByText('Mock attachment — no file content.')).not.toBeInTheDocument()

    // A true mock attachment (no `path`) never touches the filesystem —
    // only a real attachment (feature 065) opens via the OS.
    expect(window.api.data.messages.update).not.toHaveBeenCalled()
    expect(window.api.attachments.open).not.toHaveBeenCalled()
  })

  it('067 AC1: clicking a real attachment (with a path) opens the attachment pop-out instead of toggling a placeholder', async () => {
    const user = userEvent.setup()
    const messageWithRealAttachment: MailMessage = {
      ...MESSAGE,
      attachments: [{ filename: 'settlement-offer.html', path: '/home/trainee/settlement-offer.html' }]
    }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(messageWithRealAttachment)

    render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    const attachmentButton = await screen.findByRole('button', { name: /settlement-offer\.html/ })
    await user.click(attachmentButton)

    expect(window.api.attachmentPopout.open).toHaveBeenCalledWith('msg-1', 0)
    // 067 replaces the old direct-to-OS handoff (065) as the click action —
    // that affordance now lives inside the pop-out itself as a fallback.
    expect(window.api.attachments.open).not.toHaveBeenCalled()
    expect(screen.queryByText('Mock attachment — no file content.')).not.toBeInTheDocument()
  })

  it('067 AC1: opens the pop-out with the clicked attachment\'s own index, for a message with several attachments', async () => {
    const user = userEvent.setup()
    const message: MailMessage = {
      ...MESSAGE,
      attachments: [
        { filename: 'first.pdf', path: '/tmp/first.pdf' },
        { filename: 'second.pdf', path: '/tmp/second.pdf' }
      ]
    }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(message)

    render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: /second\.pdf/ }))

    expect(window.api.attachmentPopout.open).toHaveBeenCalledWith('msg-1', 1)
  })

  it('resets the open attachment note when a different message is selected', async () => {
    const user = userEvent.setup()
    const messageWithAttachment: MailMessage = { ...MESSAGE, attachments: [{ filename: 'report.pdf' }] }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(messageWithAttachment)

    const { rerender } = render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: /report\.pdf/ }))
    expect(screen.getByText('Mock attachment — no file content.')).toBeInTheDocument()

    const otherMessage: MailMessage = { ...MESSAGE, id: 'msg-2', subject: 'Different message' }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(otherMessage)
    rerender(<ReadingPane selectedMessageId="msg-2" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await screen.findByText('Different message')
    expect(screen.queryByText('Mock attachment — no file content.')).not.toBeInTheDocument()
  })

  describe('066: Save an attachment into FileVine', () => {
    // Content from an LLM-generated attachment (065's `extractedText` is
    // its Markdown source) and content from a real attachment's extraction
    // (063) look identical from `ReadingPane`'s point of view — the whole
    // point of this feature is that neither gets special-cased.
    const ATTACHMENT_WITH_CONTENT: MailMessage['attachments'][number] = {
      filename: 'settlement-offer.html',
      path: '/data/generated-attachments/uuid/settlement-offer.html',
      extractedText: '# Settlement Offer\n\nAmount: $5,000'
    }
    const FOLDER: FileVineFolder = { id: 'folder-1', name: 'Smith v. Jones', parentId: null, clientPersonaId: null }
    const OTHER_FOLDER: FileVineFolder = { id: 'folder-2', name: 'Doe Estate', parentId: null, clientPersonaId: null }

    it('AC1: any attachment with content shows the action — a real one and an LLM-generated one alike', async () => {
      const message: MailMessage = {
        ...MESSAGE,
        attachments: [
          ATTACHMENT_WITH_CONTENT,
          { filename: 'report.pdf', path: '/tmp/report.pdf', extractedText: 'Q3 revenue.' }
        ]
      }
      vi.mocked(window.api.data.messages.get).mockResolvedValue(message)

      render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

      await screen.findByRole('button', { name: /settlement-offer\.html/ })
      // Both attachments have content — neither is a "generated" vs "real"
      // special case, so both get the action.
      expect(screen.getAllByRole('button', { name: /Save to FileVine/ })).toHaveLength(2)
    })

    it('AC1: an attachment with no content (a true mock, or an unsupported/failed extraction) gets no action', async () => {
      const message: MailMessage = {
        ...MESSAGE,
        attachments: [{ filename: 'photo.jpg', path: '/tmp/photo.jpg' }]
      }
      vi.mocked(window.api.data.messages.get).mockResolvedValue(message)

      render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

      await screen.findByRole('button', { name: /photo\.jpg/ })
      expect(screen.queryByRole('button', { name: /Save to FileVine/ })).not.toBeInTheDocument()
    })

    it('AC1/AC2: picking an existing folder and saving creates a note with the attachment\'s content', async () => {
      const user = userEvent.setup()
      const message: MailMessage = { ...MESSAGE, attachments: [ATTACHMENT_WITH_CONTENT] }
      vi.mocked(window.api.data.messages.get).mockResolvedValue(message)
      vi.mocked(window.api.data.fileVineFolders.list).mockResolvedValue([FOLDER, OTHER_FOLDER])

      render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

      await user.click(await screen.findByRole('button', { name: /Save to FileVine/ }))
      expect(await screen.findByRole('option', { name: 'Smith v. Jones' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Doe Estate' })).toBeInTheDocument()

      await user.selectOptions(screen.getByLabelText('Folder'), 'folder-2')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(window.api.data.fileVineNotes.create).toHaveBeenCalledWith({
        folderId: 'folder-2',
        name: 'settlement-offer.html',
        content: '# Settlement Offer\n\nAmount: $5,000'
      })
      // The dialog closes once the save completes.
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    })

    it('AC3: saving never touches the original message or its attachment', async () => {
      const user = userEvent.setup()
      const message: MailMessage = { ...MESSAGE, attachments: [ATTACHMENT_WITH_CONTENT] }
      vi.mocked(window.api.data.messages.get).mockResolvedValue(message)
      vi.mocked(window.api.data.fileVineFolders.list).mockResolvedValue([FOLDER])

      render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

      await user.click(await screen.findByRole('button', { name: /Save to FileVine/ }))
      await user.click(await screen.findByRole('button', { name: 'Save' }))

      expect(window.api.data.messages.update).not.toHaveBeenCalled()
      // The filename button and the attachment's own file both remain: the
      // real save call only ever touched the FileVine note API above.
      expect(await screen.findByRole('button', { name: /settlement-offer\.html/ })).toBeInTheDocument()
    })

    it('AC4: with no FileVine folders yet, offers an inline create-folder-and-save path instead of a dead end', async () => {
      const user = userEvent.setup()
      const message: MailMessage = { ...MESSAGE, attachments: [ATTACHMENT_WITH_CONTENT] }
      vi.mocked(window.api.data.messages.get).mockResolvedValue(message)
      vi.mocked(window.api.data.fileVineFolders.list).mockResolvedValue([])
      vi.mocked(window.api.data.fileVineFolders.create).mockResolvedValue({
        id: 'new-folder',
        name: 'New Case',
        parentId: null,
        clientPersonaId: null
      })

      render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

      await user.click(await screen.findByRole('button', { name: /Save to FileVine/ }))
      expect(await screen.findByText('No FileVine folders yet — create one to save into.')).toBeInTheDocument()
      // No dead end: a real folder-name input and submit button are right there.
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()

      await user.type(screen.getByRole('textbox', { name: 'New FileVine folder name' }), 'New Case')
      await user.click(screen.getByRole('button', { name: /Create folder/ }))

      expect(window.api.data.fileVineFolders.create).toHaveBeenCalledWith({ name: 'New Case' })
      expect(window.api.data.fileVineNotes.create).toHaveBeenCalledWith({
        folderId: 'new-folder',
        name: 'settlement-offer.html',
        content: '# Settlement Offer\n\nAmount: $5,000'
      })
    })

    it('does not submit the create-folder form with a blank name', async () => {
      const user = userEvent.setup()
      const message: MailMessage = { ...MESSAGE, attachments: [ATTACHMENT_WITH_CONTENT] }
      vi.mocked(window.api.data.messages.get).mockResolvedValue(message)
      vi.mocked(window.api.data.fileVineFolders.list).mockResolvedValue([])

      render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

      await user.click(await screen.findByRole('button', { name: /Save to FileVine/ }))
      await screen.findByText('No FileVine folders yet — create one to save into.')
      await user.click(screen.getByRole('button', { name: /Create folder/ }))

      expect(window.api.data.fileVineFolders.create).not.toHaveBeenCalled()
      expect(window.api.data.fileVineNotes.create).not.toHaveBeenCalled()
    })

    it('Cancel closes the dialog without saving anything', async () => {
      const user = userEvent.setup()
      const message: MailMessage = { ...MESSAGE, attachments: [ATTACHMENT_WITH_CONTENT] }
      vi.mocked(window.api.data.messages.get).mockResolvedValue(message)
      vi.mocked(window.api.data.fileVineFolders.list).mockResolvedValue([FOLDER])

      render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

      await user.click(await screen.findByRole('button', { name: /Save to FileVine/ }))
      await screen.findByRole('button', { name: 'Save' })
      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
      expect(window.api.data.fileVineNotes.create).not.toHaveBeenCalled()
    })

    it('resets the save dialog when a different message is selected', async () => {
      const user = userEvent.setup()
      const message: MailMessage = { ...MESSAGE, attachments: [ATTACHMENT_WITH_CONTENT] }
      vi.mocked(window.api.data.messages.get).mockResolvedValue(message)
      vi.mocked(window.api.data.fileVineFolders.list).mockResolvedValue([FOLDER])

      const { rerender } = render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

      await user.click(await screen.findByRole('button', { name: /Save to FileVine/ }))
      await screen.findByRole('button', { name: 'Save' })

      const otherMessage: MailMessage = { ...MESSAGE, id: 'msg-2', subject: 'Different message', attachments: [] }
      vi.mocked(window.api.data.messages.get).mockResolvedValue(otherMessage)
      rerender(<ReadingPane selectedMessageId="msg-2" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

      await screen.findByText('Different message')
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    })
  })

  it('refetches the message when messagesVersion changes', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE)
    const { rerender } = render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await screen.findByText('Quarterly numbers')
    expect(window.api.data.messages.get).toHaveBeenCalledTimes(1)

    rerender(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={1} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    await waitFor(() => expect(window.api.data.messages.get).toHaveBeenCalledTimes(2))
  })

  // Multi-select neutral state (feature 039 AC4)

  it('039 AC4: shows a neutral "N selected" state instead of the single message when multiple are selected', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE)

    const { rerender } = render(
      <ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />
    )
    expect(await screen.findByText('Quarterly numbers')).toBeInTheDocument()

    rerender(
      <ReadingPane selectedMessageId={null} selectedCount={3} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />
    )

    expect(screen.getByText('3 selected')).toBeInTheDocument()
    expect(screen.queryByText('Quarterly numbers')).not.toBeInTheDocument()
    expect(screen.queryByText('Select an item to read.')).not.toBeInTheDocument()
  })

  it('039 AC4: still shows "Select an item to read." when nothing is selected (selectedCount 0)', () => {
    render(
      <ReadingPane selectedMessageId={null} selectedCount={0} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />
    )

    expect(screen.getByText('Select an item to read.')).toBeInTheDocument()
  })

  it('039 AC4: going from multiple selected back to exactly one shows that single message again', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE)

    const { rerender } = render(
      <ReadingPane selectedMessageId={null} selectedCount={2} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />
    )
    expect(screen.getByText('2 selected')).toBeInTheDocument()

    rerender(
      <ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />
    )

    expect(await screen.findByText('Quarterly numbers')).toBeInTheDocument()
    expect(screen.queryByText('2 selected')).not.toBeInTheDocument()
  })

  it('037 AC3: an unflagged message shows the Flag toggle without the "flagged" class', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE) // isFlagged: false

    render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    const flagButton = await screen.findByRole('button', { name: 'Flag' })
    expect(flagButton.className.split(' ')).toEqual(['reading-pane-flag-toggle'])
  })

  it('037 AC3: a flagged message in the default (Inbox-like) view shows the Flag toggle with the "flagged" class', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue({ ...MESSAGE, isFlagged: true })

    render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    const unflagButton = await screen.findByRole('button', { name: 'Unflag' })
    expect(unflagButton.className.split(' ')).toEqual(expect.arrayContaining(['reading-pane-flag-toggle', 'flagged']))
  })

  it('037 AC3: a flagged message in Drafts shows the Flag toggle with the "flagged" class', async () => {
    const flaggedDraft: MailMessage = { ...MESSAGE, id: 'draft-1', folderId: 'drafts', isFlagged: true }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(flaggedDraft)

    render(<ReadingPane selectedMessageId="draft-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    const unflagButton = await screen.findByRole('button', { name: 'Unflag' })
    expect(unflagButton.className.split(' ')).toEqual(expect.arrayContaining(['reading-pane-flag-toggle', 'flagged']))
  })

  it('058: Delete and the read/unread toggle each get their own semantic-color class, for a message outside Drafts/Deleted Items', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE)

    render(<ReadingPane selectedMessageId="msg-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    expect(await screen.findByRole('button', { name: 'Delete' })).toHaveClass('reading-pane-delete-btn')
    expect(screen.getByRole('button', { name: 'Mark as unread' })).toHaveClass('reading-pane-read-toggle')
  })

  it('058: Delete and the read/unread toggle keep their semantic-color class in Drafts (Delete) and Deleted Items (Delete permanently)', async () => {
    const draftMessage: MailMessage = { ...MESSAGE, id: 'draft-1', folderId: 'drafts' }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(draftMessage)

    render(<ReadingPane selectedMessageId="draft-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    expect(await screen.findByRole('button', { name: 'Delete' })).toHaveClass('reading-pane-delete-btn')
    expect(screen.getByRole('button', { name: 'Mark as unread' })).toHaveClass('reading-pane-read-toggle')

    const deletedMessage: MailMessage = { ...MESSAGE, id: 'deleted-1', folderId: 'deleted', previousFolderId: 'inbox' }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(deletedMessage)
    render(<ReadingPane selectedMessageId="deleted-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    expect(await screen.findByRole('button', { name: 'Delete permanently' })).toHaveClass('reading-pane-delete-btn')
  })

  it('037 AC3: a flagged message in Deleted Items shows the Flag toggle with the "flagged" class', async () => {
    const flaggedDeleted: MailMessage = {
      ...MESSAGE,
      id: 'deleted-1',
      folderId: 'deleted',
      previousFolderId: 'inbox',
      isFlagged: true
    }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(flaggedDeleted)

    render(<ReadingPane selectedMessageId="deleted-1" selectedCount={1} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onPermanentDelete={vi.fn()} />)

    const unflagButton = await screen.findByRole('button', { name: 'Unflag' })
    expect(unflagButton.className.split(' ')).toEqual(expect.arrayContaining(['reading-pane-flag-toggle', 'flagged']))
  })
})
