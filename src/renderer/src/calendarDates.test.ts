import { describe, expect, it } from 'vitest'
import {
  addDaysMs,
  formatRangeLabel,
  getVisibleDays,
  isSameDay,
  shiftAnchor,
  startOfDayMs,
  startOfWeekMs
} from './calendarDates'

// Wednesday, March 11, 2026, 3:30pm local time — an arbitrary midweek anchor
// used throughout so every view's math can be checked against known dates.
const WED_MAR_11_2026 = new Date(2026, 2, 11, 15, 30).getTime()

function day(year: number, monthIndex: number, dayOfMonth: number): number {
  return new Date(year, monthIndex, dayOfMonth).getTime()
}

describe('startOfDayMs', () => {
  it('zeroes out the time-of-day, keeping the same calendar day', () => {
    const result = startOfDayMs(WED_MAR_11_2026)
    const date = new Date(result)
    expect(date.getHours()).toBe(0)
    expect(date.getMinutes()).toBe(0)
    expect(date.getSeconds()).toBe(0)
    expect(date.getDate()).toBe(11)
  })
})

describe('addDaysMs', () => {
  it('adds calendar days, not fixed 24h increments (handles a DST spring-forward)', () => {
    // US DST started 2026-03-08; adding a day across it should still land on
    // the 9th at local midnight, not be off by an hour.
    const beforeDst = day(2026, 2, 8)
    const result = addDaysMs(beforeDst, 1)
    expect(new Date(result).getDate()).toBe(9)
    expect(new Date(result).getHours()).toBe(0)
  })

  it('rolls over month and year boundaries', () => {
    expect(new Date(addDaysMs(day(2026, 11, 31), 1)).getFullYear()).toBe(2027)
    expect(new Date(addDaysMs(day(2026, 11, 31), 1)).getMonth()).toBe(0)
  })
})

describe('isSameDay', () => {
  it('is true for two timestamps on the same calendar day regardless of time', () => {
    expect(isSameDay(day(2026, 2, 11), WED_MAR_11_2026)).toBe(true)
  })

  it('is false across a day boundary', () => {
    expect(isSameDay(day(2026, 2, 11), day(2026, 2, 12))).toBe(false)
  })
})

describe('startOfWeekMs', () => {
  it('returns the preceding (or same) Sunday', () => {
    const result = startOfWeekMs(WED_MAR_11_2026)
    expect(new Date(result).getDay()).toBe(0)
    expect(new Date(result).getDate()).toBe(8)
  })

  it('returns the same day when the anchor is already a Sunday', () => {
    const sunday = day(2026, 2, 8)
    expect(startOfWeekMs(sunday)).toBe(startOfDayMs(sunday))
  })
})

describe('getVisibleDays', () => {
  it('day view returns exactly the anchor day', () => {
    const days = getVisibleDays('day', WED_MAR_11_2026)
    expect(days).toEqual([startOfDayMs(WED_MAR_11_2026)])
  })

  it('workWeek view returns Monday through Friday of the anchor week', () => {
    const days = getVisibleDays('workWeek', WED_MAR_11_2026)
    expect(days).toHaveLength(5)
    expect(days.map((d) => new Date(d).getDay())).toEqual([1, 2, 3, 4, 5])
    expect(new Date(days[0]).getDate()).toBe(9)
    expect(new Date(days[4]).getDate()).toBe(13)
  })

  it('week view returns Sunday through Saturday of the anchor week', () => {
    const days = getVisibleDays('week', WED_MAR_11_2026)
    expect(days).toHaveLength(7)
    expect(days.map((d) => new Date(d).getDay())).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(new Date(days[0]).getDate()).toBe(8)
    expect(new Date(days[6]).getDate()).toBe(14)
  })

  it('month view returns a 42-day grid that fully contains every day of the month', () => {
    const days = getVisibleDays('month', WED_MAR_11_2026)
    expect(days).toHaveLength(42)
    expect(days.some((d) => isSameDay(d, day(2026, 2, 1)))).toBe(true)
    expect(days.some((d) => isSameDay(d, day(2026, 2, 31)))).toBe(true)
    // Grid starts on a Sunday and is in strictly increasing day order.
    expect(new Date(days[0]).getDay()).toBe(0)
    for (let i = 1; i < days.length; i++) {
      expect(days[i]).toBeGreaterThan(days[i - 1])
    }
  })

  it('month view for February in a leap year still contains Feb 29', () => {
    const days = getVisibleDays('month', day(2028, 1, 10))
    expect(days.some((d) => isSameDay(d, day(2028, 1, 29)))).toBe(true)
  })
})

describe('shiftAnchor', () => {
  it('day view shifts by one calendar day', () => {
    expect(new Date(shiftAnchor('day', WED_MAR_11_2026, 1)).getDate()).toBe(12)
    expect(new Date(shiftAnchor('day', WED_MAR_11_2026, -1)).getDate()).toBe(10)
  })

  it('week and workWeek views shift by seven days', () => {
    const nextWeek = shiftAnchor('week', WED_MAR_11_2026, 1)
    expect(isSameDay(nextWeek, day(2026, 2, 18))).toBe(true)
    const prevWorkWeek = shiftAnchor('workWeek', WED_MAR_11_2026, -1)
    expect(isSameDay(prevWorkWeek, day(2026, 2, 4))).toBe(true)
  })

  it('month view shifts by a whole month without overflowing on a 31-day-to-shorter-month edge', () => {
    const jan31 = day(2026, 0, 31)
    const nextMonth = shiftAnchor('month', jan31, 1)
    expect(new Date(nextMonth).getMonth()).toBe(1) // February, not overflowed into March
    expect(new Date(nextMonth).getFullYear()).toBe(2026)
  })

  it('month view rolls over year boundaries in both directions', () => {
    const dec = day(2026, 11, 15)
    expect(new Date(shiftAnchor('month', dec, 1)).getFullYear()).toBe(2027)
    expect(new Date(shiftAnchor('month', dec, 1)).getMonth()).toBe(0)

    const jan = day(2026, 0, 15)
    expect(new Date(shiftAnchor('month', jan, -1)).getFullYear()).toBe(2025)
    expect(new Date(shiftAnchor('month', jan, -1)).getMonth()).toBe(11)
  })
})

describe('formatRangeLabel', () => {
  it('day view includes the weekday, month, day, and year', () => {
    const label = formatRangeLabel('day', WED_MAR_11_2026)
    expect(label).toContain('Wednesday')
    expect(label).toContain('March')
    expect(label).toContain('11')
    expect(label).toContain('2026')
  })

  it('month view is just the month and year', () => {
    expect(formatRangeLabel('month', WED_MAR_11_2026)).toBe('March 2026')
  })

  it('week and workWeek views show a first–last range spanning the visible days', () => {
    const weekLabel = formatRangeLabel('week', WED_MAR_11_2026)
    expect(weekLabel).toContain('Mar')
    expect(weekLabel).toContain('8')
    expect(weekLabel).toContain('14')
    expect(weekLabel).toContain('2026')

    const workWeekLabel = formatRangeLabel('workWeek', WED_MAR_11_2026)
    expect(workWeekLabel).toContain('9')
    expect(workWeekLabel).toContain('13')
  })
})
