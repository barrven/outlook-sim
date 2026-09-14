import { describe, expect, it } from 'vitest'
import { expandOccurrences, upsertException, type CalendarOccurrence } from './recurrence'
import type { CalendarItem, CalendarRecurrenceException } from './data-types'

function day(year: number, monthIndex: number, dayOfMonth: number, hours = 0, minutes = 0): number {
  return new Date(year, monthIndex, dayOfMonth, hours, minutes).getTime()
}

function baseItem(overrides: Partial<CalendarItem> = {}): CalendarItem {
  return {
    id: 'series-1',
    title: 'Standup',
    description: 'Daily sync',
    startTime: day(2026, 0, 5, 9, 0), // Mon Jan 5 2026, 9:00am
    endTime: day(2026, 0, 5, 9, 30),
    allDay: false,
    reminderMinutesBefore: null,
    recurrenceRule: 'daily',
    recurrenceExceptions: [],
    itemType: 'event',
    remindersFired: [],
    ...overrides
  }
}

function titles(occurrences: CalendarOccurrence[]): string[] {
  return occurrences.map((o) => o.title)
}

function dates(occurrences: CalendarOccurrence[]): string[] {
  return occurrences.map((o) => new Date(o.startTime).toDateString())
}

describe('expandOccurrences — non-recurring items', () => {
  it('returns the item once, unchanged, when its startTime falls in range', () => {
    const item = baseItem({ recurrenceRule: null })
    const result = expandOccurrences([item], day(2026, 0, 1), day(2026, 0, 31))
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      seriesId: 'series-1',
      originalStartTime: item.startTime,
      isRecurring: false,
      hasOverride: false,
      title: 'Standup',
      startTime: item.startTime,
      endTime: item.endTime
    })
  })

  it('returns nothing when its startTime falls outside the range', () => {
    const item = baseItem({ recurrenceRule: null, startTime: day(2026, 1, 1), endTime: null })
    const result = expandOccurrences([item], day(2026, 0, 1), day(2026, 0, 31))
    expect(result).toEqual([])
  })
})

describe('expandOccurrences — daily recurrence', () => {
  it('produces one occurrence per day across the range, inheriting the template fields', () => {
    const rangeStart = day(2026, 0, 5)
    const rangeEnd = day(2026, 0, 12) // 7 days exclusive
    const result = expandOccurrences([baseItem()], rangeStart, rangeEnd)
    expect(result).toHaveLength(7)
    expect(dates(result)).toEqual([
      'Mon Jan 05 2026',
      'Tue Jan 06 2026',
      'Wed Jan 07 2026',
      'Thu Jan 08 2026',
      'Fri Jan 09 2026',
      'Sat Jan 10 2026',
      'Sun Jan 11 2026'
    ])
    expect(result.every((o) => o.title === 'Standup' && o.isRecurring && !o.hasOverride)).toBe(true)
    // Duration (30 min) preserved on every occurrence.
    expect(result.every((o) => o.endTime === o.startTime + 30 * 60_000)).toBe(true)
  })

  it('only includes occurrences that actually fall within the range, not ones before its start', () => {
    // Series starts Jan 5; asking for a range entirely before that.
    const result = expandOccurrences([baseItem()], day(2025, 11, 1), day(2025, 11, 31))
    expect(result).toEqual([])
  })

  it('finds the first in-range occurrence when the series started well before the visible range', () => {
    const result = expandOccurrences([baseItem()], day(2026, 0, 20), day(2026, 0, 22))
    expect(dates(result)).toEqual(['Tue Jan 20 2026', 'Wed Jan 21 2026'])
  })

  it('steps by calendar day, not a fixed 24h offset, so it stays correct across a DST transition', () => {
    // US DST started 2026-03-08; a daily 9am event must stay at 9am, not
    // drift to 8am/10am, the week after.
    const item = baseItem({ startTime: day(2026, 2, 5, 9, 0), endTime: null })
    const result = expandOccurrences([item], day(2026, 2, 5), day(2026, 2, 12))
    expect(result.every((o) => new Date(o.startTime).getHours() === 9)).toBe(true)
  })
})

describe('expandOccurrences — weekly recurrence', () => {
  it('produces one occurrence every 7 days on the same weekday', () => {
    const result = expandOccurrences(
      [baseItem({ recurrenceRule: 'weekly' })],
      day(2026, 0, 1),
      day(2026, 1, 5)
    )
    expect(dates(result)).toEqual([
      'Mon Jan 05 2026',
      'Mon Jan 12 2026',
      'Mon Jan 19 2026',
      'Mon Jan 26 2026',
      'Mon Feb 02 2026'
    ])
  })
})

