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

  // 056 — unflag and pop-out controls on Flagged Mail rows

  it('056 AC1: the unflag control calls messages.update with isFlagged: false, via the real data API', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.list).mockResolvedValue([
      makeMessage({ id: 'm1', subject: 'Flagged one' })
    ])
    render(<TasksPanel messagesVersion={0} />)

    await screen.findByText('Flagged one')
    await user.click(screen.getByRole('button', { name: 'Unflag "Flagged one"' }))

    expect(window.api.data.messages.update).toHaveBeenCalledWith('m1', { isFlagged: false })
  })

  it('056 AC2: unflagging removes the row once the broadcast-driven messagesVersion bump refetches (no local list mutation needed)', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.list).mockResolvedValue([
      makeMessage({ id: 'm1', subject: 'Flagged one' })
    ])
    const { rerender } = render(<TasksPanel messagesVersion={0} />)

    await screen.findByText('Flagged one')
    await user.click(screen.getByRole('button', { name: 'Unflag "Flagged one"' }))
    expect(window.api.data.messages.update).toHaveBeenCalledWith('m1', { isFlagged: false })

    // The real IPC update triggers a `data:messages-changed` broadcast
    // App.tsx turns into a `messagesVersion` bump — simulated here the
    // same way the existing 046 AC2 test above does.
    vi.mocked(window.api.data.messages.list).mockResolvedValue([])
    rerender(<TasksPanel messagesVersion={1} />)

    await screen.findByText('No flagged messages.')
  })

  it('056 AC3: double-clicking a Flagged Mail row\'s subject opens it in its own pop-out window', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.list).mockResolvedValue([
      makeMessage({ id: 'm1', subject: 'Flagged one' })
    ])
    render(<TasksPanel messagesVersion={0} />)

    const subject = await screen.findByText('Flagged one')
    await user.dblClick(subject)

    expect(window.api.messagePopout.open).toHaveBeenCalledWith('m1')
  })

  it('056 AC4: double-clicking the unflag control never triggers the pop-out', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.list).mockResolvedValue([
      makeMessage({ id: 'm1', subject: 'Flagged one' })
    ])
    render(<TasksPanel messagesVersion={0} />)

    await screen.findByText('Flagged one')
    await user.dblClick(screen.getByRole('button', { name: 'Unflag "Flagged one"' }))

    expect(window.api.messagePopout.open).not.toHaveBeenCalled()
  })

  it('056 AC4: double-clicking the subject never calls the unflag API', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.messages.list).mockResolvedValue([
      makeMessage({ id: 'm1', subject: 'Flagged one' })
    ])
    render(<TasksPanel messagesVersion={0} />)

    const subject = await screen.findByText('Flagged one')
    await user.dblClick(subject)

    expect(window.api.data.messages.update).not.toHaveBeenCalled()
  })

  // AC3
  it('057 AC1/AC2: the add form is hidden by default; clicking header Add opens it below the header', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.tasks.list).mockResolvedValue([])
    render(<TasksPanel messagesVersion={0} />)

    await screen.findByText('No tasks yet.')
    expect(screen.queryByLabelText('New task')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(screen.getByLabelText('New task')).toBeInTheDocument()
    // The header's own Add button is replaced by the open form, not
    // duplicated alongside it.
    expect(screen.getAllByRole('button', { name: 'Add' })).toHaveLength(1)
  })

  it('adds a freestanding task with the typed text and an optional due date, then closes the form', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.tasks.create).mockResolvedValue(makeTask())
    render(<TasksPanel messagesVersion={0} />)
    await waitFor(() => expect(window.api.data.tasks.list).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: 'Add' }))
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
    expect(screen.queryByLabelText('New task')).not.toBeInTheDocument()
  })

  it('adding a task with no due date sends dueAt: null', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.tasks.create).mockResolvedValue(makeTask())
    render(<TasksPanel messagesVersion={0} />)

    await user.click(screen.getByRole('button', { name: 'Add' }))
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

    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.type(screen.getByLabelText('New task'), 'Via Enter{Enter}')

    await waitFor(() =>
      expect(window.api.data.tasks.create).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Via Enter' })
      )
    )
  })

  it('the form\'s Add button is disabled, and Enter is a no-op, when the task text is blank', async () => {
    const user = userEvent.setup()
    render(<TasksPanel messagesVersion={0} />)

    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()

    await user.type(screen.getByLabelText('New task'), '   {Enter}')
    expect(window.api.data.tasks.create).not.toHaveBeenCalled()
  })

  it('Cancel closes the add form without creating anything', async () => {
    const user = userEvent.setup()
    render(<TasksPanel messagesVersion={0} />)

    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.type(screen.getByLabelText('New task'), 'Should not be saved')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(window.api.data.tasks.create).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('New task')).not.toBeInTheDocument()
    // The header Add button is back.
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })

  // 057 — Edit opens the form inline under the task's own row

  it('057 AC3: Edit opens the form immediately below that task\'s own row, pre-filled with its text and due date', async () => {
    const user = userEvent.setup()
    const dueAt = new Date('2026-03-15').getTime()
    vi.mocked(window.api.data.tasks.list).mockResolvedValue([
      makeTask({ id: 'a', text: 'Alpha', dueAt, createdAt: 1 }),
      makeTask({ id: 'b', text: 'Bravo', dueAt: null, createdAt: 2 })
    ])
    render(<TasksPanel messagesVersion={0} />)

    await screen.findByText('Bravo') // sorted first: undated, newest-created
    await user.click(screen.getByRole('button', { name: 'Edit "Alpha"' }))

    const list = document.querySelector('.tasks-panel-list') as HTMLElement
    const rows = Array.from(list.children)
    const alphaIndex = rows.findIndex((row) => row.textContent?.includes('Alpha'))
    const formIndex = rows.findIndex((row) => row.querySelector('.tasks-panel-form'))
    expect(formIndex).toBe(alphaIndex + 1)

    expect(screen.getByLabelText('Edit task text')).toHaveValue('Alpha')
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-03-15')
  })

  it('057 AC3: editing an undated task pre-fills a blank due date', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.tasks.list).mockResolvedValue([
      makeTask({ id: 'a', text: 'No due date yet', dueAt: null, createdAt: 1 })
    ])
    render(<TasksPanel messagesVersion={0} />)

    await screen.findByText('No due date yet')
    await user.click(screen.getByRole('button', { name: 'Edit "No due date yet"' }))

    expect(screen.getByLabelText('Due date')).toHaveValue('')
  })

  it('057 AC4: opening a different task\'s Edit closes the one already open', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.tasks.list).mockResolvedValue([
      makeTask({ id: 'a', text: 'Alpha', createdAt: 1 }),
      makeTask({ id: 'b', text: 'Bravo', createdAt: 2 })
    ])
    render(<TasksPanel messagesVersion={0} />)

    await screen.findByText('Alpha')
    await user.click(screen.getByRole('button', { name: 'Edit "Alpha"' }))
    expect(screen.getByLabelText('Edit task text')).toHaveValue('Alpha')

    await user.click(screen.getByRole('button', { name: 'Edit "Bravo"' }))

    expect(screen.getAllByLabelText('Edit task text')).toHaveLength(1)
    expect(screen.getByLabelText('Edit task text')).toHaveValue('Bravo')
  })

  it('057 AC4: opening Edit on a task closes an open Add form', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.tasks.list).mockResolvedValue([makeTask({ id: 'a', text: 'Alpha', createdAt: 1 })])
    render(<TasksPanel messagesVersion={0} />)

    await screen.findByText('Alpha')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByLabelText('New task')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit "Alpha"' }))

    expect(screen.queryByLabelText('New task')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Edit task text')).toHaveValue('Alpha')
  })

  it('057 AC5: saving an edit updates the task via the real data API and closes the form', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.tasks.list).mockResolvedValue([
      makeTask({ id: 'a', text: 'Alpha', dueAt: null, createdAt: 1 })
    ])
    render(<TasksPanel messagesVersion={0} />)

    await screen.findByText('Alpha')
    await user.click(screen.getByRole('button', { name: 'Edit "Alpha"' }))
    const textInput = screen.getByLabelText('Edit task text')
    await user.clear(textInput)
    await user.type(textInput, 'Alpha updated')
    await user.type(screen.getByLabelText('Due date'), '2026-04-01')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(window.api.data.tasks.update).toHaveBeenCalledWith('a', {
      text: 'Alpha updated',
      dueAt: new Date('2026-04-01').getTime()
    })
    await waitFor(() => expect(screen.queryByLabelText('Edit task text')).not.toBeInTheDocument())
  })

  it('057: editing a dated task without changing its due date round-trips to the exact same stored value', async () => {
    const user = userEvent.setup()
    const dueAt = new Date('2026-03-15').getTime()
    vi.mocked(window.api.data.tasks.list).mockResolvedValue([
      makeTask({ id: 'a', text: 'Alpha', dueAt, createdAt: 1 })
    ])
    render(<TasksPanel messagesVersion={0} />)

    await screen.findByText('Alpha')
    await user.click(screen.getByRole('button', { name: 'Edit "Alpha"' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(window.api.data.tasks.update).toHaveBeenCalledWith('a', { text: 'Alpha', dueAt })
  })

  it('Cancel closes an open edit form without updating anything', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.tasks.list).mockResolvedValue([makeTask({ id: 'a', text: 'Alpha', createdAt: 1 })])
    render(<TasksPanel messagesVersion={0} />)

    await screen.findByText('Alpha')
    await user.click(screen.getByRole('button', { name: 'Edit "Alpha"' }))
    await user.type(screen.getByLabelText('Edit task text'), ' but not saved')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(window.api.data.tasks.update).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Edit task text')).not.toBeInTheDocument()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })

  it('removing a task that is mid-edit also closes its form', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.tasks.list)
      .mockResolvedValueOnce([makeTask({ id: 'a', text: 'Going away', createdAt: 1 })])
      .mockResolvedValueOnce([])
    render(<TasksPanel messagesVersion={0} />)

    await screen.findByText('Going away')
    await user.click(screen.getByRole('button', { name: 'Edit "Going away"' }))
    expect(screen.getByLabelText('Edit task text')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Remove/ }))

    await waitFor(() => expect(screen.queryByLabelText('Edit task text')).not.toBeInTheDocument())
    await screen.findByText('No tasks yet.')
  })

  // 057 AC6 — due-date sort order

  it('057 AC6: undated tasks appear first, newest-created first among themselves, then dated tasks ascending', async () => {
    vi.mocked(window.api.data.tasks.list).mockResolvedValue([
      makeTask({ id: 'dated-later', text: 'Dated Later', dueAt: 2_000_000, createdAt: 1 }),
      makeTask({ id: 'undated-old', text: 'Undated Old', dueAt: null, createdAt: 1 }),
      makeTask({ id: 'dated-earlier', text: 'Dated Earlier', dueAt: 1_000_000, createdAt: 1 }),
      makeTask({ id: 'undated-new', text: 'Undated New', dueAt: null, createdAt: 2 })
    ])
    render(<TasksPanel messagesVersion={0} />)

    await screen.findByText('Dated Later')
    const texts = Array.from(document.querySelectorAll('.tasks-panel-task-text')).map((el) => el.textContent)

    expect(texts).toEqual(['Undated New', 'Undated Old', 'Dated Earlier', 'Dated Later'])
  })

  // AC4 (feature 046)
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

  // 057: the add form must appear below the header (fixed spot), not
  // interspersed among existing tasks, regardless of how many exist —
  // the redesigned equivalent of the requested-changes fix from 046 that
  // originally pinned the (then always-visible) add row above the list.
  it('057 AC2: the open add form stays above the task list, not pushed down by existing tasks', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.tasks.list).mockResolvedValue([
      makeTask({ id: 't1', text: 'First', createdAt: 1 }),
      makeTask({ id: 't2', text: 'Second', createdAt: 2 })
    ])
    render(<TasksPanel messagesVersion={0} />)

    const firstTask = await screen.findByText('First')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    const addForm = screen.getByLabelText('New task')

    // DOCUMENT_POSITION_FOLLOWING on the task relative to the add form
    // means the form comes first in document order.
    expect(addForm.compareDocumentPosition(firstTask) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
