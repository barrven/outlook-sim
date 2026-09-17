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

## Validation Notes
lint/typecheck/build all pass. Full suite 751/751, re-run 3x, stable.
`git diff --stat` (1b39043..31fa317) confirms `/implement`+`/test` touched
only the expected files — no drift.

All 4 ACs re-verified directly against current source:
- **AC1**: both `personaReply.ts:5,59` and `scheduler.ts:4,42` import and
  append the shared `ATTACHMENT_PROMPT_INSTRUCTION` to their system
  prompts, then both call `extractAttachmentBlock(result.text)`
  (`personaReply.ts:130`, `scheduler.ts:127`) before any other parsing —
  the same shared protocol in both generators, confirmed structurally and
  by the 5 new `personaReply.test.ts`/`scheduler.test.ts` cases exercising
  real (mocked) LLM responses end-to-end.
- **AC2**: `main/index.ts:29`'s `userDataDir = app.getPath('userData')` —
  the same value already passed to `MailDb`/`ConfigStore`/`SimClock` — is
  threaded through `registerDataIpcHandlers`/`UnsolicitedMailScheduler`
  into `writeGeneratedAttachment(userDataDir, ...)`
  (`personaReply.ts:144`, `scheduler.ts:135`), which writes a real,
  Markdown-rendered HTML file there (not a filename placeholder) —
  confirmed by `generatedAttachment.test.ts`'s file-on-disk assertions and
  live during `/implement`'s throwaway script.
- **AC3**: `main/index.ts:134`'s `attachments:open` handler
  (`shell.openPath`) is wired into `ReadingPane.tsx:123-124`'s attachment
  click handler for any attachment carrying a real `path` — confirmed by
  the new `ReadingPane.test.tsx` case, and by inspection that this also
  applies to feature 062's real outgoing attachments (same shared
  component), closing a gap those earlier features left open.
- **AC4**: falls out of AC2's persistent-directory choice
  (`app.getPath('userData')`, not a temp dir) plus `MailDb`'s existing
  JSON round-trip for the `attachments` column (unchanged by this
  feature) — proven live during `/implement` by reopening a fresh `MailDb`
  instance against the same directory and confirming the attachment was
  still there. Not re-encoded as a permanent test, since doing so would
  only re-test `MailDb`'s own already-covered JSON persistence.
- **AC5**: `ATTACHMENT_PROMPT_INSTRUCTION` explicitly tells the model
  "only... if a real document genuinely belongs... most emails do NOT
  need one"; structurally, `attachments = attachment ? [...] : []`
  (`personaReply.ts:144`, `scheduler.ts:135`) means the everyday case is
  byte-for-byte the same `[]` this code always produced before this
  feature. Confirmed by the two AC5-labeled tests plus every pre-existing
  test in both files (24+29 of them) continuing to pass unmodified — none
  needed updating for the new optional behavior, which is itself evidence
  the everyday path is unaffected.

Not independently re-verified: a live OS file-association double-click
(no attached display on this dev box) and the `attachments:open`/
`extractText`/`pick` IPC handlers' actual `shell`/`dialog` delegation (no
established main-process `dialog`/`shell` mocking pattern in this repo —
same non-blocking gap category as every prior `dialog`-touching feature,
e.g. 021/022/031/062).

All checks pass, no gaps found. Phase set to `accept`.

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
