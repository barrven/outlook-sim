---
id: 030
title: Settings panels refresh live after a scenario pack load
status: backlog
priority: medium
---

## Description
If Settings is open (in particular the Personas section, and now the
System Prompt section per feature 029) when a scenario pack is loaded, it
now reflects the newly loaded data immediately, without the user needing to
close and reopen Settings.

## Acceptance Criteria
- [ ] With Settings open on the Personas section, loading a scenario pack
      updates the visible persona list without navigating away and back
- [ ] With Settings open on the System Prompt section, loading a scenario
      pack updates the visible system prompt text the same way
- [ ] Loading a pack while Settings is closed is unaffected — the data is
      simply correct the next time Settings is opened, as today
- [ ] An in-progress unsaved edit in an open Settings section is not
      silently discarded any more destructively than existing app behavior
      elsewhere (call out the chosen behavior explicitly in Implementation
      Notes)

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
