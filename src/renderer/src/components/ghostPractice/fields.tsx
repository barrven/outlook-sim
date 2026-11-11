import type { ReactElement } from 'react'
import type { Persona } from '../../../../shared/data-types'
import {
  addYears,
  formatMoney,
  gpNumber,
  type GpAdmin,
  type GpDocument,
  type GpField,
  type GpRecordData
} from '../../../../shared/ghostPractice'

// Everything a Ghost Practice form needs to resolve defaults and pick-lists:
// firm admin lists, the simulated "today", and who the trainee is.
export interface GpContext {
  admin: GpAdmin
  today: string
  currentUser: string
  personas: Persona[]
}

// Form state: every non-checkbox field is held as the string the input
// shows (numbers included), converted back to stored values on save.
export type GpDraft = Record<string, string | boolean>

function defaultRateFor(ctx: GpContext, userName: string): string {
  const user = ctx.admin.users.find((candidate) => candidate.name === userName)
  return user && user.defaultRate ? String(user.defaultRate) : ''
}

function fieldOptions(field: GpField, ctx: GpContext): string[] {
  return field.optionsFrom ? ctx.admin[field.optionsFrom] : (field.options ?? [])
}

export function toDraft(fields: GpField[], data: GpRecordData): GpDraft {
  const draft: GpDraft = {}
  for (const field of fields) {
    const value = data[field.key]
    draft[field.key] = field.type === 'checkbox' ? Boolean(value) : value === undefined ? '' : String(value)
  }
  return draft
}

export function fromDraft(fields: GpField[], draft: GpDraft): GpRecordData {
  const data: GpRecordData = {}
  for (const field of fields) {
    const value = draft[field.key]
    if (field.type === 'checkbox') {
      data[field.key] = Boolean(value)
    } else if (field.type === 'number' || field.type === 'money') {
      data[field.key] = value === '' ? '' : gpNumber(String(value))
    } else {
      data[field.key] = String(value ?? '').trim()
    }
  }
  return data
}

export function initialDraft(fields: GpField[], ctx: GpContext): GpDraft {
  const draft: GpDraft = {}
  for (const field of fields) {
    if (field.type === 'checkbox') {
      draft[field.key] = field.default === true
    } else if (field.default === 'today') {
      draft[field.key] = ctx.today
    } else if (field.default === 'currentUser') {
      draft[field.key] = ctx.currentUser
    } else if (field.default === 'currentUserRate') {
      draft[field.key] = defaultRateFor(ctx, ctx.currentUser)
    } else {
      draft[field.key] = field.default === undefined ? '' : String(field.default)
    }
  }
  for (const field of fields) {
    if (field.plusYearsFrom) {
      draft[field.key] = addYears(String(draft[field.plusYearsFrom.field]), field.plusYearsFrom.years)
    }
  }
  return draft
}

// Applies one field edit plus anything derived from it. A derived value
// (a "+N years" date, a user's default rate) only follows its source while
// it is still empty or still equal to what was last derived — once the user
// types their own value it is left alone.
export function applyDraftChange(
  fields: GpField[],
  draft: GpDraft,
  key: string,
  value: string | boolean,
  ctx: GpContext
): GpDraft {
  const next: GpDraft = { ...draft, [key]: value }
  for (const field of fields) {
    if (field.plusYearsFrom?.field === key) {
      const previousDerived = addYears(String(draft[key]), field.plusYearsFrom.years)
      if (draft[field.key] === '' || draft[field.key] === previousDerived) {
        next[field.key] = addYears(String(value), field.plusYearsFrom.years)
      }
    }
    if (field.default === 'currentUserRate' && key === 'user') {
      const previousDerived = defaultRateFor(ctx, String(draft.user))
      if (draft[field.key] === '' || draft[field.key] === previousDerived) {
        next[field.key] = defaultRateFor(ctx, String(value))
      }
    }
  }
  return next
}

export function missingRequiredField(fields: GpField[], draft: GpDraft): GpField | undefined {
  return fields.find((field) => field.required && String(draft[field.key] ?? '').trim() === '')
}

export function displayValue(field: GpField, data: GpRecordData, documents: GpDocument[]): string {
  const value = data[field.key]
  if (field.type === 'checkbox') return value ? 'Yes' : 'No'
  if (value === undefined || value === '') return ''
  if (field.type === 'money') return formatMoney(gpNumber(value))
  if (field.type === 'document') return documents.find((document) => document.id === value)?.name ?? ''
  return String(value)
}

interface GpFieldInputProps {
  field: GpField
  value: string | boolean
  idPrefix: string
  ctx: GpContext
  documents?: GpDocument[]
  onChange: (value: string | boolean) => void
}

export function GpFieldInput({ field, value, idPrefix, ctx, documents, onChange }: GpFieldInputProps): ReactElement {
  const id = `${idPrefix}-${field.key}`

  if (field.type === 'checkbox') {
    return (
      <label className="gp-field gp-field-checkbox" htmlFor={id}>
        <input id={id} type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        {field.label}
      </label>
    )
  }

  const text = String(value)
  let input: ReactElement
  if (field.type === 'select' || field.type === 'document') {
    const options =
      field.type === 'document'
        ? (documents ?? []).map((document) => ({ value: document.id, label: document.name }))
        : fieldOptions(field, ctx).map((option) => ({ value: option, label: option }))
    // A stored value that is no longer in the pick-list (an admin list was
    // edited, a linked document deleted) still shows as selected rather
    // than silently resetting.
    const hasCurrent = text === '' || options.some((option) => option.value === text)
    input = (
      <select id={id} value={text} onChange={(event) => onChange(event.target.value)}>
        <option value="">{field.type === 'document' ? 'No document' : '—'}</option>
        {!hasCurrent && <option value={text}>{field.type === 'document' ? '(missing document)' : text}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  } else if (field.type === 'textarea') {
    input = <textarea id={id} value={text} onChange={(event) => onChange(event.target.value)} />
  } else {
    const numeric = field.type === 'number' || field.type === 'money'
    input = (
      <input
        id={id}
        type={field.type === 'date' ? 'date' : numeric ? 'number' : 'text'}
        step={numeric ? 'any' : undefined}
        min={numeric ? 0 : undefined}
        value={text}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

  return (
    <div className={`gp-field${field.type === 'textarea' ? ' gp-field-wide' : ''}`}>
      <label htmlFor={id}>{field.label}</label>
      {input}
    </div>
  )
}
