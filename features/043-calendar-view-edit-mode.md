---
id: 043
title: Calendar item view-mode and single-open swap
status: done
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
All in `src/renderer/src/components/CalendarView.test.tsx` (604 → 608 net;
re-run 3x, stable): several existing "click an item" tests genuinely
asserted the old click-opens-edit-directly behavior and were rewritten in
place (not just touched-up) to click through view mode first, rather than
weakened. AC-by-AC:

- AC1: new "clicking an existing item opens a read-only view..." test —
  fields render as text, zero `textbox`/`checkbox` roles present, an Edit
  button, and no Edit Calendar Item dialog. Also covers the recurring case
  (view opens first, 🔁 indicator present, no scope chooser yet).
- AC2: new "clicking Edit switches the panel into the editable form..."
  test (pre-filled fields, same as the old direct-open test used to assert)
  plus the pre-existing recurring/non-recurring scope-chooser tests, now
  reached via an Edit click rather than the item click itself — a
  non-recurring item's Edit still skips the chooser, a recurring item's
  doesn't.
- AC3: new "clicking a different calendar item closes the first panel and
  opens the second, in view mode" — opens one item into edit, clicks a
  second item, and asserts exactly one dialog exists (the second item's
  view), the first is fully gone.
- AC4: unaffected by this feature's existing extensive create-flow
  coverage (unchanged) — the create ternary branch is untouched code.

Also added, as a documented design decision beyond the literal AC text: two
tests confirming Cancel (from the edit form, and from the this-event/series
chooser) returns to the read-only view rather than closing the panel
outright, with no API calls made either way.

Deliberately not covered: real multi-window/Electron behavior (this is a
single in-window panel, nothing new there) and any visual/CSS assertion
beyond class names already implicit in existing conventions.

## Validation Notes
lint/typecheck/build all pass. Full test suite (608/608) re-run 3x, stable.
Confirmed via `git diff` (d84187d..7c578b0) that `/test` touched only
`STATE.md`/`features/*`/the test file — no implementation drift.

All 4 ACs re-verified directly against current source, not just tests:
- AC1: `CalendarItemView` (the read-only branch, `panelMode === 'view'`)
  renders every field as a plain `<span>` — no `<input>`/`<textarea>`/
  `<select>` anywhere in that component, so there is structurally nothing
  for a stray click to edit. Also confirmed by test (zero `textbox`/
  `checkbox` roles present).
- AC2: `startEdit()` flips `panelMode` to `'edit'` on the *same*
  `openOccurrence` (no new state, no remount of a different item) — for a
  non-recurring occurrence it also sets `editScope: 'series'` directly, for
  a recurring one it leaves `editScope: null` so the existing this-event/
  whole-series chooser (itself unchanged) renders next, now correctly
  gated behind `panelMode === 'edit'` so it can't appear while still
  viewing.
- AC3: `openView()` is the only place `openOccurrence` is set from a click,
  and it unconditionally resets `panelMode`/`editScope` to view/null on
  every call — since `openOccurrence` is a single value (not a set/array),
  clicking a second item structurally replaces the first; there is no code
  path that could hold two open at once. Confirmed by test asserting
  exactly one `dialog` role exists after switching.
- AC4: `showCreateForm` is checked first in the render ternary,
  unconditionally, before any `openOccurrence` branch — this code path is
  byte-for-byte unchanged from before the feature. Confirmed by the
  existing (unmodified, still-passing) create-flow test coverage.

One design decision made beyond the literal AC text, flagged for
`/retro`'s awareness: Cancel (from the edit form, or from the this-event/
series chooser) returns to the read-only view rather than closing the
panel outright, on the reasoning that Cancel undoes the edit attempt, not
the fact that you were looking at the item. Explicit Close (from the view
panel) or a successful save/delete still fully close it. This is
documented in Implementation Notes and covered by tests, but the AC itself
doesn't specify either behavior, so if the intended UX was actually
"Cancel always closes," that would need a follow-up.

No live multi-window Electron GUI click-through attempted — no attached
display; same non-blocking gap as every prior feature. All checks pass, no
gaps found.

## Acceptance Log
2026-09-15 — Presented the AC-by-AC mapping and validation summary
(608/608 tests stable, no implementation drift, plus the Cancel-returns-
to-view design decision flagged as a judgment call beyond the literal AC
text). First accept attempt surfaced that the work was on an isolated
worktree branch (`worktree-feature-043-calendar-view-mode`), not merged
into `master`, so the user's local `npm run dev` didn't show it; user
chose to merge/pull it themselves rather than have it pushed to `master`
automatically. After merging and testing, user selected "Accept" via the
accept-stage decision prompt. Decision: **accepted**.
