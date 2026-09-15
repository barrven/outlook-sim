// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FileVineView from './FileVineView'
import type { FileVineFolder, Persona } from '../../../shared/data-types'

const PERSONA: Persona = {
  id: 'p1',
  displayName: 'Morgan Rivera',
  email: 'morgan@example.com',
  role: 'Office Manager',
  bio: '',
  writingStyleNotes: '',
  extraPrompt: '',
  isClient: true
}

// A minimal in-memory stand-in for the real IPC-backed store — same
// approach `MessageListPane`/`ReadingPane` tests use for personas/messages,
// letting create/rename/delete/associate round-trip realistically without a
// real MailDb (that's covered separately in `db.test.ts`/`ipc.test.ts`).
function installFakeStore(initial: FileVineFolder[] = [], personas: Persona[] = [PERSONA]): void {
  let folders = initial
  vi.mocked(window.api.data.fileVineFolders.list).mockImplementation(() => Promise.resolve(folders))
  vi.mocked(window.api.data.fileVineFolders.create).mockImplementation((folder) => {
    const created: FileVineFolder = {
      id: `id-${folders.length + 1}`,
      parentId: null,
      clientPersonaId: null,
      ...folder
    }
    folders = [...folders, created]
    return Promise.resolve(created)
  })
  vi.mocked(window.api.data.fileVineFolders.update).mockImplementation((id, patch) => {
    folders = folders.map((folder) => (folder.id === id ? { ...folder, ...patch } : folder))
    return Promise.resolve(folders.find((folder) => folder.id === id) ?? null)
  })
  vi.mocked(window.api.data.fileVineFolders.delete).mockImplementation((id) => {
    folders = folders.filter((folder) => folder.id !== id)
    return Promise.resolve()
  })
  vi.mocked(window.api.data.personas.get).mockResolvedValue(personas)
}

