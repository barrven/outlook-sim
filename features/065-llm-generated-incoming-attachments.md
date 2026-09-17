---
id: 065
title: Mail — LLM-generated incoming attachments
status: testing
priority: high
---

## Description
When a scenario calls for a persona-generated (incoming) email to include
a document attachment, the LLM produces that document's text, which gets
rendered into a real HTML file written to local disk — replacing today's
filename-only mock for incoming mail.

## Acceptance Criteria
- [ ] A persona reply or unsolicited-mail generation can produce an
      attachment: the LLM's response includes document content for it,
      distinct from the email body itself
- [ ] That content is rendered into a real HTML file written to disk
      (under the app's existing local data directory), not just a
      filename placeholder
- [ ] The generated attachment is downloadable/openable by the user — a
      real file exists and is reachable from the UI
- [ ] A generated attachment persists correctly alongside its message
      (survives app restart, shows up when the message is reopened)
- [ ] Not every persona-generated message needs an attachment — this only
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
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
