---
id: 060
title: Dark color scheme
status: validating
priority: medium
---

## Description
Add a dark color scheme using the same scheme-switching mechanism (feature
058), with dark backgrounds and text/accent/border colors adjusted for
legibility.

## Acceptance Criteria
- [ ] A dark color scheme exists, defining a complete value for every
      semantic token, with dark backgrounds
- [ ] Switching to the dark scheme changes every themed surface
      consistently, the same as the light schemes
- [ ] Text and interactive elements maintain adequate contrast against the
      dark backgrounds
- [ ] No layout/chrome changes — same structural constraint as feature 058

## Implementation Notes
Added a `:root[data-theme='dark']` block to `src/renderer/src/styles/
global.css`, same mechanism as 058/059 — no other files touched (the
`<html data-theme>` switch itself is feature 061's job, not this one).

Defines the same 23-token set as every other scheme, with dark
backgrounds/chrome (`--pane-bg`, `--ribbon-bg`, `--nav-rail-bg` etc. all
dark, unlike 059 which kept `--pane-bg` white) and near-white text/bright
accent for legibility.

Most semantic status tokens (danger-bg/danger, warning trio, flag trio)
are left identical to the other schemes — each is only ever used as a
self-contained (text, background) pair, so their contrast is unaffected
by the surrounding scheme's darkness. `--danger-border` and `--success`
are the exception: both are also used as plain text with no background
of their own, directly against `--pane-bg`/`--nav-rail-bg`
(`.settings-test-result-error`, `.calendar-event-form-error`,
`.settings-test-result-ok`) — the existing mid-red/dark-green values
read fine on white but fail WCAG AA against a near-black background, so
this scheme uses brighter red (`#ff6b6b`) and green (`#4caf50`) instead.
`--flag-border` needed no change — standalone against the new
`--pane-bg` it already clears 8:1.

All contrast checked by hand against WCAG's relative-luminance formula:
text/text-muted/accent on `--pane-bg` run 7.4-14.9:1, white-on-
`--primary-bg` 5.2:1, the standalone `--danger-border`/`--success`/
`--flag-border` on `--pane-bg`/`--nav-rail-bg` run 6.0-9.3:1 — all clear
4.5:1 with margin. No layout/chrome properties touched, same constraint
as 058/059.

## Test Notes
Added a "dark color scheme (060)" block to `globalCssStyling.test.ts`
(776 → 783, net +7), mirroring 059's test structure. Also added
`'dark'` to the file's `KNOWN_THEMES` list so the pre-existing "no
hardcoded hex outside a token block" check keeps stripping it
correctly.

Covered: AC1 the dark scheme defines all 23 tokens, and that its
chrome/pane backgrounds are actually dark (relative luminance < 0.1, not
just "different"). AC2 exact same token-name set as every other scheme
(nothing undefined on switch). AC3 WCAG contrast (>=4.5:1), split into
three checks: text/text-muted/accent against `--pane-bg`; white against
this scheme's own `--primary-bg`; and the standalone-text tokens
(`--danger-border`, `--success`, `--flag-border`) against whichever
background they actually render on in the app (`--pane-bg`/
`--nav-rail-bg`), the same set called out in Implementation Notes as
needing brighter values. AC4 no layout property anywhere in the `dark`
block.

Deliberately not covered: runtime theme switching (no switcher exists
yet — feature 061), and pixel/visual rendering (same as 058/059, this
suite only checks the CSS source, not a rendered page).

Full suite: 783/783 passing (776 + 7 new), re-run twice, stable.

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
