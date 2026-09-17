---
id: 066
title: Mail — save a generated attachment into FileVine
status: backlog
priority: medium
---

## Description
Let the user save an LLM-generated (incoming) attachment (feature 065)
into a FileVine folder as a note/file entry.

## Acceptance Criteria
- [ ] A generated attachment has a "Save to FileVine" action, letting the
      user pick an existing FileVine folder to save it into
- [ ] Saving creates a FileVine note/file entry containing the
      attachment's content, viewable through FileVine's existing notes UI
      afterward
- [ ] The original message's attachment is unaffected by saving a copy
      into FileVine (non-destructive)
- [ ] Attempting to save when no FileVine folders exist yet offers a clear
      path to create one first, rather than failing silently

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
