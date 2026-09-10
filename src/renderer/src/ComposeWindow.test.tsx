// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ComposeWindow from './ComposeWindow'
import type { MailMessage, Persona, TraineeIdentity } from '../../shared/data-types'

const PERSONA: Persona = {
  id: 'p1',
  displayName: 'Morgan Rivera',
  email: 'morgan@example.com',
  role: 'Manager',
  bio: '',
  writingStyleNotes: '',
  extraPrompt: ''
}

const IDENTITY: TraineeIdentity = {
  displayName: 'Jordan Trainee',
  jobTitle: 'Analyst',
  fromEmail: 'jordan.trainee@example.com'
}

function mockClose(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(window, 'close').mockImplementation(() => {})
}

describe('ComposeWindow', () => {
  it('renders To/Subject/Body fields and disables Send without a recipient', () => {
    render(<ComposeWindow />)

    expect(screen.getByLabelText('To')).toBeInTheDocument()
    expect(screen.getByLabelText('Subject')).toBeInTheDocument()
    expect(screen.getByLabelText('Message body')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('populates the To dropdown from configured personas', async () => {
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])

    render(<ComposeWindow />)

    expect(
      await within(screen.getByLabelText('To')).findByRole('option', {
        name: 'Morgan Rivera <morgan@example.com>'
      })
    ).toBeInTheDocument()
  })

  it('enables Send once a recipient is chosen, and sends into the Sent folder', async () => {
    const user = userEvent.setup()
    const close = mockClose()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])
    vi.mocked(window.api.data.identity.get).mockResolvedValue(IDENTITY)

    render(<ComposeWindow />)

    await user.selectOptions(await screen.findByLabelText('To'), 'morgan@example.com')
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()

    await user.type(screen.getByLabelText('Subject'), 'Hello')
    await user.type(screen.getByLabelText('Message body'), 'Body text')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(window.api.data.messages.create).toHaveBeenCalled())
    expect(window.api.data.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        folderId: 'sent',
        toEmail: 'morgan@example.com',
        toName: 'Morgan Rivera',
        subject: 'Hello',
        body: 'Body text',
        fromName: IDENTITY.displayName,
        fromEmail: IDENTITY.fromEmail
      })
    )
    expect(window.api.data.messages.update).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalled()
  })

  it('Save & Close saves into Drafts without requiring a recipient', async () => {
    const user = userEvent.setup()
    const close = mockClose()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])

    render(<ComposeWindow />)

    await user.type(screen.getByLabelText('Subject'), 'Draft subject')
    await user.click(screen.getByRole('button', { name: 'Save & Close' }))

    await waitFor(() => expect(window.api.data.messages.create).toHaveBeenCalled())
    expect(window.api.data.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ folderId: 'drafts', subject: 'Draft subject', toEmail: '' })
    )
    expect(close).toHaveBeenCalled()
  })

  it('prefills from an existing draft and updates the same message on Send', async () => {
    const user = userEvent.setup()
    const close = mockClose()
    const draft: MailMessage = {
      id: 'draft-1',
      folderId: 'drafts',
      subject: 'Existing draft',
      body: 'Existing body',
      fromName: '',
      fromEmail: '',
      toName: 'Morgan Rivera',
      toEmail: 'morgan@example.com',
      cc: [],
      timestamp: Date.now(),
      isRead: true,
      isFlagged: false,
      categories: [],
      attachments: []
    }
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])
    vi.mocked(window.api.data.messages.get).mockResolvedValue(draft)
    vi.mocked(window.api.data.identity.get).mockResolvedValue(IDENTITY)

    render(<ComposeWindow draftId="draft-1" />)

    expect(await screen.findByDisplayValue('Existing draft')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Existing body')).toBeInTheDocument()
    expect(window.api.data.messages.get).toHaveBeenCalledWith('draft-1')

    await user.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(window.api.data.messages.update).toHaveBeenCalled())
    expect(window.api.data.messages.update).toHaveBeenCalledWith(
      'draft-1',
      expect.objectContaining({ folderId: 'sent', subject: 'Existing draft', toEmail: 'morgan@example.com' })
    )
    expect(window.api.data.messages.create).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalled()
  })

  it('keeps showing the draft original recipient even if it is no longer in the persona list', async () => {
    const draft: MailMessage = {
      id: 'draft-2',
      folderId: 'drafts',
      subject: '',
      body: '',
      fromName: '',
      fromEmail: '',
      toName: 'Old Contact',
      toEmail: 'old@example.com',
      cc: [],
      timestamp: Date.now(),
      isRead: true,
      isFlagged: false,
      categories: [],
      attachments: []
    }
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])
    vi.mocked(window.api.data.messages.get).mockResolvedValue(draft)

    render(<ComposeWindow draftId="draft-2" />)

    expect(await screen.findByRole('option', { name: 'Old Contact <old@example.com>' })).toBeInTheDocument()
    expect(screen.getByLabelText('To')).toHaveValue('old@example.com')
  })

  it('Discard closes without persisting anything', async () => {
    const user = userEvent.setup()
    const close = mockClose()

    render(<ComposeWindow />)

    await user.type(screen.getByLabelText('Subject'), 'Should not be saved')
    await user.click(screen.getByRole('button', { name: 'Discard' }))

    expect(window.api.data.messages.create).not.toHaveBeenCalled()
    expect(window.api.data.messages.update).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalled()
  })

  describe('reply / reply all / forward', () => {
    const SOURCE_MESSAGE: MailMessage = {
      id: 'src-1',
      folderId: 'inbox',
      subject: 'Quarterly numbers',
      body: 'See attached.',
      fromName: 'Priya Shah',
      fromEmail: 'priya@example.com',
      toName: 'Jordan Trainee',
      toEmail: 'jordan.trainee@example.com',
      cc: [{ name: 'Sam Lee', email: 'sam@example.com' }],
      timestamp: new Date('2026-01-15T10:00:00').getTime(),
      isRead: true,
      isFlagged: false,
      categories: [],
      attachments: []
    }

    it('reply pre-fills To with the original sender and quotes the original body', async () => {
      vi.mocked(window.api.data.messages.get).mockResolvedValue(SOURCE_MESSAGE)
      vi.mocked(window.api.data.identity.get).mockResolvedValue(IDENTITY)

      render(<ComposeWindow sourceMessageId="src-1" intent="reply" />)

      expect(await screen.findByLabelText('To')).toHaveValue('priya@example.com')
      expect(screen.getByLabelText('Subject')).toHaveValue('Re: Quarterly numbers')
      expect((screen.getByLabelText('Message body') as HTMLTextAreaElement).value).toContain('> See attached.')
      expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
    })

    it('reply mock-sends into Sent the same way as a new compose', async () => {
      const user = userEvent.setup()
      const close = mockClose()
      vi.mocked(window.api.data.messages.get).mockResolvedValue(SOURCE_MESSAGE)
      vi.mocked(window.api.data.identity.get).mockResolvedValue(IDENTITY)

      render(<ComposeWindow sourceMessageId="src-1" intent="reply" />)

      await screen.findByDisplayValue('Re: Quarterly numbers')
      await user.click(screen.getByRole('button', { name: 'Send' }))

      await waitFor(() => expect(window.api.data.messages.create).toHaveBeenCalled())
      expect(window.api.data.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          folderId: 'sent',
          toEmail: 'priya@example.com',
          toName: 'Priya Shah',
          subject: 'Re: Quarterly numbers',
          fromName: IDENTITY.displayName,
          fromEmail: IDENTITY.fromEmail
        })
      )
      expect(close).toHaveBeenCalled()
    })

    it('reply all pre-fills Cc with the other original recipients, and persists Cc on send', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.messages.get).mockResolvedValue(SOURCE_MESSAGE)
      vi.mocked(window.api.data.identity.get).mockResolvedValue(IDENTITY)

      render(<ComposeWindow sourceMessageId="src-1" intent="replyAll" />)

      expect(await screen.findByLabelText('To')).toHaveValue('priya@example.com')
      expect(await screen.findByText('Sam Lee <sam@example.com>')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Send' }))

      await waitFor(() => expect(window.api.data.messages.create).toHaveBeenCalled())
      expect(window.api.data.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          folderId: 'sent',
          toEmail: 'priya@example.com',
          cc: [{ name: 'Sam Lee', email: 'sam@example.com' }]
        })
      )
    })

    it('forward clears To, keeps the quoted body, and allows picking a new recipient', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])
      vi.mocked(window.api.data.messages.get).mockResolvedValue(SOURCE_MESSAGE)
      vi.mocked(window.api.data.identity.get).mockResolvedValue(IDENTITY)

      render(<ComposeWindow sourceMessageId="src-1" intent="forward" />)

      await screen.findByDisplayValue('Fwd: Quarterly numbers')
      expect(screen.getByLabelText('To')).toHaveValue('')
      expect((screen.getByLabelText('Message body') as HTMLTextAreaElement).value).toContain('> See attached.')
      expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()

      await user.selectOptions(screen.getByLabelText('To'), 'morgan@example.com')

      expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()

      await user.click(screen.getByRole('button', { name: 'Send' }))

      await waitFor(() => expect(window.api.data.messages.create).toHaveBeenCalled())
      expect(window.api.data.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          folderId: 'sent',
          toEmail: 'morgan@example.com',
          subject: 'Fwd: Quarterly numbers'
        })
      )
    })
  })
})
