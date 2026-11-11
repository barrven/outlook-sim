import { useEffect, useState, type FormEvent, type ReactElement } from 'react'
import {
  formatMoney,
  GP_MATTER_FIELD_GROUPS,
  GP_STATUS_LABELS,
  gpNumber,
  matterDeadlines,
  matterTotals,
  nextDeadline,
  settlementFee,
  type GpDocument,
  type GpMatter,
  type GpMatterPatch,
  type GpMatterStatus,
  type GpRecord,
  type GpRecordData,
  type GpRecordKind
} from '../../../../shared/ghostPractice'
import DocumentsTab from './DocumentsTab'
import { GpFieldInput, type GpContext, type GpDraft } from './fields'
import RecordSection from './RecordSection'

const TABS = [
  'Home',
  'People',
  'Benefits',
  'Forms',
  'Plans',
  'Denials',
  'Insurer',
  'LAT',
  'Diary',
  'Time',
  'Charges',
  'Settlement',
  'Documents',
  'Log'
] as const

type TabId = (typeof TABS)[number]

interface MatterViewProps {
  matter: GpMatter
  // This matter's records only.
  records: GpRecord[]
  ctx: GpContext
  onChanged: () => void
  onBack: () => void
  onDeleted: () => void
}

const MATTER_FIELDS = GP_MATTER_FIELD_GROUPS.flatMap((group) => group.fields)

function matterToDraft(matter: GpMatter): GpDraft {
  const draft: GpDraft = {}
  const values = matter as unknown as Record<string, string | boolean>
  for (const field of MATTER_FIELDS) draft[field.key] = values[field.key] ?? ''
  return draft
}

