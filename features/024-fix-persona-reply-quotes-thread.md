---
id: 024
title: Fix — persona replies quote the prior thread chain
status: testing
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
Extracted the trainee's own reply-quoting format (feature 005) out of
`composeIntent.ts`'s private `quoteBody()` into a new shared function,
`src/shared/quoteBody.ts` — `composeIntent.ts` (renderer) and
`personaReply.ts` (main) both now call the identical implementation, so
there's no risk of the two formats drifting apart (satisfies AC2 by
construction rather than by convention-copying). `personaReply.ts` now
builds the persona's reply body as `` `${text}${quoteBody(sentMessage)}` ``
— `sentMessage` (the trainee's message that triggered the reply) is exactly
"the immediately-preceding message" a real persona would be replying to, and
it's already guaranteed non-null by the existing early-return a few lines up
(`db.getMessage(sentMessageId)` not found → error), so the quote block can
never be built from a missing message (AC4's guard holds structurally, not
via an added conditional). The `thread` array (used for the LLM prompt,
unchanged) was deliberately not used for the quote source — it's a broader
multi-message transcript, whereas the quote's job is narrower ("what
directly preceded this reply").

Files touched: `src/shared/quoteBody.ts` (new), `src/renderer/src/composeIntent.ts`
(quoteBody extracted, behavior unchanged — confirmed via existing
`composeIntent.test.ts`, still 100% passing untouched), `src/main/llm/personaReply.ts`.
One existing test (`personaReply.test.ts`'s Inbox-insert test) needed a
compile/assertion touch-up since it asserted an exact `body` string that the
new quote block now extends — changed to `toContain` checks for both the
new reply text and the quoted original; no other behavior changed.
lint/typecheck/build pass; existing suite still 408/408 (17/18 personaReply
tests unaffected, 1 touched). Live-verified the exact output format with a
standalone `tsx` script against a real, non-mocked `MailDb`/`SimClock` — the
persona reply body came back as `"Sure, noon works!\n\nOn 3/1/2026, 10:00:00
AM, Jordan Trainee <jordan@example.com> wrote:\n> Want to grab lunch
tomorrow?"`, byte-for-byte the same header/quote-prefix shape
`composeIntent.ts` produces for the trainee's own replies.

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
