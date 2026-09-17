---
id: 058
title: Color scheme infrastructure + revised default palette
status: done
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
- [x] Every color value used throughout the app is still expressed via CSS
      custom properties (tokens) — no new hardcoded colors introduced
- [x] A scheme-switching mechanism exists (e.g. a root-level
      attribute/class selecting which token set applies) that can swap
      every token's value in one place, even with only one scheme defined
      so far
- [x] The default scheme's token values are revised to reduce the amount
      of gray/muted color and introduce more distinct hues, while every
      existing acceptance criterion from feature 037 (semantic tokens,
      consistent border-radius, red flags) still holds
- [x] No ribbon/pane layout, sizing, or chrome changes — this is a
      color-only revision (see Validation Notes: one disclosed `opacity`
      exception for disabled-button dimming, judged in-scope)
- [x] (Added mid-review, user-requested) The always-visible action buttons
      (ribbon's New Email/Delete; Reading Pane's Reply/Reply All/Forward/
      Delete/Mark-as-(un)read/Flag) each get their own semantic identity
      color — destructive actions red, communicative actions blue, the
      read/unread toggle a neutral gray, Flag its own amber — instead of a
      uniform look, consistent with Core Requirement 2's semantic color
      system. A disabled action (no handler wired) never shows a color, so
      color always signals "this does something."

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

