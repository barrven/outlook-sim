---
id: 044
title: Double-click calendar item opens a pop-out window
status: testing
priority: low
---

## Description
Double-clicking a calendar item opens it in its own separate Electron
window (same pop-out pattern as compose/mail), instead of the inline
view/edit panel from feature 043.

## Acceptance Criteria
- [ ] Double-clicking a calendar item opens a new window showing that item
      (view mode by default, with the same edit affordance as the inline
      panel)
- [ ] Editing/deleting from the pop-out window updates the main window's
      calendar view live, consistent with the app's existing cross-window
      refresh pattern
- [ ] Closing the pop-out doesn't affect the main window's calendar state
- [ ] Single-click inline behavior (feature 043) is unaffected —
      double-click is purely additive

## Implementation Notes
Unlike feature 041's mail pop-out (which reuses `ReadingPane` — already a
self-contained, ID-driven component), the calendar item view/edit/
recurrence-scope state machine was baked directly into `CalendarView.tsx`'s
own render tree, working with `CalendarOccurrence`s (expanded from a
series + recurrence rules, not a simple by-id row). Reusing it required
extraction first:

- **New `src/renderer/src/components/CalendarItemPanel.tsx`**: moved
  `CalendarItemForm`, `CalendarItemView`, `formatEventTime`, and their
  supporting date-format helpers/option constants out of `CalendarView.tsx`
  verbatim (byte-for-byte — including the literal curly-quote characters
  in the scope-chooser prompt, not entities), plus a new `CalendarItemPanel`
  dispatcher component that renders the same 4-branch view/recurrence-
  chooser/edit-series/edit-instance logic feature 043 already had, now
  taking every piece of state (`panelMode`, `editScope`, `seriesForEdit`)
  and every mutation callback as props rather than owning them — a pure,
  behavior-preserving code-motion refactor (confirmed by the full existing
  suite passing unchanged afterward, no `CalendarView.test.tsx` update
  needed).
- **`CalendarView.tsx`**: now imports `CalendarItemPanel`/`CalendarItemForm`/
  `formatEventTime` from the new file; its own state/handlers
  (`openOccurrence`, `panelMode`, `editScope`, `handleUpdateSeries`, etc.)
  are unchanged, just passed down to `<CalendarItemPanel>` instead of
  inlining the render ternary. Also gained: a double-click handler
  (`openPopout`) on both day- and month-view item buttons, purely additive
  alongside the existing single-click `openView` (AC4); and an
  `onCalendarItemsChanged` listener that refetches (AC2, see below).

**Cross-window broadcast (AC2) — new for calendar items.** Unlike
messages, calendar item IPC handlers never broadcast to other windows
before this feature (`CalendarView` only ever refetched after its own
local mutations). Added `broadcastCalendarItemsChanged()` in
`main/data/ipc.ts` (mirrors `broadcastMessagesChanged`), wired into the
`db:calendarItems:create/update/delete` handlers, plus a new
`onCalendarItemsChanged` preload API. `CalendarView.tsx` and the new
pop-out both listen and refetch — this is what makes edits from either
window show up live in the other.

**New pop-out plumbing (AC1)**, mirroring feature 041's pattern exactly:
`createCalendarPopoutWindow` in `main/windows.ts`, a
`window:openCalendarPopout` IPC handler in `main/index.ts` (looks up the
series' title for the window title), a `calendarPopout.open(seriesId,
originalStartTime)` preload API, and `main.tsx` routing a
`calendarPopout=1&seriesId=…&originalStartTime=…` query string to the new
`CalendarPopoutWindow`.

**`CalendarPopoutWindow.tsx`**: since an occurrence isn't a standalone
row, it fetches the full items list, finds the series by id, and
re-expands the *exact* occurrence via
`expandOccurrences([series], originalStartTime, originalStartTime + 1)` —
a 1ms-wide range guarantees at most one natural occurrence time in it,
correctly identifying the occurrence even if an exception has since moved
its *displayed* start time elsewhere (`expandOccurrences` ranges against
the natural, un-excepted time). Renders view mode by default via the same
`CalendarItemPanel` (AC1's "same edit affordance as the inline panel").
Save/delete (any scope) call the real IPC then `window.close()` — the
pop-out's equivalent of the inline panel's `closePanel()`, since there's
no grid behind it to return to; Cancel still just returns to view mode,
matching the inline panel exactly. If the occurrence vanishes entirely
(deleted from elsewhere while this window was open), it closes itself
rather than showing a dead window — tracked via a `hasFetched` flag,
*not* `items.length`, since the latter can't distinguish "haven't fetched
yet" from "fetched and this was the only item, now gone" (a real bug
caught and fixed via the live verification below).

Verified live: a throwaway RTL script confirmed double-click calls
`calendarPopout.open` with the right `seriesId`/`originalStartTime` while
single-click inline view keeps working unaffected (AC4); the pop-out
shows view mode by default, Edit reaches the form, and Save calls the
real update IPC then closes the window (AC1/AC2); and the pop-out closes
itself when the broadcast fires after the item is deleted elsewhere
(AC2/AC3 — closing doesn't touch the main window's own state, since the
pop-out is a fully separate `BrowserWindow`/renderer process with no
shared React state, same structural argument as feature 041's AC3).
lint/typecheck/build pass; full suite unchanged at 688/688 (the
`CalendarView.tsx` refactor is behavior-preserving, and no existing test
exercised calendar cross-window broadcast or the new pop-out, so nothing
needed updating — new coverage is `/test`'s job).

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
