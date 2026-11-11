// Types and pure helpers for the Ghost Practice module — an Ontario
// accident-benefits (AB) file tool, per features/ghost-practice/SPEC.md.
// Shared between main (SQLite store, LLM context), preload, and renderer.
//
// Dates are stored as plain 'YYYY-MM-DD' strings (what an <input type="date">
// produces), never timestamps — these are calendar dates on a legal file,
// so they must not shift with a timezone.

export type GpMatterStatus = 'intake' | 'benefits' | 'lat' | 'partiallySettled' | 'settled' | 'closed'

export const GP_STATUS_LABELS: Record<GpMatterStatus, string> = {
  intake: 'Intake',
  benefits: 'Benefits ongoing',
  lat: 'LAT',
  partiallySettled: 'Partially settled',
  settled: 'Settled',
  closed: 'Closed'
}

export const GP_INJURY_TRACKS = ['MIG', 'Non-CAT', 'CAT', 'Disputed']

// An AB matter (spec §5, FILE-01..08, WRK-08, WRK-10). Deliberately flat —
// every field is a simple string/boolean so one generic form can edit it.
export interface GpMatter {
  id: string
  matterNumber: string
  createdAt: number
  // Optional link to a configured persona marked as a client, so that
  // persona's LLM-generated mail can reference this file's contents.
  clientPersonaId: string | null
  status: GpMatterStatus
  clientName: string
  clientDob: string
  clientPhone: string
  clientEmail: string
  clientAddress: string
  clientLanguage: string
  clientOccupation: string
  familyDoctor: string
  dateOfLoss: string
  accidentTime: string
  accidentLocation: string
  policeReport: string
  accidentDescription: string
  insurerCompany: string
  policyNumber: string
  claimNumber: string
  namedInsured: string
  adjusterName: string
  adjusterPhone: string
  adjusterEmail: string
  coverageIrb: boolean
  coverageNeb: boolean
  coverageCaregiver: boolean
  coverageHousekeeping: boolean
  coverageIncreasedLimits: boolean
  injuryTrack: string
  catApplicationDate: string
  assignedAssistant: string
  responsibleLawyer: string
  summary: string
  latOpen: boolean
  latFileNumber: string
  latDateFiled: string
  latFeePaid: boolean
  latNextStep: string
}

export type NewGpMatter = Partial<Omit<GpMatter, 'id' | 'matterNumber'>> & { clientName: string }

export type GpMatterPatch = Partial<Omit<GpMatter, 'id' | 'matterNumber' | 'createdAt'>>

export const BLANK_GP_MATTER_FIELDS: Omit<GpMatter, 'id' | 'matterNumber' | 'createdAt'> = {
  clientPersonaId: null,
  status: 'intake',
  clientName: '',
  clientDob: '',
  clientPhone: '',
  clientEmail: '',
  clientAddress: '',
  clientLanguage: '',
  clientOccupation: '',
  familyDoctor: '',
  dateOfLoss: '',
  accidentTime: '',
  accidentLocation: '',
  policeReport: '',
  accidentDescription: '',
  insurerCompany: '',
  policyNumber: '',
  claimNumber: '',
  namedInsured: '',
  adjusterName: '',
  adjusterPhone: '',
  adjusterEmail: '',
  coverageIrb: false,
  coverageNeb: false,
  coverageCaregiver: false,
  coverageHousekeeping: false,
  coverageIncreasedLimits: false,
  injuryTrack: '',
  catApplicationDate: '',
  assignedAssistant: '',
  responsibleLawyer: '',
  summary: '',
  latOpen: false,
  latFileNumber: '',
  latDateFiled: '',
  latFeePaid: false,
  latNextStep: ''
}

// Every list-with-dates object on a matter (spec §6.2–6.6) is one generic
// record: a `kind` plus a flat bag of field values described by
// GP_RECORD_FIELDS below. "Keep them simple lists-with-dates, not a rules
// engine" — so one table and one form component serve all of them.
export type GpRecordKind =
  | 'contact'
  | 'time'
  | 'charge'
  | 'settlement'
  | 'log'
  | 'task'
  | 'form'
  | 'plan'
  | 'benefit'
  | 'denial'
  | 'insurerEvent'
  | 'latStep'

