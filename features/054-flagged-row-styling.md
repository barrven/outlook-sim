---
id: 054
title: Mail message list — flagged-row styling
status: testing
priority: low
---

## Description
Make the flag icon in the message list larger, and give a flagged
message's row a distinct background highlight — slightly different from
an unflagged row's — so flagged mail stands out at a glance, not just via
the flag icon's own red color.

## Acceptance Criteria
- [ ] The flag icon in the message list renders visibly larger than its
      current size
- [ ] A flagged message's row has a distinct background highlight
      (different from an unflagged row's default) when not selected
- [ ] Selecting a flagged row still shows the existing `.selected`
      highlight sensibly alongside/instead of the flagged highlight
      (decide and document the exact precedence in Implementation Notes)
- [ ] Flagging/unflagging a message immediately adds/removes the row
      highlight

## Implementation Notes
**AC1 (larger flag icon)** was already done directly by the user before
this feature was picked up, in the same manual commit as feature 053
(`3158af7`, "made some manual changes to the styling to make it not suck
so bad.", 2026-09-17): `.message-list-flag-btn`'s `font-size` went from
`14px` to `20px` (confirmed via `git log -p`) — clearly larger, verified
directly against current source, not just taken on the user's word.

**AC2-AC4** implemented here: `MessageListPane.tsx`'s row `<button>`
gained a conditional `flagged` class (`message.isFlagged ? ' flagged' :
''`), inserted before the existing `selected`/`unread` conditionals in
the same template-literal className build — same pattern those two
already use.

New CSS: `.message-list-item.flagged { background: var(--flag-bg); }`,
reusing the existing `--flag-bg` token (already defined identically
across all 4 color schemes, and already used at surface scale for the
Reading Pane's Flag toggle button) rather than inventing a new one (AC2).

**AC3 (selection precedence — documented per the AC's own instruction):**
selected wins. `.message-list-item.flagged` is declared *before*
`.message-list-item.selected` in `global.css`; both are equal-specificity
two-class selectors (`.message-list-item` + one modifier), so per CSS
cascade order the later declaration — `.selected` — wins whenever a row
is both flagged and selected. This was a deliberate ordering choice, not
an accident: selection is the more immediate "what you're looking at
right now" signal and should stay visually dominant over a row's resting
status highlight. `:hover`'s existing declaration comes before `.flagged`
in the source, so hovering a flagged (but unselected) row keeps the flag
color rather than flashing to the generic hover gray — a deliberate
secondary choice (not required by any AC) since a flagged row is already
visually distinct and losing that signal on hover would undercut the
point of the highlight; `.selected` still comes last overall, so hovering
an already-selected row is unaffected either way (unchanged from before
this feature).

**AC4 (live update):** no explicit work needed — `flagged` is a plain
derived class computed from `message.isFlagged` on every render, exactly
like the pre-existing `unread`/`selected` classes, which already update
live via this component's established data-refetch-on-broadcast pattern.
Flagging/unflagging already triggers that same refetch (used by
`isRead`/categories/etc. already), so the new class updates for free.

Verified live via a throwaway RTL script (not committed): a flagged-only
row gets `flagged` but not `selected`; a row that's both flagged and
selected gets both classes (confirming the DOM state the cascade-order
argument above relies on). lint/typecheck/build pass; full suite
unchanged at 846/846 (no new feature-specific tests yet — that's
`/test`'s job).

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
