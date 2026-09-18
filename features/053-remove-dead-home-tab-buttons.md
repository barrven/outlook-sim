---
id: 053
title: Ribbon — Home tab: remove dead placeholder buttons
status: done
priority: low
---

## Description
Remove the Home tab's always-disabled placeholder action buttons ("New
Items", "Reply", "Reply All", "Forward" — none have a wired handler) so
only "New Email" and "Delete" remain. Same treatment as feature 033's
removal of the Send/Receive and Folder ribbon tabs: hide dead UI entirely
rather than show it permanently disabled.

## Acceptance Criteria
- [x] The Home tab's action row no longer renders "New Items", "Reply",
      "Reply All", or "Forward" buttons
- [x] "New Email" and "Delete" remain, wired exactly as before
- [x] Calendar module's ribbon actions ("New Event") and the View tab's
      actions (Tasks, Reading Pane) are unaffected

## Implementation Notes
Done directly by the user, outside the normal `/implement` flow — commit
`3158af7` ("made some manual changes to the styling to make it not suck so
bad.", 2026-09-17), landed before this feature was formally picked up.
`RibbonBar.tsx`'s `MAIL_ACTIONS` was reduced from
`['New Email', 'New Items', 'Delete', 'Reply', 'Reply All', 'Forward']` to
`['New Email', 'Delete']` — same treatment as feature 033's removal of the
Send/Receive and Folder ribbon tabs (hide dead UI entirely, don't show it
permanently disabled). `actionHandlers` never had entries for the removed
four anyway (they never had real handlers), so nothing else needed
touching — `CALENDAR_ACTIONS`, `VIEW_ACTIONS`, and the Reading Pane
`<select>` are all rendered through separate, untouched code paths (AC3).

While picking this up for `/accept`, found and fixed one leftover: a
stale comment above `ACTION_COLOR_CLASS` still said "Reply/Reply All/
Forward/New Items have none yet and stay neutral" as if they were still
present-but-unwired, when they're actually gone entirely now — reworded
to describe the removal accurately, and moved the removal note to sit
with the `MAIL_ACTIONS` declaration itself. Also relabeled an existing
test from a leftover "058:" prefix to "053 AC1/AC2:" (it already asserted
exactly what this feature's ACs ask for, just from before 053 existed as
a formal feature) — no assertion changes, comment/label accuracy only.

## Test Notes
Coverage already existed from the same manual commit, in
`RibbonBar.test.tsx` (relabeled during this pass, no assertion changes):
AC1/AC2 — with `activeModule="mail"`, "New Email" and "Delete" render
(and remain wired: separate pre-existing tests exercise their `onClick`
handlers), while `['Reply', 'Reply All', 'Forward', 'New Items']` are all
confirmed absent from the document. AC3 has broad pre-existing coverage
that was never touched by this change and continues to pass unmodified:
several `activeModule="calendar"` tests confirm "New Event" renders/
enables/disables/fires correctly, and the View-tab/Tasks-toggle/Reading-
Pane-select tests are all independent of `MAIL_ACTIONS`. No new tests
added — the existing suite already covers every AC.

## Validation Notes
lint/typecheck/build pass; full suite (846/846) re-run 3x, stable —
unchanged from before this pass, since the comment/label fixes touched no
assertions. `git log -p -- src/renderer/src/components/RibbonBar.tsx`
confirms the exact `MAIL_ACTIONS` reduction landed in commit `3158af7`
(2026-09-17), already on `master`, already built on by every feature
since (050-052) without incident.

All 3 ACs verified directly against current source:
- **AC1**: `MAIL_ACTIONS = ['New Email', 'Delete']` — grepped the whole
  file for "New Items"/"Reply All"/"'Reply'"/"Forward"; the only
  remaining hit is the (now-corrected) comment, no JSX or handler
  references anywhere.
- **AC2**: `actionHandlers` still maps `'New Email': onNewEmail` and
  `Delete: onDelete` exactly as before; both call sites (`RibbonBar`
  props, `App.tsx`'s wiring) untouched by this diff.
- **AC3**: `const actions = viewTabActive ? VIEW_ACTIONS :
  activeModule === 'mail' ? MAIL_ACTIONS : CALENDAR_ACTIONS` — Calendar's
  `CALENDAR_ACTIONS = ['New Event']` and View's `VIEW_ACTIONS = ['Tasks']`
  are separate constants, neither touched; the Reading Pane mode control
  is a `<select>` rendered outside the `actions.map()` loop entirely.

All checks pass, no blocking gaps found. This is a documentation/
housekeeping pass over work already on `master`, not a fresh
implement→test→validate cycle — flagged explicitly in the Acceptance Log.

## Acceptance Log
2026-09-18 — user: "I already did this task 053 ... you can mark it done
and check my work. nothing really to implement." Verified the existing
`master` state (commit `3158af7`) against all 3 ACs directly, confirmed
full suite green (846/846, stable), fixed one stale comment and one
stale test label found along the way (no behavior/assertion changes).
Decision: accepted, on the user's explicit instruction to mark it done.
