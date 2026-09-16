// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MessageContextMenu from './MessageContextMenu'
import type { Folder, MailMessage } from '../../../shared/data-types'

function makeMessage(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    id: 'msg-1',
    folderId: 'inbox',
    previousFolderId: null,
    subject: 'Test subject',
    body: 'Body',
    fromName: 'Alex',
    fromEmail: 'alex@example.com',
    toName: 'Trainee',
    toEmail: 'trainee@example.com',
    cc: [],
    timestamp: Date.now(),
    isRead: false,
    isFlagged: false,
    categories: [],
    attachments: [],
    ...overrides
  }
}

const folders: Folder[] = [
  { id: 'inbox', name: 'Inbox', type: 'system', sortOrder: 0 },
  { id: 'archive', name: 'Archive', type: 'custom', sortOrder: 1 }
]

function makeProps(overrides: Partial<Parameters<typeof MessageContextMenu>[0]> = {}) {
  return {
    x: 10,
    y: 20,
    targetMessages: [makeMessage()],
    folders,
    onClose: vi.fn(),
    onMoveToFolder: vi.fn(),
    onMarkRead: vi.fn(),
    onToggleFlag: vi.fn(),
    onAddCategory: vi.fn(),
    onReply: vi.fn(),
    onReplyAll: vi.fn(),
    onForward: vi.fn(),
    onDelete: vi.fn(),
    ...overrides
  }
}

