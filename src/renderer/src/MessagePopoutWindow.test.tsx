// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MessagePopoutWindow from './MessagePopoutWindow'
import type { MailMessage } from '../../shared/data-types'

function makeMessage(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
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
    attachments: [],
    ...overrides
  }
}

describe('MessagePopoutWindow', () => {
  // AC1: the pop-out shows the message's full content — via the real
  // ReadingPane, not a reimplementation, so this is content parity by
  // construction; confirmed here by checking the fetch is scoped to the
  // right id and the fetched content actually renders.
  it('041 AC1: renders the given message\'s full content via the real ReadingPane', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(makeMessage())

    render(<MessagePopoutWindow messageId="msg-1" />)

    expect(await screen.findByText('Quarterly numbers')).toBeInTheDocument()
    expect(screen.getByText('See attached.')).toBeInTheDocument()
    expect(screen.getByText(/Priya Shah/)).toBeInTheDocument()
    expect(window.api.data.messages.get).toHaveBeenCalledWith('msg-1')
  })

  // AC2: reflects live state, via the same cross-window broadcast pattern
  // the main window already uses.
  it('041 AC2: refetches the message when the main-process data:messages-changed broadcast fires', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(makeMessage({ isFlagged: false }))

    render(<MessagePopoutWindow messageId="msg-1" />)
    await screen.findByText('Quarterly numbers')
    expect(window.api.data.messages.get).toHaveBeenCalledTimes(1)

    // Simulate the main process broadcasting a change (e.g. the message
    // was flagged from the main window, or from this pop-out's own
    // toggle below) — the same listener App.tsx registers.
    const [onMessagesChanged] = vi.mocked(window.api.onMessagesChanged).mock.calls[0]
    vi.mocked(window.api.data.messages.get).mockResolvedValue(makeMessage({ isFlagged: true }))
    onMessagesChanged()

    await waitFor(() => expect(window.api.data.messages.get).toHaveBeenCalledTimes(2))
  })

  it('041 AC2: subscribes to onMessagesChanged and unsubscribes on unmount', () => {
    const unsubscribe = vi.fn()
    vi.mocked(window.api.onMessagesChanged).mockReturnValue(unsubscribe)
    vi.mocked(window.api.data.messages.get).mockResolvedValue(makeMessage())

    const { unmount } = render(<MessagePopoutWindow messageId="msg-1" />)
    expect(window.api.onMessagesChanged).toHaveBeenCalledTimes(1)

    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  // Action wiring — each action call is real (not a stub the host
  // swallows), matching what the same buttons do in the main window's
  // inline Reading Pane.
  it('Reply/Reply All/Forward call compose.open with this message as the source', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.get).mockResolvedValue(makeMessage())

    render(<MessagePopoutWindow messageId="msg-1" />)
    await screen.findByText('Quarterly numbers')

    await user.click(screen.getByRole('button', { name: 'Reply' }))
    expect(window.api.compose.open).toHaveBeenCalledWith({ sourceMessageId: 'msg-1', intent: 'reply' })

    await user.click(screen.getByRole('button', { name: 'Reply All' }))
    expect(window.api.compose.open).toHaveBeenCalledWith({ sourceMessageId: 'msg-1', intent: 'replyAll' })

    await user.click(screen.getByRole('button', { name: 'Forward' }))
    expect(window.api.compose.open).toHaveBeenCalledWith({ sourceMessageId: 'msg-1', intent: 'forward' })
  })

  it('Delete moves the message to Deleted Items, preserving its prior folder', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.get).mockResolvedValue(makeMessage({ folderId: 'inbox' }))

    render(<MessagePopoutWindow messageId="msg-1" />)
    await screen.findByText('Quarterly numbers')

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(window.api.data.messages.update).toHaveBeenCalledWith('msg-1', {
      folderId: 'deleted',
      previousFolderId: 'inbox'
    })
  })

  it('a message already in Deleted Items shows Restore/Delete permanently instead, both wired', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.get).mockResolvedValue(
      makeMessage({ folderId: 'deleted', previousFolderId: 'inbox' })
    )

    render(<MessagePopoutWindow messageId="msg-1" />)
    await screen.findByText('Quarterly numbers')

    expect(screen.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Restore' }))
    expect(window.api.data.messages.update).toHaveBeenCalledWith('msg-1', {
      folderId: 'inbox',
      previousFolderId: null
    })

    await user.click(screen.getByRole('button', { name: 'Delete permanently' }))
    expect(window.api.data.messages.delete).toHaveBeenCalledWith('msg-1')
  })

  it('a draft message shows Edit draft, wired to open it in the compose window', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.get).mockResolvedValue(makeMessage({ folderId: 'drafts' }))

    render(<MessagePopoutWindow messageId="msg-1" />)
    await screen.findByText('Quarterly numbers')

    await user.click(screen.getByRole('button', { name: 'Edit draft' }))
    expect(window.api.compose.open).toHaveBeenCalledWith({ draftId: 'msg-1' })
  })
})