export type GpRecordData = Record<string, string | number | boolean>

export interface GpRecord {
  id: string
  matterId: string
  kind: GpRecordKind
  createdAt: number
  // Set whenever the record is edited after creation — the "trace" TIME-05
  // asks for; null for a never-edited record.
  updatedAt: number | null
  data: GpRecordData
}

export interface NewGpRecord {
  matterId: string
  kind: GpRecordKind
  data: GpRecordData
  createdAt?: number
}

export interface GpFolder {
  id: string
  matterId: string
  name: string
  parentId: string | null
}

export type NewGpFolder = Omit<GpFolder, 'id' | 'parentId'> & Partial<Pick<GpFolder, 'parentId'>>

export type GpFolderPatch = Partial<Pick<GpFolder, 'name' | 'parentId'>>

// A document on a matter. Either an uploaded file (`path` points at the
// original on disk; `content` is its extracted text, when the type is
// supported) or a Markdown note written in the app (`path` null).
// `folderId` null means the matter's top level.
export interface GpDocument {
  id: string
  matterId: string
  folderId: string | null
  name: string
  content: string
  path: string | null
  uploadedBy: string
  createdAt: number
}

export type NewGpDocument = Omit<GpDocument, 'id' | 'folderId' | 'path' | 'uploadedBy' | 'createdAt'> &
  Partial<Pick<GpDocument, 'folderId' | 'path' | 'uploadedBy' | 'createdAt'>>

export type GpDocumentPatch = Partial<Pick<GpDocument, 'name' | 'content' | 'folderId'>>

export interface GpUser {
  name: string
  role: string
  defaultRate: number
}

// Firm admin (spec §6.7, ADM-02..04). ADM-01 (sign-in) is not implemented:
// this is a single-user desktop sandbox with no accounts.
export interface GpAdmin {
  firmName: string
  letterhead: string
  users: GpUser[]
  activityTypes: string[]
  chargeCategories: string[]
}

export const GP_USER_ROLES = ['Assistant', 'Lawyer', 'Paralegal']

export const DEFAULT_GP_ADMIN: GpAdmin = {
  firmName: '',
  letterhead: '',
  users: [],
  activityTypes: ['Call', 'Correspondence', 'Records', 'LAT prep', 'Attendance', 'Other'],
  chargeCategories: ['Records', 'Filing', 'Expert', 'Travel', 'Other']
}

// --- Field definitions -----------------------------------------------------

export type GpFieldType = 'text' | 'textarea' | 'date' | 'number' | 'money' | 'checkbox' | 'select' | 'document'

export interface GpField {
  key: string
  label: string
  type: GpFieldType
  options?: string[]
  // Pick-list sourced from firm admin rather than a fixed list (ADM-04).
  optionsFrom?: 'activityTypes' | 'chargeCategories'
  required?: boolean
  // Initial value for a new record. 'today' / 'currentUser' /
  // 'currentUserRate' are resolved by the form at open time.
  default?: string | number | boolean
  // Auto-fills this date from another date field plus N years, as long as
  // the user hasn't typed their own value (WRK-07: limitation date defaults
  // to +2 years from the denial, always editable).
  plusYearsFrom?: { field: string; years: number }
}

export const GP_CONTACT_ROLES = ['Client', 'Adjuster', 'Clinic', 'Employer', 'Expert', 'LAT', 'Other counsel', 'Other']

export const GP_OCF_FORMS = [
  'OCF-1',
  'OCF-2',
  'OCF-3',
  'OCF-6',
  'OCF-9',
  'OCF-10',
  'OCF-18',
  'OCF-19',
  'OCF-21',
  'OCF-23',
  'OCF-24',
  'Form 1',
  'Other'
]

