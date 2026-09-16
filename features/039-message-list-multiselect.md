---
id: 039
title: Message list multi-select
status: testing
priority: medium
---

## Description
The message list supports selecting multiple messages at once via
Ctrl-click (toggle an individual message in/out of selection) and
Shift-click (select a contiguous range).

## Acceptance Criteria
- [ ] Ctrl-click toggles a message's selection without clearing the rest of
      the current selection
- [ ] Shift-click selects the contiguous range between the last-clicked
      message and the shift-clicked one
- [ ] A plain click (no modifier) selects only that one message, clearing
      any prior multi-selection — matches existing single-select behavior
- [ ] The Reading Pane shows the single selected message when exactly one
      is selected, and a sensible neutral state (e.g. "N selected") when
      multiple are selected

## Implementation Notes
`App.tsx`'s single `selectedMessageId: string | null` state became `selectedMessageIds:
string[]`; a derived `selectedMessageId = selectedMessageIds.length === 1 ? [0] : null` keeps
every existing single-message consumer (Reading Pane actions, ribbon Delete, Reply/Forward,
Restore/permanent-delete) working unchanged — they now just mean "exactly one message
selected" rather than "a message is selected." Every prior `setSelectedMessageId(null)` call
site (folder change, delete/restore/permanent-delete, free-play start, scenario pack load)
became `setSelectedMessageIds([])`.

`MessageListPane.tsx` owns the click semantics (AC1-3), since it already owns the filtered/
searched/categorized `visibleMessages` order a Shift-click range needs: a local `anchorId`
state (the last plain- or Ctrl-clicked message — never moved by a Shift-click, so repeated
Shift-clicks keep re-ranging from the same anchor) drives `handleMessageClick`, which computes
the full new selection array and reports it up via `onSelectionChange` — the parent just
stores whatever it's told, no range/toggle logic duplicated there. `anchorId` resets whenever
`selectedFolderId` changes, reusing the existing derived-state-during-render pattern already
in place for the category filter reset. A Shift-click with no anchor yet, or whose anchor has
scrolled out of the current filtered view, falls back to a plain single-select — a reasonable
default with no AC coverage either way. The `.selected` CSS class check changed from
`===` to `.includes()` so every selected row highlights, not just one.

`ReadingPane.tsx` gained a `selectedCount: number` prop (AC4) — the existing `selectedMessageId`
prop is already `null` for both "nothing selected" and "multiple selected," so `selectedCount`
is what distinguishes the two in the empty-state branch ("N selected" vs "Select an item to
read.").

Scope check: the ACs are only about selection state and its two visible effects (row
highlighting, Reading Pane state) — no bulk actions (multi-delete, multi-flag, etc.) are
implied or added; the Reading Pane's action buttons remain scoped to exactly one selected
message, unchanged.

Existing tests: `MessageListPane.test.tsx`/`ReadingPane.test.tsx` needed prop-shape touch-ups
(`selectedMessageId`/`onSelectMessage` → `selectedMessageIds`/`onSelectionChange`;
`selectedCount` added alongside every `selectedMessageId`) to keep compiling — one assertion
in the former (`onSelectMessage` called with `'a'`) updated to the new `['a']` array shape a
plain click now reports; no other behavior assertions changed. `App.test.tsx` needed no
changes — it drives real clicks through the real components and its existing single-select
scenarios are unaffected.

Verified live (throwaway test, written/run/deleted): AC1 Ctrl-click adds/removes one message
without touching the rest of the selection; AC2 Shift-click selects the contiguous range from
the anchor (both directions), and a second Shift-click re-ranges from the same anchor rather
than the newly clicked point; AC3 a plain click replaces a 3-message selection with just the
clicked one; a visual check confirmed multiple rows carry the `selected` class simultaneously;
AC4 confirmed via `ReadingPane` directly — `selectedCount={1}` shows the message,
`selectedCount={3}` shows "3 selected", `selectedCount={0}` shows the original empty state.
lint/typecheck/build pass; existing suite unchanged 557/557 (only the two component test
files needed the prop-shape touch-ups described above).

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
