---
id: 044
title: Double-click calendar item opens a pop-out window
status: accept
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
688 → 705 net (+17, all passing; re-run 3x, stable), across 4 files:

- New `src/renderer/src/CalendarPopoutWindow.test.tsx` (+11, mirroring
  `MessagePopoutWindow.test.tsx`'s structure): AC1 view mode by default
  via the real content, Edit reaches the pre-filled form for a
  non-recurring item, a recurring item shows the this-event/whole-series
  chooser first; AC2 Save/Delete (series and single-instance-via-
  exception) call the real `calendarItems.update`/`delete` IPC then close
  the window, and a `data:calendar-items-changed` broadcast refetches
  live content into this window too (plus subscribe/unsubscribe
  lifecycle); AC3 is structural, not unit-tested here (same call this
  project made for feature 041 — a separate window/process with no
  shared React state to assert against at this layer); a design-decision
  test (mirroring feature 043's own convention) confirms Close/Cancel
  distinguish "close the window" from "back to view mode" the same way
  the inline panel does. Also covers the real bug found and fixed during
  `/implement`: the pop-out closes itself if the item vanishes after a
  broadcast-triggered refetch.
- `CalendarView.test.tsx` (+4, AC1/AC2/AC4): double-click opens the
  pop-out with the right `seriesId`/`originalStartTime` in both the day
  and month views (two separate render paths this feature touched);
  single-click inline view still works with the pop-out API left
  uncalled (AC4, "purely additive"); the main window's own view refetches
  on the new broadcast too.
- `src/main/data/ipc.test.ts` (+1): a calendar-item create/update/delete
  through the real IPC handlers broadcasts `data:calendar-items-changed`
  to every open window — mirrors the existing messages-changed broadcast
  test exactly, now that calendar items have the same mechanism.
- `src/main/windows.test.ts` (+1): the calendar pop-out window gets the
  same icon as the main window, extending feature 036's existing
  same-icon-everywhere coverage to the new window-creation site.

Deliberately not covered: a live multi-window Electron GUI click-through
(no attached display, same non-blocking gap as every prior pop-out
feature) and the `CalendarView.tsx` refactor's own correctness — not
re-tested directly, since the full pre-existing `CalendarView.test.tsx`
suite (43 tests covering feature 043's view/edit/recurrence-scope
behavior) already ran unchanged and green throughout, which is itself
the regression check for a pure code-motion extraction. lint/typecheck/
build all pass.

## Validation Notes
lint/typecheck/build all pass. Full test suite (705/705) re-run 3x,
stable. `git diff --stat` (370eaf9..54e81fe) confirms `/test` touched
only `STATE.md`/feature/backlog docs plus the four test files — no
implementation drift.

All 4 ACs re-verified directly against current source (not just trusting
prior notes):
- AC1 (double-click opens a pop-out, view mode by default with the same
  edit affordance): confirmed `openPopout` wired to `onDoubleClick` on
  both the day- and month-view item buttons; `CalendarPopoutWindow.tsx`
  renders the real `CalendarItemPanel` (the same component the inline
  panel uses) starting in `panelMode: 'view'`.
- AC2 (editing/deleting updates the main window live, cross-window
  pattern): `broadcastCalendarItemsChanged()` is now called from all 3
  `db:calendarItems:*` mutation handlers in `main/data/ipc.ts`; both
  `CalendarView.tsx` and `CalendarPopoutWindow.tsx` subscribe via
  `onCalendarItemsChanged` and refetch — the identical shape
  `broadcastMessagesChanged`/`onMessagesChanged` already established.
- AC3 (closing the pop-out doesn't affect the main window): confirmed
  structurally — `createCalendarPopoutWindow` creates a genuinely
  separate `BrowserWindow`/renderer process (same construction as
  `createMessagePopoutWindow`), and `CalendarPopoutWindow.tsx` has zero
  reference to `App.tsx`/`CalendarView`'s state, only its own local state
  seeded from props.
- AC4 (single-click inline behavior unaffected, double-click purely
  additive): `onClick={() => openView(occurrence)}` is untouched and
  independent of the new `onDoubleClick` handler on the same button; the
  full pre-existing `CalendarView.test.tsx` suite (43 tests covering
  043's inline behavior) ran unchanged and green throughout this
  feature's implement/test stages.

Not independently re-verified: a live multi-window Electron GUI
click-through (no attached display) — same non-blocking gap as every
prior pop-out feature. All checks pass, no gaps found. Phase set to
`accept`.

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
