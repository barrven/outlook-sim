---
id: 040
title: Message list right-click context menu
status: validating
priority: medium
---

## Description
Right-clicking a message (or a multi-selection of messages, feature 039) in
the list opens a context menu with Move to folder, Mark read/unread,
Flag/Unflag, Add to category, Reply/Reply All/Forward, and Delete —
applying to the whole current selection.

## Acceptance Criteria
- [ ] Right-clicking a message shows a context menu with all listed actions
- [ ] Right-clicking within an existing multi-selection keeps that
      selection and applies chosen actions to all of it; right-clicking
      outside the current selection selects just that message first
- [ ] Move to folder shows a submenu/list of available folders and moves
      every selected message there
- [ ] Mark read/unread, Flag/Unflag, and Add to category apply to every
      selected message
- [ ] Reply/Reply All/Forward are only enabled when exactly one message is
      selected; Delete works for any selection size

## Implementation Notes
New `MessageContextMenu.tsx` renders the menu (fixed-positioned at the
click's `clientX`/`clientY`) and closes on Escape or an outside click.
`MessageListPane.tsx` owns the right-click semantics: a `contextMenu` state
holds `{x, y, messageIds}`, where `messageIds` is the existing selection if
the right-clicked row was already part of it, or just that row otherwise
(AC2) — mirroring the existing plain-click selection logic. The menu's
per-item actions (Mark read/unread, Flag/Unflag, Add to category, Move to
folder) run directly against `window.api.data.messages.update` per
message id, the same pattern the existing per-row flag button already
uses — no new IPC/bulk-update endpoint needed (AC3/AC4). Read/Flag toggle
labels are computed from whether *every* targeted message is already
read/flagged, matching the Reading Pane's single-message toggle
convention scaled to a selection. Move to folder lists all folders (no
IPC change; `folders` is a new prop threaded down from `App.tsx`, which
already holds it) and clears the selection afterward, since the moved
messages are about to disappear from the currently viewed list — same
reasoning as Delete.

Reply/Reply All/Forward and Delete reuse `App.tsx`'s existing
`handleReply`/`handleReplyAll`/`handleForward` (passed down as new props,
same functions the Reading Pane already uses) — enabled only for a
single-message target (AC5), enforced both by `disabled` on the menu
buttons and by the callback itself checking `targetMessages.length === 1`
before calling through. Delete needed a new bulk-capable
`handleDeleteMessages` in `App.tsx` (AC5: any selection size) that, per
message, moves it to Deleted Items or — if already there — deletes it
permanently, mirroring the Reading Pane's existing per-folder Delete vs.
"Delete permanently" split, just generalized across a selection and
unified under the single "Delete" label the feature description asks for.

No new IPC channels, shared types, or persistence changes.

Verified live with a throwaway RTL suite (10 cases, all passing) directly
exercising every AC: right-click outside vs. inside an existing
selection, Reply/Reply All/Forward enabled only for exactly one message,
Mark as read/Flag applying to every selected message with correct
mixed-state vs. all-set label switching, Add to category skipping a
message that already has it, Move to folder listing folders and moving +
clearing selection, Delete firing for a 3-message selection, and the menu
closing on Escape/outside click.

Existing `MessageListPane.test.tsx` needed prop-shape touch-ups (a shared
`defaultProps` spread for the 5 new required props) to keep compiling —
no behavioral changes to existing tests. lint/typecheck/build all pass;
full suite 574/574 (no change from before this feature — no new tests
were added, since that's `/test`'s job).

## Test Notes
Added 22 tests (574 → 596, all passing; re-run 3x, stable), all AC-traceable
by number, across 3 layers:

- New `MessageContextMenu.test.tsx` (+13, unit-level, the component in
  isolation): AC1 every listed action renders; AC5 Reply/Reply All/Forward
  enabled for exactly one target message, disabled for a multi-message
  target, and an enabled click calls through + closes the menu, while
  Delete works regardless of target size; AC4 the Mark as
  read/unread and Flag/Unflag label switches correctly between "not
  uniformly set" (shows "Mark as read"/"Flag", applies `true`) and "every
  target already set" (shows "Mark as unread"/"Unflag", applies `false`),
  plus Add to category revealing its input on click and submitting the
  *trimmed* name (and not calling through for a blank submission); AC3
  Move to folder stays collapsed until clicked, then lists every folder,
  and choosing one calls through with that folder's id; plus dismissal via
  Escape and an outside click (confirming a click *inside* the menu does
  not trigger the outside-click close path).
- `MessageListPane.test.tsx` (+8, integration-level, real right-click →
  selection → menu wiring): AC2 both halves — right-clicking outside the
  current selection calls `onSelectionChange` with just that message
  (verified via the resulting menu being scoped to one message, i.e.
  Reply enabled) and right-clicking inside an existing multi-selection
  leaves `onSelectionChange` uncalled (Reply stays disabled, proving the
  menu operates on the full existing selection); AC4 Mark as
  read/Flag issuing an `update` call per selected id, and Add to category
  skipping a message that already has the category (only the message
  lacking it gets an `update` call); AC3 Move to folder listing the
  configured folders and moving every selected message, then clearing the
  selection (since the moved messages are about to vanish from the
  current-folder view); AC5 Delete calling `onDeleteMessages` once with
  every targeted message object for a 3-message selection, and Reply
  calling through with the actual message object for a single-message
  target; plus a structural check that the menu closes when the folder
  changes (same reset as the existing multi-select anchor).
- `App.test.tsx` (+1, end-to-end through the real `App`/`MessageListPane`
  wiring): the one branch nothing else exercises — the context menu's
  Delete permanently deletes (`messages.delete`, not another `update` back
  to `folderId: 'deleted'`) when the target message is already sitting in
  Deleted Items, confirmed by actually navigating into that folder first.

Deliberately not covered: exact on-screen pixel positioning of the menu
(only that it renders and is scoped correctly — position is a `style`
value taken verbatim from the click event, nothing to assert beyond "it's
there"); a live multi-window Electron right-click (no attached display —
same structural gap as every prior feature, substituted here by
`fireEvent.contextMenu` driving the real `onContextMenu` handler through
the real component tree).

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