describe('FileVineView', () => {
  it('shows an empty state with no folders', async () => {
    installFakeStore([])
    render(<FileVineView />)

    expect(await screen.findByText('No folders yet.')).toBeInTheDocument()
  })

  it('047 AC3: creates a root folder via "+ New folder"', async () => {
    const user = userEvent.setup()
    installFakeStore([])
    render(<FileVineView />)
    await screen.findByText('No folders yet.')

    await user.click(screen.getByRole('button', { name: '+ New folder' }))
    await user.type(screen.getByLabelText('New folder name'), 'Smith v. Jones')
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('button', { name: 'Smith v. Jones' })).toBeInTheDocument()
    expect(window.api.data.fileVineFolders.create).toHaveBeenCalledWith({
      name: 'Smith v. Jones',
      parentId: null
    })
  })

  it('047 AC3: does not create a folder when submitting an empty name', async () => {
    const user = userEvent.setup()
    installFakeStore([])
    render(<FileVineView />)
    await screen.findByText('No folders yet.')

    await user.click(screen.getByRole('button', { name: '+ New folder' }))
    await user.keyboard('{Enter}')

    expect(window.api.data.fileVineFolders.create).not.toHaveBeenCalled()
    expect(screen.getByText('No folders yet.')).toBeInTheDocument()
  })

  it('047 AC3: creates a subfolder nested under an existing folder (a tree, not a flat list)', async () => {
    const user = userEvent.setup()
    installFakeStore([{ id: 'root-1', name: 'Smith v. Jones', parentId: null, clientPersonaId: null }])
    render(<FileVineView />)
    await screen.findByRole('button', { name: 'Smith v. Jones' })

    await user.click(screen.getByRole('button', { name: 'New subfolder under Smith v. Jones' }))
    await user.type(screen.getByLabelText('New subfolder name'), 'Discovery')
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('button', { name: 'Discovery' })).toBeInTheDocument()
    expect(window.api.data.fileVineFolders.create).toHaveBeenCalledWith({
      name: 'Discovery',
      parentId: 'root-1'
    })
  })

  it('047 AC3: renders a nested folder indented under its parent in the DOM tree', async () => {
    installFakeStore([
      { id: 'root-1', name: 'Smith v. Jones', parentId: null, clientPersonaId: null },
      { id: 'child-1', name: 'Discovery', parentId: 'root-1', clientPersonaId: null }
    ])
    render(<FileVineView />)

    const parentRow = await screen.findByRole('button', { name: 'Smith v. Jones' })
    const childRow = await screen.findByRole('button', { name: 'Discovery' })
    const parentItem = parentRow.closest('.filevine-tree-item') as HTMLElement
    // The child is nested inside a <ul> that lives inside the parent's own
    // <li>, not as a sibling at the root — confirms real nesting, not a
    // flat list with visual indentation only.
    expect(parentItem.querySelector('.filevine-tree-children')?.contains(childRow)).toBe(true)
  })

  it('047 AC3: renames a folder', async () => {
    const user = userEvent.setup()
    installFakeStore([{ id: 'root-1', name: 'Smith v. Jones', parentId: null, clientPersonaId: null }])
    render(<FileVineView />)
    await screen.findByRole('button', { name: 'Smith v. Jones' })

    await user.click(screen.getByRole('button', { name: 'Rename Smith v. Jones' }))
    const input = screen.getByLabelText('Rename Smith v. Jones')
    await user.clear(input)
    await user.type(input, 'Smith v. Jones (Amended)')
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('button', { name: 'Smith v. Jones (Amended)' })).toBeInTheDocument()
    expect(window.api.data.fileVineFolders.update).toHaveBeenCalledWith('root-1', {
      name: 'Smith v. Jones (Amended)'
    })
  })

  it('047 AC3: deletes a folder', async () => {
    const user = userEvent.setup()
    installFakeStore([{ id: 'root-1', name: 'Smith v. Jones', parentId: null, clientPersonaId: null }])
    render(<FileVineView />)
    await screen.findByRole('button', { name: 'Smith v. Jones' })

    await user.click(screen.getByRole('button', { name: 'Delete Smith v. Jones' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Smith v. Jones' })).not.toBeInTheDocument())
    expect(window.api.data.fileVineFolders.delete).toHaveBeenCalledWith('root-1')
  })

  it('shows a "select a folder" empty state in the detail pane until one is selected', async () => {
    installFakeStore([{ id: 'root-1', name: 'Smith v. Jones', parentId: null, clientPersonaId: null }])
    render(<FileVineView />)
    await screen.findByRole('button', { name: 'Smith v. Jones' })

    expect(screen.getByText('Select a folder to view its details.')).toBeInTheDocument()
  })

  it('047 AC4: associates a selected folder with a persona as its client', async () => {
    const user = userEvent.setup()
    installFakeStore([{ id: 'root-1', name: 'Smith v. Jones', parentId: null, clientPersonaId: null }])
    render(<FileVineView />)
    await user.click(await screen.findByRole('button', { name: 'Smith v. Jones' }))

    await user.selectOptions(screen.getByLabelText('Client'), 'p1')

    expect(window.api.data.fileVineFolders.update).toHaveBeenCalledWith('root-1', { clientPersonaId: 'p1' })
    expect(await screen.findByText(/Client: Morgan Rivera \(Office Manager\)/)).toBeInTheDocument()
  })

  it('excludes non-client personas (firm staff) from the client dropdown', async () => {
    const user = userEvent.setup()
    const staffPersona: Persona = { ...PERSONA, id: 'p2', displayName: 'Patricia Sim', isClient: false }
    installFakeStore(
      [{ id: 'root-1', name: 'Smith v. Jones', parentId: null, clientPersonaId: null }],
      [PERSONA, staffPersona]
    )
    render(<FileVineView />)
    await user.click(await screen.findByRole('button', { name: 'Smith v. Jones' }))

    const select = screen.getByLabelText('Client')
    expect(within(select).getByRole('option', { name: 'Morgan Rivera' })).toBeInTheDocument()
    expect(within(select).queryByRole('option', { name: 'Patricia Sim' })).not.toBeInTheDocument()
  })

  it('keeps a folder\'s existing client selected in the dropdown even if that persona is no longer marked as a client', async () => {
    const user = userEvent.setup()
    const formerClient: Persona = { ...PERSONA, isClient: false }
    installFakeStore(
      [{ id: 'root-1', name: 'Smith v. Jones', parentId: null, clientPersonaId: 'p1' }],
      [formerClient]
    )
    render(<FileVineView />)
    await user.click(await screen.findByRole('button', { name: 'Smith v. Jones' }))

    expect(await screen.findByLabelText('Client')).toHaveValue('p1')
    expect(screen.getByText(/Client: Morgan Rivera/)).toBeInTheDocument()
  })

  it('047 AC4: shows the folder\'s existing client pre-selected, and allows un-associating it', async () => {
    const user = userEvent.setup()
    installFakeStore([{ id: 'root-1', name: 'Smith v. Jones', parentId: null, clientPersonaId: 'p1' }])
    render(<FileVineView />)
    await user.click(await screen.findByRole('button', { name: 'Smith v. Jones' }))

    expect(await screen.findByLabelText('Client')).toHaveValue('p1')
    expect(screen.getByText(/Client: Morgan Rivera/)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Client'), '')

    expect(window.api.data.fileVineFolders.update).toHaveBeenCalledWith('root-1', { clientPersonaId: null })
  })

  it('047 AC4: changing the client to a different persona updates the association', async () => {
    const user = userEvent.setup()
    const secondPersona: Persona = { ...PERSONA, id: 'p2', displayName: 'Alex Chen', role: 'Paralegal' }
    installFakeStore(
      [{ id: 'root-1', name: 'Smith v. Jones', parentId: null, clientPersonaId: 'p1' }],
      [PERSONA, secondPersona]
    )
    render(<FileVineView />)
    await user.click(await screen.findByRole('button', { name: 'Smith v. Jones' }))
    await screen.findByText(/Client: Morgan Rivera/)

    await user.selectOptions(screen.getByLabelText('Client'), 'p2')

    expect(window.api.data.fileVineFolders.update).toHaveBeenCalledWith('root-1', { clientPersonaId: 'p2' })
    expect(await screen.findByText(/Client: Alex Chen \(Paralegal\)/)).toBeInTheDocument()
  })
})
