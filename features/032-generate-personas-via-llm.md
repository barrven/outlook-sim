---
id: 032
title: Settings — generate personas via LLM
status: backlog
priority: medium
---

## Description
Settings' Personas section gains a "Generate Personas" UI — the user enters
a short company/industry description, and the app asks the configured LLM
to generate a full set of personas (name, email, role, bio, writing-style
notes, reports-to) reflecting that company, which the user reviews before
they're added to the persona list.

## Acceptance Criteria
- [ ] A "Generate Personas" control accepts a free-text company/industry
      description and triggers an LLM call using the currently configured
      provider/model/key
- [ ] A successful generation produces one or more well-formed personas
      (all required fields populated, reports-to relationships forming a
      sensible structure) shown to the user before being committed
- [ ] The user can accept (add generated personas to the list) or discard
      the generation result
- [ ] A failed generation (bad key, network error, malformed LLM output)
      shows a clear error rather than corrupting the existing persona list
- [ ] Generated personas persist across restarts like any other persona
      once accepted

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
