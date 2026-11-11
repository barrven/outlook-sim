// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GhostPracticeView from './GhostPracticeView'
import type { Persona } from '../../../shared/data-types'
import {
  BLANK_GP_MATTER_FIELDS,
  DEFAULT_GP_ADMIN,
  type GpAdmin,
  type GpDocument,
  type GpFolder,
  type GpMatter,
  type GpRecord,
  type GpRecordData,
  type GpRecordKind
} from '../../../shared/ghostPractice'

// Local noon, so the simulated "today" is the same calendar date in any
// timezone the suite runs in.
const TODAY = '2026-03-04'
const NOW = new Date(2026, 2, 4, 12, 0).getTime()

const CLIENT_PERSONA: Persona = {
  id: 'p1',
  displayName: 'Ana Rivera',
  email: 'ana@example.com',
  role: 'Client',
  bio: '',
  writingStyleNotes: '',
  extraPrompt: '',
  isClient: true,
  reportsTo: ''
}

const STAFF_PERSONA: Persona = { ...CLIENT_PERSONA, id: 'p2', displayName: 'Lee Counsel', isClient: false }

function makeMatter(overrides: Partial<GpMatter> = {}): GpMatter {
  return {
    ...BLANK_GP_MATTER_FIELDS,
    id: 'm1',
    matterNumber: 'AB-2026-0001',
    createdAt: NOW,
    clientName: 'Rivera, Ana',
    ...overrides
  }
}

function makeRecord(kind: GpRecordKind, data: GpRecordData, overrides: Partial<GpRecord> = {}): GpRecord {
  return { id: `${kind}-seed`, matterId: 'm1', kind, createdAt: NOW, updatedAt: null, data, ...overrides }
}

interface Seed {
  matters?: GpMatter[]
  records?: GpRecord[]
  folders?: GpFolder[]
  documents?: GpDocument[]
  admin?: GpAdmin
  personas?: Persona[]
  currentUser?: string
}

// An in-memory stand-in for the real Ghost Practice store, so the view's
// own refetch-after-write flow is exercised end to end.
function installStore(seed: Seed = {}): { matters: GpMatter[]; records: GpRecord[]; documents: GpDocument[]; folders: GpFolder[] } {
  const store = {
    matters: [...(seed.matters ?? [])],
    records: [...(seed.records ?? [])],
    folders: [...(seed.folders ?? [])],
    documents: [...(seed.documents ?? [])],
    admin: seed.admin ?? DEFAULT_GP_ADMIN
  }
  let counter = 0
  const newId = (prefix: string): string => `${prefix}-${++counter}`
  const gp = window.api.gp

  vi.mocked(gp.matters.list).mockImplementation(() => Promise.resolve([...store.matters]))
  vi.mocked(gp.matters.create).mockImplementation((matter) => {
    const created: GpMatter = {
      ...BLANK_GP_MATTER_FIELDS,
      ...matter,
      id: newId('m'),
      createdAt: NOW,
      matterNumber: `AB-2026-${String(store.matters.length + 1).padStart(4, '0')}`
    }
    store.matters.push(created)
    return Promise.resolve(created)
  })
  vi.mocked(gp.matters.update).mockImplementation((id, patch) => {
    store.matters = store.matters.map((matter) => (matter.id === id ? { ...matter, ...patch } : matter))
    return Promise.resolve(store.matters.find((matter) => matter.id === id) ?? null)
  })
  vi.mocked(gp.matters.delete).mockImplementation((id) => {
    store.matters = store.matters.filter((matter) => matter.id !== id)
    return Promise.resolve()
  })

  vi.mocked(gp.records.list).mockImplementation((matterId) =>
    Promise.resolve(store.records.filter((record) => !matterId || record.matterId === matterId))
  )
  vi.mocked(gp.records.create).mockImplementation((record) => {
    const created: GpRecord = { id: newId('r'), createdAt: NOW, updatedAt: null, ...record }
    store.records.push(created)
    return Promise.resolve(created)
  })
  vi.mocked(gp.records.update).mockImplementation((id, data) => {
    store.records = store.records.map((record) =>
      record.id === id ? { ...record, updatedAt: NOW, data: { ...record.data, ...data } } : record
    )
    return Promise.resolve(store.records.find((record) => record.id === id) ?? null)
  })
  vi.mocked(gp.records.delete).mockImplementation((id) => {
    store.records = store.records.filter((record) => record.id !== id)
    return Promise.resolve()
  })

  vi.mocked(gp.folders.list).mockImplementation((matterId) =>
    Promise.resolve(store.folders.filter((folder) => folder.matterId === matterId))
  )
  vi.mocked(gp.folders.create).mockImplementation((folder) => {
    const created: GpFolder = { id: newId('f'), parentId: null, ...folder }
    store.folders.push(created)
    return Promise.resolve(created)
  })
  vi.mocked(gp.folders.update).mockImplementation((id, patch) => {
    store.folders = store.folders.map((folder) => (folder.id === id ? { ...folder, ...patch } : folder))
    return Promise.resolve(store.folders.find((folder) => folder.id === id) ?? null)
  })
  vi.mocked(gp.folders.delete).mockImplementation((id) => {
    store.folders = store.folders.filter((folder) => folder.id !== id)
    store.documents = store.documents.filter((document) => document.folderId !== id)
    return Promise.resolve()
  })

  vi.mocked(gp.documents.list).mockImplementation((matterId) =>
    Promise.resolve(store.documents.filter((document) => document.matterId === matterId))
  )
  vi.mocked(gp.documents.create).mockImplementation((document) => {
    const created: GpDocument = {
      id: newId('d'),
      folderId: null,
      path: null,
      uploadedBy: '',
      createdAt: NOW,
      ...document
    }
    store.documents.push(created)
    return Promise.resolve(created)
  })
  vi.mocked(gp.documents.update).mockImplementation((id, patch) => {
    store.documents = store.documents.map((document) => (document.id === id ? { ...document, ...patch } : document))
    return Promise.resolve(store.documents.find((document) => document.id === id) ?? null)
  })
  vi.mocked(gp.documents.delete).mockImplementation((id) => {
    store.documents = store.documents.filter((document) => document.id !== id)
    return Promise.resolve()
  })

  vi.mocked(gp.admin.get).mockImplementation(() => Promise.resolve(store.admin))
  vi.mocked(gp.admin.set).mockImplementation((admin) => {
    store.admin = admin
    return Promise.resolve()
  })

  vi.mocked(window.api.data.personas.get).mockResolvedValue(seed.personas ?? [CLIENT_PERSONA, STAFF_PERSONA])
  vi.mocked(window.api.data.identity.get).mockResolvedValue({
    displayName: seed.currentUser ?? 'Sam Trainee',
    jobTitle: '',
    fromEmail: '',
    reportsTo: '',
    department: ''
  })
  vi.mocked(window.api.data.clock.now).mockResolvedValue(NOW)
  return store
}

