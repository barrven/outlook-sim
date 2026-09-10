---
id: 011
title: "Settings: trainee identity & system prompt"
status: backlog
priority: high
---

## Description
Settings screen lets the trainee set their identity (display name, job
title, From email) and edit the single system prompt that defines the
simulation's domain, goals, tone, and rules.

## Acceptance Criteria
- [ ] User can set and persist display name, job title, and From email
- [ ] Outgoing mock mail uses the configured From email/display name
- [ ] User can edit a single free-text system prompt and it persists across
      restarts
- [ ] The system prompt is stored in a form ready for later LLM prompt
      assembly

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
