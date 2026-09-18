---
id: 064
title: Mail — multimodal image attachments sent directly to the LLM
status: done
priority: medium
---

## Description
When an attached file (feature 062) is an image, send it directly to the
configured LLM provider/model as an image — not OCR'd or text-extracted —
when that provider/model supports multimodal input.

## Acceptance Criteria
- [ ] An attached image file (PNG/JPEG at minimum) is sent as an image
      content block to the LLM when generating a persona reply, for
      providers/models that support multimodal input
- [ ] For a provider/model that doesn't support multimodal input, the
      image attachment is omitted from the LLM context gracefully — no
      crash, no failed send; the filename still shows in the UI
- [ ] No local OCR or text extraction is attempted on image content
      (matches the spec's Non-goals)

## Implementation Notes
New `src/main/llm/imageAttachment.ts`: `readImageAttachment(filePath)` reads a
PNG/JPEG attachment's raw bytes off disk and base64-encodes them (never
OCR'd/text-extracted — AC3), returning `undefined` for any other extension,
a missing file, or a read error — same never-throws convention as feature
063's `extractAttachmentText`. `LlmGenerateInput` (shared/data-types.ts)
gained an optional `images: Array<{ mimeType, base64Data }>`.
`personaReply.ts`'s `collectImageAttachments()` reads image attachments
fresh from the thread at generation time (not stored as `extractedText`)
and passes them into `generateText`.

`client.ts`'s `buildRequest` attaches images as each provider's native
multimodal content block when present (OpenAI/xAI `image_url` data URLs,
Anthropic `image` base64 source blocks, Gemini `inline_data` parts) — content
stays a plain string when there are no images, so every pre-existing
non-image request/test shape is unchanged (AC1).

AC2 (graceful omission for a non-multimodal provider/model): this app has no
per-model capability list — `model` is a free-text field — so there's no way
to know in advance whether a given model accepts image content. `client.ts`
now tries the request with images first and, only if that attempt fails,
retries once with `images: undefined`, returning that result instead. A
provider/model that rejects the image content block still produces a normal
reply (or a normal unrelated failure, on the retry) rather than surfacing an
image-specific failure — no crash, no failed send, and the attachment's
filename still appears in the thread transcript's "Attachments:" line either
way (unchanged from feature 063).

Verified live via a throwaway script: `buildRequest` produces the expected
content-block shape for all 4 providers given a fake base64 image, and the
retry-without-images path returns a clean success when the first (with-image)
attempt is made to fail. lint/typecheck/build pass; full suite unchanged at
793/793 (no new tests yet — that's `/test`'s job).

## Test Notes
793 → 813 net (+20, all passing; re-run 3x, stable) across 3 files. New
`imageAttachment.test.ts` (+9) covers `readImageAttachment` directly: PNG/
JPG/JPEG (AC1) each produce the correct mime type and an exact base64
round-trip of the raw bytes (AC3 — no derived/extracted content, verified by
decoding the result back to the original `Buffer`), case-insensitive
extension matching, and graceful `undefined` for an unsupported extension
(`.gif`), a non-image extension, and a nonexistent file.

`client.test.ts` (+8, new "multimodal image attachments (feature 064)"
block) covers AC1's exact content-block shape for all 4 providers (OpenAI/
xAI `image_url` data URL, Anthropic base64 `image` source, Gemini
`inline_data` part) alongside the unchanged text, confirms plain-string
content when `images` is empty (no regression to every pre-existing
non-image request), and covers AC2's graceful-degradation retry: a failed
first (with-image) attempt is retried once with `images` stripped and
returns the clean second result; if that retry also fails, the failure
surfaces normally (not swallowed); and no retry happens at all when there
were no images to begin with (an unrelated failure isn't retried twice).

`personaReply.test.ts` (+4) covers the end-to-end wiring: a real image
attachment (from a message in the thread, not just the triggering one)
becomes an image content block with the exact original file bytes, while
the "Attachments: <filename>" text line is preserved unchanged (AC1); a
non-image attachment (`report.pdf`) never becomes an image block, content
stays a plain string (AC3); images are collected across every message in
the thread, not just the one that triggered the reply; and AC2 end-to-end —
a provider rejecting the image on the first call still produces a normal
reply on retry, with the filename intact in the retried prompt.

Deliberately uncovered: a live call against a real multimodal-capable
provider actually referencing image content in its reply (inherently
manual, same category as this project's other live-LLM ACs) and the exact
wording/behavior a specific real non-multimodal model returns when it
rejects an image block (client.ts's retry only depends on the response
being non-ok, not on any particular error message, so this is a design
property rather than something worth mocking one specific vendor's error
text for).

## Validation Notes
lint/typecheck/build pass; full suite (813/813) re-run 4x total across
`/test` and `/validate`, stable. `git diff --stat` (c2052c2..HEAD, the
commit immediately before this feature's `/implement` started) confirms
`/implement`+`/test` touched only the expected files (2 new: `imageAttachment.ts`
+ its test; 8 modified: `client.ts`/`personaReply.ts`/`data-types.ts` plus
their tests, the feature file, BACKLOG, STATE). No new dependency was added
(`package.json`/`package-lock.json` unchanged), which is itself part of
AC3's evidence — no OCR/vision library was pulled in.

All 3 ACs re-verified directly against current source, not just by
re-running the new tests:

- **AC1** (image sent as a content block, PNG/JPEG minimum):
  `imageAttachment.ts`'s `IMAGE_MIME_TYPES` covers `.png`/`.jpg`/`.jpeg`
  exactly (AC's literal "at minimum"). `personaReply.ts`'s
  `collectImageAttachments()` reads every attachment with a `path` across
  the whole thread through `readImageAttachment`, then passes the result as
  `images` into `generateText`. `client.ts`'s `buildRequest` attaches those
  images as each provider's actual multimodal content-block shape whenever
  `images.length > 0`: OpenAI/xAI `image_url` data-URL blocks, Anthropic
  base64 `image` source blocks, Gemini `inline_data` parts — confirmed by
  reading the switch statement directly, and cross-checked against each
  provider's real API request shape.
- **AC2** (graceful omission for a non-multimodal provider/model, no crash,
  no failed send, filename still shows): confirmed structurally that the
  original message send (`ComposeWindow.tsx`'s `persist()`) writes the
  message — filename included, independent of any LLM call — before the
  fire-and-forget `llm.personaReply` IPC call even starts, so the send
  itself can never fail because of this feature. For the reply-generation
  call itself, `client.ts`'s `generateText` tries the request with images
  first and, only if that attempt's response is non-ok, retries once with
  `images: undefined` and returns that result — so a provider/model that
  rejects the image content block still produces a normal reply instead of
  a failed generation, and the `Attachments: <filename>` text line
  (unchanged from feature 063) is present in both the with-image and
  retried prompt either way. This app has no per-model capability list
  (`model` is free-text), so this response-driven retry is the only way to
  discover non-support — a disclosed design choice, not a gap, since it
  still meets the AC's literal requirement (no crash, no failed send,
  filename intact) regardless of which specific model is configured.
- **AC3** (no local OCR/text extraction on image content): `readImageAttachment`
  does exactly one thing to the file — `readFileSync` + base64-encode, no
  parsing library involved — confirmed by reading the function body, and by
  `imageAttachment.test.ts`'s exact-byte-round-trip test (decoding the
  base64 result reproduces the original `Buffer` precisely, not some
  derived/summarized text). `attachmentExtraction.ts` (feature 063) still
  has no image extensions in either `PLAIN_TEXT_EXTENSIONS` or
  `OFFICE_EXTENSIONS`, so `extractAttachmentText` continues to resolve
  `undefined` for an image and never contributes an `extractedText` field
  for one — confirmed by reading the source (unchanged by this feature).

Not independently re-verified: a live call against a real multimodal-capable
provider (e.g. `gpt-4o` or a Claude vision model) actually referencing an
attached image's content in its generated reply, and a live call against a
genuinely non-multimodal model's real rejection response shape — both are
inherently manual/live-API checks, the same category as this project's other
live-LLM ACs (e.g. 063's AC2, 065's AC1). All checks pass, no blocking gaps
found.

## Acceptance Log
2026-09-18 — user selected "Accept (Recommended)" against the validation
summary and AC-by-AC mapping, no changes requested. Decision: accepted.