export const GP_BENEFIT_TYPES = [
  'Medical / rehabilitation',
  'Attendant care',
  'Income replacement (IRB)',
  'Non-earner (NEB)',
  'Caregiver',
  'Housekeeping / home maintenance',
  'Visitor expenses',
  'Education',
  'Clothing / glasses',
  'Death / funeral',
  'Catastrophic (CAT)',
  'Other'
]

export const GP_RECORD_FIELDS: Record<GpRecordKind, GpField[]> = {
  contact: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'role', label: 'Role', type: 'select', options: GP_CONTACT_ROLES, default: 'Adjuster' },
    { key: 'organization', label: 'Organization', type: 'text' },
    { key: 'phone', label: 'Phone', type: 'text' },
    { key: 'email', label: 'Email', type: 'text' },
    { key: 'notes', label: 'Notes', type: 'text' }
  ],
  time: [
    { key: 'date', label: 'Date', type: 'date', required: true, default: 'today' },
    { key: 'user', label: 'User', type: 'text', required: true, default: 'currentUser' },
    { key: 'hours', label: 'Hours', type: 'number', required: true },
    { key: 'description', label: 'Description', type: 'text', required: true },
    { key: 'activityType', label: 'Activity', type: 'select', optionsFrom: 'activityTypes' },
    { key: 'rate', label: 'Rate', type: 'money', default: 'currentUserRate' },
    { key: 'billable', label: 'Billable', type: 'checkbox', default: true }
  ],
  charge: [
    { key: 'date', label: 'Date', type: 'date', required: true, default: 'today' },
    { key: 'vendor', label: 'Vendor', type: 'text', required: true },
    { key: 'amount', label: 'Amount', type: 'money', required: true },
    { key: 'tax', label: 'Tax', type: 'money' },
    { key: 'description', label: 'Description', type: 'text' },
    { key: 'category', label: 'Category', type: 'select', optionsFrom: 'chargeCategories' },
    { key: 'receipt', label: 'Receipt on file', type: 'checkbox' },
    { key: 'paid', label: 'Paid', type: 'checkbox' },
    { key: 'recoverable', label: 'Recoverable', type: 'checkbox', default: true },
    { key: 'documentId', label: 'Invoice / receipt', type: 'document' }
  ],
  settlement: [
    { key: 'date', label: 'Date', type: 'date', required: true, default: 'today' },
    { key: 'insurer', label: 'Insurer', type: 'text' },
    { key: 'amount', label: 'Amount', type: 'money', required: true },
    { key: 'released', label: 'Benefits released', type: 'text' },
    { key: 'fullAndFinal', label: 'Full and final', type: 'checkbox' },
    { key: 'feeType', label: 'Fee type', type: 'select', options: ['Percent', 'Flat', 'Hourly'], default: 'Percent' },
    { key: 'feeValue', label: 'Fee % or flat $', type: 'number' }
  ],
  log: [
    { key: 'date', label: 'Date', type: 'date', required: true, default: 'today' },
    {
      key: 'type',
      label: 'Type',
      type: 'select',
      options: ['Call', 'Email', 'Letter', 'Meeting', 'Note', 'Other'],
      default: 'Call'
    },
    { key: 'who', label: 'Who', type: 'text' },
    { key: 'summary', label: 'Summary', type: 'text', required: true },
    { key: 'documentId', label: 'Document', type: 'document' }
  ],
  task: [
    { key: 'text', label: 'Task', type: 'text', required: true },
    { key: 'dueDate', label: 'Due', type: 'date' },
    { key: 'assignee', label: 'Assignee', type: 'text', default: 'currentUser' },
    { key: 'done', label: 'Done', type: 'checkbox' }
  ],
  form: [
    { key: 'form', label: 'Form', type: 'select', options: GP_OCF_FORMS, default: 'OCF-1' },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: ['Requested', 'Received', 'Submitted', 'Insurer response'],
      default: 'Requested'
    },
    { key: 'date', label: 'Status date', type: 'date', default: 'today' },
    { key: 'notes', label: 'Notes', type: 'text' },
    { key: 'documentId', label: 'Document', type: 'document' }
  ],
  plan: [
    { key: 'clinic', label: 'Clinic', type: 'text', required: true },
    { key: 'planType', label: 'Plan type', type: 'select', options: ['OCF-18', 'OCF-23'], default: 'OCF-18' },
    { key: 'planNumber', label: 'Plan #', type: 'text' },
    { key: 'dateSubmitted', label: 'Submitted', type: 'date' },
    { key: 'amount', label: 'Amount', type: 'money' },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: ['Pending', 'Approved', 'Denied', 'Partial'],
      default: 'Pending'
    },
    { key: 'documentId', label: 'EOB', type: 'document' }
  ],
  benefit: [
    { key: 'type', label: 'Benefit', type: 'select', options: GP_BENEFIT_TYPES, default: GP_BENEFIT_TYPES[0] },
    { key: 'claimed', label: 'Claimed', type: 'checkbox', default: true },
    { key: 'amount', label: 'Weekly / limit amount', type: 'text' },
    { key: 'startDate', label: 'Start', type: 'date' },
    { key: 'cutoffDate', label: 'Cutoff', type: 'date' },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: ['Not claimed', 'Claimed', 'Ongoing', 'Denied', 'Terminated', 'Settled'],
      default: 'Claimed'
    }
  ],
  denial: [
    { key: 'dateReceived', label: 'Date received', type: 'date', required: true, default: 'today' },
    { key: 'denied', label: 'Benefit / plan denied', type: 'text', required: true },
    {
      key: 'limitationDate',
      label: 'Limitation date',
      type: 'date',
      plusYearsFrom: { field: 'dateReceived', years: 2 }
    },
    { key: 'latFiled', label: 'LAT filed', type: 'checkbox' },
    { key: 'documentId', label: 'Denial letter / EOB', type: 'document' }
  ],
  insurerEvent: [
    {
      key: 'type',
      label: 'Type',
      type: 'select',
      options: ['s. 33 request', 's. 44 exam', 'EUO'],
      default: 's. 33 request'
    },
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'details', label: 'Details', type: 'text' },
    { key: 'completed', label: 'Completed', type: 'checkbox' },
    { key: 'documentId', label: 'Document', type: 'document' }
  ],
  latStep: [
    {
      key: 'step',
      label: 'Step',
      type: 'select',
      options: ['Response', 'Case conference', 'Disclosure', 'Motion', 'Hearing', 'Decision', 'Other'],
      default: 'Response'
    },
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'notes', label: 'Notes', type: 'text' }
  ]
}

