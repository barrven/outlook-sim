---
id: 009
title: Mail mock attachments
status: validating
priority: low
---

## Description
Compose and received messages can carry mock attachments — a filename and
file-type icon/placeholder only, with no real file payload.

## Acceptance Criteria
- [ ] Compose window allows adding one or more mock attachments by
      entering/picking a filename
- [ ] Attachments render in the reading pane as filename + placeholder
      icon, with no real file content behind them
- [ ] Attachments persist with the message across restarts
- [ ] "Opening" a mock attachment does not attempt any real file I/O beyond
      the placeholder

## Implementation Notes
The data model, SQLite persistence (JSON `attachments` column), and `NewMailMessage`/`MailMessagePatch`
typing already existed from feature 002 (`MessageAttachment { filename: string }`) — this feature is
entirely UI, wiring the existing field into compose and the reading pane.

`ComposeWindow.tsx`: new `attachments`/`attachmentDraft` state, following the exact chip-list pattern
already used for Cc (add-by-text-entry form, remove button per chip). Loaded from an existing draft on
edit; fresh compose and reply/reply-all/forward all start with an empty list (attachments aren't part of
`composeIntent.ts`'s scope, and 005 never touched them — carrying attachments over on forward would be a
scope expansion beyond this feature's ACs, so deliberately left out). Included in the `persist()` fields
object sent to `messages.create`/`messages.update`, same as every other field.

`ReadingPane.tsx`: attachments render as a row of 📎-prefixed buttons below the categories row. Clicking
one toggles a small "Mock attachment — no file content." note next to it (AC4) — the click handler
(`handleToggleAttachment`) only flips a piece of React state, with no filesystem/IPC call anywhere in the
path, so there's no real file I/O to attempt in the first place. The open/toggle state resets whenever
the selected message changes, same lifecycle as the existing category-draft reset.

No changes to `db.ts`, IPC, or preload — the whole surface already round-trips through the generic
`messages.create`/`update`/`get` path. Verified live (standalone script) that attachments survive a
simulated app restart (`MailDb` closed and reopened against the same directory) before considering this
done. lint/typecheck/build pass, existing suite still 361/361 unchanged; phase set to `test`.

## Test Notes
Added 10 tests (361 → 371, all passing; re-ran full suite 3x, stable). `ComposeWindow.test.tsx` gained
an "attachments" block (5 tests, AC1): adding two attachments by typed filename renders them as chips
and includes both in the `messages.create` payload; submitting an empty filename adds nothing; a chip's
remove button removes it; an existing draft's attachments prefill into chips; reply deliberately does
*not* carry the source message's attachments over (a scope boundary, not a bug — `composeIntent.ts` never
handled attachments and this feature doesn't ask for that). `ReadingPane.test.tsx` gained 4 tests (AC2/AC4):
attachments render as named, clickable buttons with no note shown by default; a message with none shows
no attachments row at all; clicking an attachment toggles the "Mock attachment — no file content." note
(and clicking again hides it) while asserting `messages.update` is never called as a result — the
strongest test-level proxy available for "no real file I/O", since there's no filesystem/IPC call in the
component to begin with; the open note resets when a different message is selected. `db.test.ts` gained
one test (AC3) proving a message's attachments (filename-only objects) survive a `MailDb` close/reopen
cycle, mirroring the existing read/flags/categories persistence test. No new tests were needed for
`db.ts`/IPC/preload beyond that, since attachments already flowed through the pre-existing generic
`messages.create`/`update`/`get` surface from feature 002 — this feature only added UI on top of it.
lint/typecheck/build all still pass; phase set to `validate`.

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
