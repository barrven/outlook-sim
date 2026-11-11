import { describe, expect, it } from 'vitest'
import {
  addYears,
  BLANK_GP_MATTER_FIELDS,
  DEFAULT_GP_FOLDERS,
  formatMoney,
  GP_RECORD_FIELDS,
  matterDeadlines,
  matterMatchesSearch,
  matterTotals,
  nextDeadline,
  settlementFee,
  toDateString,
  type GpMatter,
  type GpRecord,
  type GpRecordData,
  type GpRecordKind
} from './ghostPractice'

let nextId = 0
function record(kind: GpRecordKind, data: GpRecordData, matterId = 'm1'): GpRecord {
  nextId += 1
  return { id: `r${nextId}`, matterId, kind, createdAt: nextId, updatedAt: null, data }
}

describe('addYears', () => {
  it('adds whole years to a date string without any timezone drift', () => {
    expect(addYears('2026-04-12', 2)).toBe('2028-04-12')
    expect(addYears('2026-01-01', 2)).toBe('2028-01-01')
    expect(addYears('2026-12-31', 2)).toBe('2028-12-31')
  })

  it('lands Feb 29 on Feb 28 when the target year is not a leap year, and keeps it when it is', () => {
    expect(addYears('2028-02-29', 2)).toBe('2030-02-28')
    expect(addYears('2028-02-29', 4)).toBe('2032-02-29')
  })

  it('returns an empty string for a blank or malformed date', () => {
    expect(addYears('', 2)).toBe('')
    expect(addYears('April 12', 2)).toBe('')
  })
})

describe('toDateString / formatMoney', () => {
  it('formats a timestamp as a local calendar date', () => {
    expect(toDateString(new Date(2026, 2, 4, 23, 59).getTime())).toBe('2026-03-04')
    expect(toDateString(new Date(2026, 10, 30, 0, 1).getTime())).toBe('2026-11-30')
  })

  it('formats money with two decimals and thousands separators', () => {
    expect(formatMoney(106)).toBe('$106.00')
    expect(formatMoney(12345.5)).toBe('$12,345.50')
  })
})

describe('matterTotals (spec §8 bare-bones money model)', () => {
  it('is all zeroes for a matter with nothing recorded', () => {
    expect(matterTotals([])).toEqual({
      hours: 0,
      timeValue: 0,
      chargesTotal: 0,
      chargesOutstanding: 0,
      disbursements: 0,
      settlementTotal: 0,
      feeTotal: 0,
      netToClient: 0
    })
  })

  it('TIME-07: sums hours and hours × rate, counting non-billable hours but not their value', () => {
    const totals = matterTotals([
      record('time', { hours: 1.5, rate: 100, billable: true }),
      record('time', { hours: 0.5, rate: 100, billable: false })
    ])
    expect(totals.hours).toBe(2)
    expect(totals.timeValue).toBe(150)
  })

  it('TIME-05: a voided entry counts for nothing', () => {
    const totals = matterTotals([
      record('time', { hours: 1, rate: 100, billable: true }),
      record('time', { hours: 9, rate: 100, billable: true, voided: true })
    ])
    expect(totals.hours).toBe(1)
    expect(totals.timeValue).toBe(100)
  })

  it('CHG-03/04/06: totals charges with tax, and separates outstanding and recoverable amounts', () => {
    const totals = matterTotals([
      record('charge', { amount: 106, tax: 0, paid: true, recoverable: true }),
      record('charge', { amount: 100, tax: 13, paid: false, recoverable: true }),
      record('charge', { amount: 20, tax: '', paid: false, recoverable: false })
    ])
    expect(totals.chargesTotal).toBe(239)
    expect(totals.chargesOutstanding).toBe(133)
    expect(totals.disbursements).toBe(219)
  })

  it('SET-03: net to client = recovery − fee − recoverable disbursements, across staged settlements', () => {
    const totals = matterTotals([
      record('settlement', { amount: 10000, feeType: 'Percent', feeValue: 30 }),
      record('settlement', { amount: 5000, feeType: 'Flat', feeValue: 1000 }),
      record('charge', { amount: 500, tax: 0, recoverable: true }),
      record('charge', { amount: 75, tax: 0, recoverable: false })
    ])
    expect(totals.settlementTotal).toBe(15000)
    expect(totals.feeTotal).toBe(4000)
    expect(totals.netToClient).toBe(10500)
  })

  it('treats blank or non-numeric amounts as zero rather than NaN', () => {
    const totals = matterTotals([record('charge', { amount: '', tax: 'abc', recoverable: true })])
    expect(totals.chargesTotal).toBe(0)
  })
})

