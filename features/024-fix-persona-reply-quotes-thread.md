---
id: 024
title: Fix — persona replies quote the prior thread chain
status: validating
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
Added a new `src/shared/quoteBody.test.ts` (4 tests) — the shared function
had never had its own test file before (it was only exercised indirectly via
`composeIntent.test.ts`). Discovered along the way that `vitest.config.ts`'s
`include` list only covered `src/renderer/**` and `src/main/**`, so
`src/shared/**` tests were silently never executed by `npm test`/`vitest
run` — added `'src/shared/**/*.test.ts'` to `include` as part of this stage
(a real gap, not scope creep: without it the new quoteBody tests, and any
future shared-module tests, would pass locally but never actually run in
CI/`npm test`).

`quoteBody.test.ts` covers: the "On \<date\>, Name \<email\> wrote:" header
(AC2's format), every body line getting a "> " prefix (AC2), the leading
blank-line separator, and an empty-body message not throwing and still
producing a well-formed (if content-empty) quote line (AC4-adjacent — the
function itself never assumes a non-empty body).

`personaReply.test.ts` (406 → now includes 2 more targeted assertions/tests
on top of the existing suite): the pre-existing "inserts the generated
reply…" test was extended to assert the exact quote header
("Jordan Trainee \<jordan@example.com\> wrote:") and a "> "-prefixed
original line, not just a loose `toContain` on the raw text (AC1). A new
test byte-for-byte compares the persona reply's body against
`` `${llmText}${quoteBody(sentMessage)}` `` computed independently in the
test — locking in AC2 (identical convention, not just "looks similar") by
construction rather than by eyeballing. A new "AC4" test re-asserts, under
the acceptance criterion's own name, that a missing prior message (the only
realistic "no prior message" case, since a reply always has the sentMessage
that triggered it) degrades cleanly: no crash, no LLM call, no Inbox insert
(AC3's existing test already covers the message-body assertions; this one
is purely about AC4's guard).

Deliberately not covered: locale-specific exact date-string output of
`toLocaleString()` (same reasoning `composeIntent.test.ts` already uses —
locale-dependent formatting isn't part of any AC, only the header shape and
surrounding text are). Full suite (414/414, up from 408) re-run 3x locally,
stable; lint/typecheck/build all pass.

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
