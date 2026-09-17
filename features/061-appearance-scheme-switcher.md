---
id: 061
title: Settings — Appearance color scheme switcher
status: backlog
priority: medium
---

## Description
Add an "Appearance" control in Settings letting the user pick between all
available color schemes (feature 058's default, feature 059's two
additional light schemes, and feature 060's dark scheme). The choice
persists like any other setting.

## Acceptance Criteria
- [ ] A new "Appearance" control in Settings lists all 4 available color
      schemes and lets the user pick one
- [ ] Selecting a scheme applies it immediately across the whole app, no
      restart required
- [ ] The selected scheme persists across app restarts, stored the same
      way other settings are (JSON config)
- [ ] On launch, the app applies the persisted scheme; a fresh install
      defaults to the revised default scheme from feature 058

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