describe('settlementFee (SET-02)', () => {
  it('computes a percentage of that settlement, a flat fee, or the hourly time value applied', () => {
    expect(settlementFee(record('settlement', { amount: 20000, feeType: 'Percent', feeValue: 33 }), 999)).toBe(6600)
    expect(settlementFee(record('settlement', { amount: 20000, feeType: 'Flat', feeValue: 2500 }), 999)).toBe(2500)
    expect(settlementFee(record('settlement', { amount: 20000, feeType: 'Hourly', feeValue: '' }), 999)).toBe(999)
  })

  it('is zero when no fee has been entered yet', () => {
    expect(settlementFee(record('settlement', { amount: 20000, feeType: 'Percent', feeValue: '' }), 0)).toBe(0)
  })
})

describe('matterDeadlines / nextDeadline (WRK-03)', () => {
  it('collects open tasks, unfiled denial limitation dates, LAT steps, and incomplete insurer events, sorted by date', () => {
    const deadlines = matterDeadlines([
      record('task', { text: 'Call clinic', dueDate: '2026-05-01', done: false }),
      record('denial', { denied: 'OCF-18 physio', limitationDate: '2028-04-12', latFiled: false }),
      record('latStep', { step: 'Case conference', date: '2026-06-15' }),
      record('insurerEvent', { type: 's. 44 exam', details: 'Dr. Lee', date: '2026-04-20', completed: false })
    ])
    expect(deadlines.map((deadline) => `${deadline.date} ${deadline.label}`)).toEqual([
      '2026-04-20 s. 44 exam: Dr. Lee',
      '2026-05-01 Task: Call clinic',
      '2026-06-15 LAT case conference',
      '2028-04-12 LAT limitation: OCF-18 physio'
    ])
  })

  it('drops what is already dealt with or has no date', () => {
    const deadlines = matterDeadlines([
      record('task', { text: 'Done task', dueDate: '2026-05-01', done: true }),
      record('task', { text: 'Undated task', dueDate: '', done: false }),
      record('denial', { denied: 'IRB', limitationDate: '2028-01-01', latFiled: true }),
      record('insurerEvent', { type: 'EUO', date: '2026-04-20', completed: true }),
      record('time', { date: '2026-04-20', hours: 1 })
    ])
    expect(deadlines).toEqual([])
  })

  it('nextDeadline keeps an overdue task or limitation date visible, but skips LAT steps already in the past', () => {
    const pastStep = record('latStep', { step: 'Response', date: '2026-01-10' })
    const overdueTask = record('task', { text: 'Serve application', dueDate: '2026-02-01', done: false })
    const futureStep = record('latStep', { step: 'Hearing', date: '2026-09-01' })

    expect(nextDeadline([pastStep, futureStep], '2026-03-01')?.label).toBe('LAT hearing')
    expect(nextDeadline([pastStep, overdueTask, futureStep], '2026-03-01')?.label).toBe('Task: Serve application')
    expect(nextDeadline([pastStep], '2026-03-01')).toBeNull()
  })
})

describe('matterMatchesSearch (FILE-10)', () => {
  const matter: GpMatter = {
    ...BLANK_GP_MATTER_FIELDS,
    id: 'm1',
    matterNumber: 'AB-2026-0007',
    createdAt: 0,
    clientName: 'Rivera, Ana',
    claimNumber: 'CLM-55812',
    dateOfLoss: '2026-01-05',
    insurerCompany: 'Northern Mutual'
  }

  it('matches on client name, matter #, claim #, and date of loss, case-insensitively', () => {
    expect(matterMatchesSearch(matter, 'rivera')).toBe(true)
    expect(matterMatchesSearch(matter, '0007')).toBe(true)
    expect(matterMatchesSearch(matter, 'clm-558')).toBe(true)
    expect(matterMatchesSearch(matter, '2026-01-05')).toBe(true)
  })

  it('matches everything for a blank query and nothing for an unrelated one', () => {
    expect(matterMatchesSearch(matter, '   ')).toBe(true)
    expect(matterMatchesSearch(matter, 'Northern')).toBe(false)
  })
})

describe('definitions', () => {
  it('§7: the default folder template has the twelve top-level folders with their sub-folders', () => {
    expect(DEFAULT_GP_FOLDERS).toHaveLength(12)
    expect(DEFAULT_GP_FOLDERS.find((folder) => folder.name === '02 Correspondence')?.children).toHaveLength(5)
    expect(DEFAULT_GP_FOLDERS.find((folder) => folder.name === '08 LAT')?.children).toHaveLength(4)
  })

  it('WRK-07: the denial limitation date derives from the date received plus two years', () => {
    const field = GP_RECORD_FIELDS.denial.find((candidate) => candidate.key === 'limitationDate')
    expect(field?.plusYearsFrom).toEqual({ field: 'dateReceived', years: 2 })
  })

  it('every record kind has uniquely-keyed fields, starting with one that names the row', () => {
    for (const fields of Object.values(GP_RECORD_FIELDS)) {
      const keys = fields.map((field) => field.key)
      expect(new Set(keys).size).toBe(keys.length)
      expect(fields[0].type).not.toBe('checkbox')
    }
  })
})
