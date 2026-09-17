---
id: 062
title: Mail — real outgoing attachments (file picker)
status: backlog
priority: high
---

## Description
Replace the current mock attachment flow (typing a filename into a text
field) with a real OS file picker when composing or replying, so an
actual file from the local filesystem gets attached — the foundation for
features 063/064's content extraction and multimodal handling.

## Acceptance Criteria
- [ ] The compose window's attachment control opens a real OS file-picker
      dialog (the same `dialog.showOpenDialog` pattern already used for
      Load/Save Scenario Pack), replacing the current filename text input
- [ ] The picked file's name and a reference to its real content (stored
      path or copied file) are attached to the message, persisting
      correctly on both the draft/original copy and, once sent, the Sent
      Items copy
- [ ] Multiple attachments can still be added/removed before sending, as
      today
- [ ] Picking a file of any type succeeds (attaching doesn't require the
      file to be a supported-for-extraction type — that's features
      063/064's concern, not this one's)

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
