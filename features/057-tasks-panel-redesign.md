---
id: 057
title: Tasks panel — Tasks section redesign (inline edit, header Add, due-date sort)
status: backlog
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
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
