---
id: 060
title: Dark color scheme
status: done
priority: medium
---

## Description
Add a dark color scheme using the same scheme-switching mechanism (feature
058), with dark backgrounds and text/accent/border colors adjusted for
legibility.

## Acceptance Criteria
- [x] A dark color scheme exists, defining a complete value for every
      semantic token, with dark backgrounds
- [x] Switching to the dark scheme changes every themed surface
      consistently, the same as the light schemes
- [x] Text and interactive elements maintain adequate contrast against the
      dark backgrounds
- [x] No layout/chrome changes — same structural constraint as feature 058

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
lint/typecheck/build all pass clean. Full suite 783/783, re-run 3x,
stable. `git diff --stat` (56c893d..HEAD) confirms `/implement`+`/test`
touched only expected files (global.css, the test file, and the
feature/BACKLOG/STATE bookkeeping).

All 4 ACs re-verified with independent scripts (Python, not just
re-running the vitest file):

- **AC1** (complete value per token, dark backgrounds): parsed the
  `dark` block directly — 23/23 tokens present. `--pane-bg`/
  `--ribbon-bg`/`--nav-rail-bg` relative luminance 0.0085/0.0174/0.0135
  — genuinely dark (well below mid-gray ~0.18), not just "different."
- **AC2** (switching changes every themed surface consistently): `dark`'s
  token-name set is byte-identical to `default`/`sage`/`plum`'s (23
  names each) — the switch mechanism can't leave anything undefined.
- **AC3** (adequate contrast against dark backgrounds): independent WCAG
  relative-luminance implementation — text/text-muted/accent on
  `--pane-bg` 14.9/7.35/8.22:1; white on `--primary-bg` 5.2:1; the
  standalone-text tokens `--danger-border` on `--pane-bg`/`--nav-rail-bg`
  6.47/5.96:1, `--success` on `--pane-bg` 6.46:1, `--flag-border` on
  `--pane-bg` 8.16:1. All clear the 4.5:1 AA threshold with margin.
- **AC4** (no layout/chrome changes): regex sweep of the `dark` block for
  padding/margin/width/height/flex/gap/position/display finds nothing;
  `git diff --stat` shows no component/layout files touched at all.

All checks pass, no gaps found.

## Acceptance Log
2026-09-18 — user accepted, against the validation summary and AC-by-AC
mapping, no changes requested. (Initially selected "Reject" in the
acceptance prompt, then clarified: "i rejected by accident. please
accept the feature" — treated as an accept, not a reject.)
