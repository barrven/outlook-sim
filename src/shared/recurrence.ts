// Pure logic for expanding a recurring CalendarItem into individual
// occurrences within a visible date range, kept free of React so it can be
// unit-tested directly (same convention as calendarDates.ts) and shared
// between the renderer's calendar view and the main process's reminder
// scheduler (feature 026), which both need to know an individual
// occurrence's actual (possibly exception-overridden) start time.
//
// A recurring series is stored as a single CalendarItem (the "template"):
// its own title/description/startTime/endTime/allDay/reminderMinutesBefore/
// itemType are the pattern every occurrence inherits unless that specific
// occurrence has a CalendarRecurrenceException. Occurrences are computed on
// the fly, never persisted individually — only the template row and its
// exceptions live in the database.
import type { CalendarItem, CalendarItemType, CalendarRecurrenceException } from './data-types'

export interface CalendarOccurrence {
  // The template CalendarItem's id — use this to find/patch the series row.
  seriesId: string
  // This occurrence's un-excepted start time; stays stable across repeated
  // edits, so it's the correct key for creating/updating an exception even
  // when the occurrence's *displayed* startTime has itself been overridden.
  originalStartTime: number
  isRecurring: boolean
  hasOverride: boolean
  title: string
  description: string
  startTime: number
  endTime: number | null
  allDay: boolean
  reminderMinutesBefore: number | null
  itemType: CalendarItemType
}

// Defensive cap on how many steps to walk forward from a series' own
// startTime while searching for occurrences in range — should never be hit
// in practice (100,000 daily steps alone covers ~270 years), but guards
// against a runaway loop if a future change introduces a zero/negative step.
const MAX_OCCURRENCE_ITERATIONS = 100_000

// Steps a timestamp forward by one daily/weekly occurrence, using
// local-calendar-date arithmetic (Date's setDate) rather than a fixed
// millisecond offset, so results stay correct across DST transitions — same
// approach calendarDates.ts already uses for day math.
function stepDailyOrWeekly(ms: number, frequency: 'daily' | 'weekly'): number {
  const date = new Date(ms)
  date.setDate(date.getDate() + (frequency === 'daily' ? 1 : 7))
  return date.getTime()
}

// The Nth monthly occurrence after `anchorMs`, always clamped from the
// anchor's own day-of-month (not from whatever the previous occurrence
// clamped to) — otherwise a recurrence anchored on the 31st that clamps to
// the 28th in February would incorrectly stay clamped at 28 in March
// instead of returning to the 31st.
function monthlyOccurrenceAt(anchorMs: number, monthsAhead: number): number {
  const anchor = new Date(anchorMs)
  const target = new Date(anchor)
  target.setDate(1)
  target.setMonth(target.getMonth() + monthsAhead)
  const daysInTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(anchor.getDate(), daysInTargetMonth))
  return target.getTime()
}

// The occurrence start times a series would produce within
// [rangeStartMs, rangeEndExclusiveMs), before any exceptions are applied.
// A non-recurring item is just its own startTime, if that falls in range.
function naturalOccurrenceTimes(item: CalendarItem, rangeStartMs: number, rangeEndExclusiveMs: number): number[] {
  if (!item.recurrenceRule) {
    return item.startTime >= rangeStartMs && item.startTime < rangeEndExclusiveMs ? [item.startTime] : []
  }
  const times: number[] = []
  let iterations = 0
  if (item.recurrenceRule === 'monthly') {
    let monthsAhead = 0
    let occurrence = monthlyOccurrenceAt(item.startTime, monthsAhead)
    while (occurrence < rangeEndExclusiveMs && iterations < MAX_OCCURRENCE_ITERATIONS) {
      if (occurrence >= rangeStartMs) times.push(occurrence)
      monthsAhead++
      occurrence = monthlyOccurrenceAt(item.startTime, monthsAhead)
      iterations++
    }
    return times
  }
  const frequency = item.recurrenceRule
  let cursor = item.startTime
  while (cursor < rangeEndExclusiveMs && iterations < MAX_OCCURRENCE_ITERATIONS) {
    if (cursor >= rangeStartMs) times.push(cursor)
    cursor = stepDailyOrWeekly(cursor, frequency)
    iterations++
  }
  return times
}

/**
 * Expands every item into its occurrences that fall within
 * [rangeStartMs, rangeEndExclusiveMs), applying each series' recurrence
 * exceptions (skipping deleted occurrences, overriding edited ones), and
 * returns them sorted by start time.
 */
export function expandOccurrences(
  items: CalendarItem[],
  rangeStartMs: number,
  rangeEndExclusiveMs: number
): CalendarOccurrence[] {
  const occurrences: CalendarOccurrence[] = []
  for (const item of items) {
    const naturalTimes = naturalOccurrenceTimes(item, rangeStartMs, rangeEndExclusiveMs)
    const durationMs = item.endTime !== null ? item.endTime - item.startTime : null
    for (const naturalStart of naturalTimes) {
      const exception = item.recurrenceExceptions.find((candidate) => candidate.originalStartTime === naturalStart)
      if (exception?.deleted) continue
      occurrences.push(
        exception
          ? {
              seriesId: item.id,
              originalStartTime: naturalStart,
              isRecurring: item.recurrenceRule !== null,
              hasOverride: true,
              title: exception.title,
              description: exception.description,
              startTime: exception.startTime,
              endTime: exception.endTime,
              allDay: exception.allDay,
              reminderMinutesBefore: exception.reminderMinutesBefore,
              itemType: exception.itemType
            }
          : {
              seriesId: item.id,
              originalStartTime: naturalStart,
              isRecurring: item.recurrenceRule !== null,
              hasOverride: false,
              title: item.title,
              description: item.description,
              startTime: naturalStart,
              endTime: durationMs !== null ? naturalStart + durationMs : null,
              allDay: item.allDay,
              reminderMinutesBefore: item.reminderMinutesBefore,
              itemType: item.itemType
            }
      )
    }
  }
  return occurrences.sort((a, b) => a.startTime - b.startTime)
}

/**
 * Returns a series' recurrenceExceptions with `next` inserted in place of
 * any existing exception for the same occurrence (matched by
 * originalStartTime) — the correct way to both create a new exception and
 * update a previously-excepted occurrence again.
 */
export function upsertException(
  exceptions: CalendarRecurrenceException[],
  next: CalendarRecurrenceException
): CalendarRecurrenceException[] {
  return [...exceptions.filter((exception) => exception.originalStartTime !== next.originalStartTime), next]
}
