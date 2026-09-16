---
id: 040
title: Message list right-click context menu
status: testing
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
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
