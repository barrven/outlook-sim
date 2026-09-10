---
id: 015
title: LLM persona reply generation
status: backlog
priority: high
---

## Description
When the trainee sends or replies to a message addressed to a persona, and a
reply is appropriate, the app generates a reply in that persona's voice
using the system prompt, persona details, and thread context, and delivers
it into the Inbox.

## Acceptance Criteria
- [ ] Sending/replying to a persona-addressed message triggers an LLM call
      assembling system prompt + persona fields + thread history
- [ ] Generated replies appear in Inbox from the correct persona's From
      address, timestamped with simulated time
- [ ] The app can decide not to reply when a reply isn't appropriate for
      that context (e.g. an FYI-only message), per system-prompt guidance
- [ ] Reply generation failures degrade gracefully (visible error, no
      crash, no partial/garbled message inserted)

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