async function openFile(user: ReturnType<typeof userEvent.setup>, matterNumber = 'AB-2026-0001'): Promise<void> {
  await user.click(await screen.findByRole('button', { name: `Open file ${matterNumber}` }))
  await screen.findByRole('tablist', { name: 'File sections' })
}

async function openTab(user: ReturnType<typeof userEvent.setup>, name: string): Promise<void> {
  await user.click(screen.getByRole('tab', { name }))
}

describe('GhostPracticeView — My files (FILE-01, 07, 10, 11)', () => {
  it('shows the Ghost Practice heading and an empty state when there are no files', async () => {
    installStore()
    render(<GhostPracticeView />)

    expect(screen.getByRole('heading', { name: 'Ghost Practice' })).toBeInTheDocument()
    expect(await screen.findByText('No files yet. Create one with New file.')).toBeInTheDocument()
  })

  it('lists each file with its matter #, client, date of loss, insurer, status, and next deadline', async () => {
    installStore({
      matters: [makeMatter({ dateOfLoss: '2026-01-05', insurerCompany: 'Northern Mutual', status: 'benefits' })],
      records: [makeRecord('task', { text: 'Call clinic', dueDate: '2026-03-10', done: false })]
    })
    render(<GhostPracticeView />)

    const row = (await screen.findByRole('button', { name: 'Open file AB-2026-0001' })).closest('tr') as HTMLElement
    expect(within(row).getByText('Rivera, Ana')).toBeInTheDocument()
    expect(within(row).getByText('2026-01-05')).toBeInTheDocument()
    expect(within(row).getByText('Northern Mutual')).toBeInTheDocument()
    expect(within(row).getByText('Benefits ongoing')).toBeInTheDocument()
    expect(within(row).getByText('2026-03-10 — Task: Call clinic')).toBeInTheDocument()
  })

  it('creates a file assigned to the trainee and opens it straight away', async () => {
    const user = userEvent.setup()
    installStore()
    render(<GhostPracticeView />)

    await user.click(await screen.findByRole('button', { name: 'New file' }))
    await user.type(screen.getByLabelText('Client name'), 'Doe, John')
    await user.type(screen.getByLabelText('Insurer'), 'Northern Mutual')
    await user.type(screen.getByLabelText('Claim #'), 'CLM-1')
    await user.click(screen.getByRole('button', { name: 'Create file' }))

    expect(window.api.gp.matters.create).toHaveBeenCalledWith({
      clientName: 'Doe, John',
      clientPersonaId: null,
      dateOfLoss: '',
      insurerCompany: 'Northern Mutual',
      claimNumber: 'CLM-1',
      assignedAssistant: 'Sam Trainee'
    })
    expect(await screen.findByText('AB-2026-0001 — Doe, John')).toBeInTheDocument()
  })

  it('offers only client personas to link, and fills the client name from the one picked', async () => {
    const user = userEvent.setup()
    installStore()
    render(<GhostPracticeView />)

    await user.click(await screen.findByRole('button', { name: 'New file' }))
    const personaSelect = screen.getByLabelText('Linked client persona')
    expect(within(personaSelect).getByRole('option', { name: 'Ana Rivera' })).toBeInTheDocument()
    expect(within(personaSelect).queryByRole('option', { name: 'Lee Counsel' })).not.toBeInTheDocument()

    await user.selectOptions(personaSelect, 'p1')
    expect(screen.getByLabelText('Client name')).toHaveValue('Ana Rivera')
    await user.click(screen.getByRole('button', { name: 'Create file' }))

    expect(window.api.gp.matters.create).toHaveBeenCalledWith(
      expect.objectContaining({ clientName: 'Ana Rivera', clientPersonaId: 'p1' })
    )
  })

  it('does not create a file with a blank client name', async () => {
    const user = userEvent.setup()
    installStore()
    render(<GhostPracticeView />)

    await user.click(await screen.findByRole('button', { name: 'New file' }))
    await user.click(screen.getByRole('button', { name: 'Create file' }))

    expect(window.api.gp.matters.create).not.toHaveBeenCalled()
  })

  it('searches by client, claim #, and date of loss, and filters by status and assignee', async () => {
    const user = userEvent.setup()
    installStore({
      matters: [
        makeMatter({ claimNumber: 'CLM-111', dateOfLoss: '2026-01-05', assignedAssistant: 'Sam Trainee' }),
        makeMatter({
          id: 'm2',
          matterNumber: 'AB-2026-0002',
          clientName: 'Doe, John',
          claimNumber: 'CLM-222',
          dateOfLoss: '2025-11-20',
          status: 'lat',
          assignedAssistant: 'Pat Other'
        })
      ]
    })
    render(<GhostPracticeView />)
    await screen.findByRole('button', { name: 'Open file AB-2026-0001' })
    const search = screen.getByRole('searchbox', { name: 'Search files' })

    await user.type(search, 'doe')
    expect(screen.queryByRole('button', { name: 'Open file AB-2026-0001' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open file AB-2026-0002' })).toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'CLM-111')
    expect(screen.getByRole('button', { name: 'Open file AB-2026-0001' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open file AB-2026-0002' })).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, '2025-11')
    expect(screen.getByRole('button', { name: 'Open file AB-2026-0002' })).toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'nobody')
    expect(screen.getByText('No files match.')).toBeInTheDocument()

    await user.clear(search)
    await user.selectOptions(screen.getByLabelText('Filter by status'), 'lat')
    expect(screen.queryByRole('button', { name: 'Open file AB-2026-0001' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open file AB-2026-0002' })).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Filter by status'), '')
    await user.selectOptions(screen.getByLabelText('Filter by assignee'), 'Sam Trainee')
    expect(screen.getByRole('button', { name: 'Open file AB-2026-0001' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open file AB-2026-0002' })).not.toBeInTheDocument()
  })
})

describe('GhostPracticeView — matter home (FILE-02..08)', () => {
  it('summarises the file: insurer block, track, next deadline, running hours and charges', async () => {
    const user = userEvent.setup()
    installStore({
      matters: [
        makeMatter({
          insurerCompany: 'Northern Mutual',
          claimNumber: 'CLM-111',
          adjusterName: 'Kim Adjuster',
          injuryTrack: 'MIG',
          coverageIrb: true,
          summary: 'Client in physio twice a week.'
        })
      ],
      records: [
        makeRecord('time', { date: TODAY, user: 'Sam Trainee', hours: 2, rate: 100, billable: true }),
        makeRecord('charge', { date: TODAY, vendor: 'LAT', amount: 106, tax: 0, paid: false, recoverable: true }),
        makeRecord('task', { text: 'Send OCF-3', dueDate: '2026-03-09', done: false })
      ]
    })
    render(<GhostPracticeView />)
    await openFile(user)

    expect(screen.getByText('Northern Mutual · Claim # CLM-111 · Adjuster: Kim Adjuster')).toBeInTheDocument()
    expect(screen.getByText('MIG')).toBeInTheDocument()
    expect(screen.getByText('IRB')).toBeInTheDocument()
    expect(screen.getByText('2026-03-09 — Task: Send OCF-3')).toBeInTheDocument()
    expect(screen.getByText('2.0 h · $200.00')).toBeInTheDocument()
    expect(screen.getByText('$106.00 ($106.00 outstanding)')).toBeInTheDocument()
    expect(screen.getByText('No settlement recorded')).toBeInTheDocument()
    expect(screen.getByText('Client in physio twice a week.')).toBeInTheDocument()
  })

  it('edits file details — accident, insurer, coverage flags, injury track — in one save', async () => {
    const user = userEvent.setup()
    installStore({ matters: [makeMatter()] })
    render(<GhostPracticeView />)
    await openFile(user)

    await user.click(screen.getByRole('button', { name: 'Edit file details' }))
    await user.type(screen.getByLabelText('Location'), 'Yonge and Bloor')
    await user.type(screen.getByLabelText('Policy #'), 'POL-9')
    await user.click(screen.getByLabelText('Income replacement (IRB)'))
    await user.selectOptions(screen.getByLabelText('Injury track'), 'CAT')
    await user.selectOptions(screen.getByLabelText('Linked client persona'), 'p1')
    await user.click(screen.getByRole('button', { name: 'Save file details' }))

    expect(window.api.gp.matters.update).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({
        clientName: 'Rivera, Ana',
        accidentLocation: 'Yonge and Bloor',
        policyNumber: 'POL-9',
        coverageIrb: true,
        coverageNeb: false,
        injuryTrack: 'CAT',
        clientPersonaId: 'p1'
      })
    )
    expect(await screen.findByText('CAT')).toBeInTheDocument()
  })

  it('refuses to save file details with the client name cleared', async () => {
    const user = userEvent.setup()
    installStore({ matters: [makeMatter()] })
    render(<GhostPracticeView />)
    await openFile(user)

    await user.click(screen.getByRole('button', { name: 'Edit file details' }))
    await user.clear(screen.getByLabelText('Client name'))
    await user.click(screen.getByRole('button', { name: 'Save file details' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Client name is required.')
    expect(window.api.gp.matters.update).not.toHaveBeenCalled()
  })

  it('changes the file status from the header, including closing it', async () => {
    const user = userEvent.setup()
    installStore({ matters: [makeMatter()] })
    render(<GhostPracticeView />)
    await openFile(user)

    await user.selectOptions(screen.getByLabelText('Status'), 'closed')

    expect(window.api.gp.matters.update).toHaveBeenCalledWith('m1', { status: 'closed' })
    await waitFor(() => expect(screen.getByLabelText('Status')).toHaveValue('closed'))
  })

  it('deletes a file only after confirmation, then returns to the list', async () => {
    const user = userEvent.setup()
    installStore({ matters: [makeMatter()] })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(<GhostPracticeView />)
    await openFile(user)

    await user.click(screen.getByRole('button', { name: 'Delete file' }))
    expect(window.api.gp.matters.delete).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Delete file' }))
    expect(window.api.gp.matters.delete).toHaveBeenCalledWith('m1')
    expect(await screen.findByText('No files yet. Create one with New file.')).toBeInTheDocument()
    confirmSpy.mockRestore()
  })

  it('goes back to My files from an open file', async () => {
    const user = userEvent.setup()
    installStore({ matters: [makeMatter()] })
    render(<GhostPracticeView />)
    await openFile(user)

    await user.click(screen.getByRole('button', { name: '← My files' }))

    expect(await screen.findByRole('button', { name: 'Open file AB-2026-0001' })).toBeInTheDocument()
  })
})

describe('GhostPracticeView — time (TIME-01..07)', () => {
  const admin: GpAdmin = {
    ...DEFAULT_GP_ADMIN,
    users: [
      { name: 'Sam Trainee', role: 'Assistant', defaultRate: 90 },
      { name: 'Lee Counsel', role: 'Lawyer', defaultRate: 350 }
    ]
  }

  it('records a time entry defaulting to today, the trainee, and their default rate', async () => {
    const user = userEvent.setup()
    installStore({ matters: [makeMatter()], admin })
    render(<GhostPracticeView />)
    await openFile(user)
    await openTab(user, 'Time')

    await user.click(screen.getByRole('button', { name: 'Add time entry' }))
    expect(screen.getByLabelText('Date')).toHaveValue(TODAY)
    expect(screen.getByLabelText('User')).toHaveValue('Sam Trainee')
    expect(screen.getByLabelText('Rate')).toHaveValue(90)
    expect(screen.getByLabelText('Billable')).toBeChecked()

    await user.type(screen.getByLabelText('Hours'), '0.5')
    await user.type(screen.getByLabelText('Description'), 'Call with adjuster')
    await user.selectOptions(screen.getByLabelText('Activity'), 'Call')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(window.api.gp.records.create).toHaveBeenCalledWith({
      matterId: 'm1',
      kind: 'time',
      data: {
        date: TODAY,
        user: 'Sam Trainee',
        hours: 0.5,
        description: 'Call with adjuster',
        activityType: 'Call',
        rate: 90,
        billable: true
      }
    })
    expect(await screen.findByText('Call with adjuster')).toBeInTheDocument()
    expect(within(screen.getByLabelText('Time totals')).getByText('Total: 0.5 h · $45.00')).toBeInTheDocument()
  })

  it('follows the default rate when the user changes, until a rate is typed by hand', async () => {
    const user = userEvent.setup()
    installStore({ matters: [makeMatter()], admin })
    render(<GhostPracticeView />)
    await openFile(user)
    await openTab(user, 'Time')
    await user.click(screen.getByRole('button', { name: 'Add time entry' }))

    await user.clear(screen.getByLabelText('User'))
    await user.type(screen.getByLabelText('User'), 'Lee Counsel')
    expect(screen.getByLabelText('Rate')).toHaveValue(350)

    await user.clear(screen.getByLabelText('Rate'))
    await user.type(screen.getByLabelText('Rate'), '200')
    await user.clear(screen.getByLabelText('User'))
    await user.type(screen.getByLabelText('User'), 'Sam Trainee')
    expect(screen.getByLabelText('Rate')).toHaveValue(200)
  })

  it('requires the mandatory fields before saving', async () => {
    const user = userEvent.setup()
    installStore({ matters: [makeMatter()] })
    render(<GhostPracticeView />)
    await openFile(user)
    await openTab(user, 'Time')

    await user.click(screen.getByRole('button', { name: 'Add time entry' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Hours is required.')
    expect(window.api.gp.records.create).not.toHaveBeenCalled()
  })

  it('voids rather than deletes an entry: it stays listed, marked, and out of the totals', async () => {
    const user = userEvent.setup()
    installStore({
      matters: [makeMatter()],
      records: [
        makeRecord('time', { date: TODAY, user: 'Sam Trainee', hours: 2, description: 'Wrong file', rate: 100, billable: true })
      ]
    })
    render(<GhostPracticeView />)
    await openFile(user)
    await openTab(user, 'Time')

    expect(screen.queryByRole('button', { name: 'Delete Wrong file' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: `Void ${TODAY}` }))

    expect(window.api.gp.records.update).toHaveBeenCalledWith('time-seed', { voided: true })
    expect(await screen.findByText('Voided')).toBeInTheDocument()
    expect(screen.getByText('Wrong file')).toBeInTheDocument()
    expect(within(screen.getByLabelText('Time totals')).getByText('Total: 0.0 h · $0.00')).toBeInTheDocument()
    expect(window.api.gp.records.delete).not.toHaveBeenCalled()
  })

  it('marks an edited entry, and totals by user within a date range', async () => {
    const user = userEvent.setup()
    installStore({
      matters: [makeMatter()],
      records: [
        makeRecord('time', { date: '2026-02-01', user: 'Sam Trainee', hours: 1, description: 'February work', rate: 100, billable: true }, { id: 't1' }),
        makeRecord('time', { date: '2026-03-02', user: 'Lee Counsel', hours: 3, description: 'March work', rate: 300, billable: true }, { id: 't2', updatedAt: NOW })
      ]
    })
    render(<GhostPracticeView />)
    await openFile(user)
    await openTab(user, 'Time')

    expect(screen.getAllByText('Edited')).toHaveLength(1)
    const totals = screen.getByLabelText('Time totals')
    expect(within(totals).getByText('Total: 4.0 h · $1,000.00')).toBeInTheDocument()
    expect(within(totals).getByText('Lee Counsel: 3.0 h · $900.00')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-03-01' } })

    expect(screen.queryByText('February work')).not.toBeInTheDocument()
    expect(within(totals).getByText('Total: 3.0 h · $900.00')).toBeInTheDocument()
    expect(within(totals).queryByText(/Sam Trainee/)).not.toBeInTheDocument()
  })

  it('TIME-06: "My time today" lists only the trainee\'s own entries dated today, across files', async () => {
    const user = userEvent.setup()
    installStore({
      matters: [makeMatter(), makeMatter({ id: 'm2', matterNumber: 'AB-2026-0002', clientName: 'Doe, John' })],
      records: [
        makeRecord('time', { date: TODAY, user: 'Sam Trainee', hours: 1.5, description: 'Mine today' }, { id: 't1' }),
        makeRecord('time', { date: TODAY, user: 'Sam Trainee', hours: 0.5, description: 'Mine on file two' }, { id: 't2', matterId: 'm2' }),
        makeRecord('time', { date: '2026-03-03', user: 'Sam Trainee', hours: 4, description: 'Yesterday' }, { id: 't3' }),
        makeRecord('time', { date: TODAY, user: 'Lee Counsel', hours: 4, description: 'Somebody else' }, { id: 't4' }),
        makeRecord('time', { date: TODAY, user: 'Sam Trainee', hours: 4, description: 'Voided one', voided: true }, { id: 't5' })
      ]
    })
    render(<GhostPracticeView />)
    await screen.findByRole('button', { name: 'Open file AB-2026-0001' })

    await user.click(screen.getByRole('tab', { name: 'My time today' }))

    expect(screen.getByText('Mine today')).toBeInTheDocument()
    expect(screen.getByText('Mine on file two')).toBeInTheDocument()
    expect(screen.queryByText('Yesterday')).not.toBeInTheDocument()
    expect(screen.queryByText('Somebody else')).not.toBeInTheDocument()
    expect(screen.queryByText('Voided one')).not.toBeInTheDocument()
    expect(screen.getByText('Total today: 2.0 h')).toBeInTheDocument()
  })
})

describe('GhostPracticeView — charges and settlement (CHG, SET)', () => {
  it('records a charge and shows the running totals', async () => {
    const user = userEvent.setup()
    installStore({ matters: [makeMatter()] })
    render(<GhostPracticeView />)
    await openFile(user)
    await openTab(user, 'Charges')

    await user.click(screen.getByRole('button', { name: 'Add charge' }))
    await user.type(screen.getByLabelText('Vendor'), 'Tracument')
    await user.type(screen.getByLabelText('Amount'), '100')
    await user.type(screen.getByLabelText('Tax'), '13')
    await user.selectOptions(screen.getByLabelText('Category'), 'Records')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(window.api.gp.records.create).toHaveBeenCalledWith({
      matterId: 'm1',
      kind: 'charge',
      data: {
        date: TODAY,
        vendor: 'Tracument',
        amount: 100,
        tax: 13,
        description: '',
        category: 'Records',
        receipt: false,
        paid: false,
        recoverable: true,
        documentId: ''
      }
    })
    const totals = await screen.findByLabelText('Charge totals')
    expect(within(totals).getByText('Total charges: $113.00')).toBeInTheDocument()
    expect(within(totals).getByText('Recoverable: $113.00')).toBeInTheDocument()
    expect(within(totals).getByText('Outstanding (unpaid): $113.00')).toBeInTheDocument()
  })

  it('CHG-05: links a charge to a document already on the file', async () => {
    const user = userEvent.setup()
    installStore({
      matters: [makeMatter()],
      documents: [
        { id: 'd1', matterId: 'm1', folderId: null, name: 'Tracument invoice.pdf', content: '', path: '/tmp/i.pdf', uploadedBy: '', createdAt: NOW }
      ]
    })
    render(<GhostPracticeView />)
    await openFile(user)
    await openTab(user, 'Charges')

    await user.click(screen.getByRole('button', { name: 'Add charge' }))
    await user.type(screen.getByLabelText('Vendor'), 'Tracument')
    await user.type(screen.getByLabelText('Amount'), '50')
    await user.selectOptions(await screen.findByLabelText('Invoice / receipt'), 'd1')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(window.api.gp.records.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ documentId: 'd1' }) })
    )
    const row = (await screen.findByRole('button', { name: `Delete ${TODAY}` })).closest('tr') as HTMLElement
    expect(within(row).getByText('Tracument invoice.pdf')).toBeInTheDocument()
  })

  it('SET-01..03, 05: a partial settlement shows the statement and marks the file partially settled', async () => {
    const user = userEvent.setup()
    installStore({
      matters: [makeMatter({ status: 'benefits' })],
      records: [makeRecord('charge', { date: TODAY, vendor: 'LAT', amount: 500, tax: 0, paid: true, recoverable: true })]
    })
    render(<GhostPracticeView />)
    await openFile(user)
    await openTab(user, 'Settlement')

    await user.click(screen.getByRole('button', { name: 'Add settlement' }))
    await user.type(screen.getByLabelText('Amount'), '10000')
    await user.type(screen.getByLabelText('Benefits released'), 'IRB lump sum')
    await user.type(screen.getByLabelText('Fee % or flat $'), '30')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const statement = await screen.findByLabelText('Settlement statement')
    expect(within(statement).getByText('Recovery: $10,000.00')).toBeInTheDocument()
    expect(within(statement).getByText('Less fee: $3,000.00')).toBeInTheDocument()
    expect(within(statement).getByText('Less disbursements: $500.00')).toBeInTheDocument()
    expect(within(statement).getByText('Net to client: $6,500.00')).toBeInTheDocument()
    expect(window.api.gp.matters.update).toHaveBeenCalledWith('m1', { status: 'partiallySettled' })
    await waitFor(() => expect(screen.getByLabelText('Status')).toHaveValue('partiallySettled'))
  })

  it('SET-05: a full and final settlement marks the file settled, but never reopens a closed file', async () => {
    const user = userEvent.setup()
    installStore({
      matters: [makeMatter(), makeMatter({ id: 'm2', matterNumber: 'AB-2026-0002', clientName: 'Doe, John', status: 'closed' })]
    })
    render(<GhostPracticeView />)

    await openFile(user)
    await openTab(user, 'Settlement')
    await user.click(screen.getByRole('button', { name: 'Add settlement' }))
    await user.type(screen.getByLabelText('Amount'), '25000')
    await user.click(screen.getByLabelText('Full and final'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(window.api.gp.matters.update).toHaveBeenCalledWith('m1', { status: 'settled' }))

    await user.click(screen.getByRole('button', { name: '← My files' }))
    await openFile(user, 'AB-2026-0002')
    await openTab(user, 'Settlement')
    await user.click(screen.getByRole('button', { name: 'Add settlement' }))
    await user.type(screen.getByLabelText('Amount'), '1000')
    await user.click(screen.getByLabelText('Full and final'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByLabelText('Settlement statement')

    expect(window.api.gp.matters.update).toHaveBeenCalledTimes(1)
  })
})

describe('GhostPracticeView — AB trackers and diary (WRK)', () => {
  it('WRK-07: a denial\'s limitation date defaults to two years out, tracks the date received, and stays editable', async () => {
    const user = userEvent.setup()
    installStore({ matters: [makeMatter()] })
    render(<GhostPracticeView />)
    await openFile(user)
    await openTab(user, 'Denials')

    await user.click(screen.getByRole('button', { name: 'Add denial' }))
    expect(screen.getByLabelText('Date received')).toHaveValue(TODAY)
    expect(screen.getByLabelText('Limitation date')).toHaveValue('2028-03-04')

    fireEvent.change(screen.getByLabelText('Date received'), { target: { value: '2026-04-12' } })
    expect(screen.getByLabelText('Limitation date')).toHaveValue('2028-04-12')

    // Once typed by hand, a later change to the date received leaves it alone.
    fireEvent.change(screen.getByLabelText('Limitation date'), { target: { value: '2027-12-31' } })
    fireEvent.change(screen.getByLabelText('Date received'), { target: { value: '2026-05-01' } })
    expect(screen.getByLabelText('Limitation date')).toHaveValue('2027-12-31')

    await user.type(screen.getByLabelText('Benefit / plan denied'), 'OCF-18 physio')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(window.api.gp.records.create).toHaveBeenCalledWith({
      matterId: 'm1',
      kind: 'denial',
      data: {
        dateReceived: '2026-05-01',
        denied: 'OCF-18 physio',
        limitationDate: '2027-12-31',
        latFiled: false,
        documentId: ''
      }
    })
  })

  it('edits and deletes a tracker row (treatment plan)', async () => {
    const user = userEvent.setup()
    installStore({
      matters: [makeMatter()],
      records: [makeRecord('plan', { clinic: 'Lakeside Physio', planType: 'OCF-18', amount: 2400, status: 'Pending' })]
    })
    render(<GhostPracticeView />)
    await openFile(user)
    await openTab(user, 'Plans')

    expect(screen.getByText('$2,400.00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit Lakeside Physio' }))
    expect(screen.getByLabelText('Clinic')).toHaveValue('Lakeside Physio')
    await user.selectOptions(within(screen.getByRole('form', { name: 'Edit treatment plan' })).getByLabelText('Status'), 'Denied')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(window.api.gp.records.update).toHaveBeenCalledWith(
      'plan-seed',
      expect.objectContaining({ clinic: 'Lakeside Physio', status: 'Denied', amount: 2400 })
    )
    const row = (await screen.findByRole('button', { name: 'Edit Lakeside Physio' })).closest('tr') as HTMLElement
    expect(within(row).getByText('Denied')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete Lakeside Physio' }))
    expect(window.api.gp.records.delete).toHaveBeenCalledWith('plan-seed')
    expect(await screen.findByText('No treatment plan recorded yet.')).toBeInTheDocument()
  })

  it.each([
    ['People', 'Add contact'],
    ['Benefits', 'Add benefit'],
    ['Forms', 'Add form'],
    ['Plans', 'Add treatment plan'],
    ['Insurer', 'Add insurer event'],
    ['Log', 'Add log entry']
  ])('the %s tab offers "%s"', async (tab, addLabel) => {
    const user = userEvent.setup()
    installStore({ matters: [makeMatter()] })
    render(<GhostPracticeView />)
    await openFile(user)

    await openTab(user, tab)

    expect(screen.getByRole('button', { name: addLabel })).toBeInTheDocument()
  })

  it('WRK-02: ticks a task done straight from the list, which drops it from the file\'s upcoming dates', async () => {
    const user = userEvent.setup()
    installStore({
      matters: [makeMatter()],
      records: [makeRecord('task', { text: 'Serve application', dueDate: '2026-03-10', assignee: 'Sam Trainee', done: false })]
    })
    render(<GhostPracticeView />)
    await openFile(user)
    await openTab(user, 'Diary')

    const upcoming = screen.getByRole('region', { name: 'Upcoming dates on this file' })
    expect(within(upcoming).getByText(/Task: Serve application/)).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Done: Serve application' }))

    expect(window.api.gp.records.update).toHaveBeenCalledWith('task-seed', { done: true })
    expect(await within(upcoming).findByText('Nothing in the diary.')).toBeInTheDocument()
  })

  it('WRK-03: the global diary lists dates across files in order, flags overdue ones, and skips closed files', async () => {
    const user = userEvent.setup()
    installStore({
      matters: [
        makeMatter({ assignedAssistant: 'Sam Trainee' }),
        makeMatter({ id: 'm2', matterNumber: 'AB-2026-0002', clientName: 'Doe, John', assignedAssistant: 'Pat Other' }),
        makeMatter({ id: 'm3', matterNumber: 'AB-2026-0003', clientName: 'Closed, Carl', status: 'closed' })
      ],
      records: [
        makeRecord('denial', { denied: 'IRB', limitationDate: '2028-01-15', latFiled: false }, { id: 'd1' }),
        makeRecord('task', { text: 'Overdue call', dueDate: '2026-03-01', done: false }, { id: 't1', matterId: 'm2' }),
        makeRecord('task', { text: 'On a closed file', dueDate: '2026-03-05', done: false }, { id: 't2', matterId: 'm3' })
      ]
    })
    render(<GhostPracticeView />)
    await screen.findByRole('button', { name: 'Open file AB-2026-0001' })

    await user.click(screen.getByRole('tab', { name: 'Diary' }))

    const rows = screen.getAllByRole('row').slice(1)
    expect(rows.map((row) => (row as HTMLTableRowElement).cells[1].textContent)).toEqual(['Task: Overdue call', 'LAT limitation: IRB'])
    expect(rows[0]).toHaveClass('gp-overdue')
    expect(rows[1]).not.toHaveClass('gp-overdue')
    expect(screen.queryByText('Task: On a closed file')).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('Only files assigned to me'))
    expect(screen.queryByText('Task: Overdue call')).not.toBeInTheDocument()
    expect(screen.getByText('LAT limitation: IRB')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'AB-2026-0001 — Rivera, Ana' }))
    expect(await screen.findByRole('tablist', { name: 'File sections' })).toBeInTheDocument()
  })

  it('WRK-08: the LAT tab is empty until a proceeding is opened, which also moves the file to LAT status', async () => {
    const user = userEvent.setup()
    installStore({ matters: [makeMatter({ status: 'benefits' })] })
    render(<GhostPracticeView />)
    await openFile(user)
    await openTab(user, 'LAT')

    expect(screen.getByText('No LAT proceeding on this file.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open LAT proceeding' }))
    expect(window.api.gp.matters.update).toHaveBeenCalledWith('m1', { latOpen: true, status: 'lat' })

    await user.type(await screen.findByLabelText('Tribunal file #'), '26-001234/AABS')
    await user.click(screen.getByLabelText('Filing fee paid'))
    await user.click(screen.getByRole('button', { name: 'Save LAT details' }))

    expect(window.api.gp.matters.update).toHaveBeenLastCalledWith('m1', {
      latFileNumber: '26-001234/AABS',
      latDateFiled: '',
      latFeePaid: true,
      latNextStep: ''
    })
    expect(screen.getByRole('button', { name: 'Add LAT step' })).toBeInTheDocument()
  })
})

describe('GhostPracticeView — documents (DOC-01..07)', () => {
  const FOLDERS: GpFolder[] = [
    { id: 'f1', matterId: 'm1', name: '02 Correspondence', parentId: null },
    { id: 'f2', matterId: 'm1', name: '02.01 Client', parentId: 'f1' },
    { id: 'f3', matterId: 'm1', name: '03 OCF forms and insurer EOBs', parentId: null }
  ]

  function makeDocument(overrides: Partial<GpDocument> = {}): GpDocument {
    return {
      id: 'd1',
      matterId: 'm1',
      folderId: 'f3',
      name: 'April EOB.pdf',
      content: 'Explanation of benefits: denied.',
      path: '/tmp/eob.pdf',
      uploadedBy: 'Sam Trainee',
      createdAt: NOW,
      ...overrides
    }
  }

  async function openDocuments(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    render(<GhostPracticeView />)
    await openFile(user)
    await openTab(user, 'Documents')
  }

  it('shows the folder tree nested, and the documents of the selected folder with date and uploader', async () => {
    const user = userEvent.setup()
    installStore({ matters: [makeMatter()], folders: FOLDERS, documents: [makeDocument()] })
    await openDocuments(user)

    const parent = (await screen.findByRole('button', { name: '02 Correspondence' })).closest('li') as HTMLElement
    expect(within(parent).getByRole('button', { name: '02.01 Client' })).toBeInTheDocument()
    expect(screen.getByText('No documents in this folder yet.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '03 OCF forms and insurer EOBs' }))

    const row = screen.getByRole('button', { name: 'April EOB.pdf' }).closest('tr') as HTMLElement
    expect(within(row).getByText(TODAY)).toBeInTheDocument()
    expect(within(row).getByText('Sam Trainee')).toBeInTheDocument()
  })

  it('DOC-07: uploads a picked file straight into the selected folder, with its extracted text', async () => {
    const user = userEvent.setup()
    installStore({ matters: [makeMatter()], folders: FOLDERS })
    vi.mocked(window.api.attachments.pick).mockResolvedValue({ ok: true, filename: 'ocf3.pdf', path: '/docs/ocf3.pdf' })
    vi.mocked(window.api.attachments.extractText).mockResolvedValue('Disability certificate')
    await openDocuments(user)

    await user.click(await screen.findByRole('button', { name: '03 OCF forms and insurer EOBs' }))
    await user.click(screen.getByRole('button', { name: 'Upload file' }))

    await waitFor(() =>
      expect(window.api.gp.documents.create).toHaveBeenCalledWith({
        matterId: 'm1',
        folderId: 'f3',
        name: 'ocf3.pdf',
        content: 'Disability certificate',
        path: '/docs/ocf3.pdf',
        uploadedBy: 'Sam Trainee'
      })
    )
    expect(await screen.findByRole('button', { name: 'ocf3.pdf' })).toBeInTheDocument()
  })

  it('does nothing when the file picker is cancelled', async () => {
    const user = userEvent.setup()
    installStore({ matters: [makeMatter()], folders: FOLDERS })
    await openDocuments(user)

    await user.click(await screen.findByRole('button', { name: 'Upload file' }))

    expect(window.api.gp.documents.create).not.toHaveBeenCalled()
  })

  it('DOC-01: uploads files dropped onto the document list, including one with no extractable text', async () => {
    const user = userEvent.setup()
    installStore({ matters: [makeMatter()], folders: FOLDERS })
    vi.mocked(window.api.attachments.pathForFile).mockImplementation((file) => `/dropped/${file.name}`)
    vi.mocked(window.api.attachments.extractText).mockResolvedValue(undefined)
    await openDocuments(user)
    await screen.findByRole('button', { name: '02 Correspondence' })

    const dropZone = document.querySelector('.gp-documents-main') as HTMLElement
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [new File(['x'], 'photo.jpg'), new File(['y'], 'letter.msg')] }
    })

    await waitFor(() => expect(window.api.gp.documents.create).toHaveBeenCalledTimes(2))
    expect(window.api.gp.documents.create).toHaveBeenCalledWith({
      matterId: 'm1',
      folderId: null,
      name: 'photo.jpg',
      content: '',
      path: '/dropped/photo.jpg',
      uploadedBy: 'Sam Trainee'
    })
    expect(await screen.findByRole('button', { name: 'letter.msg' })).toBeInTheDocument()
  })

  it('DOC-04: previews an uploaded file\'s text in place, with a way to open the original', async () => {
    const user = userEvent.setup()
    installStore({ matters: [makeMatter()], folders: FOLDERS, documents: [makeDocument()] })
    await openDocuments(user)
    await user.click(await screen.findByRole('button', { name: '03 OCF forms and insurer EOBs' }))

    await user.click(screen.getByRole('button', { name: 'April EOB.pdf' }))

    const preview = screen.getByRole('region', { name: 'Preview of April EOB.pdf' })
    expect(within(preview).getByText('Explanation of benefits: denied.')).toBeInTheDocument()
    await user.click(within(preview).getByRole('button', { name: 'Open with your default application' }))
    expect(window.api.attachments.open).toHaveBeenCalledWith('/tmp/eob.pdf')
  })

  it('says so when an uploaded file has no previewable text', async () => {
    const user = userEvent.setup()
    installStore({
      matters: [makeMatter()],
      folders: FOLDERS,
      documents: [makeDocument({ name: 'photo.jpg', content: '', folderId: null })]
    })
    await openDocuments(user)

    await user.click(await screen.findByRole('button', { name: 'photo.jpg' }))

    expect(screen.getByText('No preview is available for this file.')).toBeInTheDocument()
  })

  it('writes a Markdown note onto the file and renders it formatted, not as raw source', async () => {
    const user = userEvent.setup()
    installStore({ matters: [makeMatter()], folders: FOLDERS })
    await openDocuments(user)

    await user.click(await screen.findByRole('button', { name: 'New note' }))
    await user.type(screen.getByLabelText('Document name'), 'Call notes')
    await user.type(screen.getByLabelText('Note content (Markdown)'), '# Heading')
    await user.click(screen.getByRole('button', { name: 'Save document' }))

    expect(window.api.gp.documents.create).toHaveBeenCalledWith({
      matterId: 'm1',
      folderId: null,
      name: 'Call notes',
      content: '# Heading',
      uploadedBy: 'Sam Trainee'
    })
    await user.click(await screen.findByRole('button', { name: 'Call notes' }))
    const preview = screen.getByRole('region', { name: 'Preview of Call notes' })
    expect(within(preview).getByRole('heading', { name: 'Heading' })).toBeInTheDocument()
    expect(within(preview).queryByRole('button', { name: 'Open with your default application' })).not.toBeInTheDocument()
  })

  it('DOC-03: renames a document and moves it to another folder', async () => {
    const user = userEvent.setup()
    installStore({ matters: [makeMatter()], folders: FOLDERS, documents: [makeDocument()] })
    await openDocuments(user)
    await user.click(await screen.findByRole('button', { name: '03 OCF forms and insurer EOBs' }))

    await user.click(screen.getByRole('button', { name: 'Rename or move April EOB.pdf' }))
    // An uploaded file's content isn't editable here — only a note's is.
    expect(screen.queryByLabelText('Note content (Markdown)')).not.toBeInTheDocument()
    await user.clear(screen.getByLabelText('Document name'))
    await user.type(screen.getByLabelText('Document name'), 'EOB 2026-04.pdf')
    await user.selectOptions(screen.getByLabelText('Folder'), 'f2')
    await user.click(screen.getByRole('button', { name: 'Save document' }))

    expect(window.api.gp.documents.update).toHaveBeenCalledWith('d1', { name: 'EOB 2026-04.pdf', folderId: 'f2' })
    expect(await screen.findByText('No documents in this folder yet.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '02.01 Client' }))
    expect(screen.getByRole('button', { name: 'EOB 2026-04.pdf' })).toBeInTheDocument()
  })

  it('DOC-06: searches file names across the whole matter, showing where each match lives', async () => {
    const user = userEvent.setup()
    installStore({
      matters: [makeMatter()],
      folders: FOLDERS,
      documents: [
        makeDocument(),
        makeDocument({ id: 'd2', name: 'Client letter.docx', folderId: 'f2' }),
        makeDocument({ id: 'd3', name: 'March EOB.pdf', folderId: null })
      ]
    })
    await openDocuments(user)
    await screen.findByRole('button', { name: 'March EOB.pdf' })

    await user.type(screen.getByRole('searchbox', { name: 'Search documents' }), 'eob')

    expect(screen.getByRole('button', { name: 'April EOB.pdf' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'March EOB.pdf' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Client letter.docx' })).not.toBeInTheDocument()
    const row = screen.getByRole('button', { name: 'April EOB.pdf' }).closest('tr') as HTMLElement
    expect(within(row).getByText('03 OCF forms and insurer EOBs')).toBeInTheDocument()

    await user.clear(screen.getByRole('searchbox', { name: 'Search documents' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search documents' }), 'zzz')
    expect(screen.getByText('No documents match.')).toBeInTheDocument()
  })

  it('deletes a document, closing its preview', async () => {
    const user = userEvent.setup()
    installStore({ matters: [makeMatter()], folders: FOLDERS, documents: [makeDocument({ folderId: null })] })
    await openDocuments(user)
    await user.click(await screen.findByRole('button', { name: 'April EOB.pdf' }))

    await user.click(screen.getByRole('button', { name: 'Delete April EOB.pdf' }))

    expect(window.api.gp.documents.delete).toHaveBeenCalledWith('d1')
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Preview of April EOB.pdf' })).not.toBeInTheDocument())
    expect(screen.getByText('No documents in this folder yet.')).toBeInTheDocument()
  })

  it('DOC-03: creates a subfolder, renames and moves a folder without offering its own subtree, and deletes one', async () => {
    const user = userEvent.setup()
    installStore({ matters: [makeMatter()], folders: FOLDERS })
    await openDocuments(user)

    await user.click(await screen.findByRole('button', { name: 'New subfolder under 03 OCF forms and insurer EOBs' }))
    await user.type(screen.getByLabelText('Folder name'), 'EOBs 2026')
    await user.click(screen.getByRole('button', { name: 'Save folder' }))
    expect(window.api.gp.folders.create).toHaveBeenCalledWith({ matterId: 'm1', name: 'EOBs 2026', parentId: 'f3' })
    expect(await screen.findByRole('button', { name: 'EOBs 2026' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Rename or move 02 Correspondence' }))
    const parentSelect = screen.getByLabelText('Inside')
    expect(within(parentSelect).queryByRole('option', { name: '02 Correspondence' })).not.toBeInTheDocument()
    expect(within(parentSelect).queryByRole('option', { name: '02 Correspondence / 02.01 Client' })).not.toBeInTheDocument()
    await user.clear(screen.getByLabelText('Folder name'))
    await user.type(screen.getByLabelText('Folder name'), 'Letters')
    await user.selectOptions(parentSelect, 'f3')
    await user.click(screen.getByRole('button', { name: 'Save folder' }))
    expect(window.api.gp.folders.update).toHaveBeenCalledWith('f1', { name: 'Letters', parentId: 'f3' })

    await user.click(await screen.findByRole('button', { name: 'Delete folder Letters' }))
    expect(window.api.gp.folders.delete).toHaveBeenCalledWith('f1')
  })

  it('does not create a folder with a blank name', async () => {
    const user = userEvent.setup()
    installStore({ matters: [makeMatter()], folders: FOLDERS })
    await openDocuments(user)

    await user.click(await screen.findByRole('button', { name: '+ New folder' }))
    await user.click(screen.getByRole('button', { name: 'Save folder' }))

    expect(window.api.gp.folders.create).not.toHaveBeenCalled()
  })
})

describe('GhostPracticeView — admin (ADM-02..04)', () => {
  it('saves firm details, users with a default rate, and the pick-lists', async () => {
    const user = userEvent.setup()
    installStore()
    render(<GhostPracticeView />)
    await screen.findByText('No files yet. Create one with New file.')
    await user.click(screen.getByRole('tab', { name: 'Admin' }))

    await user.type(await screen.findByLabelText('Firm name'), 'Example LLP')
    await user.click(screen.getByRole('button', { name: '+ Add user' }))
    await user.type(screen.getByLabelText('User 1 name'), 'Sam Trainee')
    await user.selectOptions(screen.getByLabelText('User 1 role'), 'Paralegal')
    await user.type(screen.getByLabelText('User 1 default rate'), '120')
    await user.type(screen.getByLabelText('Charge categories (one per line)'), '\nCourier')
    await user.click(screen.getByRole('button', { name: 'Save admin settings' }))

    expect(window.api.gp.admin.set).toHaveBeenCalledWith({
      firmName: 'Example LLP',
      letterhead: '',
      users: [{ name: 'Sam Trainee', role: 'Paralegal', defaultRate: 120 }],
      activityTypes: DEFAULT_GP_ADMIN.activityTypes,
      chargeCategories: [...DEFAULT_GP_ADMIN.chargeCategories, 'Courier']
    })
    expect(await screen.findByText('Saved.')).toBeInTheDocument()
  })

  it('an edited pick-list is what the charge form then offers', async () => {
    const user = userEvent.setup()
    installStore({
      matters: [makeMatter()],
      admin: { ...DEFAULT_GP_ADMIN, chargeCategories: ['Courier', 'Process server'] }
    })
    render(<GhostPracticeView />)
    await openFile(user)
    await openTab(user, 'Charges')
    await user.click(screen.getByRole('button', { name: 'Add charge' }))

    const category = screen.getByLabelText('Category')
    expect(within(category).getByRole('option', { name: 'Process server' })).toBeInTheDocument()
    expect(within(category).queryByRole('option', { name: 'Records' })).not.toBeInTheDocument()
  })
})
