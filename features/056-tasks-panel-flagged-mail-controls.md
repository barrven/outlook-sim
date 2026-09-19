---
id: 056
title: Tasks panel — unflag and pop-out controls on Flagged Mail rows
status: validating
priority: low
---

## Description
Each row in the Tasks panel's Flagged Mail list is currently just static
subject text with no controls at all. Add an unflag control per row, and a
double-click handler that opens the message in its pop-out reading window
— the same as double-clicking it in the main message list.

## Acceptance Criteria
- [ ] Each Flagged Mail row has a control to unflag that message directly,
      without navigating to the message list or Reading Pane
- [ ] Unflagging from this list updates the message's `isFlagged` state via
      the real data API, and the row disappears from the list (no longer
      flagged)
- [ ] Double-clicking a Flagged Mail row opens that message in its own
      pop-out reading window (`window.api.messagePopout.open`), the same
      as double-clicking it in the message list
- [ ] The unflag control and the double-click handler don't interfere with
      each other (clicking the unflag control doesn't also trigger the
      pop-out)

## Implementation Notes
Scoped to `TasksPanel.tsx` + `global.css`. Each Flagged Mail `<li>` now
renders two sibling `<button>`s instead of plain text — same structural
pattern `MessageListPane.tsx` already uses for its row-button + flag-button
pair (never nested inside each other, so a `dblclick` on one can never
bubble into the other's handler):
- `.tasks-panel-flagged-subject` — the message subject, with
  `onDoubleClick={() => window.api.messagePopout.open(message.id)}`
  (AC3, the exact same call `MessageListPane.tsx` uses for the main list).
- `.tasks-panel-flagged-unflag` — a new `handleUnflagMessage` calling
  `window.api.data.messages.update(message.id, { isFlagged: false })`
  (AC1). No local refetch needed: this update triggers the same
  `db:messages:update` → `broadcastMessagesChanged` → `messagesVersion`
  bump App.tsx already wires up, and `TasksPanel`'s own
  `flaggedMessages` effect is already keyed on `messagesVersion` — so the
  row disappears once the broadcast round-trips, the same live-update
  path every other flag toggle in the app already relies on (AC2).

**AC4 (no interference):** solved structurally, not with
`stopPropagation()` — since the two buttons are siblings rather than
nested, a double-click on the unflag button fires only its own `onClick`
(twice, standard double-click behavior) and never reaches the subject
button's `onDoubleClick`, because DOM event bubbling only travels up an
element's own ancestor chain, never sideways to siblings.

New CSS: `.tasks-panel-flagged-item` became a flex row (mirroring
`.tasks-panel-task`'s existing layout); `.tasks-panel-flagged-subject` is
an unstyled, left-aligned, flexible-width button (visually identical to
the old plain text); `.tasks-panel-flagged-unflag` mirrors
`.message-list-flag-btn.flagged`'s flag-colored icon-button look
(`color: var(--flag-border)`).

Verified live via a throwaway RTL script (not committed): the unflag
button calls `messages.update` with `{ isFlagged: false }`; double-
clicking the subject calls `messagePopout.open` with the right id;
double-clicking the unflag button itself never calls
`messagePopout.open` (only its own `onClick` fires, twice). lint/
typecheck/build pass; full suite unchanged at 856/856 (no new
feature-specific tests yet — that's `/test`'s job).

## Test Notes
856 → 861 net (+5, all passing; re-run 3x, stable), all in the existing
`TasksPanel.test.tsx`'s new "056" block.

AC1: clicking the unflag button calls `messages.update(id, { isFlagged:
false })` — the real data API, not a local-only toggle. AC2: after that
call, simulating the same broadcast-driven `messagesVersion` bump the
existing 046 AC2 test already exercises (a `rerender` with the mock list
now excluding the message) makes the row disappear — confirming this
component's existing refetch path is what removes it, no new local-state
mutation added. AC3: double-clicking the subject calls
`messagePopout.open` with the message's real id. AC4: two tests —
double-clicking the unflag button never calls `messagePopout.open`, and
double-clicking the subject never calls the unflag API — covering
non-interference in both directions, not just one.

Deliberately uncovered: the actual rendered visual layout of the two
side-by-side buttons (no attached display, same non-blocking gap as
every prior CSS-touching feature). lint/typecheck/build all pass.

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
