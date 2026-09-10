// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
  timestamp: new Date('2026-01-15T10:00:00').getTime(),
  isRead: true,
  isFlagged: false,
  categories: [],
  attachments: []
}

describe('ReadingPane', () => {
  it('shows a placeholder when no message is selected', () => {
    render(<ReadingPane selectedMessageId={null} />)

    expect(screen.getByText('Select an item to read.')).toBeInTheDocument()
  })

  it('renders the fetched message content when a message is selected', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE)

    render(<ReadingPane selectedMessageId="msg-1" />)

    expect(await screen.findByText('Quarterly numbers')).toBeInTheDocument()
    expect(screen.getByText('See attached.')).toBeInTheDocument()
    expect(screen.getByText(/Priya Shah/)).toBeInTheDocument()
    expect(screen.getByText(/priya@example\.com/)).toBeInTheDocument()
    expect(window.api.data.messages.get).toHaveBeenCalledWith('msg-1')
  })

  it('goes back to the placeholder when the selection is cleared', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(MESSAGE)
    const { rerender } = render(<ReadingPane selectedMessageId="msg-1" />)

    expect(await screen.findByText('Quarterly numbers')).toBeInTheDocument()

    rerender(<ReadingPane selectedMessageId={null} />)

    expect(screen.getByText('Select an item to read.')).toBeInTheDocument()
    expect(screen.queryByText('Quarterly numbers')).not.toBeInTheDocument()
  })

  it('shows the placeholder if the message cannot be found', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(null)

    render(<ReadingPane selectedMessageId="missing" />)

    await waitFor(() => expect(window.api.data.messages.get).toHaveBeenCalledWith('missing'))
    expect(screen.getByText('Select an item to read.')).toBeInTheDocument()
  })
})
