---
id: 054
title: Mail message list — flagged-row styling
status: accept
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
846 → 852 net (+6, all passing; re-run 3x, stable) across 2 files.

New `describe('flagged-row styling (054)')` block in `src/main/
globalCssStyling.test.ts` (+3, matching this file's established
CSS-source-assertion convention rather than a renderer test, since
`fs`/`path`/`__dirname` aren't available under the renderer's
`tsconfig.web.json`): AC1 locks in the flag button's `font-size: 20px`
as a regression guard on the user's own manual change; AC2 confirms
`.message-list-item.flagged` uses `background: var(--flag-bg)`; AC3
confirms `.flagged` is declared before `.selected` in source order —
the actual mechanism the precedence decision in Implementation Notes
relies on.

`MessageListPane.test.tsx` (+3, new "054" block): AC2 — a flagged row
carries the class, an unflagged one doesn't. AC3 — a row that's both
flagged and selected carries both classes simultaneously (confirms the
DOM state; the cascade test above confirms which one visually wins).
AC4 — starting unflagged, then re-rendering with the same message now
flagged (simulating the broadcast-driven refetch this component already
uses for `isRead`/categories) immediately adds the `flagged` class, no
extra plumbing needed.

Deliberately uncovered: the actual rendered visual appearance/contrast of
`--flag-bg` as a full-row background across all 4 color schemes (no
attached display — same non-blocking gap as every prior CSS-touching
feature; existing WCAG-contrast tests already cover `--flag-border`
specifically as flagged-icon text, not this new row-background use).
lint/typecheck/build all pass.

## Validation Notes
lint/typecheck/build pass; full suite (852/852) re-run 4x total across
`/test` and `/validate`, stable. `git diff --stat` (1ba8223..HEAD, the
commit immediately before this feature's `/implement` started) confirms
`/implement`+`/test` touched only the expected files (the AC1 flag-icon
size change itself predates this range — it was already on `master` from
the user's earlier manual commit, `3158af7`, confirmed and credited
directly in Implementation Notes). No new dependency added.

All 4 ACs re-verified directly against current source:

- **AC1** (visibly larger flag icon): `.message-list-flag-btn`'s
  `font-size: 20px` (was `14px`), confirmed via direct source read and
  locked in by a dedicated regression-guard test.
- **AC2** (distinct background when not selected):
  `.message-list-item.flagged { background: var(--flag-bg); }` — a real
  rule, confirmed by grep against the actual stylesheet.
- **AC3** (selection precedence, documented): `.message-list-item.flagged`
  is declared at line 1055, `.message-list-item.selected` at line 1059 —
  confirmed directly by reading the file, not just by test assertion.
  Both are equal-specificity two-class selectors, so per CSS cascade
  rules the later declaration (`.selected`) wins whenever both classes
  apply — the exact mechanism Implementation Notes documents as the
  deliberate precedence choice.
- **AC4** (live update on flag/unflag): the `flagged` class is a plain
  derived value from `message.isFlagged`, computed fresh on every render
  — no caching, no separate state to fall out of sync — confirmed by
  reading `MessageListPane.tsx`'s className template literal directly.

Not independently re-verified: the actual rendered visual appearance of
`--flag-bg` as a full-row background across all 4 color schemes, and
whether it reads well against `--hover-bg`/`--selected-bg` in each theme
(no attached display — same non-blocking gap as every prior CSS-touching
feature in this project). All checks pass, no blocking gaps found.

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
