import { useState, type FormEvent, type ReactElement, type ReactNode } from 'react'
import {
  GP_RECORD_FIELDS,
  type GpDocument,
  type GpRecord,
  type GpRecordData,
  type GpRecordKind
} from '../../../../shared/ghostPractice'
import {
  applyDraftChange,
  displayValue,
  fromDraft,
  GpFieldInput,
  initialDraft,
  missingRequiredField,
  toDraft,
  type GpContext,
  type GpDraft
} from './fields'

interface RecordSectionProps {
  title: string
  // Singular noun for the Add button and empty state, e.g. "time entry".
  itemLabel: string
  kind: GpRecordKind
  matterId: string
  // This matter's records of this kind (the caller may pre-filter further).
  records: GpRecord[]
  documents: GpDocument[]
  ctx: GpContext
  onChanged: () => void
  // Runs after a successful create/update with the saved values — used by
  // Settlement to move the matter's status along.
  afterSave?: (data: GpRecordData) => void | Promise<void>
  // Time entries are voided, never deleted (TIME-05: keep a trace).
  voidable?: boolean
  // A checkbox field shown as a live checkbox in each row (a task's Done).
  quickToggle?: string
  children?: ReactNode
}

// One list-with-dates on a matter: a table of records of a single kind
// with a shared inline add/edit form, driven entirely by GP_RECORD_FIELDS.
function RecordSection({
  title,
  itemLabel,
  kind,
  matterId,
  records,
  documents,
  ctx,
  onChanged,
  afterSave,
  voidable,
  quickToggle,
  children
}: RecordSectionProps): ReactElement {
  const fields = GP_RECORD_FIELDS[kind]
  // 'new' while adding, a record id while editing, null when closed.
  const [formTarget, setFormTarget] = useState<string | null>(null)
  const [draft, setDraft] = useState<GpDraft>({})
  const [error, setError] = useState('')

  function openCreate(): void {
    setFormTarget('new')
    setDraft(initialDraft(fields, ctx))
    setError('')
  }

  function openEdit(record: GpRecord): void {
    setFormTarget(record.id)
    setDraft(toDraft(fields, record.data))
    setError('')
  }

  function closeForm(): void {
    setFormTarget(null)
    setError('')
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault()
    const missing = missingRequiredField(fields, draft)
    if (missing) {
      setError(`${missing.label} is required.`)
      return
    }
    const data = fromDraft(fields, draft)
    if (formTarget === 'new') {
      await window.api.gp.records.create({ matterId, kind, data })
    } else if (formTarget) {
      await window.api.gp.records.update(formTarget, data)
    }
    closeForm()
    await afterSave?.(data)
    onChanged()
  }

  async function handleDelete(record: GpRecord): Promise<void> {
    await window.api.gp.records.delete(record.id)
    if (formTarget === record.id) closeForm()
    onChanged()
  }

  async function handlePatch(record: GpRecord, data: GpRecordData): Promise<void> {
    await window.api.gp.records.update(record.id, data)
    onChanged()
  }

  return (
    <section className="gp-section" aria-label={title}>
      <div className="gp-section-header">
        <h3>{title}</h3>
        {formTarget === null && (
          <button type="button" className="btn-primary" onClick={openCreate}>
            Add {itemLabel}
          </button>
        )}
      </div>

      {formTarget !== null && (
        <form className="gp-form" onSubmit={handleSubmit} aria-label={`${formTarget === 'new' ? 'Add' : 'Edit'} ${itemLabel}`}>
          <div className="gp-form-grid">
            {fields.map((field) => (
              <GpFieldInput
                key={field.key}
                field={field}
                value={draft[field.key] ?? ''}
                idPrefix={`gp-${kind}`}
                ctx={ctx}
                documents={documents}
                onChange={(value) => setDraft((current) => applyDraftChange(fields, current, field.key, value, ctx))}
              />
            ))}
          </div>
          {error && (
            <div className="gp-form-error" role="alert">
              {error}
            </div>
          )}
          <div className="gp-form-actions">
            <button type="submit" className="btn-primary">
              Save
            </button>
            <button type="button" onClick={closeForm}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {records.length === 0 ? (
        <div className="gp-empty">No {itemLabel} recorded yet.</div>
      ) : (
        <table className="gp-table">
          <thead>
            <tr>
              {fields.map((field) => (
                <th key={field.key}>{field.label}</th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const voided = Boolean(record.data.voided)
              const name = String(record.data[fields[0].key] ?? itemLabel)
              return (
                <tr key={record.id} className={voided ? 'gp-row-voided' : undefined}>
                  {fields.map((field) => (
                    <td key={field.key}>
                      {field.key === quickToggle ? (
                        <input
                          type="checkbox"
                          aria-label={`${field.label}: ${name}`}
                          checked={Boolean(record.data[field.key])}
                          onChange={(event) => handlePatch(record, { [field.key]: event.target.checked })}
                        />
                      ) : (
                        displayValue(field, record.data, documents)
                      )}
                    </td>
                  ))}
                  <td className="gp-row-actions">
                    {voided && <span className="gp-tag">Voided</span>}
                    {record.updatedAt !== null && !voided && <span className="gp-tag">Edited</span>}
                    {!voided && (
                      <button type="button" aria-label={`Edit ${name}`} onClick={() => openEdit(record)}>
                        Edit
                      </button>
                    )}
                    {voidable ? (
                      <button
                        type="button"
                        aria-label={`${voided ? 'Restore' : 'Void'} ${name}`}
                        onClick={() => handlePatch(record, { voided: !voided })}
                      >
                        {voided ? 'Restore' : 'Void'}
                      </button>
                    ) : (
                      <button type="button" aria-label={`Delete ${name}`} onClick={() => handleDelete(record)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {children}
    </section>
  )
}

export default RecordSection
