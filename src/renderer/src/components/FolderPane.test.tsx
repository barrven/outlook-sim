// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FolderPane from './FolderPane'
import type { Folder } from '../../../shared/data-types'

const FOLDERS: Folder[] = [
  { id: 'inbox', name: 'Inbox', type: 'system', sortOrder: 0 },
  { id: 'drafts', name: 'Drafts', type: 'system', sortOrder: 1 },
  { id: 'custom-1', name: 'Project X', type: 'custom', sortOrder: 4 }
]

function renderPane(overrides: Partial<Parameters<typeof FolderPane>[0]> = {}) {
  const onSelectFolder = vi.fn()
  const onFoldersChanged = vi.fn()
  render(
    <FolderPane
      folders={FOLDERS}
      selectedFolderId="inbox"
      onSelectFolder={onSelectFolder}
      onFoldersChanged={onFoldersChanged}
      {...overrides}
    />
  )
  return { onSelectFolder, onFoldersChanged }
}

describe('FolderPane', () => {
  it('renders system and custom folders, marking the selected one', () => {
    renderPane()

    expect(screen.getByRole('button', { name: 'Inbox' })).toHaveClass('selected')
    expect(screen.getByRole('button', { name: 'Drafts' })).not.toHaveClass('selected')
    expect(screen.getByRole('button', { name: 'Project X' })).toBeInTheDocument()
  })

  it('only shows rename/delete controls on custom folders, not system folders', () => {
    renderPane()

    const inboxItem = screen.getByRole('button', { name: 'Inbox' }).closest('.folder-list-item')
    const customItem = screen.getByRole('button', { name: 'Project X' }).closest('.folder-list-item')

    expect(inboxItem?.querySelectorAll('.folder-action-btn')).toHaveLength(0)
    expect(customItem?.querySelectorAll('.folder-action-btn')).toHaveLength(2)
  })

  it('calls onSelectFolder when a folder is clicked', async () => {
    const user = userEvent.setup()
    const { onSelectFolder } = renderPane()

    await user.click(screen.getByRole('button', { name: 'Drafts' }))

    expect(onSelectFolder).toHaveBeenCalledWith('drafts')
  })

  it('creates a custom folder from the new-folder form', async () => {
    const user = userEvent.setup()
    const { onFoldersChanged } = renderPane()

    await user.click(screen.getByRole('button', { name: '+ New folder' }))
    await user.type(screen.getByRole('textbox', { name: 'New folder name' }), 'Receipts')
    await user.keyboard('{Enter}')

    expect(window.api.data.folders.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Receipts', type: 'custom', sortOrder: FOLDERS.length })
    )
    expect(onFoldersChanged).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '+ New folder' })).toBeInTheDocument()
  })

  it('does not create a folder for a whitespace-only name', async () => {
    const user = userEvent.setup()
    const { onFoldersChanged } = renderPane()

    await user.click(screen.getByRole('button', { name: '+ New folder' }))
    await user.type(screen.getByRole('textbox', { name: 'New folder name' }), '   ')
    await user.keyboard('{Enter}')

    expect(window.api.data.folders.create).not.toHaveBeenCalled()
    expect(onFoldersChanged).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '+ New folder' })).toBeInTheDocument()
  })

  it('cancels folder creation on Escape without calling the API', async () => {
    const user = userEvent.setup()
    renderPane()

    await user.click(screen.getByRole('button', { name: '+ New folder' }))
    await user.type(screen.getByRole('textbox', { name: 'New folder name' }), 'Discard me')
    await user.keyboard('{Escape}')

    expect(window.api.data.folders.create).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '+ New folder' })).toBeInTheDocument()
  })

  it('renames a custom folder', async () => {
    const user = userEvent.setup()
    const { onFoldersChanged } = renderPane()

    await user.click(screen.getByRole('button', { name: 'Rename Project X' }))
    const input = screen.getByRole('textbox', { name: 'Rename Project X' })
    await user.clear(input)
    await user.type(input, 'Renamed Project')
    await user.keyboard('{Enter}')

    expect(window.api.data.folders.rename).toHaveBeenCalledWith('custom-1', 'Renamed Project')
    expect(onFoldersChanged).toHaveBeenCalled()
  })

  it('cancels a rename on Escape without calling the API', async () => {
    const user = userEvent.setup()
    renderPane()

    await user.click(screen.getByRole('button', { name: 'Rename Project X' }))
    await user.keyboard('{Escape}')

    expect(window.api.data.folders.rename).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Project X' })).toBeInTheDocument()
  })

  it('deletes a custom folder and falls back to Inbox when it was selected', async () => {
    const user = userEvent.setup()
    const { onSelectFolder, onFoldersChanged } = renderPane({ selectedFolderId: 'custom-1' })

    await user.click(screen.getByRole('button', { name: 'Delete Project X' }))

    expect(window.api.data.folders.delete).toHaveBeenCalledWith('custom-1')
    expect(onSelectFolder).toHaveBeenCalledWith('inbox')
    expect(onFoldersChanged).toHaveBeenCalled()
  })

  it('deleting a non-selected custom folder does not change the selection', async () => {
    const user = userEvent.setup()
    const { onSelectFolder } = renderPane({ selectedFolderId: 'inbox' })

    await user.click(screen.getByRole('button', { name: 'Delete Project X' }))

    expect(window.api.data.folders.delete).toHaveBeenCalledWith('custom-1')
    expect(onSelectFolder).not.toHaveBeenCalled()
  })
})