### Post-`/test`, pre-`/validate` addition (user-requested, mid-review)
After seeing the revised palette live, the user asked for semantic
button coloring: Delete red, New Email/Reply/Reply All/Forward blue,
Mark-as-(un)read gray, Flag amber. Scoped to the two surfaces that
actually have these actions wired to something real: the ribbon's Home
tab (`New Email`, `Delete` — the only two of its six Mail actions with a
handler; `New Items`/`Reply`/`Reply All`/`Forward` are permanently-
disabled placeholders, matching feature 033's own "hide/disable what
isn't wired" convention) and the Reading Pane's action row (all of
Reply/Reply All/Forward/Delete/Mark-as-(un)read/Flag are always wired
there). Deliberately left `MessageContextMenu.tsx`'s equivalent items
unstyled — a native-feeling right-click menu doesn't get bold per-item
button coloring the way a toolbar does, and the user's request was
specifically about buttons, not menu items; flagged here rather than
silently scoped out.

New `--flag`/`--flag-bg`/`--flag-border` token trio added to
`:root[data-theme='default']` — distinct from `--warning` (the existing
LLM-failure-banner color, also yellow/brown-ish) since Flag is an action
identity color, not a caution state. Everything else reuses existing
037/058 tokens directly: blue → `--accent`/`--selected-bg`/
`--selected-border` (already the exact trio `.ribbon-action.active`
used); red → `--danger`/`--danger-bg`/`--danger-border`; gray →
`--text-muted`/`--border`/`--nav-rail-bg` (the app's own blue-tinted
"neutral," not a reintroduced flat gray — reintroducing one would have
directly undone this same feature's AC1/AC3 gray-reduction).

`RibbonBar.tsx` gained an `ACTION_COLOR_CLASS` lookup applied only when
an action has a real handler (`New Email` always does; `Delete` does
only when something's selected) — a disabled button never gets a color
class, so color continues to mean "this does something," and I added a
`.ribbon-action:disabled` rule (a latent pre-existing gap: disabled
ribbon buttons had no dimming at all before this) so a disabled button
now visibly recedes rather than looking identical to an enabled one.
`ReadingPane.tsx` gained `reading-pane-delete-btn`/`reading-pane-read-
toggle` classNames on the relevant buttons across all three branches
(default/Drafts/Deleted Items); the existing `reading-pane-flag-toggle`
class needed no JSX change, just new CSS.

The new CSS overrides needed care with selector specificity: the
existing base `.reading-pane-actions button` rule is (0,1,1) — a single
class + element — so a bare `.reading-pane-delete-btn` alone (0,1,0)
wouldn't have beaten it. Used two-class descendant selectors (e.g.
`.reading-pane-actions .reading-pane-delete-btn`, specificity (0,2,0))
throughout, and kept the pre-existing `.reading-pane-flag-toggle.flagged`
override positioned after the new default-amber rule in source order so
the (equal-specificity) flagged-red state still wins the tie once a
message is actually flagged.

lint/typecheck/build all pass; full suite unchanged at 759/759 before
adding this round's own tests (see Test Notes).

## Test Notes
755 → 759 net (+4, all passing; re-run 3x, stable), all within
`globalCssStyling.test.ts`'s new `describe('color scheme infrastructure
(058)', ...)` block.

- **AC2 (switch mechanism):** one test reads the real `index.html` off
  disk and confirms `<html>` carries `data-theme="default"`; a second
  confirms `global.css` defines the color tokens inside a
  `:root[data-theme='default']` attribute-selector block — and,
  crucially, that none of those tokens are *also* still declared in the
  plain unconditional `:root` (which would silently defeat the whole
  point: changing `data-theme` wouldn't actually swap anything if the old
  values were still active from an un-gated `:root`). This is what
  "provably swappable even with only one scheme defined" actually means
  in code, not just by inspection.
- **AC1/AC3 (gray-reduction, revised palette):** rather than a generic
  "is this a valid hex color" check (which would pass even if `/implement`
  had changed nothing), the test asserts each of the 5 grayest 037-era
  tokens (`--border`, `--ribbon-bg`, `--nav-rail-bg`, `--hover-bg`,
  `--text-muted`) is no longer set to its exact original hex value —
  catches a partial revert, not just "some edit happened." A companion
  test locks in that `--pane-bg` deliberately stayed pure white. The rest
  of AC3 ("every existing 037 AC still holds") is exercised by the
  pre-existing 037 tests just above this block in the same file, updated
  during `/implement` to look in the new `:root[data-theme='default']`
  location and still passing unchanged in substance.
- **AC1** ("every color value still a token, no new hardcoded colors"):
  already covered by the pre-existing, updated "no hardcoded hex color
  outside a token-defining block" test — re-ran it directly against the
  final palette values, still green.

Deliberately not covered by an automated test: **AC4** (no ribbon/pane
layout/sizing/chrome changes) — verified during `/implement` by directly
inspecting `git diff` and confirming zero non-color CSS properties
changed anywhere, the same way feature 037's own AC4 was verified rather
than unit-tested (a structural "did any non-color property change"
assertion would be brittle and not meaningfully different from re-reading
the diff by eye). Also not covered: the actual *rendered* appearance in a
live browser/Electron window — jsdom in this project's test setup doesn't
load the external stylesheet, so no test here (or in any prior purely-CSS
feature, e.g. 037/042) can assert on computed styles; visually confirming
the new palette looks right is a manual check for the user, same
category as every prior styling-pass feature's non-blocking gap.

lint/typecheck/build all pass.

### Post-`/test` addition's own tests (semantic button coloring)
759 → 768 net (+9, all passing; re-run 3x, stable) across 3 files.

`globalCssStyling.test.ts` (+5): a new token trio (`--flag`/`--flag-bg`/
`--flag-border`) exists; the ribbon's `.ribbon-action-primary`/
`.ribbon-action-danger` rules resolve to `--accent`/`--danger`; a
disabled ribbon action resolves to `--text-muted`; Reading Pane's
delete/read-toggle/flag-toggle rules resolve to `--danger`/
`--text-muted`/`--flag` respectively — all assertions target the actual
CSS text on disk, the same pattern the rest of this file already uses.

`RibbonBar.test.tsx` (+3): New Email gets `ribbon-action-primary` and an
enabled Delete gets `ribbon-action-danger`; a *disabled* Delete (no
`onDelete` handler) gets neither; the permanently-disabled Reply/Reply
All/Forward/New Items never get a color class regardless — the concrete
check that "only wired actions get colored" actually holds, not just
"the CSS rule exists somewhere."

`ReadingPane.test.tsx` (+2, mirroring the existing 037 AC3 flag-class
tests' style): Delete and the read/unread toggle carry their new classes
for a message outside Drafts/Deleted Items, and Delete (as "Delete
permanently") keeps its class in both the Drafts and Deleted Items
branches too — the three-branch JSX duplication this component already
has (039/006-era) means all three needed independent coverage, not just
the default branch.

Not independently covered: the CSS specificity reasoning itself (that
the two-class override rules actually beat the base rule, and that the
flagged-red state still wins its tie against the new default-amber
rule) — inherently a browser-rendering concern jsdom can't exercise here,
same category as every other computed-style gap in this file. Reasoned
through by hand during implementation instead (see Implementation
Notes) and will show up immediately as a visibly-wrong color if wrong,
the same way any CSS-only bug in this codebase would surface.
lint/typecheck/build all pass.

## Validation Notes
lint/typecheck/build all pass. Full suite 768/768, re-run 3x, stable.
`git diff --stat` (1ee7b5d..844db12) confirms `/implement`+`/test`+the
mid-review button-coloring addition touched only the expected files — no
drift.

All 5 ACs re-verified directly against current source:
- **AC1**: `grep`'d the whole `global.css` for hex colors — every one
  (including the new `--flag`/`--flag-bg`/`--flag-border` trio) lives
  inside the `:root[data-theme='default']` block (lines 20-57); nothing
  outside it. No hardcoded color anywhere.
- **AC2**: `index.html`'s `<html>` carries `data-theme="default"`;
  `global.css` gates every color token behind `:root[data-theme='default']`,
  never duplicated in the plain `:root` — confirmed both by direct
  inspection and by the dedicated test that asserts the plain `:root`
  block does NOT contain any color token.
- **AC3**: the pre-existing, updated 037 test suite (semantic tokens,
  radius, red flags) all pass unchanged in substance; the 5 grayest
  original tokens are confirmed no longer their exact original hex
  values, and `--pane-bg` stays pure white.
- **AC4**: `git diff` across the *entire* feature range (both the initial
  palette revision and the later button-coloring addition) for
  `padding|margin|width|height|flex|gap|position|display` declarations
  returns zero matches. One disclosed, deliberate exception: a new
  `.ribbon-action:disabled { opacity: 0.6; }` rule (fixing a latent gap —
  disabled ribbon buttons previously had no visual dimming at all).
  `opacity` doesn't reflow or resize anything and only applies to an
  individual interactive element's disabled state, the same category
  Core Requirement 2 already scopes to "buttons, chips, panels, flags,
  etc." — judged in-scope for a color/appearance-only feature, not a
  layout/chrome change, but flagged explicitly here rather than silently
  passed over.
- **AC5** (user-requested addition): `RibbonBar.tsx`'s `ACTION_COLOR_CLASS`
  lookup is applied only when `handler` is truthy — confirmed structurally
  and by the dedicated test proving the permanently-disabled Reply/Reply
  All/Forward/New Items never get a color class regardless. `ReadingPane.tsx`'s
  three JSX branches (default/Drafts/Deleted Items) all carry the new
  `reading-pane-delete-btn`/`reading-pane-read-toggle` classNames, matched
  by CSS rules resolving to `--danger`/`--text-muted`/`--flag` respectively
  (and `--accent` for the ribbon's primary action) — confirmed both via
  `grep` and the passing dedicated tests in all three files.

Not independently re-verified: the actual *rendered* appearance and colors
in a live browser/Electron window — jsdom doesn't load the external
stylesheet, so no test in this project can assert on computed styles or
CSS specificity outcomes (same non-blocking gap as every prior pure-CSS
feature, e.g. 037/042). The user did visually confirm the underlying
palette revision live during this feature's review; the button-coloring
addition (this round) has not yet had that same live confirmation —
worth a look during `/accept`.

All checks pass; the two items above (the disclosed `opacity` exception
and pending live look at the button colors) are noted, not blocking.

### Post-validation: user's own manual styling pass, plus one targeted fix
The user gave the button colors their own live look and then hand-edited
`global.css`/`RibbonBar.tsx`/`ReadingPane.tsx` directly (commit
`3158af7`, "made some manual changes to the styling to make it not suck
so bad"): filled-button styling for the primary/danger actions (new
`--primary`/`--primary-bg`/`--primary-border` trio, `--danger` remapped
to white paired with a solid red `--danger-bg`/`--danger-border`, bold
button text), the ribbon's Mail actions trimmed to just `New Email` +
`Delete` (dropping the permanently-disabled `New Items`/`Reply`/`Reply
All`/`Forward` placeholders entirely — those actions live in the Reading
Pane, which already had them wired), a larger flag icon, and the
`.reading-pane-flag-toggle.flagged` color rule commented out (a
deliberate choice: the button's own "Unflag" label text already signals
the flagged state, no color change needed).

That last edit's ripple effect — `--danger` becoming white — silently
broke 2 unrelated standalone-text usages that had no background of their
own to pair with (`.settings-test-result-error`, the Settings Test
Connection failure message, and `.calendar-event-form-error`, the
Calendar event form's validation error): both would have rendered
invisible white text on the white pane background. Caught this by
`grep`ing every `var(--danger)` usage in the file and checking each had
an accompanying background, not by visual inspection (no attached
display). Flagged both issues to the user; they asked to fix the
invisible-text bug specifically and confirmed the flagged-state color
removal was intentional. Fixed by repointing those two rules to
`--danger-border` (the still-red, still-standalone-safe token) instead
of `--danger`.

Updated the tests that were pinned to the pre-edit design rather than
fighting the user's direction: `.message-list-flag-btn.flagged`'s test
now checks `--flag-border` (its new, deliberately-chosen color) instead
of `--danger`, and drops its previous assertion on the Reading Pane's
flag-toggle color (intentionally no longer a thing); the ribbon-primary
token test now checks `--primary` instead of `--accent`; and the ribbon
test that asserted the disabled Reply/Reply All/Forward/New Items
buttons exist-but-uncolored was replaced with one confirming they don't
render in the ribbon at all anymore. 769/769 full suite, re-run 3x
stable; lint/typecheck/build all pass.

Phase set to `accept`.

## Acceptance Log
2026-09-17 — The user reviewed the revised palette live, requested
semantic button coloring mid-review (added as AC5), then made their own
manual styling pass on top (filled-button look, simplified ribbon
actions, flagged-state color intentionally removed) and pushed it
directly. Before finalizing, flagged two likely side effects of that
pass: invisible white-on-white error text in two places, and the
Reading Pane's flag-toggle no longer changing color when flagged. User
asked to fix the former and confirmed the latter was intentional
("the button doesn't need a different style when flagged because it
already says 'unflag'"). Fixed the invisible-text regression, updated
tests to match the final design, re-validated (769/769, lint/typecheck/
build clean). User then selected "Accept (Recommended)" against this
full summary. Decision: accepted, current state taken as the default
style.