describe('MessageContextMenu', () => {
  // AC1: every listed action is present.
  it('040 AC1: renders every listed action', () => {
    render(<MessageContextMenu {...makeProps()} />)

    for (const name of [
      'Reply',
      'Reply All',
      'Forward',
      'Mark as read',
      'Flag',
      'Add to category',
      'Move to folder',
      'Delete'
    ]) {
      expect(screen.getByRole('menuitem', { name })).toBeInTheDocument()
    }
  })

  // AC5: Reply/Reply All/Forward only enabled for exactly one target message.
  it('040 AC5: Reply/Reply All/Forward are enabled for a single-message target', () => {
    render(<MessageContextMenu {...makeProps({ targetMessages: [makeMessage()] })} />)

    expect(screen.getByRole('menuitem', { name: 'Reply' })).toBeEnabled()
    expect(screen.getByRole('menuitem', { name: 'Reply All' })).toBeEnabled()
    expect(screen.getByRole('menuitem', { name: 'Forward' })).toBeEnabled()
  })

  it('040 AC5: Reply/Reply All/Forward are disabled for a multi-message target', () => {
    render(
      <MessageContextMenu
        {...makeProps({ targetMessages: [makeMessage({ id: 'a' }), makeMessage({ id: 'b' })] })}
      />
    )

    expect(screen.getByRole('menuitem', { name: 'Reply' })).toBeDisabled()
    expect(screen.getByRole('menuitem', { name: 'Reply All' })).toBeDisabled()
    expect(screen.getByRole('menuitem', { name: 'Forward' })).toBeDisabled()
  })

  it('040 AC5: clicking an enabled Reply/Reply All/Forward calls through and closes the menu', () => {
    const onReply = vi.fn()
    const onClose = vi.fn()
    render(<MessageContextMenu {...makeProps({ onReply, onClose })} />)

    fireEvent.click(screen.getByRole('menuitem', { name: 'Reply' }))

    expect(onReply).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('040 AC5: Delete works regardless of selection size', () => {
    const onDelete = vi.fn()
    const onClose = vi.fn()
    render(
      <MessageContextMenu
        {...makeProps({
          targetMessages: [makeMessage({ id: 'a' }), makeMessage({ id: 'b' }), makeMessage({ id: 'c' })],
          onDelete,
          onClose
        })}
      />
    )

    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // AC4: Mark read/unread and Flag/Unflag — label reflects whether every
  // targeted message already shares that state, and the click passes the
  // opposite boolean (i.e. "apply this to everyone").
  it('040 AC4: shows "Mark as read"/"Flag" when the target is not uniformly read/flagged, and applies true on click', () => {
    const onMarkRead = vi.fn()
    const onToggleFlag = vi.fn()
    render(
      <MessageContextMenu
        {...makeProps({
          targetMessages: [
            makeMessage({ id: 'a', isRead: true, isFlagged: true }),
            makeMessage({ id: 'b', isRead: false, isFlagged: false })
          ],
          onMarkRead,
          onToggleFlag
        })}
      />
    )

    expect(screen.getByRole('menuitem', { name: 'Mark as read' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Flag' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Mark as read' }))
    expect(onMarkRead).toHaveBeenCalledWith(true)

    fireEvent.click(screen.getByRole('menuitem', { name: 'Flag' }))
    expect(onToggleFlag).toHaveBeenCalledWith(true)
  })

  it('040 AC4: shows "Mark as unread"/"Unflag" when every targeted message is already read/flagged, and applies false on click', () => {
    const onMarkRead = vi.fn()
    const onToggleFlag = vi.fn()
    render(
      <MessageContextMenu
        {...makeProps({
          targetMessages: [
            makeMessage({ id: 'a', isRead: true, isFlagged: true }),
            makeMessage({ id: 'b', isRead: true, isFlagged: true })
          ],
          onMarkRead,
          onToggleFlag
        })}
      />
    )

    expect(screen.getByRole('menuitem', { name: 'Mark as unread' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Unflag' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Mark as unread' }))
    expect(onMarkRead).toHaveBeenCalledWith(false)

    fireEvent.click(screen.getByRole('menuitem', { name: 'Unflag' }))
    expect(onToggleFlag).toHaveBeenCalledWith(false)
  })

  // AC4: Add to category.
  it('040 AC4: Add to category reveals an input and submits the trimmed category name', async () => {
    const user = userEvent.setup()
    const onAddCategory = vi.fn()
    const onClose = vi.fn()
    render(<MessageContextMenu {...makeProps({ onAddCategory, onClose })} />)

    expect(screen.queryByLabelText('Category name')).not.toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: 'Add to category' }))

    const input = screen.getByLabelText('Category name')
    await user.type(input, '  Urgent  {enter}')

    expect(onAddCategory).toHaveBeenCalledWith('Urgent')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("040 AC4: submitting a blank category name doesn't call onAddCategory", async () => {
    const user = userEvent.setup()
    const onAddCategory = vi.fn()
    render(<MessageContextMenu {...makeProps({ onAddCategory })} />)

    await user.click(screen.getByRole('menuitem', { name: 'Add to category' }))
    await user.type(screen.getByLabelText('Category name'), '   {enter}')

    expect(onAddCategory).not.toHaveBeenCalled()
  })

  // AC3: Move to folder shows a list of available folders, and moving
  // applies to the whole target.
  it('040 AC3: Move to folder expands into a list of the available folders', async () => {
    const user = userEvent.setup()
    render(<MessageContextMenu {...makeProps()} />)

    expect(screen.queryByRole('menuitem', { name: 'Archive' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: 'Move to folder' }))

    expect(screen.getByRole('menuitem', { name: 'Inbox' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Archive' })).toBeInTheDocument()
  })

  it('040 AC3: choosing a folder calls onMoveToFolder with that folder id and closes the menu', async () => {
    const user = userEvent.setup()
    const onMoveToFolder = vi.fn()
    const onClose = vi.fn()
    render(<MessageContextMenu {...makeProps({ onMoveToFolder, onClose })} />)

    await user.click(screen.getByRole('menuitem', { name: 'Move to folder' }))
    await user.click(screen.getByRole('menuitem', { name: 'Archive' }))

    expect(onMoveToFolder).toHaveBeenCalledWith('archive')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // Dismissal.
  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<MessageContextMenu {...makeProps({ onClose })} />)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on an outside click, but not a click inside the menu', () => {
    const onClose = vi.fn()
    render(
      <div>
        <button type="button">Outside</button>
        <MessageContextMenu {...makeProps({ onClose })} />
      </div>
    )

    fireEvent.mouseDown(screen.getByRole('menu'))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.mouseDown(screen.getByText('Outside'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
