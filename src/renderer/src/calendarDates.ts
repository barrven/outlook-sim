// Pure date math for the calendar views, kept free of React so it can be
// unit-tested directly. All calculations use the viewer's local timezone
// (same as the native `datetime-local` inputs the create-event form uses).

export type CalendarViewId = 'day' | 'workWeek' | 'week' | 'month'

const MONTH_GRID_DAYS = 42 // 6 weeks, enough to cover any month's Sunday-start grid

export function startOfDayMs(ms: number): number {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function addDaysMs(ms: number, days: number): number {
  const date = new Date(ms)
  date.setDate(date.getDate() + days)
  return date.getTime()
}

export function isSameDay(aMs: number, bMs: number): boolean {
  return startOfDayMs(aMs) === startOfDayMs(bMs)
}

// Sunday-start week, matching the classic Outlook Week view default.
export function startOfWeekMs(ms: number): number {
  const date = new Date(startOfDayMs(ms))
  date.setDate(date.getDate() - date.getDay())
  return date.getTime()
}

export function getVisibleDays(view: CalendarViewId, anchorMs: number): number[] {
  switch (view) {
    case 'day':
      return [startOfDayMs(anchorMs)]
    case 'workWeek': {
      const monday = addDaysMs(startOfWeekMs(anchorMs), 1)
      return Array.from({ length: 5 }, (_, i) => addDaysMs(monday, i))
    }
    case 'week': {
      const sunday = startOfWeekMs(anchorMs)
      return Array.from({ length: 7 }, (_, i) => addDaysMs(sunday, i))
    }
    case 'month': {
      const date = new Date(anchorMs)
      const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).getTime()
      const gridStart = startOfWeekMs(firstOfMonth)
      return Array.from({ length: MONTH_GRID_DAYS }, (_, i) => addDaysMs(gridStart, i))
    }
  }
}

export function shiftAnchor(view: CalendarViewId, anchorMs: number, direction: 1 | -1): number {
  if (view === 'day') return addDaysMs(anchorMs, direction)
  if (view === 'workWeek' || view === 'week') return addDaysMs(anchorMs, 7 * direction)
  const date = new Date(anchorMs)
  date.setDate(1)
  date.setMonth(date.getMonth() + direction)
  return date.getTime()
}

const DAY_FORMAT = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric'
})
const MONTH_DAY_FORMAT = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const MONTH_DAY_YEAR_FORMAT = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
})
const MONTH_YEAR_FORMAT = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })

export function formatRangeLabel(view: CalendarViewId, anchorMs: number): string {
  if (view === 'day') return DAY_FORMAT.format(new Date(anchorMs))
  if (view === 'month') return MONTH_YEAR_FORMAT.format(new Date(anchorMs))
  const days = getVisibleDays(view, anchorMs)
  const first = days[0]
  const last = days[days.length - 1]
  return `${MONTH_DAY_FORMAT.format(new Date(first))} – ${MONTH_DAY_YEAR_FORMAT.format(new Date(last))}`
}

