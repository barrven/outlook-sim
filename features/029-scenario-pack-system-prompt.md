---
id: 029
title: Scenario packs include the system prompt
status: backlog
priority: medium
---

## Description
Both saving and loading a scenario pack now include the system prompt,
alongside the existing inbox/personas/calendar/timed-messages. Loading a
pack replaces the current system prompt the same way it already replaces
personas/calendar/inbox.

## Acceptance Criteria
- [ ] Save Scenario Pack writes the current system prompt into the pack's
      JSON
- [ ] Load Scenario Pack applies the pack's system prompt, replacing
      whatever was configured before
- [ ] A pack saved before this feature (missing the system-prompt field)
      still loads without error, leaving the current system prompt
      unchanged
- [ ] Round-tripping (save, then load into a fresh store) preserves the
      system prompt exactly

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
