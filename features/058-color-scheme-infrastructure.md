---
id: 058
title: Color scheme infrastructure + revised default palette
status: testing
priority: medium
---

## Description
Establish a mechanism for swapping the app's entire color palette at
runtime from a single switch point (e.g. a `data-theme` attribute on the
root element, with scheme-specific CSS custom-property overrides), and
revise the current default palette to use more color and less gray. This
lays the groundwork features 059-061 build on. No ribbon/pane layout
changes — colors only (Core Requirement 2).

## Acceptance Criteria
- [ ] Every color value used throughout the app is still expressed via CSS
      custom properties (tokens) — no new hardcoded colors introduced
- [ ] A scheme-switching mechanism exists (e.g. a root-level
      attribute/class selecting which token set applies) that can swap
      every token's value in one place, even with only one scheme defined
      so far
- [ ] The default scheme's token values are revised to reduce the amount
      of gray/muted color and introduce more distinct hues, while every
      existing acceptance criterion from feature 037 (semantic tokens,
      consistent border-radius, red flags) still holds
- [ ] No ribbon/pane layout, sizing, or chrome changes — this is a
      color-only revision

## Implementation Notes
Scoped entirely to `src/renderer/index.html` and
`src/renderer/src/styles/global.css`, plus the existing `globalCssStyling.test.ts`
(updated to match the new structure, not new scope).

**Switch mechanism (AC2):** `<html>` now carries `data-theme="default"`
(set statically in `index.html`, loaded by every renderer window — main,
compose, message/calendar pop-outs — so it applies everywhere with no
JS/FOUC concern). `global.css`'s color tokens moved out of the bare
`:root { ... }` block into `:root[data-theme='default'] { ... }`; a
future scheme (059/060) is just another `:root[data-theme='...']` block
with the same token names and different values, and Settings (061)
becomes a one-line `document.documentElement.dataset.theme = ...` to
swap every token app-wide. The non-color `--radius`/`--radius-pill`
tokens (037) stay in the bare, unconditional `:root` — they aren't part
of a "color" scheme and every future scheme shares the same rounding,
so there's no reason to repeat them per scheme.

**Revised default palette (AC1/AC3):** replaced the original's flat
neutral grays (`--border`, `--ribbon-bg`, `--nav-rail-bg`, `--hover-bg`,
`--text-muted`) with a soft blue-tinted family, and deepened `--accent`/
`--selected-border` slightly for more presence — reads as "more color,
less gray" while staying calm enough for classic-Outlook chrome (Core
Requirement 2). `--pane-bg` deliberately stays pure white (message/
reading content should stay neutral for readability regardless of
scheme). `--text` shifted from flat black to a deep blue-black for
palette cohesion. Feature 037's semantic status colors
(`--danger`/`--warning`/`--success` and their `-bg`/`-border` pairs) were
left untouched — already distinct, non-gray hues, not what "reduce
gray" was about, and touching them risked feature 037's specific
red-flag guarantees (AC3) for no benefit.

**AC4 (no layout changes):** the diff is exhaustively two files, both
color-token-only edits (`index.html`'s one attribute; `global.css`'s
token values and the block restructuring around them) — no selector
gained or lost any non-color property, confirmed by `git diff` showing
zero touched `padding`/`margin`/`width`/`height`/`flex`/`gap`/`position`/
`display` lines anywhere.

**Test file update (needed for AC3, not new scope):** `globalCssStyling.test.ts`'s
037-era `extractRootBlock` helper used a regex anchored to bare
`:root { ... }`, which no longer contains the color tokens it was
checking. Added a parallel `extractDefaultThemeBlock` helper for the new
`:root[data-theme='default']` selector and repointed the two tests that
needed it (semantic-token existence, no-hex-outside-tokens); the
radius-pair and flag-color tests were unaffected since radius stayed in
the unchanged bare `:root`. This is a mechanical fix to keep 037's actual
guarantees (not their literal implementation detail) intact — the real
new-feature tests (058's own ACs: the switch mechanism itself, the
gray-reduction) are left for `/test`.

Verified: `npm run build`'s output `out/renderer/index.html` retains
`data-theme="default"` after Vite processes the HTML entry (confirmed by
grep against the built file, not just the source). lint/typecheck/build
all pass; full suite unchanged at 755/755 (jsdom in this project's test
setup doesn't load the external stylesheet, so no test could regress
from a CSS-only value change — same pre-existing gap as every prior
purely-CSS feature, e.g. 037).

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
