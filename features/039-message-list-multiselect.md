---
id: 039
title: Message list multi-select
status: validating
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
Added 14 tests (557 → 571, all passing; re-run 3x, stable), all AC-traceable by number,
across 3 layers:

- `MessageListPane.test.tsx` (+10, unit-level, `fireEvent` for precise modifier keys): AC1 —
  Ctrl-click adds a message without clearing the rest, Cmd/Meta-click does the same (Mac
  equivalent), and Ctrl-clicking an already-selected message removes just that one; AC2 —
  Shift-click ranges forward and backward from the anchor, a second Shift-click re-ranges
  from the *same* anchor rather than the previous Shift-click's target (the case that would
  silently break if the anchor were wrongly updated on every click), and a Shift-click with
  no prior click falls back to a plain single-select; AC3 — a plain click replaces a
  3-message selection with just the clicked one; plus two structural checks: every selected
  row (not just one) carries the `selected` class, and the anchor resets when the folder
  changes so a stale anchor from a previous folder can't leak into a Shift-click range in a
  new one (falls back to plain-select instead).
- `ReadingPane.test.tsx` (+3): AC4 — a `selectedCount` of 3 shows "3 selected" instead of the
  single message (and instead of the original empty-selection message), `selectedCount={0}`
  still shows "Select an item to read." (proving the two null-`selectedMessageId` cases are
  genuinely distinguished, not accidentally merged), and going from multiple back to exactly
  one re-shows that single message.
- `App.test.tsx` (+1, integration-level, real clicks through the real
  App/MessageListPane/ReadingPane wiring rather than the components in isolation): a single
  scenario chains plain-click → Ctrl-click → plain-click → Shift-click and checks the Reading
  Pane's visible state after each step, proving the wiring between the two components (not
  just each component's own prop contract) is correct end-to-end.

Deliberately not covered: keyboard-based selection (arrow keys, Ctrl+A) — not in scope, no AC
mentions it; bulk actions on a multi-selection (delete/flag/mark-read many at once) — the
feature description and ACs are scoped to selection state and its two visible effects only,
not new bulk operations; and a live end-to-end Electron GUI click-through with real mouse
modifier keys (no attached display in this environment — same non-blocking gap noted on
every prior feature's Validation Notes).

lint/typecheck/build all pass.

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
