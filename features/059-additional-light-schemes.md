---
id: 059
title: Two additional light color schemes
status: backlog
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
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
