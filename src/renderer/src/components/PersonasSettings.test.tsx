// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PersonasSettings from './PersonasSettings'
import type { Persona, PersonasFilePersona } from '../../../shared/data-types'

const PERSONA: Persona = {
  id: 'p1',
  displayName: 'Morgan Rivera',
  email: 'morgan@example.com',
  role: 'Manager',
  bio: 'Runs the regional office.',
  writingStyleNotes: 'Terse, direct.',
  extraPrompt: 'Always mentions the quarterly deadline.',
  isClient: false,
  reportsTo: 'Michael Ferrante'
}

describe('PersonasSettings', () => {
  it('shows a message when there are no personas yet', async () => {
    render(<PersonasSettings />)

    expect(await screen.findByText('No personas yet.')).toBeInTheDocument()
  })

  it('lists existing personas with name, email, and role', async () => {
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])

    render(<PersonasSettings />)

    expect(await screen.findByText('Morgan Rivera')).toBeInTheDocument()
    expect(screen.getByText('morgan@example.com · Manager')).toBeInTheDocument()
  })

  it('disables Add Persona until both Display Name and Email are filled', async () => {
    const user = userEvent.setup()
    render(<PersonasSettings />)

    await user.click(await screen.findByRole('button', { name: '+ New Persona' }))

    const submit = screen.getByRole('button', { name: 'Add Persona' })
    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText('Display Name'), 'Sam Lee')
    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText('Email'), 'sam@example.com')
    expect(submit).toBeEnabled()
  })

  it('creates a persona with all fields (including optional extra prompt) and persists the full array', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])

    render(<PersonasSettings />)

    await user.click(await screen.findByRole('button', { name: '+ New Persona' }))
    await user.type(screen.getByLabelText('Display Name'), 'Sam Lee')
    await user.type(screen.getByLabelText('Email'), 'sam@example.com')
    await user.type(screen.getByLabelText('Role'), 'Paralegal')
    await user.type(screen.getByLabelText('Bio'), 'New to the team.')
    await user.type(screen.getByLabelText('Writing Style'), 'Friendly, uses exclamation points.')
    // Extra Prompt deliberately left blank to prove it's optional.

    await user.click(screen.getByRole('button', { name: 'Add Persona' }))

    await waitFor(() => expect(window.api.data.personas.set).toHaveBeenCalled())
    const [savedPersonas] = vi.mocked(window.api.data.personas.set).mock.calls[0]
    expect(savedPersonas).toHaveLength(2)
    expect(savedPersonas[0]).toEqual(PERSONA)
    expect(savedPersonas[1]).toMatchObject({
      displayName: 'Sam Lee',
      email: 'sam@example.com',
      role: 'Paralegal',
      bio: 'New to the team.',
      writingStyleNotes: 'Friendly, uses exclamation points.',
      extraPrompt: ''
    })
    expect(typeof savedPersonas[1].id).toBe('string')
    expect(savedPersonas[1].id).not.toBe('')

    // The editor closes and the new persona shows up in the list.
    expect(await screen.findByText('Sam Lee')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add Persona' })).not.toBeInTheDocument()
  })

  it('creates a persona marked as a client', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([])

    render(<PersonasSettings />)

    await user.click(await screen.findByRole('button', { name: '+ New Persona' }))
    await user.type(screen.getByLabelText('Display Name'), 'Carlos Torres')
    await user.type(screen.getByLabelText('Email'), 'c.torres@email.test')
    await user.click(screen.getByLabelText('Client'))

    await user.click(screen.getByRole('button', { name: 'Add Persona' }))

    await waitFor(() => expect(window.api.data.personas.set).toHaveBeenCalled())
    const [savedPersonas] = vi.mocked(window.api.data.personas.set).mock.calls[0]
    expect(savedPersonas[0]).toMatchObject({ displayName: 'Carlos Torres', isClient: true })
    expect(await screen.findByText('c.torres@email.test · Client')).toBeInTheDocument()
  })

  it('028 AC2: creates a persona with a Reports To value', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([])

    render(<PersonasSettings />)

    await user.click(await screen.findByRole('button', { name: '+ New Persona' }))
    await user.type(screen.getByLabelText('Display Name'), 'Carlos Torres')
    await user.type(screen.getByLabelText('Email'), 'c.torres@email.test')
    await user.type(screen.getByLabelText('Reports To'), 'Michael Ferrante')

    await user.click(screen.getByRole('button', { name: 'Add Persona' }))

    await waitFor(() => expect(window.api.data.personas.set).toHaveBeenCalled())
    const [savedPersonas] = vi.mocked(window.api.data.personas.set).mock.calls[0]
    expect(savedPersonas[0]).toMatchObject({ displayName: 'Carlos Torres', reportsTo: 'Michael Ferrante' })
  })

  it('028 AC3: Reports To is optional — creating a persona with it left blank saves as empty', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([])

    render(<PersonasSettings />)

    await user.click(await screen.findByRole('button', { name: '+ New Persona' }))
    await user.type(screen.getByLabelText('Display Name'), 'Wei Chen')
    await user.type(screen.getByLabelText('Email'), 'w.chen@email.test')
    // Reports To deliberately left blank to prove it's optional.

    await user.click(screen.getByRole('button', { name: 'Add Persona' }))

    await waitFor(() => expect(window.api.data.personas.set).toHaveBeenCalled())
    const [savedPersonas] = vi.mocked(window.api.data.personas.set).mock.calls[0]
    expect(savedPersonas[0]).toMatchObject({ displayName: 'Wei Chen', reportsTo: '' })
  })

  it('028 AC4: a persona missing reportsTo entirely (pre-feature data) opens for edit without error, field blank', async () => {
    const user = userEvent.setup()
    const legacyPersona = {
      id: 'p1',
      displayName: 'Legacy Persona',
      email: 'legacy@example.com',
      role: '',
      bio: '',
      writingStyleNotes: '',
      extraPrompt: '',
      isClient: false
    } as Persona
    vi.mocked(window.api.data.personas.get).mockResolvedValue([legacyPersona])

    render(<PersonasSettings />)
    await user.click(await screen.findByRole('button', { name: 'Edit' }))

    expect(screen.getByLabelText('Reports To')).toHaveValue('')
  })

  it('028 AC2: editing Reports To and saving persists the change in place', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])

    render(<PersonasSettings />)
    await user.click(await screen.findByRole('button', { name: 'Edit' }))

    const reportsToInput = screen.getByLabelText('Reports To')
    await user.clear(reportsToInput)
    await user.type(reportsToInput, 'Bianca Crocetti')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(window.api.data.personas.set).toHaveBeenCalled())
    expect(window.api.data.personas.set).toHaveBeenCalledWith([{ ...PERSONA, reportsTo: 'Bianca Crocetti' }])
  })

  it('Edit prefills the form with the existing persona, and Save persists the edit in place', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])

    render(<PersonasSettings />)

    await user.click(await screen.findByRole('button', { name: 'Edit' }))

    expect(screen.getByLabelText('Display Name')).toHaveValue('Morgan Rivera')
    expect(screen.getByLabelText('Email')).toHaveValue('morgan@example.com')
    expect(screen.getByLabelText('Role')).toHaveValue('Manager')
    expect(screen.getByLabelText('Bio')).toHaveValue('Runs the regional office.')
    expect(screen.getByLabelText('Writing Style')).toHaveValue('Terse, direct.')
    expect(screen.getByLabelText('Extra Prompt')).toHaveValue('Always mentions the quarterly deadline.')
    expect(screen.getByLabelText('Client')).not.toBeChecked()
    expect(screen.getByLabelText('Reports To')).toHaveValue('Michael Ferrante')

    const roleInput = screen.getByLabelText('Role')
    await user.clear(roleInput)
    await user.type(roleInput, 'Senior Manager')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(window.api.data.personas.set).toHaveBeenCalled())
    expect(window.api.data.personas.set).toHaveBeenCalledWith([{ ...PERSONA, role: 'Senior Manager' }])
    expect(await screen.findByText('morgan@example.com · Senior Manager')).toBeInTheDocument()
  })

  it('Cancel closes the editor without persisting anything', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])

    render(<PersonasSettings />)

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.clear(screen.getByLabelText('Display Name'))
    await user.type(screen.getByLabelText('Display Name'), 'Should not be saved')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(window.api.data.personas.set).not.toHaveBeenCalled()
    expect(screen.getByText('Morgan Rivera')).toBeInTheDocument()
    expect(screen.queryByText('Should not be saved')).not.toBeInTheDocument()
  })

  it('Delete removes the persona from the list and persists the remaining array', async () => {
    const user = userEvent.setup()
    const otherPersona: Persona = { ...PERSONA, id: 'p2', displayName: 'Sam Lee', email: 'sam@example.com' }
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA, otherPersona])

    render(<PersonasSettings />)

    await screen.findByText('Morgan Rivera')
    await user.click(screen.getByRole('button', { name: 'Delete Morgan Rivera' }))

    await waitFor(() => expect(window.api.data.personas.set).toHaveBeenCalledWith([otherPersona]))
    expect(screen.queryByText('Morgan Rivera')).not.toBeInTheDocument()
    expect(screen.getByText('Sam Lee')).toBeInTheDocument()
  })

  // 050 — the edit form renders inline under the edited persona's own row

  it('050 AC1: the edit form renders immediately after the clicked persona\'s row, not below the whole list', async () => {
    const user = userEvent.setup()
    const otherPersona: Persona = { ...PERSONA, id: 'p2', displayName: 'Sam Lee', email: 'sam@example.com' }
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA, otherPersona])

    render(<PersonasSettings />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[0])

    const list = screen.getByLabelText('Display Name').closest('ul') as HTMLElement
    const rows = Array.from(list.children)
    const morganIndex = rows.findIndex((row) => row.textContent?.includes('Morgan Rivera'))
    const editorIndex = rows.findIndex((row) => row.querySelector('#persona-display-name'))
    const samIndex = rows.findIndex((row) => row.textContent?.includes('Sam Lee'))

    // The editor sits directly under Morgan's own row (the one that was
    // clicked) and strictly before Sam's row — not appended after the
    // whole list.
    expect(editorIndex).toBe(morganIndex + 1)
    expect(editorIndex).toBeLessThan(samIndex)
  })

  it('050 AC1: editing the second persona in the list places the form under that row, not the first', async () => {
    const user = userEvent.setup()
    const otherPersona: Persona = { ...PERSONA, id: 'p2', displayName: 'Sam Lee', email: 'sam@example.com' }
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA, otherPersona])

    render(<PersonasSettings />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[1]) // Sam Lee

    const list = screen.getByLabelText('Display Name').closest('ul') as HTMLElement
    const rows = Array.from(list.children)
    const samIndex = rows.findIndex((row) => row.textContent?.includes('Sam Lee'))
    const editorIndex = rows.findIndex((row) => row.querySelector('#persona-display-name'))

    expect(editorIndex).toBe(samIndex + 1)
    expect(screen.getByLabelText('Display Name')).toHaveValue('Sam Lee')
  })

  it('050 AC2: opening a different persona\'s edit form closes/replaces the previously open one', async () => {
    const user = userEvent.setup()
    const otherPersona: Persona = { ...PERSONA, id: 'p2', displayName: 'Sam Lee', email: 'sam@example.com' }
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA, otherPersona])

    render(<PersonasSettings />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[0])
    expect(screen.getByLabelText('Display Name')).toHaveValue('Morgan Rivera')

    await user.click(screen.getAllByRole('button', { name: 'Edit' })[1])

    // Exactly one editor open, now showing the second persona's data.
    expect(screen.getAllByLabelText('Display Name')).toHaveLength(1)
    expect(screen.getByLabelText('Display Name')).toHaveValue('Sam Lee')
  })

  it('050 AC3: "+ New Persona" still opens its form below the whole list, outside the persona list itself', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])

    render(<PersonasSettings />)
    await screen.findByText('Morgan Rivera')

    await user.click(screen.getByRole('button', { name: '+ New Persona' }))

    const list = document.querySelector('.persona-list') as HTMLElement
    expect(list.querySelector('#persona-display-name')).toBeNull()
    expect(document.getElementById('persona-display-name')).not.toBeNull()
  })

  it('050: the create form is hidden while an inline edit is open, and vice versa (still only one editor at a time)', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])

    render(<PersonasSettings />)

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    expect(screen.queryByRole('button', { name: '+ New Persona' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(1)
  })

  // reloadKey (feature 030 — Settings live-refresh after a scenario pack load)

  it('030 AC1: refetches the persona list when reloadKey changes, without needing to unmount/remount', async () => {
    vi.mocked(window.api.data.personas.get).mockResolvedValueOnce([PERSONA])

    const { rerender } = render(<PersonasSettings reloadKey={0} />)
    expect(await screen.findByText('Morgan Rivera')).toBeInTheDocument()

    const otherPersona: Persona = { ...PERSONA, id: 'p2', displayName: 'Sam Lee', email: 'sam@example.com' }
    vi.mocked(window.api.data.personas.get).mockResolvedValueOnce([otherPersona])
    rerender(<PersonasSettings reloadKey={1} />)

    expect(await screen.findByText('Sam Lee')).toBeInTheDocument()
    expect(screen.queryByText('Morgan Rivera')).not.toBeInTheDocument()
    expect(window.api.data.personas.get).toHaveBeenCalledTimes(2)
  })

  it('030: does not refetch merely on re-render when reloadKey stays the same', async () => {
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])

    const { rerender } = render(<PersonasSettings reloadKey={0} />)
    await screen.findByText('Morgan Rivera')

    rerender(<PersonasSettings reloadKey={0} />)

    expect(window.api.data.personas.get).toHaveBeenCalledTimes(1)
  })

  it('030 AC4: discards an in-progress unsaved create form when reloadKey changes (a pack load), rather than leaving it open', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([])

    const { rerender } = render(<PersonasSettings reloadKey={0} />)
    await screen.findByText('No personas yet.')
    await user.click(screen.getByRole('button', { name: '+ New Persona' }))
    await user.type(screen.getByLabelText('Display Name'), 'Unsaved Draft')
    expect(screen.getByLabelText('Display Name')).toHaveValue('Unsaved Draft')

    rerender(<PersonasSettings reloadKey={1} />)

    await waitFor(() => expect(screen.queryByLabelText('Display Name')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: '+ New Persona' })).toBeInTheDocument()
  })

  it('030 AC4: discards an in-progress unsaved edit form the same way', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])

    const { rerender } = render(<PersonasSettings reloadKey={0} />)
    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.clear(screen.getByLabelText('Display Name'))
    await user.type(screen.getByLabelText('Display Name'), 'Unsaved Edit')

    rerender(<PersonasSettings reloadKey={1} />)

    await waitFor(() => expect(screen.queryByDisplayValue('Unsaved Edit')).not.toBeInTheDocument())
    expect(window.api.data.personas.set).not.toHaveBeenCalled()
  })

  it('a bare render with no reloadKey prop still fetches once on mount (backward compatible)', async () => {
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])

    render(<PersonasSettings />)

    expect(await screen.findByText('Morgan Rivera')).toBeInTheDocument()
    expect(window.api.data.personas.get).toHaveBeenCalledTimes(1)
  })

  // Load Personas from a JSON file (feature 031)

  it('031 AC1: "Load Personas…" invokes the file-picker IPC call', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([])
    vi.mocked(window.api.personasFile.pick).mockResolvedValue({ ok: false, canceled: true })

    render(<PersonasSettings />)
    await screen.findByText('No personas yet.')
    await user.click(screen.getByRole('button', { name: 'Load Personas…' }))

    expect(window.api.personasFile.pick).toHaveBeenCalledTimes(1)
  })

  it('031 AC2: a valid file replaces the current persona list, persisted via personas.set', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])
    vi.mocked(window.api.personasFile.pick).mockResolvedValue({
      ok: true,
      personas: [
        {
          displayName: 'Salvatore Grillo',
          email: 'sgrillo@grillo.ca',
          role: 'Founder & Principal Lawyer',
          bio: '',
          writingStyleNotes: '',
          extraPrompt: '',
          isClient: false,
          reportsTo: ''
        }
      ]
    })

    render(<PersonasSettings />)
    await screen.findByText('Morgan Rivera')
    await user.click(screen.getByRole('button', { name: 'Load Personas…' }))

    expect(await screen.findByText('Salvatore Grillo')).toBeInTheDocument()
    // 031 AC2: replaced, not merged.
    expect(screen.queryByText('Morgan Rivera')).not.toBeInTheDocument()

    await waitFor(() => expect(window.api.data.personas.set).toHaveBeenCalled())
    const [saved] = vi.mocked(window.api.data.personas.set).mock.calls[0]
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ displayName: 'Salvatore Grillo', email: 'sgrillo@grillo.ca' })
    expect(typeof saved[0].id).toBe('string')
    expect(saved[0].id).not.toBe('')
  })

  it('031 AC3: an invalid file shows a specific, readable error instead of crashing or silently doing nothing', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])
    vi.mocked(window.api.personasFile.pick).mockResolvedValue({
      ok: false,
      error: 'personas[0].displayName must be a string'
    })

    render(<PersonasSettings />)
    await screen.findByText('Morgan Rivera')
    await user.click(screen.getByRole('button', { name: 'Load Personas…' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('personas[0].displayName must be a string')
    expect(window.api.data.personas.set).not.toHaveBeenCalled()
    // Not crashed — the existing list and controls are still there.
    expect(screen.getByText('Morgan Rivera')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ New Persona' })).toBeInTheDocument()
  })

  it('031: canceling the file dialog does nothing (no error, no change)', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])
    vi.mocked(window.api.personasFile.pick).mockResolvedValue({ ok: false, canceled: true })

    render(<PersonasSettings />)
    await screen.findByText('Morgan Rivera')
    await user.click(screen.getByRole('button', { name: 'Load Personas…' }))

    expect(window.api.data.personas.set).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Morgan Rivera')).toBeInTheDocument()
  })

  // Generate personas via LLM (feature 032)

  const GENERATED_CAST: PersonasFilePersona[] = [
    {
      displayName: 'Alice Chen',
      email: 'alice@firm.com',
      role: 'Partner',
      bio: 'Senior partner.',
      writingStyleNotes: 'Formal.',
      extraPrompt: '',
      isClient: false,
      reportsTo: ''
    },
    {
      displayName: 'Bob Diaz',
      email: 'bob@firm.com',
      role: 'Associate',
      bio: 'Junior associate.',
      writingStyleNotes: 'Casual.',
      extraPrompt: '',
      isClient: false,
      reportsTo: 'Alice Chen'
    }
  ]

  it('032 AC1: Generate Personas is disabled until a description is entered', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([])

    render(<PersonasSettings />)
    await screen.findByText('No personas yet.')

    const generateButton = screen.getByRole('button', { name: 'Generate Personas' })
    expect(generateButton).toBeDisabled()

    await user.type(screen.getByLabelText('Generate Personas'), 'a small law firm')
    expect(generateButton).toBeEnabled()
  })

  it('032 AC1: clicking Generate Personas invokes the LLM call with the entered free-text description', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([])
    vi.mocked(window.api.llm.generatePersonas).mockResolvedValue({ ok: true, personas: GENERATED_CAST })

    render(<PersonasSettings />)
    await screen.findByText('No personas yet.')
    await user.type(screen.getByLabelText('Generate Personas'), 'a small law firm in Chicago')
    await user.click(screen.getByRole('button', { name: 'Generate Personas' }))

    await waitFor(() => expect(window.api.llm.generatePersonas).toHaveBeenCalledWith('a small law firm in Chicago'))
  })

  it('032 AC2: a successful generation is shown for review, with well-formed fields and reports-to structure, before anything is committed', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([])
    vi.mocked(window.api.llm.generatePersonas).mockResolvedValue({ ok: true, personas: GENERATED_CAST })

    render(<PersonasSettings />)
    await screen.findByText('No personas yet.')
    await user.type(screen.getByLabelText('Generate Personas'), 'a small law firm')
    await user.click(screen.getByRole('button', { name: 'Generate Personas' }))

    expect(await screen.findByText('Alice Chen')).toBeInTheDocument()
    expect(screen.getByText('Bob Diaz')).toBeInTheDocument()
    expect(screen.getByText('alice@firm.com · Partner')).toBeInTheDocument()
    expect(screen.getByText(/Reports to Alice Chen/)).toBeInTheDocument()
    // Not yet committed: personas.set hasn't been called, and there's an
    // explicit Add/Discard choice still pending.
    expect(window.api.data.personas.set).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Add 2 Personas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument()
  })

  it('032 AC3: accepting a generation adds the generated personas to the existing list and persists the merged array', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])
    vi.mocked(window.api.llm.generatePersonas).mockResolvedValue({ ok: true, personas: GENERATED_CAST })

    render(<PersonasSettings />)
    await screen.findByText('Morgan Rivera')
    await user.type(screen.getByLabelText('Generate Personas'), 'a small law firm')
    await user.click(screen.getByRole('button', { name: 'Generate Personas' }))
    await screen.findByText('Alice Chen')

    await user.click(screen.getByRole('button', { name: 'Add 2 Personas' }))

    await waitFor(() => expect(window.api.data.personas.set).toHaveBeenCalled())
    const [saved] = vi.mocked(window.api.data.personas.set).mock.calls[0]
    expect(saved).toHaveLength(3)
    expect(saved[0]).toEqual(PERSONA)
    expect(saved[1]).toMatchObject({ displayName: 'Alice Chen' })
    expect(saved[2]).toMatchObject({ displayName: 'Bob Diaz', reportsTo: 'Alice Chen' })
    expect(typeof saved[1].id).toBe('string')
    expect(saved[1].id).not.toBe('')

    // The review is gone and the newly accepted personas show up alongside
    // the pre-existing one.
    expect(screen.queryByRole('button', { name: 'Add 2 Personas' })).not.toBeInTheDocument()
    expect(screen.getByText('Morgan Rivera')).toBeInTheDocument()
    expect(screen.getByText('Alice Chen')).toBeInTheDocument()
  })

  it('032 AC3: discarding a generation persists nothing and leaves the existing list untouched', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])
    vi.mocked(window.api.llm.generatePersonas).mockResolvedValue({ ok: true, personas: GENERATED_CAST })

    render(<PersonasSettings />)
    await screen.findByText('Morgan Rivera')
    await user.type(screen.getByLabelText('Generate Personas'), 'a small law firm')
    await user.click(screen.getByRole('button', { name: 'Generate Personas' }))
    await screen.findByText('Alice Chen')

    await user.click(screen.getByRole('button', { name: 'Discard' }))

    expect(window.api.data.personas.set).not.toHaveBeenCalled()
    expect(screen.queryByText('Alice Chen')).not.toBeInTheDocument()
    expect(screen.getByText('Morgan Rivera')).toBeInTheDocument()
    // Back to the normal controls, ready to try again.
    expect(screen.getByRole('button', { name: 'Generate Personas' })).toBeInTheDocument()
  })

  it('032 AC4: a failed generation shows a clear error and never touches the existing list or persistence', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([PERSONA])
    vi.mocked(window.api.llm.generatePersonas).mockResolvedValue({
      ok: false,
      error: 'No API key configured for openai.'
    })

    render(<PersonasSettings />)
    await screen.findByText('Morgan Rivera')
    await user.type(screen.getByLabelText('Generate Personas'), 'a small law firm')
    await user.click(screen.getByRole('button', { name: 'Generate Personas' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No API key configured for openai.')
    expect(window.api.data.personas.set).not.toHaveBeenCalled()
    // Not crashed — the existing list and controls are still there.
    expect(screen.getByText('Morgan Rivera')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ New Persona' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add \d+ Persona/ })).not.toBeInTheDocument()
  })

  it('032 AC5: an accepted generated persona is saved through the same personas.set call manual create uses, so it persists like any other persona', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.personas.get).mockResolvedValue([])
    vi.mocked(window.api.llm.generatePersonas).mockResolvedValue({ ok: true, personas: [GENERATED_CAST[0]] })

    render(<PersonasSettings />)
    await screen.findByText('No personas yet.')
    await user.type(screen.getByLabelText('Generate Personas'), 'a small law firm')
    await user.click(screen.getByRole('button', { name: 'Generate Personas' }))
    await screen.findByText('Alice Chen')
    await user.click(screen.getByRole('button', { name: 'Add 1 Persona' }))

    await waitFor(() => expect(window.api.data.personas.set).toHaveBeenCalledTimes(1))
    // Same IPC call (config:personas:set under the hood) manual create/edit
    // and 031's Load Personas already use for persistence — no separate,
    // generation-specific persistence path exists.
    expect(window.api.data.personas.set).toHaveBeenCalledWith([expect.objectContaining({ displayName: 'Alice Chen' })])
  })
})
