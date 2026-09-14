---
id: 024
title: Fix — persona replies quote the prior thread chain
status: backlog
priority: high
---

## Description
Fixes `BUGS.md` B003. When a persona replies, the generated message body now
includes the quoted prior message in the thread (like a real email client's
"On [date], X wrote:" block), not just the LLM's bare new-paragraph reply
text. Matches how the trainee's own Reply/Reply All/Forward already quote
the body (feature 005).

## Acceptance Criteria
- [ ] A persona reply's stored message body includes the immediately-
      preceding message quoted, in addition to the LLM-generated new reply
      text
- [ ] Quoting follows the same nesting convention as the trainee's own
      reply-quoting (feature 005) rather than inventing a separate format
- [ ] Existing persona-reply generation tests are updated to assert quoted
      content is present
- [ ] A thread with no prior messages (shouldn't happen for a reply, but
      guard it) doesn't crash or produce a malformed quote block

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
