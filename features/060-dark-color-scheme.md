---
id: 060
title: Dark color scheme
status: testing
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
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
