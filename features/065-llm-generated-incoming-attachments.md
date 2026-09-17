---
id: 065
title: Mail — LLM-generated incoming attachments
status: accept
priority: high
---

## Description
When a scenario calls for a persona-generated (incoming) email to include
a document attachment, the LLM produces that document's text, which gets
rendered into a real HTML file written to local disk — replacing today's
filename-only mock for incoming mail.

## Acceptance Criteria
- [x] A persona reply or unsolicited-mail generation can produce an
      attachment: the LLM's response includes document content for it,
      distinct from the email body itself
- [x] That content is rendered into a real HTML file written to disk
      (under the app's existing local data directory), not just a
      filename placeholder
- [x] The generated attachment is downloadable/openable by the user — a
      real file exists and is reachable from the UI
- [x] A generated attachment persists correctly alongside its message
      (survives app restart, shows up when the message is reopened)
- [x] Not every persona-generated message needs an attachment — this only
      applies when the scenario/LLM determines a document is warranted;
      the everyday no-attachment flow is unaffected

## Implementation Notes
New `src/main/llm/generatedAttachment.ts` defines the protocol both
generators share: a persona reply or unsolicited-mail response may
optionally end with a fenced block —
`---ATTACHMENT: <filename>---\n<Markdown>\n---END ATTACHMENT---` — anchored
to the end of the raw LLM text, so it works regardless of which format
precedes it (a bare reply body in `personaReply.ts`, or `scheduler.ts`'s
"Subject: ...\n\n<body>"). `extractAttachmentBlock()` strips it out (never
throws — a missing/malformed block just means no attachment, satisfying
AC5); `writeGeneratedAttachment()` renders the Markdown via the existing
`marked` dependency, sanitizes the resulting HTML with a new
`sanitize-html` dependency (lightweight, Node-native — the existing
`marked`+`DOMPurify` pairing needs a browser/jsdom `window` this main-
process code doesn't have), and writes a real standalone HTML file under
`<userDataDir>/generated-attachments/<uuid>/<name>.html`, returning a
`MessageAttachment` (reusing the `path`/`extractedText` fields features
062/063 already added — no new schema). A fresh UUID per attachment avoids
any collision/overwrite; the LLM-supplied filename is stripped of path
separators and `..` and always forced to a `.html` extension before it
touches the filesystem, since it's untrusted input.

Both `personaReply.ts` and `scheduler.ts` got the same three changes:
`ATTACHMENT_PROMPT_INSTRUCTION` appended to their system prompt ("only
when a real document is warranted... most emails do NOT need one"),
`extractAttachmentBlock()` run on the raw response before any existing
parsing (NO_REPLY check / Subject-body regex), and
`writeGeneratedAttachment()` called only when the model actually included
a block. Both functions gained a `userDataDir: string` parameter, threaded
from `main/index.ts` through `registerDataIpcHandlers`,
`UnsolicitedMailScheduler`'s constructor, and `attemptUnsolicitedMail` —
the same `app.getPath('userData')` value already passed to `MailDb`/
`ConfigStore`/`SimClock`, so no new IPC-boundary crossing was needed for
this half of the feature. AC4 (persists across restart) falls out of
writing to that same durable directory rather than a temp folder — proven
live, not just asserted (see below).

AC3 ("downloadable/openable... reachable from the UI") is handled without
building feature 067's planned in-app pop-out viewer: a new
`attachments:open` IPC handler (`shell.openPath`) hands any attachment
with a real `path` off to the OS's own default handler, wired into
`ReadingPane.tsx`'s existing attachment-click handler. This also fixes a
pre-existing gap left over from feature 062 — a real outgoing attachment
previously still showed the stale "Mock attachment — no file content."
placeholder when clicked, since `ReadingPane.tsx` was never touched by
062/063. A true legacy mock attachment (no `path`) keeps the old
placeholder-toggle behavior unchanged. `docs/SPEC.md`'s own Open Question
about this ("handed off to the OS's own file viewer") anticipated exactly
this approach, so it's not scope creep, just closing a gap this feature's
own AC3 requires anyway.

Verified live end-to-end (not just by inspection), via a throwaway script
with a stubbed `fetch`: a persona reply and an unsolicited-mail response
each containing an attachment block produced a message whose `attachments`
array has a real `path`, whose file exists on disk under the temp
`userDataDir` with correctly rendered content, and whose email body has
the attachment block cleanly removed; a response with no block produced
`attachments: []` with an unmodified body (AC5); reopening the `MailDb`
(simulating an app restart) still returned the attachment intact (AC4); a
deliberately hostile filename (`../../etc/passwd.pdf`) and embedded
`<script>` tag both landed safely — sanitized to a contained filename
inside its own directory, and the script tag stripped from the written
HTML.

lint/typecheck/build all pass; full suite unchanged at 733/733 — the
~50 pre-existing call sites needing a new trailing parameter across
`personaReply.test.ts`/`scheduler.test.ts`/`ipc.test.ts` were fixed
mechanically (a temp `baseDir` value already present in each file's own
setup, not a new fixture), a compile-shape fix per this repo's established
convention, not a behavioral rewrite — no test assertion needed changing.
Left for `/test`: actual test coverage of the new attachment-generation
paths themselves (the throwaway script proved it works; nothing yet
locks it in as a regression test).

### Post-`/validate`, pre-`/accept` fix (live-testing bug report)
Before running `/accept`, the user tested against a real Anthropic
(Claude Sonnet 4.6) API and reported that a persona claimed to have sent
attachments but none showed up in the UI. Diagnosed directly against the
live app's own SQLite database (`~/.config/outlook-sim/outlook-sim.db`,
`node:sqlite` read-only): across 37 real messages, several personas
narrated fictional attachments in prose (e.g. "Attaching three things for
you right now: 1... 2... 3...") but the literal string `---ATTACHMENT`
never appeared anywhere in any message body — the model never attempted
the protocol at all, purely a prompt-compliance gap, not a parsing or UI
bug (confirmed: zero non-empty `attachments` columns from any LLM-
generated message; the only non-empty ones were the trainee's own real
outgoing attachments, feature 062).

Root cause: `ATTACHMENT_PROMPT_INSTRUCTION`'s original wording only said
the block *may* be included when warranted — nothing tied that permission
to the model's very natural tendency to *narrate* attachments in realistic
office-email prose, so a capable model wrote the prose and simply never
remembered the separate mechanical step. Fixed by rewording the
instruction into an explicit two-way rule: narrating an attachment without
including its block is now called out as a hard violation ("text alone
does not create a real attachment"), and including a block for something
not mentioned is equally disallowed.

While fixing the prompt, also generalized the protocol from "at most one
attachment per response" to "one block per document, however many the
model includes" — `extractAttachmentBlock` (singular) became
`extractAttachmentBlocks` (plural), matching a global (not end-anchored)
regex so blocks can be interleaved through the text rather than forced to
the very end. This directly serves the real failure case (a model listing
several realistic documents in one email) rather than fighting that
tendency. Both `personaReply.ts` and `scheduler.ts` now map over however
many attachments were parsed instead of a single ternary. Also fixed a
formatting side effect caught during live re-verification: the original
regex ate the newline(s) *after* a removed block along with the one
before it, squishing adjacent list items together in the body
("...form.2. **Medical Report..."); now only the leading newline is
consumed, preserving the original paragraph breaks.

Re-verified live with a throwaway script replaying the exact real-world
failure shape (a multi-document reply modeled on the actual Danny
Ferreira message from the live db, now with blocks included per the
strengthened instruction): both attachments land as real files on disk
with correct content, and the body reads cleanly with blocks stripped and
paragraph breaks intact. lint/typecheck/build pass; full suite green.

## Test Notes
733 → 751 net (+18, all passing; re-run 3x, stable) across 4 files.

New `generatedAttachment.test.ts` (+12) is the core unit coverage, split
across `extractAttachmentBlock` (AC1/AC5: a well-formed trailing block
splits cleanly from the text before it, in both a bare-reply-body context
and a Subject/body one; no block present, a malformed block missing its
closing marker, and an empty filename/content all gracefully fall back to
`attachment: null`) and `writeGeneratedAttachment` (AC2: a real HTML file
lands on disk under the given directory with the Markdown actually
rendered; AC4: the source Markdown is carried as `extractedText`; always
forces a `.html` extension regardless of what was requested; a
path-traversal filename (`../../etc/passwd`) can't escape its own
directory; an embedded `<script>` tag is stripped from the written file;
two attachments requesting the identical filename land in separate
directories without colliding).

`personaReply.test.ts` (+3, AC1/AC2/AC5) and `scheduler.test.ts` (+2,
AC1/AC2/AC5) cover the same three shapes end-to-end through each real
generator: a response with an attachment block produces a message whose
`attachments` array has a real file on disk containing the expected
content, with the block itself cleanly stripped from the email body; a
response with no block produces `attachments: []`, unaffected (AC5, the
everyday case); and (`personaReply.test.ts` only, since `NO_REPLY` is
specific to replies) an attachment block riding along with a `NO_REPLY`
response is discarded entirely — no file written, no message created —
confirmed by asserting `db.listMessages('inbox')` stays empty.

`ReadingPane.test.tsx` (+1, AC3): clicking an attachment with a real
`path` calls `window.api.attachments.open` with that path instead of
toggling the old placeholder note. The pre-existing mock-attachment test
was tightened with an explicit assertion that `attachments.open` is never
called for a `path`-less (true mock) attachment, locking in the branch
this feature added to `ReadingPane.tsx`'s click handler.

Deliberately not covered by an automated test: the `attachments:open` and
`attachments:extractText` IPC handlers' actual delegation to Electron's
`shell`/`dialog` modules (no established pattern in this repo for mocking
those in a main-process unit test, same as the untested `scenario:pickPack`/
`personasFile:pick`/`attachments:pick` wrappers), and a real end-to-end
double-click-to-open against a live OS file association (no attached
display on this dev box). AC4 (persists across restart) is covered
structurally by `writeGeneratedAttachment` writing to a real path under a
caller-supplied durable directory rather than a temp folder — the actual
"restart and reopen" round-trip was proven live during `/implement`'s
throwaway script, not re-encoded as a permanent test, since it would only
be re-testing `MailDb`'s own JSON round-trip (already covered elsewhere).
lint/typecheck/build all pass.

### Post-`/validate`, pre-`/accept` fix round
751 → 753 net (+2, all passing; re-run 3x, stable). `generatedAttachment.test.ts`'s
`extractAttachmentBlock` describe block was renamed to `extractAttachmentBlocks`
and rewritten for the new plural `{ text, attachments: [] }` shape (all
prior single-attachment/no-block/malformed-block/empty-field cases kept,
now asserting an array); added one new case proving multiple interleaved
blocks in one response all get extracted, in order, with the surrounding
prose left intact. `personaReply.test.ts` gained one regression test
modeled directly on the real failure (a multi-document reply, each
document's mention immediately followed by its own block) confirming both
attachments are written as real files and the narrative text around them
survives untouched. `scheduler.test.ts`/`ReadingPane.test.tsx` needed no
changes — they exercise the generators/UI through their public shape,
which didn't change (an array was always possible; it just always had 0
or 1 entries before).

## Validation Notes
First pass (`git diff --stat` 1b39043..31fa317): lint/typecheck/build
passed, full suite 751/751 stable across 3 runs, all 4 ACs looked correct
by static inspection and mocked-response tests. **That validation missed a
real gap**: AC1 was only checked structurally (the code calls the parser
before other parsing, mocked tests supply well-formed blocks) — nothing in
that pass exercised what a real provider actually returns for a
"realistically-written email" prompt. The user's own live testing against
a real Anthropic API caught what static/mocked checks couldn't: the model
reliably narrated fictional attachments without ever invoking the
protocol. See the Implementation Notes' "Post-`/validate`, pre-`/accept`
fix" subsection for the full diagnosis (done by reading the live app's own
SQLite database directly) and fix.

Second pass, after the fix (lint/typecheck/build all pass; full suite
753/753, re-run 3x, stable):
- **AC1**: re-verified the same way as before (both generators call
  `extractAttachmentBlocks` before other parsing) — the meaningful
  addition this time is the regression test in `personaReply.test.ts`
  modeled directly on the real failure shape (a multi-document reply,
  blocks interleaved with narrative text), plus the live verification
  script replaying the actual Danny Ferreira message from the live
  database with blocks now included. AC1 was NOT re-verified against a
  second live API call in this pass (that's the user's to confirm) — the
  fix's evidence is the diagnosed root cause plus the strengthened,
  explicit instruction wording; whether the new wording achieves 100%
  compliance against every provider/model is inherently the same
  category of manual/live check as this project's other live-LLM ACs.
- **AC2/AC3/AC4**: unaffected by the fix (file-writing, IPC, and UI wiring
  are untouched) — still hold for the same reasons as the first pass.
- **AC5**: still holds — `parsedAttachments.map(...)` on an empty array is
  still `[]`, byte-for-byte the same as before; the two AC5 tests and
  every pre-existing test in both generator files still pass unmodified.

Not independently re-verified: a second live LLM call confirming the
strengthened instruction actually changes real-world model behavior (the
user's own follow-up test, once they resume `/accept`), a live OS
file-association double-click (no attached display on this dev box), and
the `attachments:open`/`extractText`/`pick` IPC handlers' actual
`shell`/`dialog` delegation (no established main-process mocking pattern
in this repo — same non-blocking gap category as every prior
`dialog`-touching feature).

All checks pass except the one item above that only the user can confirm
live. Phase set to `accept`.

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
