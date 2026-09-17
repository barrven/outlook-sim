---
id: 067
title: Mail — pop-out window for viewing attachments
status: backlog
priority: medium
---

## Description
Let any attachment — a real outgoing file (feature 062) or an
LLM-generated incoming document (feature 065) — be opened in its own
pop-out window for viewing, separate from the main Reading Pane.

## Acceptance Criteria
- [ ] Clicking an attachment (in the Reading Pane or a message pop-out
      window) opens it in a new, dedicated pop-out window
- [ ] A generated (HTML) attachment renders its actual HTML content in the
      pop-out
- [ ] A real outgoing attachment's pop-out shows its extracted text
      content (for types feature 063 supports) or a clear fallback
      (filename/type, with an "open with your default application"
      affordance) when direct rendering isn't applicable — the exact
      behavior is decided and documented in Implementation Notes, per the
      spec's Open Questions
- [ ] Closing the attachment pop-out doesn't affect the main window or the
      message it came from, consistent with the app's existing pop-out
      pattern

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
