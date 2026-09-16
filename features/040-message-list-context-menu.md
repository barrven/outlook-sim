---
id: 040
title: Message list right-click context menu
status: done
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
lint/typecheck/build all pass. Full test suite (596/596) re-run 3x, stable.
`git diff` between the `/implement` and `/test` commits (72f30ec..d586ac8)
touched only test files and docs (`STATE.md`, the feature file,
`BACKLOG.md`, `App.test.tsx`, `MessageListPane.test.tsx`, and the new
`MessageContextMenu.test.tsx`) — no implementation drift.

All 5 ACs re-verified directly against the current source (not just by
re-reading the prior stages' notes):

- **AC1** (menu shows all listed actions): `MessageContextMenu.tsx`
  renders all 8 action items (Reply, Reply All, Forward, Mark as
  read/unread, Flag/Unflag, Add to category, Move to folder, Delete) as
  soon as it mounts — "Add to category" and "Move to folder" are
  themselves immediately-visible top-level menu items; only their
  sub-panels (the category input, the folder list) need an extra click to
  expand, which still satisfies "shows a context menu with all listed
  actions." Confirmed by `MessageContextMenu.test.tsx`'s render check plus
  direct code inspection.
- **AC2** (selection scoping): `MessageListPane.tsx`'s
  `handleMessageContextMenu` computes `targetIds` from the *existing*
  `selectedMessageIds` when the right-clicked row is already in it (no
  `onSelectionChange` call — selection genuinely untouched), and falls
  back to `[messageId]` plus an `onSelectionChange([messageId])` call
  otherwise — including the empty-selection case, correctly treated as
  "outside." Confirmed by code inspection and by the two dedicated
  `MessageListPane.test.tsx` cases.
- **AC3** (Move to folder): the submenu lists every folder from the new
  `folders` prop (threaded from `App.tsx`'s already-fetched folder list,
  no new IPC), and choosing one calls `window.api.data.messages.update`
  once per id in the target set, then clears the selection since those
  messages leave the current-folder view. Confirmed by code inspection
  and the dedicated test.
- **AC4** (Mark read/unread, Flag/Unflag, Add to category apply to every
  selected message): `handleBulkMarkRead`/`handleBulkToggleFlag` iterate
  every id in the target set; `handleBulkAddCategory` iterates every
  *message object* in the target set and skips only the ones that already
  carry the category (not all-or-nothing skip) — each gets its own
  `update` call with the merged category array. Confirmed by code
  inspection and tests at both the unit (label/value logic) and
  integration (actual per-id `update` calls) layers.
- **AC5** (Reply/Reply All/Forward single-only, Delete any size): enforced
  twice — the `disabled` attribute in `MessageContextMenu.tsx`
  (`canActOnOne = targetMessages.length === 1`) and a second guard in
  `MessageListPane.tsx`'s callback wrappers themselves
  (`if (contextMenuMessages.length === 1) onReply(...)`). Delete has no
  such guard and calls `onDeleteMessages` with the full target regardless
  of size. `App.tsx`'s new `handleDeleteMessages` correctly branches per
  message — move-to-Deleted-Items normally, permanent delete if a
  message is already there — verified end-to-end by the dedicated
  `App.test.tsx` case (the one path nothing else exercised).

One non-blocking nit found by fresh inspection, not previously noted:
right-clicking the per-row flag button (⚑/⚐) does not open the context
menu (it has no `onContextMenu` handler, only the sibling message button
does), so it falls through to the browser's native menu instead. This
mirrors the existing, intentional design for left-clicks (the flag button
already `stopPropagation`s to avoid selecting the message) — the flag
button is treated as a separate control, not part of "the message" for
selection purposes, and the ACs only require right-clicking *a message*
to work. Not a defect against any AC; flagging for `/retro`'s awareness
only.

No live multi-window Electron GUI click-through attempted — no attached
display; same non-blocking gap as every prior feature. All checks pass,
no gaps found.

## Acceptance Log
2026-09-15 — Presented the AC-by-AC mapping and validation summary (596/596
tests stable, no implementation drift, one non-blocking nit re: the flag
button's native context menu). User selected "Accept" via the accept-stage
decision prompt. Decision: **accepted**.
