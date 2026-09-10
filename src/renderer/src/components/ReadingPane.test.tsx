// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReadingPane from './ReadingPane'
import type { MailMessage } from '../../../shared/data-types'

const MESSAGE: MailMessage = {
  id: 'msg-1',
  folderId: 'inbox',
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
    render(<ReadingPane selectedMessageId={null} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} />)

    expect(screen.getByText('Select an item to read.')).toBeInTheDocument()
  })

  it('renders the fetched message content when a message is selected', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE)

    render(<ReadingPane selectedMessageId="msg-1" messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} />)

    expect(await screen.findByText('Quarterly numbers')).toBeInTheDocument()
    expect(screen.getByText('See attached.')).toBeInTheDocument()
    expect(screen.getByText(/Priya Shah/)).toBeInTheDocument()
    expect(screen.getByText(/priya@example\.com/)).toBeInTheDocument()
    expect(window.api.data.messages.get).toHaveBeenCalledWith('msg-1')
  })

  it('goes back to the placeholder when the selection is cleared', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE)
    const { rerender } = render(<ReadingPane selectedMessageId="msg-1" messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} />)

    expect(await screen.findByText('Quarterly numbers')).toBeInTheDocument()

    rerender(<ReadingPane selectedMessageId={null} messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} />)

    expect(screen.getByText('Select an item to read.')).toBeInTheDocument()
    expect(screen.queryByText('Quarterly numbers')).not.toBeInTheDocument()
  })

  it('shows the placeholder if the message cannot be found', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(null)

    render(<ReadingPane selectedMessageId="missing" messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} />)

    await waitFor(() => expect(window.api.data.messages.get).toHaveBeenCalledWith('missing'))
    expect(screen.getByText('Select an item to read.')).toBeInTheDocument()
  })

  it('shows an Edit draft button for a message in Drafts and calls onEditDraft with it', async () => {
    const user = userEvent.setup()
    const draftMessage: MailMessage = { ...MESSAGE, id: 'draft-1', folderId: 'drafts' }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(draftMessage)
    const onEditDraft = vi.fn()

    render(<ReadingPane selectedMessageId="draft-1" messagesVersion={0} onEditDraft={onEditDraft} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} />)

    const editButton = await screen.findByRole('button', { name: 'Edit draft' })
    await user.click(editButton)

    expect(onEditDraft).toHaveBeenCalledWith(draftMessage)
  })

  it('does not show an Edit draft button for a message outside Drafts', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE)

    render(<ReadingPane selectedMessageId="msg-1" messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} />)

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
      />
    )

    await screen.findByRole('button', { name: 'Edit draft' })
    expect(screen.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reply All' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Forward' })).not.toBeInTheDocument()
  })

  it('shows Cc recipients in the header when present', async () => {
    const messageWithCc: MailMessage = {
      ...MESSAGE,
      cc: [{ name: 'Sam Lee', email: 'sam@example.com' }]
    }
    vi.mocked(window.api.data.messages.get).mockResolvedValue(messageWithCc)

    render(<ReadingPane selectedMessageId="msg-1" messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} />)

    expect(await screen.findByText(/Cc: Sam Lee/)).toBeInTheDocument()
  })

  it('refetches the message when messagesVersion changes', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE)
    const { rerender } = render(<ReadingPane selectedMessageId="msg-1" messagesVersion={0} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} />)

    await screen.findByText('Quarterly numbers')
    expect(window.api.data.messages.get).toHaveBeenCalledTimes(1)

    rerender(<ReadingPane selectedMessageId="msg-1" messagesVersion={1} onEditDraft={vi.fn()} onReply={vi.fn()} onReplyAll={vi.fn()} onForward={vi.fn()} />)

    await waitFor(() => expect(window.api.data.messages.get).toHaveBeenCalledTimes(2))
  })
})