describe('expandOccurrences — monthly recurrence', () => {
  it('recurs on the same day-of-month', () => {
    const item = baseItem({ recurrenceRule: 'monthly', startTime: day(2026, 0, 15, 9, 0), endTime: null })
    const result = expandOccurrences([item], day(2026, 0, 1), day(2026, 3, 1))
    expect(dates(result)).toEqual(['Thu Jan 15 2026', 'Sun Feb 15 2026', 'Sun Mar 15 2026'])
  })

  it('clamps to the last day of a shorter month, and returns to the full day-of-month once it fits again (regression: must not permanently downgrade)', () => {
    const item = baseItem({
      recurrenceRule: 'monthly',
      startTime: day(2026, 0, 31, 9, 0),
      endTime: day(2026, 0, 31, 9, 30)
    })
    const result = expandOccurrences([item], day(2026, 0, 1), day(2026, 3, 1))
    // Jan 31 -> Feb clamps to 28 (2026 isn't a leap year) -> Mar must go
    // back to 31, not stay clamped at 28.
    expect(dates(result)).toEqual(['Sat Jan 31 2026', 'Sat Feb 28 2026', 'Tue Mar 31 2026'])
  })

  it('preserves time-of-day across the month step', () => {
    const item = baseItem({ recurrenceRule: 'monthly', startTime: day(2026, 0, 15, 14, 45), endTime: null })
    const result = expandOccurrences([item], day(2026, 0, 1), day(2026, 2, 1))
    expect(result.every((o) => new Date(o.startTime).getHours() === 14 && new Date(o.startTime).getMinutes() === 45)).toBe(
      true
    )
  })
})

describe('expandOccurrences — exceptions', () => {
  const rangeStart = day(2026, 0, 5)
  const rangeEnd = day(2026, 0, 12)

  it('skips an occurrence with a deleted exception, leaving the rest of the series intact', () => {
    const exceptions: CalendarRecurrenceException[] = [
      { originalStartTime: day(2026, 0, 7, 9, 0), deleted: true }
    ]
    const result = expandOccurrences([baseItem({ recurrenceExceptions: exceptions })], rangeStart, rangeEnd)
    expect(result).toHaveLength(6)
    expect(dates(result)).not.toContain('Wed Jan 07 2026')
  })

  it('overrides just one occurrence with the exception fields, leaving other occurrences at their natural values', () => {
    const exceptions: CalendarRecurrenceException[] = [
      {
        originalStartTime: day(2026, 0, 7, 9, 0),
        deleted: false,
        title: 'Standup (moved)',
        description: 'Moved to 10am',
        startTime: day(2026, 0, 7, 10, 0),
        endTime: day(2026, 0, 7, 10, 30),
        allDay: false,
        reminderMinutesBefore: 15,
        itemType: 'event'
      }
    ]
    const result = expandOccurrences([baseItem({ recurrenceExceptions: exceptions })], rangeStart, rangeEnd)
    expect(result).toHaveLength(7)
    const moved = result.find((o) => o.originalStartTime === day(2026, 0, 7, 9, 0))
    expect(moved).toMatchObject({
      hasOverride: true,
      title: 'Standup (moved)',
      startTime: day(2026, 0, 7, 10, 0),
      reminderMinutesBefore: 15
    })
    // Every other occurrence is untouched.
    const untouched = result.filter((o) => o.originalStartTime !== day(2026, 0, 7, 9, 0))
    expect(untouched.every((o) => o.title === 'Standup' && !o.hasOverride)).toBe(true)
  })

  it('matches exceptions by natural start time, not the occurrence\'s current index/position', () => {
    // Two exceptions on non-adjacent days shouldn't cross-apply.
    const exceptions: CalendarRecurrenceException[] = [
      { originalStartTime: day(2026, 0, 6, 9, 0), deleted: true },
      {
        originalStartTime: day(2026, 0, 9, 9, 0),
        deleted: false,
        title: 'Standup (renamed)',
        description: '',
        startTime: day(2026, 0, 9, 9, 0),
        endTime: null,
        allDay: false,
        reminderMinutesBefore: null,
        itemType: 'event'
      }
    ]
    const result = expandOccurrences([baseItem({ recurrenceExceptions: exceptions })], rangeStart, rangeEnd)
    expect(dates(result)).not.toContain('Tue Jan 06 2026')
    expect(titles(result).filter((t) => t === 'Standup (renamed)')).toHaveLength(1)
    expect(titles(result).filter((t) => t === 'Standup')).toHaveLength(5)
  })
})

describe('expandOccurrences — multiple items', () => {
  it('returns occurrences from every item, sorted by start time', () => {
    const other = baseItem({
      id: 'series-2',
      title: 'Retro',
      recurrenceRule: null,
      startTime: day(2026, 0, 6, 8, 0),
      endTime: null
    })
    const result = expandOccurrences([baseItem(), other], day(2026, 0, 5), day(2026, 0, 8))
    expect(result.map((o) => o.title)).toEqual(['Standup', 'Retro', 'Standup', 'Standup'])
  })
})

describe('upsertException', () => {
  it('appends a new exception', () => {
    const result = upsertException([], { originalStartTime: 100, deleted: true })
    expect(result).toEqual([{ originalStartTime: 100, deleted: true }])
  })

  it('replaces an existing exception for the same originalStartTime rather than duplicating it', () => {
    const first: CalendarRecurrenceException = { originalStartTime: 100, deleted: true }
    const second: CalendarRecurrenceException = {
      originalStartTime: 100,
      deleted: false,
      title: 'Edited',
      description: '',
      startTime: 200,
      endTime: null,
      allDay: false,
      reminderMinutesBefore: null,
      itemType: 'event'
    }
    const result = upsertException([first], second)
    expect(result).toEqual([second])
  })

  it('leaves exceptions for other occurrences untouched', () => {
    const other: CalendarRecurrenceException = { originalStartTime: 999, deleted: true }
    const next: CalendarRecurrenceException = { originalStartTime: 100, deleted: true }
    const result = upsertException([other], next)
    expect(result).toEqual([other, next])
  })
})
