---
id: 057
title: Tasks panel — Tasks section redesign (inline edit, header Add, due-date sort)
status: testing
priority: low
---

## Description
Redesign the Tasks panel's Tasks section: a header row with the "Tasks"
title and a right-aligned "Add" button that opens the add-task UI below
it; each existing task gets an "Edit" button that opens the same
add/update UI inline, directly below that task's own row; and tasks are
sorted by due date (soonest first), with undated tasks pinned above all
dated ones, newest-created first.

## Acceptance Criteria
- [ ] The Tasks section header shows "Tasks" on the left and an "Add"
      button right-aligned in the same row
- [ ] The add-task form is hidden by default; clicking "Add" opens it
      directly below the header
- [ ] Each existing task has an "Edit" button; clicking it opens the same
      add/update form inline, directly below that specific task's row
- [ ] Only one add/edit form is open at a time — opening one closes any
      other that was open
- [ ] Editing a task's text and/or due date and saving updates that task
      via the real data API
- [ ] Tasks with a due date are sorted ascending by due date; tasks with no
      due date appear above all dated tasks, ordered newest-created first
- [ ] Existing add/toggle-done/remove behavior is otherwise unchanged

## Implementation Notes
Scoped to `TasksPanel.tsx` + `global.css`. The single always-visible add
row is replaced by a shared add/edit form (`taskForm`, a plain JSX
variable rather than a nested component, so its inputs keep normal DOM
identity wherever it's placed — the same technique feature 050 used for
the Persona editor) driven by new state: `creating`, `editingTaskId`,
`taskFormText`, `taskFormDue`, mirroring `PersonasSettings.tsx`'s
`creating`/`editingId` pattern exactly.

- **AC1/AC2:** the Tasks heading is now wrapped in
  `.tasks-panel-section-header` (flex, space-between) alongside a new
  "Add" button; the button (and the empty-state "No tasks yet." message)
  is hidden whenever any form is open (`!isTaskFormOpen`). Clicking it
  calls `openCreateTask()`, which resets the shared form fields and shows
  `taskForm` directly below the header.
- **AC3:** each task's row gained an "Edit" button calling
  `openEditTask(task)`, which pre-fills the shared form and sets
  `editingTaskId`. The `sortedTasks.map()` loop now returns a
  `<Fragment key={task.id}>` containing the task's own `<li>` followed by
  a second `<li className="tasks-panel-form-row">{taskForm}</li>` when
  `editingTaskId === task.id` — same per-item-Fragment technique feature
  050 used to place the Persona editor inline.
- **AC4:** `editingTaskId`/`creating` remain single-valued state
  (structurally never more than one match), so opening any new form
  target is a plain reassignment, not additive — automatically closes
  whichever was open.
- **AC5:** `handleSaveTask()` branches on `editingTaskId`: set → calls
  `window.api.data.tasks.update(editingTaskId, { text, dueAt })` (the
  real data API); unset → calls `tasks.create(...)` as before.
- **AC6:** `sortedTasks` (a `[...tasks].sort(...)` copy — the underlying
  `tasks` state/create-order is untouched) puts every `dueAt === null`
  task first (ties broken by `createdAt` descending, i.e. newest first),
  then dated tasks ascending by `dueAt`.
- **AC7:** `handleToggleDone`/`handleRemoveTask` are unchanged (the latter
  gained one line: if the removed task was mid-edit, also close the form —
  a defensive fix for a dangling-reference edge case, matching
  `PersonasSettings.tsx`'s `handleDelete`'s identical guard, not a
  behavior change to removal itself).

**Date round-trip (not itself an AC, but load-bearing for AC5):** the
existing `handleSaveTask`/old `handleAddTask` write a chosen due date via
`new Date(dateInputValue).getTime()`, and native `<input type="date">`
values parse as **UTC** midnight per the ISO-8601 spec — a pre-existing
quirk from feature 046, left as-is per AC7 ("otherwise unchanged"; a real
UTC-vs-local fix is out of this feature's scope, and
`CalendarItemPanel.tsx` already documents the same quirk for its own
date-only fields). Reading a stored `dueAt` back into the edit form
therefore has to invert that same UTC parse (`dueAtToDateInputValue`,
using `getUTC*` accessors) — using local accessors instead would silently
shift the displayed date by a day in most timezones the moment Edit is
opened, even without the user touching the date field.

New CSS: `.tasks-panel-section-header`/`.tasks-panel-add-btn` for the new
header row; `.tasks-panel-edit` (small, muted button) alongside the
existing `.tasks-panel-remove`; `.tasks-panel-add-row` renamed to
`.tasks-panel-form` (now shared by both add and edit, unstyled beyond
what it already had) with a new `.tasks-panel-form-actions` (Save/Add +
Cancel) and `.tasks-panel-form-row` (the inline-edit `<li>` wrapper).

Verified live via a throwaway RTL script (not committed): the add form is
hidden until "Add" is clicked; Edit opens the form's `<li>` immediately
after the clicked task's own row (confirmed via actual DOM child order),
pre-filled with that task's text/due date; opening a different task's
Edit replaces the open form (exactly one edit-text-field in the
document); Save calls `tasks.update` with the edited fields; sort order
matches AC6 exactly across a 4-task mix of dated/undated; and, critically,
editing a dated task without touching the date and saving reproduces the
exact same `dueAt` timestamp it started with (the date round-trip fix
verified end-to-end, not just unit-tested in isolation). lint/typecheck/
build pass; full suite 856/861 — the 5 pre-existing tests that drove the
old always-visible add row now fail, since AC1/AC2 deliberately changed
that behavior; left for `/test` to rewrite, per this repo's established
convention (e.g. feature 062 left 5 attachment tests failing the same
way).

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
