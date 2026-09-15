// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PersonasSettings from './PersonasSettings'
import type { Persona } from '../../../shared/data-types'

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
})