export interface GpMatterFieldGroup {
  title: string
  fields: GpField[]
}

// Every editable field on the matter itself, grouped for the "Edit file
// details" form. `status` and `clientPersonaId` are rendered separately
// (they need labelled option values, not plain string lists).
export const GP_MATTER_FIELD_GROUPS: GpMatterFieldGroup[] = [
  {
    title: 'Client',
    fields: [
      { key: 'clientName', label: 'Client name', type: 'text', required: true },
      { key: 'clientDob', label: 'Date of birth', type: 'date' },
      { key: 'clientPhone', label: 'Client phone', type: 'text' },
      { key: 'clientEmail', label: 'Client email', type: 'text' },
      { key: 'clientAddress', label: 'Client address', type: 'text' },
      { key: 'clientLanguage', label: 'Language', type: 'text' },
      { key: 'clientOccupation', label: 'Occupation', type: 'text' },
      { key: 'familyDoctor', label: 'Family doctor', type: 'text' }
    ]
  },
  {
    title: 'Accident',
    fields: [
      { key: 'dateOfLoss', label: 'Date of loss', type: 'date' },
      { key: 'accidentTime', label: 'Time of accident', type: 'text' },
      { key: 'accidentLocation', label: 'Location', type: 'text' },
      { key: 'policeReport', label: 'Police report #', type: 'text' },
      { key: 'accidentDescription', label: 'Description', type: 'textarea' }
    ]
  },
  {
    title: 'Insurer',
    fields: [
      { key: 'insurerCompany', label: 'Insurer', type: 'text' },
      { key: 'policyNumber', label: 'Policy #', type: 'text' },
      { key: 'claimNumber', label: 'Claim #', type: 'text' },
      { key: 'namedInsured', label: 'Named insured', type: 'text' },
      { key: 'adjusterName', label: 'Adjuster name', type: 'text' },
      { key: 'adjusterPhone', label: 'Adjuster phone', type: 'text' },
      { key: 'adjusterEmail', label: 'Adjuster email', type: 'text' }
    ]
  },
  {
    title: 'Optional coverage on this policy',
    fields: [
      { key: 'coverageIrb', label: 'Income replacement (IRB)', type: 'checkbox' },
      { key: 'coverageNeb', label: 'Non-earner (NEB)', type: 'checkbox' },
      { key: 'coverageCaregiver', label: 'Caregiver', type: 'checkbox' },
      { key: 'coverageHousekeeping', label: 'Housekeeping', type: 'checkbox' },
      { key: 'coverageIncreasedLimits', label: 'Increased limits', type: 'checkbox' }
    ]
  },
  {
    title: 'Injury track and ownership',
    fields: [
      { key: 'injuryTrack', label: 'Injury track', type: 'select', options: GP_INJURY_TRACKS },
      { key: 'catApplicationDate', label: 'CAT application date', type: 'date' },
      { key: 'assignedAssistant', label: 'Assigned assistant', type: 'text' },
      { key: 'responsibleLawyer', label: 'Responsible lawyer / paralegal', type: 'text' }
    ]
  },
  {
    title: 'File summary',
    fields: [{ key: 'summary', label: 'File summary note', type: 'textarea' }]
  }
]

