---
id: 059
title: Two additional light color schemes
status: testing
priority: medium
---

## Description
Add two more selectable light-background color schemes, each with its own
full set of values for every existing semantic token, built on the
scheme-switching mechanism from feature 058.

## Acceptance Criteria
- [ ] Two new light color schemes exist, each defining a complete value
      for every semantic token the app uses
- [ ] Switching to either scheme changes every themed surface in the app
      (ribbon, panes, buttons, chips, flags, etc.) consistently — no
      element left showing a different scheme's value
- [ ] Each new scheme is visually distinct from the default and from each
      other (different accent/hue treatment) while remaining legible
      (adequate text/icon contrast against its own backgrounds)
- [ ] No layout/chrome changes — same structural constraint as feature 058

## Implementation Notes
Scoped entirely to `src/renderer/src/styles/global.css` — two new
`:root[data-theme='sage']`/`:root[data-theme='plum']` blocks, following
058's exact structure (including its post-acceptance revision: the
`--primary`/`--primary-bg`/`--primary-border` trio for filled buttons,
`--danger` as white paired with a solid `--danger-bg`/`--danger-border`
red). No component/JSX changes — 059 is purely "define two more token
sets," since every themed surface already reads its color exclusively
through `var(--token)` (037/058's own guarantee), so a new scheme just
needs to exist as a selector to be fully wired everywhere at once.

**Design:** "sage" (green) and "plum" (purple) — each with its own
neutral chrome (border/ribbon-bg/nav-rail-bg/selected-bg/selected-border/
text/text-muted/hover-bg) and its own accent/primary hue, distinct from
the default's blue and from each other. `--pane-bg` stays pure white in
both, matching 058's own reasoning (message/reading content should stay
neutral regardless of scheme). Deliberately kept the semantic status
colors (danger/warning/success/flag) identical across all three light
schemes — already-validated, universally-recognizable meanings (red/
yellow/green/amber) that shouldn't shift with the "brand" palette; each
scheme's actual identity comes entirely from its neutral+accent/primary
tokens, which is what AC3's "different accent/hue treatment" is really
asking for.

**Contrast (AC3):** checked the two highest-risk pairs by hand against
WCAG's relative-luminance contrast formula (not automated — no test
tooling in this repo renders actual computed styles) — sage's muted text
on white ≈5.6:1, plum's ≈6.5:1; sage's white-on-primary-button ≈5.1:1,
plum's ≈8.2:1. All comfortably clear the 4.5:1 AA threshold for normal
text.

**AC1 verified structurally**, not just by eye: extracted every token
NAME (not value) from all three scheme blocks and confirmed sage/plum
each define the exact same 23-token set as default, byte-for-byte
identical set membership — so switching `data-theme` can never leave an
element falling through to an undefined/inherited value (AC2's "no
element left showing a different scheme's value").

Updated `globalCssStyling.test.ts`'s "no hardcoded hex outside a token
block" helper to strip all three scheme blocks via a small `KNOWN_THEMES`
list rather than hardcoding just "default" — future schemes (060's dark
scheme is next) only need adding to that one list, not a parallel
regex each time.

lint/typecheck/build all pass; full suite unchanged at 769/769 (jsdom
doesn't load the external stylesheet, so no test here — or in 037/058 —
can regress from a CSS-only value change). `git diff` confirms zero
layout-affecting properties touched anywhere (AC4) — this change is
exhaustively two new token blocks and one test-helper generalization.

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
