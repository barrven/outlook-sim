// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AttachmentPopoutWindow from './AttachmentPopoutWindow'
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

describe('AttachmentPopoutWindow', () => {
  it('fetches the parent message by id and shows the given attachment\'s filename', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(
      makeMessage({ attachments: [{ filename: 'report.pdf', path: '/tmp/report.pdf', extractedText: 'Q3 up 12%.' }] })
    )

    render(<AttachmentPopoutWindow messageId="msg-1" attachmentIndex={0} />)

    expect(await screen.findByText('report.pdf')).toBeInTheDocument()
    expect(window.api.data.messages.get).toHaveBeenCalledWith('msg-1')
  })

  it('AC2: an attachment ending in .html with extractedText renders as Markdown-derived HTML', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(
      makeMessage({
        attachments: [
          {
            filename: 'settlement-offer.html',
            path: '/data/generated-attachments/uuid/settlement-offer.html',
            extractedText: '# Settlement Offer\n\n**Amount due:** $5,000'
          }
        ]
      })
    )

    render(<AttachmentPopoutWindow messageId="msg-1" attachmentIndex={0} />)

    // A real heading/bold element, not the literal Markdown source text —
    // proof it went through the renderer, not a plain-text dump.
    const heading = await screen.findByRole('heading', { name: 'Settlement Offer' })
    expect(heading.tagName).toBe('H1')
    expect(screen.getByText('Amount due:').tagName).toBe('STRONG')
    expect(screen.queryByText(/# Settlement Offer/)).not.toBeInTheDocument()
  })

  it('AC3: a real attachment\'s extracted text (not ending in .html) renders verbatim, not Markdown-parsed', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(
      makeMessage({
        attachments: [
          { filename: 'report.pdf', path: '/tmp/report.pdf', extractedText: '# Not a heading, just text with a #.' }
        ]
      })
    )

    render(<AttachmentPopoutWindow messageId="msg-1" attachmentIndex={0} />)

    expect(await screen.findByText('# Not a heading, just text with a #.')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('AC3: a .html attachment with no extractedText (not the generated-document shape) falls back, not rendered as HTML', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(
      makeMessage({ attachments: [{ filename: 'page.html', path: '/home/trainee/page.html' }] })
    )

    render(<AttachmentPopoutWindow messageId="msg-1" attachmentIndex={0} />)

    expect(await screen.findByText('No preview is available for this file.')).toBeInTheDocument()
  })

  it('AC3: no extractedText and no recognizable content falls back to filename + open-with-default-app', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.get).mockResolvedValue(
      makeMessage({ attachments: [{ filename: 'photo.jpg', path: '/home/trainee/photo.jpg' }] })
    )

    render(<AttachmentPopoutWindow messageId="msg-1" attachmentIndex={0} />)

    expect(await screen.findByText('No preview is available for this file.')).toBeInTheDocument()
    const openButton = screen.getByRole('button', { name: 'Open with your default application' })
    await user.click(openButton)

    expect(window.api.attachments.open).toHaveBeenCalledWith('/home/trainee/photo.jpg')
  })

  it('AC4: the window is a standalone fetch scoped to this one message/attachment — no shared state with anything else', async () => {
    vi.mocked(window.api.data.messages.get).mockResolvedValue(
      makeMessage({ attachments: [{ filename: 'report.pdf', path: '/tmp/report.pdf', extractedText: 'hi' }] })
    )

    render(<AttachmentPopoutWindow messageId="msg-1" attachmentIndex={0} />)
    await screen.findByText('report.pdf')

    // Only the one fetch this window needed — nothing else (no messages
    // list, no cross-window broadcast subscription) ties it to the main
    // window's own state.
    expect(window.api.data.messages.get).toHaveBeenCalledTimes(1)
    expect(window.api.onMessagesChanged).not.toHaveBeenCalled()
  })

  it('AC4: closes itself if the message no longer exists', async () => {
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {})
    vi.mocked(window.api.data.messages.get).mockResolvedValue(null)

    render(<AttachmentPopoutWindow messageId="msg-1" attachmentIndex={0} />)

    await waitFor(() => expect(closeSpy).toHaveBeenCalled())
  })

  it('AC4: closes itself if the attachment index no longer exists on the message', async () => {
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {})
    vi.mocked(window.api.data.messages.get).mockResolvedValue(makeMessage({ attachments: [] }))

    render(<AttachmentPopoutWindow messageId="msg-1" attachmentIndex={0} />)

    await waitFor(() => expect(closeSpy).toHaveBeenCalled())
  })
})
