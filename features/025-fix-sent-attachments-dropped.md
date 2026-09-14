---
id: 025
title: Fix — attachments persist on the Sent Items copy
status: validating
priority: high
---

## Description
Fixes `BUGS.md` B004. Composing a message with attachments and sending it
now retains those attachments on the Sent Items copy; reopening a sent
message shows the same attachments it was sent with.

## Acceptance Criteria
- [ ] Sending a message with one or more attachments results in the Sent
      Items row having the same `attachments` array as what was submitted
- [ ] Reopening that sent message in the Reading Pane shows the attachments
- [ ] Draft messages with attachments are unaffected (regression check)
- [ ] Reply/Reply All/Forward with attachments on the outgoing message also
      persist correctly to Sent Items

## Implementation Notes
No source change was needed — investigation found the bug does not
reproduce against the current codebase. Traced the full data path end to
end:

- `ComposeWindow.tsx`'s single `persist()` call site includes `attachments`
  (current component state) in the `fields` object passed to both
  `messages.create` and `messages.update`, for every intent (fresh
  compose, reply, reply all, forward, and editing-an-existing-draft-then-
  Send) — there's only one `persist()`/one attachments state variable, no
  per-intent branch that could drop it.
- `db:messages:create`/`db:messages:update` (`src/main/data/ipc.ts`) are
  pure passthroughs straight to `MailDb.createMessage`/`updateMessage` —
  no transformation, no field allowlist that could strip `attachments`.
- `MailDb.createMessage` (`src/main/data/db.ts`) builds the full row as
  `{ ...defaults, attachments: [], ...message }` — the caller-supplied
  `message.attachments` always wins over the `[]` default (correct spread
  order; confirmed via `git log` this has been unchanged since feature
  002). `updateMessage` similarly does `{ ...existing, ...patch, id }`, so
  a patch that includes `attachments` always overrides the existing value.
- `ReadingPane.tsx` renders `displayedMessage.attachments` unconditionally
  — no `folderId === 'sent'` (or any folder) branch anywhere near it.

Verified live: bundled `db.ts` standalone with `esbuild` and drove a real
(non-mocked) `MailDb` through all 4 AC scenarios — fresh send with
attachments, editing-an-existing-draft (with attachments) then Send via
the update path, a reply/forward-shaped sent message with a freshly-added
attachment, and a draft resave that doesn't touch attachments — every
case round-tripped through create/update and a subsequent `getMessage`
re-fetch with the attachments array intact and unchanged.

Conclusion: `BUGS.md`'s B004 either describes a transient state from
mid-development of feature 009 (the attachments UI, built the same day
B004 was reported) that was already corrected before that feature's own
commit, or was a one-off observation that doesn't hold against the
current code. No fix to apply. Flagged this explicitly to the user rather
than silently closing the feature — if attachments are still observed
missing from Sent Items live, that would point to something outside this
traced path (e.g. a real-Electron-only IPC/contextBridge quirk this
sandbox's Node-only checks can't exercise, since no Xvfb is available
here, same gap noted in every prior feature's validate stage).

Since there's no code defect, this feature's value is in adding
regression coverage across the full path so a future change can't
silently reintroduce this — left for `/test` to add, per the loop's normal
division of labor.

## Test Notes
Since `/implement` found no code defect, this stage's job was closing the
coverage gap that let B004 go unverified: prior tests only proved
`ComposeWindow` *called* `messages.create`/`update` with the right
`attachments` (mocked IPC) or that `db.ts` attachments survive a close/
reopen for an `inbox`-folder message — nothing exercised a real `sent`-
folder create, the update-based "resend an edited draft" path, or the
Reading Pane actually displaying attachments on a `sent` message.

Added 7 tests total, all named `B004/025 AC<n>: ...` for traceability:

`src/main/data/db.test.ts` (+4, integration-level against a real `MailDb`,
no mocking):
- AC1+AC2: a `sent`-folder message created with attachments keeps them on
  an immediate re-fetch (the Reading Pane's "reopen" path) and after a full
  close/reopen of the database.
- AC1: sending an *existing draft* — `createMessage` into `drafts` then
  `updateMessage` to `folderId: 'sent'`, exactly the path `ComposeWindow`'s
  `draftId` branch takes — keeps/updates attachments correctly.
- AC4: a reply/forward-shaped `sent` message (quoted body, `Re:` subject)
  with an attachment persists it.
- AC3 (regression): editing a draft's subject without touching
  `attachments` in the patch leaves the existing attachments untouched
  (proves `updateMessage`'s merge doesn't need `attachments` re-sent every
  time, and doesn't accidentally clear it when absent from the patch).

`src/renderer/src/ComposeWindow.test.tsx` (+2): AC4 specifically for the
renderer path — adding an attachment chip while replying, and while
forwarding, then Send, asserts `messages.create` is called with exactly
that attachment. (The pre-existing "sending them along" test only covered
a fresh compose, not reply/forward.)

`src/renderer/src/components/ReadingPane.test.tsx` (+1): AC2 — a message
with `folderId: 'sent'` and an attachment renders the attachment button,
same as the pre-existing (inbox-folder) attachment-rendering test, closing
the gap that no test had ever set `folderId: 'sent'` specifically.

Full suite 414 → 421, all passing, re-run 3x stable. lint/typecheck/build
all pass. Deliberately not covered: real Electron contextBridge/IPC
serialization (same non-blocking sandbox gap noted in every prior
feature — no Xvfb here); if the reported bug is real and lives there
rather than in the traced Node-side path, these tests wouldn't catch it.

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
