---
id: 049
title: FileVine content feeds persona LLM context
status: backlog
priority: medium
---

## Description
When generating a persona reply or unsolicited mail (features 015/016) for
a persona that has an associated FileVine folder (feature 047), that
folder's notes/files (feature 048) are included in the persona's LLM prompt
context, so the persona can meaningfully reference and correspond about the
documents there.

## Acceptance Criteria
- [ ] Generating a reply/unsolicited mail for a persona with an associated
      FileVine folder includes that folder's notes/files (name + content,
      or a reasonable summary if very large) in the LLM prompt
- [ ] A persona with no associated FileVine folder generates exactly as
      before this feature (no regression)
- [ ] A live/manual check confirms a persona references specific content
      from its folder when prompted about it (e.g. asking about a deadline
      described only in a FileVine note)
- [ ] A folder content update is reflected in the very next generation for
      that persona — no stale caching

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
