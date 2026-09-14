---
id: 027
title: LLM error banner — Retry button and durable failure log
status: backlog
priority: medium
---

## Description
When a persona-reply, unsolicited-mail, or Test Connection LLM call fails,
the dismissible error banner gains a Retry button that re-attempts the same
call. Every LLM failure is also appended to a durable local log the user
can inspect for troubleshooting repeated failures, not just shown
transiently in the UI.

## Acceptance Criteria
- [ ] The failure banner (persona-reply failures, unsolicited-mail
      failures, and Test Connection failures) shows a Retry button
      alongside the existing dismiss (✕)
- [ ] Clicking Retry re-attempts the same LLM call with the same inputs; a
      second failure updates the existing banner rather than stacking
      duplicate banners
- [ ] A successful Retry clears the banner and completes the original
      action (e.g. the persona reply gets inserted)
- [ ] Every LLM call failure is appended to a durable local log (e.g. a
      JSON/text file under the app's config directory) that survives an app
      restart, independent of whether the banner was dismissed

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