// --- Default document folders (spec §7) ------------------------------------

export interface GpFolderTemplate {
  name: string
  children?: GpFolderTemplate[]
}

export const DEFAULT_GP_FOLDERS: GpFolderTemplate[] = [
  { name: '01 Intake and retainer' },
  {
    name: '02 Correspondence',
    children: [
      { name: '02.01 Client' },
      { name: '02.02 Insurer / adjuster' },
      { name: '02.03 Clinics and treaters' },
      { name: '02.04 Employer' },
      { name: '02.05 Other' }
    ]
  },
  { name: '03 OCF forms and insurer EOBs' },
  { name: '04 Medical records and reports' },
  { name: '05 Employment and income' },
  { name: '06 Treatment plans (OCF-18 / 23)' },
  { name: '07 Insurer exams, s.33, EUO' },
  {
    name: '08 LAT',
    children: [
      { name: '08.01 Application and response' },
      { name: '08.02 Case conference' },
      { name: '08.03 Productions' },
      { name: '08.04 Hearing' }
    ]
  },
  { name: '09 Experts' },
  { name: '10 Settlement and releases' },
  { name: '11 Time and disbursements (receipts)' },
  { name: '99 Closed / archive' }
]

// --- Pure helpers ------------------------------------------------------------

export function toDateString(ms: number): string {
  const date = new Date(ms)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

// 'YYYY-MM-DD' + N years, as string arithmetic so no timezone is involved.
// Feb 29 lands on Feb 28 when the target year isn't a leap year.
export function addYears(dateString: string, years: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString)
  if (!match) return ''
  const year = Number(match[1]) + years
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  const day = match[2] === '02' && match[3] === '29' && !isLeap ? '28' : match[3]
  return `${String(year).padStart(4, '0')}-${match[2]}-${day}`
}

