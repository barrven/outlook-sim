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
  extraPrompt: '',
  isClient: false,
  reportsTo: ''
}

const IDENTITY: TraineeIdentity = {
  displayName: 'Jordan Trainee',
  jobTitle: 'Analyst',
  fromEmail: 'jordan.trainee@example.com',
  reportsTo: '',
  department: ''
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
        fromEmail: IDENTITY.fromEmail,
        isRead: true
      })
    )
    expect(window.api.data.messages.update).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalled()
  })

  it('stamps a sent message with the simulated clock time, not wall-clock time', async () => {
    const user = userEvent.setup()
    mockClose()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])
    vi.mocked(window.api.data.identity.get).mockResolvedValue(IDENTITY)
    const simulatedTime = new Date('2027-06-01T00:00:00').getTime()
    vi.mocked(window.api.data.clock.now).mockResolvedValue(simulatedTime)
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-01-01T00:00:00').getTime())

    render(<ComposeWindow />)

    await user.selectOptions(await screen.findByLabelText('To'), 'morgan@example.com')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(window.api.data.messages.create).toHaveBeenCalled())
    expect(window.api.data.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ timestamp: simulatedTime })
    )

    dateNowSpy.mockRestore()
  })

  it('triggers persona reply generation (fire-and-forget) with the newly created message id on Send', async () => {
    const user = userEvent.setup()
    mockClose()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])
    vi.mocked(window.api.data.identity.get).mockResolvedValue(IDENTITY)
    vi.mocked(window.api.data.messages.create).mockResolvedValue({
      id: 'new-sent-id',
      folderId: 'sent',
      previousFolderId: null,
      subject: '',
      body: '',
      fromName: '',
      fromEmail: '',
      toName: '',
      toEmail: '',
      cc: [],
      timestamp: 0,
      isRead: false,
      isFlagged: false,
      categories: [],
      attachments: []
    })

    render(<ComposeWindow />)

    await user.selectOptions(await screen.findByLabelText('To'), 'morgan@example.com')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(window.api.llm.personaReply).toHaveBeenCalledWith('new-sent-id'))
  })

  it('does not trigger persona reply generation on Save & Close (drafts)', async () => {
    const user = userEvent.setup()
    mockClose()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])

    render(<ComposeWindow />)

    await user.type(screen.getByLabelText('Subject'), 'Draft subject')
    await user.click(screen.getByRole('button', { name: 'Save & Close' }))

    await waitFor(() => expect(window.api.data.messages.create).toHaveBeenCalled())
    expect(window.api.llm.personaReply).not.toHaveBeenCalled()
  })

  it('triggers persona reply generation using the draft id on Send from an existing draft', async () => {
    const user = userEvent.setup()
    mockClose()
    const draft: MailMessage = {
      id: 'draft-1',
      folderId: 'drafts',
      previousFolderId: null,
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

    await screen.findByDisplayValue('Existing draft')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(window.api.llm.personaReply).toHaveBeenCalledWith('draft-1'))
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
      expect.objectContaining({ folderId: 'drafts', subject: 'Draft subject', toEmail: '', isRead: false })
    )
    expect(close).toHaveBeenCalled()
  })

  it('prefills from an existing draft and updates the same message on Send', async () => {
    const user = userEvent.setup()
    const close = mockClose()
    const draft: MailMessage = {
      id: 'draft-1',
      folderId: 'drafts',
      previousFolderId: null,
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
      expect.objectContaining({
        folderId: 'sent',
        subject: 'Existing draft',
        toEmail: 'morgan@example.com',
        isRead: true
      })
    )
    expect(window.api.data.messages.create).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalled()
  })

  it('keeps showing the draft original recipient even if it is no longer in the persona list', async () => {
    const draft: MailMessage = {
      id: 'draft-2',
      folderId: 'drafts',
      previousFolderId: null,
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
      previousFolderId: null,
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
          fromEmail: IDENTITY.fromEmail,
          isRead: true
        })
      )
      expect(close).toHaveBeenCalled()
    })

    it('B004/025 AC4: an attachment added while replying is included on the Sent Items copy', async () => {
      const user = userEvent.setup()
      mockClose()
      vi.mocked(window.api.data.messages.get).mockResolvedValue(SOURCE_MESSAGE)
      vi.mocked(window.api.data.identity.get).mockResolvedValue(IDENTITY)
      vi.mocked(window.api.attachments.pick).mockResolvedValue({
        ok: true,
        filename: 'updated-numbers.xlsx',
        path: '/home/trainee/updated-numbers.xlsx'
      })

      render(<ComposeWindow sourceMessageId="src-1" intent="reply" />)

      await screen.findByDisplayValue('Re: Quarterly numbers')
      await user.click(screen.getByRole('button', { name: 'Add attachment...' }))
      await screen.findByText(/updated-numbers\.xlsx/)
      await user.click(screen.getByRole('button', { name: 'Send' }))

      await waitFor(() => expect(window.api.data.messages.create).toHaveBeenCalled())
      expect(window.api.data.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          folderId: 'sent',
          attachments: [{ filename: 'updated-numbers.xlsx', path: '/home/trainee/updated-numbers.xlsx' }]
        })
      )
    })

    it('B004/025 AC4: an attachment added while forwarding is included on the Sent Items copy', async () => {
      const user = userEvent.setup()
      mockClose()
      vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])
      vi.mocked(window.api.data.messages.get).mockResolvedValue(SOURCE_MESSAGE)
      vi.mocked(window.api.data.identity.get).mockResolvedValue(IDENTITY)
      vi.mocked(window.api.attachments.pick).mockResolvedValue({
        ok: true,
        filename: 'cover-sheet.pdf',
        path: '/home/trainee/cover-sheet.pdf'
      })

      render(<ComposeWindow sourceMessageId="src-1" intent="forward" />)

      await screen.findByDisplayValue('Fwd: Quarterly numbers')
      await user.click(screen.getByRole('button', { name: 'Add attachment...' }))
      await screen.findByText(/cover-sheet\.pdf/)
      await user.selectOptions(screen.getByLabelText('To'), 'morgan@example.com')
      await user.click(screen.getByRole('button', { name: 'Send' }))

      await waitFor(() => expect(window.api.data.messages.create).toHaveBeenCalled())
      expect(window.api.data.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          folderId: 'sent',
          attachments: [{ filename: 'cover-sheet.pdf', path: '/home/trainee/cover-sheet.pdf' }]
        })
      )
    })

    it('replying also triggers persona reply generation (AC1 covers sending AND replying)', async () => {
      const user = userEvent.setup()
      mockClose()
      vi.mocked(window.api.data.messages.get).mockResolvedValue(SOURCE_MESSAGE)
      vi.mocked(window.api.data.identity.get).mockResolvedValue(IDENTITY)
      vi.mocked(window.api.data.messages.create).mockResolvedValue({
        id: 'reply-sent-id',
        folderId: 'sent',
        previousFolderId: null,
        subject: '',
        body: '',
        fromName: '',
        fromEmail: '',
        toName: '',
        toEmail: '',
        cc: [],
        timestamp: 0,
        isRead: false,
        isFlagged: false,
        categories: [],
        attachments: []
      })

      render(<ComposeWindow sourceMessageId="src-1" intent="reply" />)

      await screen.findByDisplayValue('Re: Quarterly numbers')
      await user.click(screen.getByRole('button', { name: 'Send' }))

      await waitFor(() => expect(window.api.llm.personaReply).toHaveBeenCalledWith('reply-sent-id'))
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
          cc: [{ name: 'Sam Lee', email: 'sam@example.com' }],
          isRead: true
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
          subject: 'Fwd: Quarterly numbers',
          isRead: true
        })
      )
    })
  })

  describe('attachments', () => {
    it('opens a real file picker, attaches the picked file(s) with their real path, shown as chips, and sends them along', async () => {
      const user = userEvent.setup()
      mockClose()
      vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])
      vi.mocked(window.api.data.identity.get).mockResolvedValue(IDENTITY)
      vi.mocked(window.api.attachments.pick)
        .mockResolvedValueOnce({ ok: true, filename: 'report.pdf', path: '/home/trainee/report.pdf' })
        .mockResolvedValueOnce({ ok: true, filename: 'photo.jpg', path: '/home/trainee/photo.jpg' })

      render(<ComposeWindow />)

      const addButton = screen.getByRole('button', { name: 'Add attachment...' })
      await user.click(addButton)
      expect(await screen.findByText(/report\.pdf/)).toBeInTheDocument()

      await user.click(addButton)
      expect(await screen.findByText(/photo\.jpg/)).toBeInTheDocument()
      expect(window.api.attachments.pick).toHaveBeenCalledTimes(2)

      await user.selectOptions(await screen.findByLabelText('To'), 'morgan@example.com')
      await user.click(screen.getByRole('button', { name: 'Send' }))

      await waitFor(() => expect(window.api.data.messages.create).toHaveBeenCalled())
      expect(window.api.data.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [
            { filename: 'report.pdf', path: '/home/trainee/report.pdf' },
            { filename: 'photo.jpg', path: '/home/trainee/photo.jpg' }
          ]
        })
      )
    })

    it('does not add an attachment when the file-picker dialog is canceled', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.attachments.pick).mockResolvedValue({ ok: false, canceled: true })

      render(<ComposeWindow />)

      await user.click(screen.getByRole('button', { name: 'Add attachment...' }))

      expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
    })

    it('removes an attachment chip via its remove button', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.attachments.pick).mockResolvedValue({
        ok: true,
        filename: 'report.pdf',
        path: '/home/trainee/report.pdf'
      })

      render(<ComposeWindow />)

      await user.click(screen.getByRole('button', { name: 'Add attachment...' }))
      expect(await screen.findByText(/report\.pdf/)).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Remove attachment report.pdf' }))

      expect(screen.queryByText(/report\.pdf/)).not.toBeInTheDocument()
    })

    it('picking a file of any type (no extension filter) succeeds', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.attachments.pick).mockResolvedValue({
        ok: true,
        filename: 'archive.tar.gz',
        path: '/home/trainee/archive.tar.gz'
      })

      render(<ComposeWindow />)

      await user.click(screen.getByRole('button', { name: 'Add attachment...' }))

      expect(await screen.findByText(/archive\.tar\.gz/)).toBeInTheDocument()
    })

    it('loads existing attachments from a draft', async () => {
      const draftWithAttachment: MailMessage = {
        id: 'draft-3',
        folderId: 'drafts',
        previousFolderId: null,
        subject: 'Has attachment',
        body: '',
        fromName: '',
        fromEmail: '',
        toName: 'Morgan Rivera',
        toEmail: 'morgan@example.com',
        cc: [],
        timestamp: Date.now(),
        isRead: true,
        isFlagged: false,
        categories: [],
        attachments: [{ filename: 'contract.docx' }]
      }
      vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])
      vi.mocked(window.api.data.messages.get).mockResolvedValue(draftWithAttachment)

      render(<ComposeWindow draftId="draft-3" />)

      expect(await screen.findByText(/contract\.docx/)).toBeInTheDocument()
    })

    it('does not carry attachments over on reply/forward', async () => {
      const sourceWithAttachment: MailMessage = {
        id: 'src-2',
        folderId: 'inbox',
        previousFolderId: null,
        subject: 'Quarterly numbers',
        body: 'See attached.',
        fromName: 'Priya Shah',
        fromEmail: 'priya@example.com',
        toName: 'Jordan Trainee',
        toEmail: 'jordan.trainee@example.com',
        cc: [],
        timestamp: new Date('2026-01-15T10:00:00').getTime(),
        isRead: true,
        isFlagged: false,
        categories: [],
        attachments: [{ filename: 'original.pdf' }]
      }
      vi.mocked(window.api.data.messages.get).mockResolvedValue(sourceWithAttachment)
      vi.mocked(window.api.data.identity.get).mockResolvedValue(IDENTITY)

      render(<ComposeWindow sourceMessageId="src-2" intent="reply" />)

      await screen.findByDisplayValue('Re: Quarterly numbers')
      expect(screen.queryByText(/original\.pdf/)).not.toBeInTheDocument()
    })
  })
})
