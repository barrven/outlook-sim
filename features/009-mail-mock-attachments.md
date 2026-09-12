---
id: 009
title: Mail mock attachments
status: accept
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
lint/typecheck/build all pass. Full test suite (371/371) re-run 3x, stable. Confirmed via `git diff`
(`b4e17cf~1..b4e17cf`) that `/test` touched only test files/docs (`db.test.ts`, `ComposeWindow.test.tsx`,
`ReadingPane.test.tsx`, `STATE.md`, the feature file, `BACKLOG.md`) — no implementation drift.

Acceptance criteria:
- **Compose window allows adding one or more mock attachments by entering/picking a filename** — PASS.
  Verified by reading `ComposeWindow.tsx:82-92,210-240`: a text-entry form appends `{filename}` to
  `attachments` state on submit (blank input is a no-op), rendered as removable chips, and included
  verbatim in `persist()`'s `fields` object sent to `messages.create`/`update`. Confirmed by the 5
  automated `ComposeWindow.test.tsx` "attachments" tests (add two, reject blank, remove one, draft
  prefill, reply doesn't carry attachments over — an intentional scope boundary, not a gap, since
  `composeIntent.ts` never handled attachments).
- **Attachments render in the reading pane as filename + placeholder icon, with no real file content
  behind them** — PASS. `ReadingPane.tsx:214-231` maps `displayedMessage.attachments` to a 📎-prefixed
  button per attachment; there is no attachment payload/content field anywhere in `MessageAttachment`
  (`{filename: string}` only, unchanged from feature 002), so there is no real file content to
  accidentally render. Confirmed by the 2 relevant `ReadingPane.test.tsx` tests (attachments render as
  named buttons; a message with none shows no attachments row).
- **Attachments persist with the message across restarts** — PASS. No changes were needed to `db.ts`
  (attachments already round-tripped through the generic message CRUD path from feature 002); confirmed
  by the new `db.test.ts` close/reopen test, and by a live check against a scratch copy of the real,
  in-use `~/.config/outlook-sim/outlook-sim.db` (11 real messages): added two attachments to a real
  message via `updateMessage`, closed and reopened `MailDb` against the same file (simulating an app
  restart), and got back identical attachment content. Confirmed via `md5sum` that the real on-disk file
  was untouched afterward (all work happened against the scratch copy).
- **"Opening" a mock attachment does not attempt any real file I/O beyond the placeholder** — PASS. This
  holds structurally, not just by test: `handleToggleAttachment` in `ReadingPane.tsx:110-112` only calls
  `setOpenAttachmentIndex` — no `window.api.*`, `fs`, or IPC call anywhere in that function. Grepped all
  of `src/main` and `src/preload` for "attachment" and found attachments used only as an opaque
  JSON-serialized field (`db.ts`), never opened, read, or written as a real file anywhere in the main
  process. The automated test additionally asserts `messages.update` is never called as a result of
  toggling the note open/closed, as the strongest available test-level proxy.

No live multi-window Electron GUI click-through attempted (no Xvfb in this sandbox) — same non-blocking
gap noted for every prior feature. No issues found; phase set to `accept`.

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
