// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TasksPanel from './TasksPanel'
import type { MailMessage, Task } from '../../../shared/data-types'

function makeMessage(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    id: 'msg-1',
    folderId: 'inbox',
    previousFolderId: null,
    subject: 'Flagged thing',
    body: '',
    fromName: '',
    fromEmail: '',
    toName: '',
    toEmail: '',
    cc: [],
    timestamp: 0,
    isRead: false,
    isFlagged: true,
    categories: [],
    attachments: [],
    ...overrides
  }
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return { id: 'task-1', text: 'Call client', done: false, dueAt: null, createdAt: 0, ...overrides }
}

describe('TasksPanel', () => {
  it('fetches tasks and flagged messages on mount, not from local/hardcoded data', async () => {
    render(<TasksPanel messagesVersion={0} />)

    await waitFor(() => expect(window.api.data.tasks.list).toHaveBeenCalled())
    await waitFor(() => expect(window.api.data.messages.list).toHaveBeenCalled())
  })

  // AC2
  it('lists only flagged messages, and refetches when messagesVersion bumps', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue([
      makeMessage({ id: 'm1', subject: 'Flagged one', isFlagged: true }),
      makeMessage({ id: 'm2', subject: 'Not flagged', isFlagged: false })
    ])
    const { rerender } = render(<TasksPanel messagesVersion={0} />)

    expect(await screen.findByText('Flagged one')).toBeInTheDocument()
    expect(screen.queryByText('Not flagged')).not.toBeInTheDocument()

    vi.mocked(window.api.data.messages.list).mockResolvedValue([])
    rerender(<TasksPanel messagesVersion={1} />)

    await screen.findByText('No flagged messages.')
  })

  it('shows "No flagged messages." when nothing is flagged', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue([])
    render(<TasksPanel messagesVersion={0} />)

    expect(await screen.findByText('No flagged messages.')).toBeInTheDocument()
  })

  it('an unnamed flagged message falls back to "(no subject)"', async () => {
    vi.mocked(window.api.data.messages.list).mockResolvedValue([makeMessage({ subject: '' })])
    render(<TasksPanel messagesVersion={0} />)

    expect(await screen.findByText('(no subject)')).toBeInTheDocument()
  })

  // AC3
  it('adds a freestanding task with the typed text and an optional due date, then clears the inputs', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.tasks.create).mockResolvedValue(makeTask())
    render(<TasksPanel messagesVersion={0} />)
    await waitFor(() => expect(window.api.data.tasks.list).toHaveBeenCalledTimes(1))

    await user.type(screen.getByLabelText('New task'), 'Call client')
    await user.type(screen.getByLabelText('Due date'), '2026-03-15')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() =>
      expect(window.api.data.tasks.create).toHaveBeenCalledWith({
        text: 'Call client',
        done: false,
        dueAt: new Date('2026-03-15').getTime()
      })
    )
    expect(window.api.data.tasks.list).toHaveBeenCalledTimes(2) // initial + post-add refetch
    expect(screen.getByLabelText('New task')).toHaveValue('')
    expect(screen.getByLabelText('Due date')).toHaveValue('')
  })

  it('adding a task with no due date sends dueAt: null', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.tasks.create).mockResolvedValue(makeTask())
    render(<TasksPanel messagesVersion={0} />)

    await user.type(screen.getByLabelText('New task'), 'No due date')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() =>
      expect(window.api.data.tasks.create).toHaveBeenCalledWith({ text: 'No due date', done: false, dueAt: null })
    )
  })

  it('pressing Enter in the task input adds it, same as clicking Add', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.tasks.create).mockResolvedValue(makeTask())
    render(<TasksPanel messagesVersion={0} />)

    await user.type(screen.getByLabelText('New task'), 'Via Enter{Enter}')

    await waitFor(() =>
      expect(window.api.data.tasks.create).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Via Enter' })
      )
    )
  })

  it('the Add button is disabled, and Enter is a no-op, when the task text is blank', async () => {
    const user = userEvent.setup()
    render(<TasksPanel messagesVersion={0} />)

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()

    await user.type(screen.getByLabelText('New task'), '   {Enter}')
    expect(window.api.data.tasks.create).not.toHaveBeenCalled()
  })

  // AC4
  it('toggling the checkbox marks a task complete/incomplete, and shows it struck through when done', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.tasks.list).mockResolvedValue([makeTask({ id: 't1', text: 'Follow up', done: false })])
    vi.mocked(window.api.data.tasks.update).mockResolvedValue(makeTask({ id: 't1', done: true }))
    render(<TasksPanel messagesVersion={0} />)

    const item = (await screen.findByText('Follow up')).closest('li')!
    expect(item).not.toHaveClass('done')

    await user.click(within(item).getByRole('checkbox'))

    await waitFor(() => expect(window.api.data.tasks.update).toHaveBeenCalledWith('t1', { done: true }))
  })

  it('removing a task calls the delete IPC and drops it from the list', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.tasks.list)
      .mockResolvedValueOnce([makeTask({ id: 't1', text: 'Gone soon' })])
      .mockResolvedValueOnce([])
    render(<TasksPanel messagesVersion={0} />)

    const item = (await screen.findByText('Gone soon')).closest('li')!
    await user.click(within(item).getByRole('button', { name: /Remove/ }))

    await waitFor(() => expect(window.api.data.tasks.delete).toHaveBeenCalledWith('t1'))
    await screen.findByText('No tasks yet.')
  })

  it('shows a due date next to a task that has one, and nothing for a task that does not', async () => {
    vi.mocked(window.api.data.tasks.list).mockResolvedValue([
      makeTask({ id: 't1', text: 'With due date', dueAt: new Date(2026, 2, 15).getTime() }),
      makeTask({ id: 't2', text: 'No due date', dueAt: null })
    ])
    render(<TasksPanel messagesVersion={0} />)

    const withDue = (await screen.findByText('With due date')).closest('li')!
    expect(within(withDue).getByText(new Date(2026, 2, 15).toLocaleDateString())).toBeInTheDocument()

    const withoutDue = screen.getByText('No due date').closest('li')!
    expect(within(withoutDue).queryByText(/\d/)).not.toBeInTheDocument()
  })

  it('shows "No tasks yet." when there are none', async () => {
    render(<TasksPanel messagesVersion={0} />)

    expect(await screen.findByText('No tasks yet.')).toBeInTheDocument()
  })
})