function MatterView({ matter, records, ctx, onChanged, onBack, onDeleted }: MatterViewProps): ReactElement {
  const [tab, setTab] = useState<TabId>('Home')
  const [documents, setDocuments] = useState<GpDocument[]>([])
  const [documentsVersion, setDocumentsVersion] = useState(0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<GpDraft>({})
  const [personaDraft, setPersonaDraft] = useState('')
  const [editError, setEditError] = useState('')
  const [timeFrom, setTimeFrom] = useState('')
  const [timeTo, setTimeTo] = useState('')

  useEffect(() => {
    let cancelled = false
    window.api.gp.documents.list(matter.id).then((list) => {
      if (!cancelled) setDocuments(list)
    })
    return () => {
      cancelled = true
    }
  }, [matter.id, documentsVersion])

  const reloadDocuments = (): void => setDocumentsVersion((version) => version + 1)

  async function updateMatter(patch: GpMatterPatch): Promise<void> {
    await window.api.gp.matters.update(matter.id, patch)
    onChanged()
  }

  function startEdit(): void {
    setDraft(matterToDraft(matter))
    setPersonaDraft(matter.clientPersonaId ?? '')
    setEditError('')
    setEditing(true)
  }

  async function submitEdit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (String(draft.clientName ?? '').trim() === '') {
      setEditError('Client name is required.')
      return
    }
    const patch: Record<string, string | boolean | null> = { clientPersonaId: personaDraft || null }
    for (const field of MATTER_FIELDS) {
      patch[field.key] = field.type === 'checkbox' ? Boolean(draft[field.key]) : String(draft[field.key]).trim()
    }
    setEditing(false)
    await updateMatter(patch as GpMatterPatch)
  }

  async function handleDeleteMatter(): Promise<void> {
    if (!window.confirm(`Delete file ${matter.matterNumber} and everything on it? This cannot be undone.`)) return
    await window.api.gp.matters.delete(matter.id)
    onDeleted()
  }

  // SET-05: recording a settlement moves the file along — full and final
  // settles it, anything less is a partial settlement. A closed file stays
  // closed.
  async function handleSettlementSaved(data: GpRecordData): Promise<void> {
    if (matter.status === 'closed') return
    const status: GpMatterStatus = data.fullAndFinal ? 'settled' : 'partiallySettled'
    if (matter.status !== status && matter.status !== 'settled') {
      await window.api.gp.matters.update(matter.id, { status })
    }
  }

  const ofKind = (kind: GpRecordKind): GpRecord[] => records.filter((record) => record.kind === kind)
  const totals = matterTotals(records)
  const next = nextDeadline(records, ctx.today)
  const deadlines = matterDeadlines(records)
  const linkedPersona = ctx.personas.find((persona) => persona.id === matter.clientPersonaId)
  // Only clients are linkable; a link to a persona no longer marked as a
  // client stays selectable rather than silently dropping.
  const personaOptions = ctx.personas.filter((persona) => persona.isClient || persona.id === matter.clientPersonaId)
  const coverage = [
    matter.coverageIrb && 'IRB',
    matter.coverageNeb && 'NEB',
    matter.coverageCaregiver && 'Caregiver',
    matter.coverageHousekeeping && 'Housekeeping',
    matter.coverageIncreasedLimits && 'Increased limits'
  ].filter(Boolean)

  const timeRecords = ofKind('time').filter(
    (record) =>
      (!timeFrom || String(record.data.date) >= timeFrom) && (!timeTo || String(record.data.date) <= timeTo)
  )
  const timeTotals = matterTotals(timeRecords)
  const hoursByUser = new Map<string, { hours: number; value: number }>()
  for (const record of timeRecords) {
    if (record.data.voided) continue
    const user = String(record.data.user || '(no user)')
    const entry = hoursByUser.get(user) ?? { hours: 0, value: 0 }
    entry.hours += gpNumber(record.data.hours)
    if (record.data.billable) entry.value += gpNumber(record.data.hours) * gpNumber(record.data.rate)
    hoursByUser.set(user, entry)
  }

  const sectionProps = { matterId: matter.id, documents, ctx, onChanged }

  function renderTab(): ReactElement {
    switch (tab) {
      case 'Home':
        return editing ? (
          <form className="gp-form" onSubmit={submitEdit} aria-label="Edit file details">
            {GP_MATTER_FIELD_GROUPS.map((group) => (
              <fieldset key={group.title} className="gp-fieldset">
                <legend>{group.title}</legend>
                <div className="gp-form-grid">
                  {group.fields.map((field) => (
                    <GpFieldInput
                      key={field.key}
                      field={field}
                      value={draft[field.key] ?? ''}
                      idPrefix="gp-matter"
                      ctx={ctx}
                      onChange={(value) => setDraft((current) => ({ ...current, [field.key]: value }))}
                    />
                  ))}
                  {group.title === 'Client' && (
                    <div className="gp-field">
                      <label htmlFor="gp-matter-persona">Linked client persona</label>
                      <select
                        id="gp-matter-persona"
                        value={personaDraft}
                        onChange={(event) => setPersonaDraft(event.target.value)}
                      >
                        <option value="">No persona</option>
                        {personaOptions.map((persona) => (
                          <option key={persona.id} value={persona.id}>
                            {persona.displayName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </fieldset>
            ))}
            {editError && (
              <div className="gp-form-error" role="alert">
                {editError}
              </div>
            )}
            <div className="gp-form-actions">
              <button type="submit" className="btn-primary">
                Save file details
              </button>
              <button type="button" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="gp-home">
            <div className="gp-section-header">
              <h3>File summary</h3>
              <span className="gp-form-actions">
                <button type="button" className="btn-primary" onClick={startEdit}>
                  Edit file details
                </button>
                <button type="button" onClick={handleDeleteMatter}>
                  Delete file
                </button>
              </span>
            </div>
            <dl className="gp-summary">
              <dt>Client</dt>
              <dd>
                {[matter.clientName, matter.clientPhone, matter.clientEmail].filter(Boolean).join(' · ')}
                {linkedPersona && <span className="gp-muted"> (persona: {linkedPersona.displayName})</span>}
              </dd>
              <dt>Accident</dt>
              <dd>{[matter.dateOfLoss, matter.accidentLocation].filter(Boolean).join(' · ') || '—'}</dd>
              <dt>Insurer</dt>
              <dd>
                {[
                  matter.insurerCompany,
                  matter.claimNumber && `Claim # ${matter.claimNumber}`,
                  matter.adjusterName && `Adjuster: ${matter.adjusterName}`,
                  matter.adjusterPhone,
                  matter.adjusterEmail
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </dd>
              <dt>Injury track</dt>
              <dd>
                {matter.injuryTrack || '—'}
                {matter.catApplicationDate && ` (CAT application ${matter.catApplicationDate})`}
              </dd>
              <dt>Optional coverage</dt>
              <dd>{coverage.length > 0 ? coverage.join(', ') : 'None recorded'}</dd>
              <dt>Assigned</dt>
              <dd>
                {[
                  matter.assignedAssistant && `Assistant: ${matter.assignedAssistant}`,
                  matter.responsibleLawyer && `Lawyer / paralegal: ${matter.responsibleLawyer}`
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </dd>
              <dt>Next deadline</dt>
              <dd>{next ? `${next.date} — ${next.label}` : 'None'}</dd>
              <dt>Hours</dt>
              <dd>
                {totals.hours.toFixed(1)} h · {formatMoney(totals.timeValue)}
              </dd>
              <dt>Charges</dt>
              <dd>
                {formatMoney(totals.chargesTotal)} ({formatMoney(totals.chargesOutstanding)} outstanding)
              </dd>
              <dt>Settlement</dt>
              <dd>
                {ofKind('settlement').length === 0
                  ? 'No settlement recorded'
                  : `${formatMoney(totals.settlementTotal)} recovered · fee ${formatMoney(totals.feeTotal)}`}
              </dd>
              <dt>File summary note</dt>
              <dd className="gp-summary-note">{matter.summary || '—'}</dd>
            </dl>
          </div>
        )
      case 'People':
        return <RecordSection {...sectionProps} title="People" itemLabel="contact" kind="contact" records={ofKind('contact')} />
      case 'Benefits':
        return <RecordSection {...sectionProps} title="Benefits" itemLabel="benefit" kind="benefit" records={ofKind('benefit')} />
      case 'Forms':
        return <RecordSection {...sectionProps} title="Form tracker" itemLabel="form" kind="form" records={ofKind('form')} />
      case 'Plans':
        return <RecordSection {...sectionProps} title="Treatment plans" itemLabel="treatment plan" kind="plan" records={ofKind('plan')} />
      case 'Denials':
        return (
          <RecordSection {...sectionProps} title="Denial register" itemLabel="denial" kind="denial" records={ofKind('denial')}>
            <p className="gp-muted">
              The limitation date defaults to two years from the date received and can always be changed. It is a
              diary aid, not legal advice.
            </p>
          </RecordSection>
        )
      case 'Insurer':
        return (
          <RecordSection
            {...sectionProps}
            title="s. 33 / s. 44 / EUO events"
            itemLabel="insurer event"
            kind="insurerEvent"
            records={ofKind('insurerEvent')}
            quickToggle="completed"
          />
        )
      case 'LAT':
        return matter.latOpen ? (
          <>
            <LatHeaderForm key={matter.id} matter={matter} onSave={updateMatter} />
            <RecordSection {...sectionProps} title="LAT steps and key dates" itemLabel="LAT step" kind="latStep" records={ofKind('latStep')} />
          </>
        ) : (
          <div className="gp-section">
            <div className="gp-empty">No LAT proceeding on this file.</div>
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                updateMatter({
                  latOpen: true,
                  ...(matter.status === 'intake' || matter.status === 'benefits' ? { status: 'lat' } : {})
                })
              }
            >
              Open LAT proceeding
            </button>
          </div>
        )
      case 'Diary':
        return (
          <>
            <RecordSection {...sectionProps} title="Tasks" itemLabel="task" kind="task" records={ofKind('task')} quickToggle="done" />
            <section className="gp-section" aria-label="Upcoming dates on this file">
              <div className="gp-section-header">
                <h3>Upcoming dates on this file</h3>
              </div>
              {deadlines.length === 0 ? (
                <div className="gp-empty">Nothing in the diary.</div>
              ) : (
                <ul className="gp-diary">
                  {deadlines.map((deadline) => (
                    <li key={deadline.recordId} className={deadline.date < ctx.today ? 'gp-overdue' : undefined}>
                      <span className="gp-diary-date">{deadline.date}</span> {deadline.label}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )
      case 'Time':
        return (
          <RecordSection {...sectionProps} title="Time" itemLabel="time entry" kind="time" records={timeRecords} voidable>
            <div className="gp-toolbar">
              <label htmlFor="gp-time-from">From</label>
              <input id="gp-time-from" type="date" value={timeFrom} onChange={(event) => setTimeFrom(event.target.value)} />
              <label htmlFor="gp-time-to">To</label>
              <input id="gp-time-to" type="date" value={timeTo} onChange={(event) => setTimeTo(event.target.value)} />
            </div>
            <div className="gp-totals" aria-label="Time totals">
              <div>
                Total: {timeTotals.hours.toFixed(1)} h · {formatMoney(timeTotals.timeValue)}
              </div>
              {[...hoursByUser.entries()].map(([user, entry]) => (
                <div key={user}>
                  {user}: {entry.hours.toFixed(1)} h · {formatMoney(entry.value)}
                </div>
              ))}
            </div>
          </RecordSection>
        )
      case 'Charges':
        return (
          <RecordSection {...sectionProps} title="Charges" itemLabel="charge" kind="charge" records={ofKind('charge')}>
            <div className="gp-totals" aria-label="Charge totals">
              <div>Total charges: {formatMoney(totals.chargesTotal)}</div>
              <div>Recoverable: {formatMoney(totals.disbursements)}</div>
              <div>Outstanding (unpaid): {formatMoney(totals.chargesOutstanding)}</div>
            </div>
          </RecordSection>
        )
      case 'Settlement':
        return (
          <RecordSection
            {...sectionProps}
            title="Settlements"
            itemLabel="settlement"
            kind="settlement"
            records={ofKind('settlement')}
            afterSave={handleSettlementSaved}
          >
            {ofKind('settlement').length > 0 && (
              <div className="gp-totals" aria-label="Settlement statement">
                <strong>Settlement statement (display only — no funds are handled here)</strong>
                {ofKind('settlement').map((settlement) => (
                  <div key={settlement.id}>
                    {String(settlement.data.date)}: recovery {formatMoney(gpNumber(settlement.data.amount))}, fee{' '}
                    {formatMoney(settlementFee(settlement, totals.timeValue))}
                  </div>
                ))}
                <div>Recovery: {formatMoney(totals.settlementTotal)}</div>
                <div>Less fee: {formatMoney(totals.feeTotal)}</div>
                <div>Less disbursements: {formatMoney(totals.disbursements)}</div>
                <div>
                  <strong>Net to client: {formatMoney(totals.netToClient)}</strong>
                </div>
              </div>
            )}
          </RecordSection>
        )
      case 'Documents':
        return <DocumentsTab matterId={matter.id} documents={documents} ctx={ctx} onChanged={reloadDocuments} />
      case 'Log':
        return <RecordSection {...sectionProps} title="Activity log" itemLabel="log entry" kind="log" records={ofKind('log')} />
    }
  }

  return (
    <div className="gp-matter">
      <div className="gp-matter-header">
        <button type="button" onClick={onBack}>
          ← My files
        </button>
        <div className="gp-matter-title">
          {matter.matterNumber} — {matter.clientName}
        </div>
        <label htmlFor="gp-matter-status">Status</label>
        <select
          id="gp-matter-status"
          value={matter.status}
          onChange={(event) => updateMatter({ status: event.target.value as GpMatterStatus })}
        >
          {Object.entries(GP_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="gp-tabs" role="tablist" aria-label="File sections">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={name === tab}
            className={`gp-tab${name === tab ? ' active' : ''}`}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="gp-tab-body">{renderTab()}</div>
    </div>
  )
}

interface LatHeaderFormProps {
  matter: GpMatter
  onSave: (patch: GpMatterPatch) => Promise<void>
}

// The LAT mini-file's own fields (WRK-08) — the docket, not e-File.
function LatHeaderForm({ matter, onSave }: LatHeaderFormProps): ReactElement {
  const [fileNumber, setFileNumber] = useState(matter.latFileNumber)
  const [dateFiled, setDateFiled] = useState(matter.latDateFiled)
  const [feePaid, setFeePaid] = useState(matter.latFeePaid)
  const [nextStep, setNextStep] = useState(matter.latNextStep)

  return (
    <form
      className="gp-form"
      aria-label="LAT proceeding"
      onSubmit={(event) => {
        event.preventDefault()
        void onSave({
          latFileNumber: fileNumber.trim(),
          latDateFiled: dateFiled,
          latFeePaid: feePaid,
          latNextStep: nextStep.trim()
        })
      }}
    >
      <div className="gp-form-grid">
        <div className="gp-field">
          <label htmlFor="gp-lat-file-number">Tribunal file #</label>
          <input id="gp-lat-file-number" value={fileNumber} onChange={(event) => setFileNumber(event.target.value)} />
        </div>
        <div className="gp-field">
          <label htmlFor="gp-lat-date-filed">Date filed</label>
          <input
            id="gp-lat-date-filed"
            type="date"
            value={dateFiled}
            onChange={(event) => setDateFiled(event.target.value)}
          />
        </div>
        <div className="gp-field">
          <label htmlFor="gp-lat-next-step">Next step</label>
          <input id="gp-lat-next-step" value={nextStep} onChange={(event) => setNextStep(event.target.value)} />
        </div>
        <label className="gp-field gp-field-checkbox" htmlFor="gp-lat-fee-paid">
          <input
            id="gp-lat-fee-paid"
            type="checkbox"
            checked={feePaid}
            onChange={(event) => setFeePaid(event.target.checked)}
          />
          Filing fee paid
        </label>
      </div>
      <div className="gp-form-actions">
        <button type="submit" className="btn-primary">
          Save LAT details
        </button>
      </div>
    </form>
  )
}

export default MatterView