export function gpNumber(value: string | number | boolean | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatMoney(value: number): string {
  return `$${value.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function ofKind(records: GpRecord[], kind: GpRecordKind): GpRecord[] {
  return records.filter((record) => record.kind === kind)
}

export interface GpMatterTotals {
  hours: number
  timeValue: number
  chargesTotal: number
  chargesOutstanding: number
  disbursements: number
  settlementTotal: number
  feeTotal: number
  netToClient: number
}

// A settlement's fee (SET-02): a percentage of that settlement's recovery,
// a flat amount, or the matter's docketed time value applied.
export function settlementFee(settlement: GpRecord, timeValue: number): number {
  const feeType = settlement.data.feeType
  if (feeType === 'Flat') return gpNumber(settlement.data.feeValue)
  if (feeType === 'Hourly') return timeValue
  return (gpNumber(settlement.data.amount) * gpNumber(settlement.data.feeValue)) / 100
}

// The bare-bones money model (spec §8). `records` is one matter's records.
// Voided time entries count for nothing; only billable time has a $ value;
// only recoverable charges are deducted from the client's net.
export function matterTotals(records: GpRecord[]): GpMatterTotals {
  const time = ofKind(records, 'time').filter((record) => !record.data.voided)
  const hours = time.reduce((sum, record) => sum + gpNumber(record.data.hours), 0)
  const timeValue = time
    .filter((record) => record.data.billable)
    .reduce((sum, record) => sum + gpNumber(record.data.hours) * gpNumber(record.data.rate), 0)

  const charges = ofKind(records, 'charge')
  const chargeAmount = (record: GpRecord): number => gpNumber(record.data.amount) + gpNumber(record.data.tax)
  const chargesTotal = charges.reduce((sum, record) => sum + chargeAmount(record), 0)
  const chargesOutstanding = charges
    .filter((record) => !record.data.paid)
    .reduce((sum, record) => sum + chargeAmount(record), 0)
  const disbursements = charges
    .filter((record) => record.data.recoverable)
    .reduce((sum, record) => sum + chargeAmount(record), 0)

  const settlements = ofKind(records, 'settlement')
  const settlementTotal = settlements.reduce((sum, record) => sum + gpNumber(record.data.amount), 0)
  const feeTotal = settlements.reduce((sum, record) => sum + settlementFee(record, timeValue), 0)

  return {
    hours,
    timeValue,
    chargesTotal,
    chargesOutstanding,
    disbursements,
    settlementTotal,
    feeTotal,
    netToClient: settlementTotal - feeTotal - disbursements
  }
}

export interface GpDeadline {
  date: string
  label: string
  matterId: string
  recordId: string
}

// Everything on a matter that belongs in the diary (WRK-03): open tasks
// with a due date, denial limitation dates not yet taken to the LAT, LAT
// step dates, and incomplete s. 33 / s. 44 / EUO events. Sorted by date.
export function matterDeadlines(records: GpRecord[]): GpDeadline[] {
  const deadlines: GpDeadline[] = []
  for (const record of records) {
    const { data } = record
    let date = ''
    let label = ''
    if (record.kind === 'task' && !data.done) {
      date = String(data.dueDate ?? '')
      label = `Task: ${data.text}`
    } else if (record.kind === 'denial' && !data.latFiled) {
      date = String(data.limitationDate ?? '')
      label = `LAT limitation: ${data.denied}`
    } else if (record.kind === 'latStep') {
      date = String(data.date ?? '')
      label = `LAT ${String(data.step).toLowerCase()}`
    } else if (record.kind === 'insurerEvent' && !data.completed) {
      date = String(data.date ?? '')
      label = data.details ? `${data.type}: ${data.details}` : String(data.type)
    }
    if (date) deadlines.push({ date, label, matterId: record.matterId, recordId: record.id })
  }
  return deadlines.sort((a, b) => a.date.localeCompare(b.date))
}

// The "next deadline" column on My files. Dated LAT steps that have
// already passed are history, not deadlines; an overdue task or limitation
// date still is one, and should stay visible until it is dealt with.
export function nextDeadline(records: GpRecord[], today: string): GpDeadline | null {
  const byId = new Map(records.map((record) => [record.id, record]))
  return (
    matterDeadlines(records).find(
      (deadline) => deadline.date >= today || byId.get(deadline.recordId)?.kind !== 'latStep'
    ) ?? null
  )
}

// FILE-10: search by client name, matter #, claim #, date of loss.
export function matterMatchesSearch(matter: GpMatter, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return [matter.clientName, matter.matterNumber, matter.claimNumber, matter.dateOfLoss].some((value) =>
    value.toLowerCase().includes(needle)
  )
}
