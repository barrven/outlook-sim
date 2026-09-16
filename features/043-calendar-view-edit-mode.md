---
id: 043
title: Calendar item view-mode and single-open swap
status: testing
priority: medium
---

## Description
Clicking a calendar item now opens the existing item form in a new
read-only "view" mode rather than straight into edit; an explicit action
switches it to edit mode. Clicking a different calendar item while one is
open closes the current one and opens the newly clicked item instead (never
two open at once).

## Acceptance Criteria
- [ ] Clicking a calendar item opens it in a read-only view (fields visible
      but not editable, no accidental edits from a stray click)
- [ ] An explicit "Edit" action switches that same panel into the existing
      editable form
- [ ] While one item's view/edit panel is open, clicking a different
      calendar item closes the first and opens the second in its place
      (view mode)
- [ ] The create-new-item flow is unaffected — it still opens directly in
      an editable, empty form as before

## Implementation Notes
All changes in `src/renderer/src/components/CalendarView.tsx` (+ new CSS in
`src/renderer/src/styles/global.css`), no other files touched.

`CalendarView`'s existing single-item-open state gained a `panelMode: 'view'
| 'edit'` alongside the existing `openOccurrence`/`editScope`. Clicking any
calendar item (`openView`, renamed from `openEdit`) always (re)sets
`openOccurrence` + `panelMode: 'view'` + `editScope: null` — so clicking a
different item while one is already open naturally replaces the single open
panel with the new item in view mode (AC3), no extra "is something already
open" branching needed.

New read-only `CalendarItemView` component (sibling to the existing
`CalendarItemForm`) renders the occurrence's fields as plain text — no
inputs at all, so there's nothing for a stray click to edit (AC1) — plus
Edit/Close actions. `startEdit()` flips `panelMode` to `'edit'`; for a
non-recurring occurrence it also sets `editScope: 'series'` directly
(matching the existing skip-the-chooser behavior for one-off items), while a
recurring occurrence leaves `editScope: null` so the pre-existing
this-event/whole-series chooser renders next, gated by `panelMode ===
'edit'` so it doesn't show while still in view mode (AC2).

Design decision (not explicit in the AC): Cancel from the edit form, or from
the this-event/series chooser, now returns to view mode (`cancelEdit`)
rather than closing the panel outright — you were looking at the item before
you chose to edit it, so backing out of editing shouldn't lose that. A full
close (`closePanel`) still happens on the view panel's own Close button, and
after any successful save/delete.

The create-new-item flow (`showCreateForm`) is a separate prop/branch,
checked first in the render ternary and untouched by any of this — still
opens `CalendarItemForm` directly with no initial item (AC4).

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
