import { useEffect, useState, type FormEvent, type ReactElement } from 'react'
import type { Persona } from '../../../shared/data-types'
import {
  DEFAULT_GP_ADMIN,
  GP_STATUS_LABELS,
  GP_USER_ROLES,
  gpNumber,
  matterDeadlines,
  matterMatchesSearch,
  nextDeadline,
  toDateString,
  type GpAdmin,
  type GpMatter,
  type GpRecord
} from '../../../shared/ghostPractice'
import type { GpContext } from './ghostPractice/fields'
import MatterView from './ghostPractice/MatterView'

type Page = 'files' | 'diary' | 'time' | 'admin'

const PAGES: { id: Page; label: string }[] = [
  { id: 'files', label: 'My files' },
  { id: 'diary', label: 'Diary' },
  { id: 'time', label: 'My time today' },
  { id: 'admin', label: 'Admin' }
]

const BLANK_NEW_FILE = { clientName: '', clientPersonaId: '', dateOfLoss: '', insurerCompany: '', claimNumber: '' }

// Ghost Practice — a matter-centric workspace for Ontario accident-benefits
// files (features/ghost-practice/SPEC.md). Replaces the FileVine tab: the
// same ribbon-tab overlay on the Mail module, now holding AB files with
// time, charges, settlements, documents and the AB trackers.
function GhostPracticeView(): ReactElement {
  const [matters, setMatters] = useState<GpMatter[]>([])
  const [records, setRecords] = useState<GpRecord[]>([])
  const [admin, setAdmin] = useState<GpAdmin>(DEFAULT_GP_ADMIN)
  const [version, setVersion] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [personas, setPersonas] = useState<Persona[]>([])
  const [currentUser, setCurrentUser] = useState('')
  const [today, setToday] = useState('')

  const [page, setPage] = useState<Page>('files')
  const [openMatterId, setOpenMatterId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [creating, setCreating] = useState(false)
  const [newFile, setNewFile] = useState(BLANK_NEW_FILE)
  const [onlyMine, setOnlyMine] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([window.api.gp.matters.list(), window.api.gp.records.list(), window.api.gp.admin.get()]).then(
      ([matterList, recordList, adminValue]) => {
        if (cancelled) return
        setMatters(matterList)
        setRecords(recordList)
        setAdmin(adminValue)
        setLoaded(true)
      }
    )
    return () => {
      cancelled = true
    }
  }, [version])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      window.api.data.personas.get(),
      window.api.data.identity.get(),
      window.api.data.clock.now()
    ]).then(([personaList, identity, now]) => {
      if (cancelled) return
      setPersonas(personaList)
      setCurrentUser(identity.displayName)
      setToday(toDateString(now))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const reload = (): void => setVersion((current) => current + 1)
  const ctx: GpContext = { admin, today, currentUser, personas }

  async function handleCreateFile(event: FormEvent): Promise<void> {
    event.preventDefault()
    const clientName = newFile.clientName.trim()
    if (!clientName) return
    const created = await window.api.gp.matters.create({
      clientName,
      clientPersonaId: newFile.clientPersonaId || null,
      dateOfLoss: newFile.dateOfLoss,
      insurerCompany: newFile.insurerCompany.trim(),
      claimNumber: newFile.claimNumber.trim(),
      assignedAssistant: currentUser
    })
    setCreating(false)
    setNewFile(BLANK_NEW_FILE)
    setOpenMatterId(created.id)
    reload()
  }

  // Picking a client persona fills in the client's name when it's still
  // blank — the persona is who the file is about.
  function handlePersonaPicked(personaId: string): void {
    const persona = personas.find((candidate) => candidate.id === personaId)
    setNewFile((current) => ({
      ...current,
      clientPersonaId: personaId,
      clientName: current.clientName || persona?.displayName || ''
    }))
  }

  const openMatter = matters.find((matter) => matter.id === openMatterId) ?? null
  const recordsFor = (matterId: string): GpRecord[] => records.filter((record) => record.matterId === matterId)
  const matterById = new Map(matters.map((matter) => [matter.id, matter]))

  if (openMatter) {
    return (
      <div className="gp-view">
        <MatterView
          key={openMatter.id}
          matter={openMatter}
          records={recordsFor(openMatter.id)}
          ctx={ctx}
          onChanged={reload}
          onBack={() => setOpenMatterId(null)}
          onDeleted={() => {
            setOpenMatterId(null)
            reload()
          }}
        />
      </div>
    )
  }

  function renderFiles(): ReactElement {
    const assignees = [...new Set(matters.map((matter) => matter.assignedAssistant).filter(Boolean))].sort()
    const visible = matters.filter(
      (matter) =>
        matterMatchesSearch(matter, search) &&
        (!statusFilter || matter.status === statusFilter) &&
        (!assigneeFilter || matter.assignedAssistant === assigneeFilter)
    )
    return (
      <>
        <div className="gp-toolbar">
          <input
            type="search"
            aria-label="Search files"
            placeholder="Search client, matter #, claim #, date of loss"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(GP_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by assignee"
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
          >
            <option value="">All assignees</option>
            {assignees.map((assignee) => (
              <option key={assignee} value={assignee}>
                {assignee}
              </option>
            ))}
          </select>
          {!creating && (
            <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
              New file
            </button>
          )}
        </div>

        {creating && (
          <form className="gp-form" onSubmit={handleCreateFile} aria-label="New file">
            <div className="gp-form-grid">
              <div className="gp-field">
                <label htmlFor="gp-new-client">Client name</label>
                <input
                  id="gp-new-client"
                  autoFocus
                  value={newFile.clientName}
                  onChange={(event) => setNewFile({ ...newFile, clientName: event.target.value })}
                />
              </div>
              <div className="gp-field">
                <label htmlFor="gp-new-persona">Linked client persona</label>
                <select
                  id="gp-new-persona"
                  value={newFile.clientPersonaId}
                  onChange={(event) => handlePersonaPicked(event.target.value)}
                >
                  <option value="">No persona</option>
                  {personas
                    .filter((persona) => persona.isClient)
                    .map((persona) => (
                      <option key={persona.id} value={persona.id}>
                        {persona.displayName}
                      </option>
                    ))}
                </select>
              </div>
              <div className="gp-field">
                <label htmlFor="gp-new-dol">Date of loss</label>
                <input
                  id="gp-new-dol"
                  type="date"
                  value={newFile.dateOfLoss}
                  onChange={(event) => setNewFile({ ...newFile, dateOfLoss: event.target.value })}
                />
              </div>
              <div className="gp-field">
                <label htmlFor="gp-new-insurer">Insurer</label>
                <input
                  id="gp-new-insurer"
                  value={newFile.insurerCompany}
                  onChange={(event) => setNewFile({ ...newFile, insurerCompany: event.target.value })}
                />
              </div>
              <div className="gp-field">
                <label htmlFor="gp-new-claim">Claim #</label>
                <input
                  id="gp-new-claim"
                  value={newFile.claimNumber}
                  onChange={(event) => setNewFile({ ...newFile, claimNumber: event.target.value })}
                />
              </div>
            </div>
            <div className="gp-form-actions">
              <button type="submit" className="btn-primary">
                Create file
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false)
                  setNewFile(BLANK_NEW_FILE)
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {matters.length === 0 ? (
          <div className="gp-empty">No files yet. Create one with New file.</div>
        ) : visible.length === 0 ? (
          <div className="gp-empty">No files match.</div>
        ) : (
          <table className="gp-table">
            <thead>
              <tr>
                <th>Matter #</th>
                <th>Client</th>
                <th>Date of loss</th>
                <th>Insurer</th>
                <th>Status</th>
                <th>Assigned</th>
                <th>Next deadline</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((matter) => {
                const next = nextDeadline(recordsFor(matter.id), today)
                return (
                  <tr key={matter.id}>
                    <td>
                      <button
                        type="button"
                        className="gp-link"
                        aria-label={`Open file ${matter.matterNumber}`}
                        onClick={() => setOpenMatterId(matter.id)}
                      >
                        {matter.matterNumber}
                      </button>
                    </td>
                    <td>{matter.clientName}</td>
                    <td>{matter.dateOfLoss}</td>
                    <td>{matter.insurerCompany}</td>
                    <td>{GP_STATUS_LABELS[matter.status] ?? matter.status}</td>
                    <td>{matter.assignedAssistant}</td>
                    <td className={next && next.date < today ? 'gp-overdue' : undefined}>
                      {next ? `${next.date} — ${next.label}` : ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </>
    )
  }

  // WRK-03: one list of upcoming dates across files, instead of a paper
  // diary nobody else can see. Closed files drop out.
  function renderDiary(): ReactElement {
    const deadlines = matterDeadlines(
      records.filter((record) => {
        const matter = matterById.get(record.matterId)
        return matter && matter.status !== 'closed' && (!onlyMine || matter.assignedAssistant === currentUser)
      })
    )
    return (
      <>
        <div className="gp-toolbar">
          <label className="gp-field-checkbox" htmlFor="gp-diary-mine">
            <input
              id="gp-diary-mine"
              type="checkbox"
              checked={onlyMine}
              onChange={(event) => setOnlyMine(event.target.checked)}
            />
            Only files assigned to me
          </label>
        </div>
        {deadlines.length === 0 ? (
          <div className="gp-empty">Nothing in the diary.</div>
        ) : (
          <table className="gp-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>What</th>
                <th>File</th>
              </tr>
            </thead>
            <tbody>
              {deadlines.map((deadline) => {
                const matter = matterById.get(deadline.matterId)
                return (
                  <tr key={deadline.recordId} className={deadline.date < today ? 'gp-overdue' : undefined}>
                    <td>{deadline.date}</td>
                    <td>{deadline.label}</td>
                    <td>
                      <button type="button" className="gp-link" onClick={() => setOpenMatterId(deadline.matterId)}>
                        {matter?.matterNumber} — {matter?.clientName}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </>
    )
  }

  // TIME-06: did I docket the day? Entries dated today (simulated clock)
  // by the trainee, across every file.
  function renderTimeToday(): ReactElement {
    const entries = records.filter(
      (record) =>
        record.kind === 'time' &&
        !record.data.voided &&
        record.data.date === today &&
        (!currentUser || record.data.user === currentUser)
    )
    const hours = entries.reduce((sum, record) => sum + gpNumber(record.data.hours), 0)
    return entries.length === 0 ? (
      <div className="gp-empty">No time docketed for {today || 'today'} yet.</div>
    ) : (
      <>
        <table className="gp-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Hours</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((record) => {
              const matter = matterById.get(record.matterId)
              return (
                <tr key={record.id}>
                  <td>
                    <button type="button" className="gp-link" onClick={() => setOpenMatterId(record.matterId)}>
                      {matter?.matterNumber} — {matter?.clientName}
                    </button>
                  </td>
                  <td>{String(record.data.hours)}</td>
                  <td>{String(record.data.description)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="gp-totals">Total today: {hours.toFixed(1)} h</div>
      </>
    )
  }

  return (
    <div className="gp-view">
      <div className="gp-view-header">
        <h2 className="gp-view-title">Ghost Practice</h2>
        <div className="gp-tabs" role="tablist" aria-label="Ghost Practice pages">
          {PAGES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={entry.id === page}
              className={`gp-tab${entry.id === page ? ' active' : ''}`}
              onClick={() => setPage(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>
      <div className="gp-tab-body">
        {page === 'files' && renderFiles()}
        {page === 'diary' && renderDiary()}
        {page === 'time' && renderTimeToday()}
        {page === 'admin' && loaded && <AdminPage admin={admin} onSaved={reload} />}
      </div>
    </div>
  )
}

interface AdminPageProps {
  admin: GpAdmin
  onSaved: () => void
}

const toLines = (values: string[]): string => values.join('\n')
const fromLines = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

// Minimal firm admin (spec §6.7): firm details, users with a role label and
// default rate, and the two pick-lists. No sign-in — there are no accounts
// in this single-user sandbox.
function AdminPage({ admin, onSaved }: AdminPageProps): ReactElement {
  const [firmName, setFirmName] = useState(admin.firmName)
  const [letterhead, setLetterhead] = useState(admin.letterhead)
  const [users, setUsers] = useState(admin.users.map((user) => ({ ...user, defaultRate: String(user.defaultRate) })))
  const [activityTypes, setActivityTypes] = useState(toLines(admin.activityTypes))
  const [chargeCategories, setChargeCategories] = useState(toLines(admin.chargeCategories))
  const [saved, setSaved] = useState(false)

  function updateUser(index: number, patch: Partial<(typeof users)[number]>): void {
    setUsers((current) => current.map((user, position) => (position === index ? { ...user, ...patch } : user)))
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault()
    await window.api.gp.admin.set({
      firmName: firmName.trim(),
      letterhead,
      users: users
        .filter((user) => user.name.trim())
        .map((user) => ({ name: user.name.trim(), role: user.role, defaultRate: gpNumber(user.defaultRate) })),
      activityTypes: fromLines(activityTypes),
      chargeCategories: fromLines(chargeCategories)
    })
    setSaved(true)
    onSaved()
  }

  return (
    <form className="gp-form" onSubmit={handleSubmit} aria-label="Firm admin">
      <div className="gp-form-grid">
        <div className="gp-field">
          <label htmlFor="gp-admin-firm">Firm name</label>
          <input id="gp-admin-firm" value={firmName} onChange={(event) => setFirmName(event.target.value)} />
        </div>
        <div className="gp-field gp-field-wide">
          <label htmlFor="gp-admin-letterhead">Letterhead (address, phone, email)</label>
          <textarea id="gp-admin-letterhead" value={letterhead} onChange={(event) => setLetterhead(event.target.value)} />
        </div>
      </div>

      <fieldset className="gp-fieldset">
        <legend>Users</legend>
        {users.map((user, index) => (
          <div key={index} className="gp-toolbar">
            <input
              aria-label={`User ${index + 1} name`}
              placeholder="Name"
              value={user.name}
              onChange={(event) => updateUser(index, { name: event.target.value })}
            />
            <select
              aria-label={`User ${index + 1} role`}
              value={user.role}
              onChange={(event) => updateUser(index, { role: event.target.value })}
            >
              {GP_USER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <input
              aria-label={`User ${index + 1} default rate`}
              type="number"
              min={0}
              step="any"
              placeholder="Default rate"
              value={user.defaultRate}
              onChange={(event) => updateUser(index, { defaultRate: event.target.value })}
            />
            <button
              type="button"
              aria-label={`Remove user ${index + 1}`}
              onClick={() => setUsers((current) => current.filter((_, position) => position !== index))}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="gp-dashed-btn"
          onClick={() => setUsers((current) => [...current, { name: '', role: GP_USER_ROLES[0], defaultRate: '' }])}
        >
          + Add user
        </button>
      </fieldset>

      <div className="gp-form-grid">
        <div className="gp-field">
          <label htmlFor="gp-admin-activity">Activity types (one per line)</label>
          <textarea
            id="gp-admin-activity"
            className="gp-note-textarea"
            value={activityTypes}
            onChange={(event) => setActivityTypes(event.target.value)}
          />
        </div>
        <div className="gp-field">
          <label htmlFor="gp-admin-categories">Charge categories (one per line)</label>
          <textarea
            id="gp-admin-categories"
            className="gp-note-textarea"
            value={chargeCategories}
            onChange={(event) => setChargeCategories(event.target.value)}
          />
        </div>
      </div>
      <div className="gp-form-actions">
        <button type="submit" className="btn-primary">
          Save admin settings
        </button>
        {saved && <span className="gp-muted">Saved.</span>}
      </div>
    </form>
  )
}

export default GhostPracticeView
