---
id: 005
title: Mail reply, reply all & forward
status: done
priority: high
---

## Description
From the reading pane, trainee can reply, reply all, or forward the selected
message, with the compose window pre-filled accordingly (recipients,
subject prefix, quoted body).

## Acceptance Criteria
- [x] Reply pre-fills To with the original sender and quotes the original
      body
- [x] Reply All pre-fills To with sender + all original recipients
- [x] Forward clears To, keeps quoted body, and allows picking new
      recipients
- [x] All three mock-send into Sent the same way as a new compose
- [x] Subject is prefixed appropriately (Re:/Fwd:) without duplicating
      prefixes on repeated replies

## Implementation Notes

**Scope decision (confirmed with user):** the data model only had a single
To recipient — no Cc, no multi-recipient concept anywhere — so Reply and
Reply All had nothing to meaningfully differ on. Rather than ship them as
aliases, added Cc support to the data model so Reply All can populate Cc
with the other original recipients. This is bigger than the feature's
literal description but was explicitly approved before implementing.

**Data model** (`src/shared/data-types.ts`, `src/main/data/db.ts`):
added `MessageRecipient { name, email }` and a `cc: MessageRecipient[]`
field on `MailMessage` (optional on `NewMailMessage`, defaults to `[]`
like `categories`/`attachments`). SQLite: new `cc TEXT` column, stored as
JSON like the existing array columns; added a `PRAGMA table_info` based
migration (`migrateMessagesCcColumn`) so an already-existing on-disk DB
from earlier features picks up the column via `ALTER TABLE` (schema's
`CREATE TABLE IF NOT EXISTS` alone wouldn't touch existing installs).

**Reply/Reply All/Forward compose flow:** compose windows already load via
a separate `BrowserWindow` with state passed through URL query params
(`main.tsx` reads `compose`/`draftId`). Extended that: `window.api.compose.open`
now takes an options object (`{ draftId? }` for edit-draft, or
`{ sourceMessageId, intent }` for reply/replyAll/forward), threaded through
`preload` → `window:openCompose` IPC → `createComposeWindow` (sets window
title and query params) → `main.tsx` → `ComposeWindow`. `ComposeWindow`
fetches the source message + trainee identity and derives the prefill via
a new pure helper, `src/renderer/src/composeIntent.ts::buildComposeSeed`:
- Reply: To = original sender, quoted body, `Re:` prefix.
- Reply All: same, plus Cc = original To (if not self/sender) + original Cc
  (minus self), de-duplicated.
- Forward: To cleared, same quoted body, `Fwd:` prefix.
- Subject prefixing skips re-prepending if the subject already starts with
  that exact prefix (case-insensitive), so repeated replies/forwards don't
  stack (`Re: Re: …`), matching the AC.

**UI:** Reply/Reply All/Forward buttons added to `ReadingPane`'s header
(next to where "Edit draft" already lived, mutually exclusive with it —
these three only show outside the Drafts folder). `ComposeWindow` gained a
Cc row: a persona picker plus removable chips, and Cc is now shown in
`ReadingPane`'s To/Cc line when present. The ribbon's pre-existing
Reply/Reply All/Forward buttons were left as the disabled stubs they
already were — the feature scopes this to the reading pane, matching its
Description.

**Mock-send:** reused the existing `persist()` path unchanged (folderId
`sent`/`drafts`), so all three intents mock-send into Sent exactly like a
new compose (AC4) with no special-casing needed.

**Compile-only touch-ups:** existing test fixtures/literals for `MailMessage`
across `ComposeWindow.test.tsx`, `ReadingPane.test.tsx`, `MessageListPane.test.tsx`,
and `App.test.tsx` needed a `cc: []` added (new required field), and
`ReadingPane.test.tsx` render calls needed the three new required props
wired to `vi.fn()`; one existing `ComposeWindow.test.tsx` assertion had to
scope its `findByRole('option', …)` query to the To `<select>` since the
new Cc `<select>` now offers the same persona option text. No new test
coverage was added for the feature itself — that's `/test`'s job.

**Not done:** live end-to-end verification in the real Electron app (this
feature's compose-window query-param plumbing is the kind of multi-window
IPC Vitest can't exercise, similar to feature 004). No Playwright/xvfb
driver exists in this repo yet and building one was judged out of scope
for `/implement`; flagging for `/validate` to live-check, same as feature
003's precedent of deferring the live check to that stage.

**Files touched:** `src/shared/data-types.ts`, `src/main/data/db.ts`,
`src/main/index.ts`, `src/main/windows.ts`, `src/preload/index.ts`, `src/preload/index.d.ts`,
`src/renderer/src/main.tsx`, `src/renderer/src/App.tsx`,
`src/renderer/src/ComposeWindow.tsx`, `src/renderer/src/composeIntent.ts` (new),
`src/renderer/src/components/ReadingPane.tsx`, `src/renderer/src/styles/global.css`,
plus the compile-only test fixture touch-ups listed above.

## Test Notes

Added 26 new tests across 5 files (61 → 87 total, all passing), plus
typecheck/lint/build all clean.

- **`src/renderer/src/composeIntent.test.ts` (new, 15 tests):** pure unit
  tests for `buildComposeSeed` — the core logic behind every AC. Covers
  Reply's To/quoted-body prefill (AC1); Reply All's Cc derivation
  (original recipient list minus self/sender, de-duped, including the
  common case where Cc stays empty because the trainee was the only
  original recipient) (AC2); Forward clearing To while keeping the quoted
  body (AC3); and subject-prefix dedup for both `Re:` and `Fwd:` —
  same-prefix repeats don't stack, cross-prefix (`Re:` on a `Fwd:`
  subject or vice versa) correctly does stack, case-insensitive
  detection, and an empty-subject edge case (AC5).
- **`ComposeWindow.test.tsx` (+5 tests):** integration-level coverage
  wiring `sourceMessageId`/`intent` props through to the rendered form —
  reply pre-fills To and quotes the body and mock-sends into `sent` with
  the same `messages.create({ folderId: 'sent', ... })` path a fresh
  compose uses (AC1, AC4); reply all shows the Cc chip and persists `cc`
  on send (AC2, AC4); forward clears To, disables Send until a recipient
  is picked from the persona dropdown, and sends once one is chosen (AC3,
  AC4).
- **`ReadingPane.test.tsx` (+3 tests):** Reply/Reply All/Forward buttons
  render outside Drafts and each calls the right `on*` prop with the
  selected message; buttons are absent (Edit draft shows instead) inside
  Drafts; Cc recipients render in the header when present.
- **`App.test.tsx` (+1 test):** clicking each reading-pane button calls
  `window.api.compose.open` with the corresponding
  `{ sourceMessageId, intent }`, confirming the wiring from ReadingPane
  through App into the IPC-facing API (scoped to the reading pane via
  `within(...)` since the ribbon has same-named disabled stub buttons).
- **`db.test.ts` (+3 tests):** Cc round-trips through create/update/reopen
  like the existing array columns; an explicit Cc list is accepted on
  create; and — most load-bearing — a message table built *without* the
  `cc` column (simulating an on-disk DB from before this feature) is
  transparently migrated by `MailDb`'s constructor via `ALTER TABLE`,
  verified by reading back a pre-existing row and creating a new one
  afterward. This directly de-risks the real `~/.config/outlook-sim/`
  database the user has been using since feature 002.

**Deliberately not covered:**
- Live multi-window Electron behavior (query-param passing through a real
  `BrowserWindow`, window titles). Still deferred to `/validate` per the
  Implementation Notes — no Playwright/xvfb driver exists in this repo.
- The ribbon's Reply/Reply All/Forward buttons — they're pre-existing
  disabled stubs, out of this feature's scope, untouched.
- Exhaustive Cc-chip-removal UI interaction (add/remove multiple Cc
  recipients via the picker) — the underlying state transitions
  (`addCc`/`removeCc`) are simple array ops exercised indirectly through
  the reply-all prefill test; a dedicated add/remove-chip UI test wasn't
  worth the marginal coverage given time constraints.

## Validation Notes

**Automated checks — all pass:**
- `npm run lint` — clean, no output.
- `npm run typecheck` — clean, no output.
- `npm run build` — clean (main/preload/renderer all built successfully).
- `npm test` — **87/87 passing** (full suite, not just this feature's new
  tests).

**Extra mechanical check beyond the test suite:** copied the user's real,
already-existing `~/.config/outlook-sim/outlook-sim.db` (from earlier
sessions, pre-dating this feature — one message, no `cc` column) into a
scratch dir and opened it with the actual `MailDb` class (compiled
standalone, no Electron needed). The migration ran cleanly: the existing
message read back with `cc: []`, and a newly created message also
defaulted to `cc: []`, with no errors. The original file's mtime was
confirmed unchanged afterward — only the copy was touched. This directly
de-risks the migration path against the real file the user has, not just
synthetic `db.test.ts` fixtures.

**Acceptance criteria:**

1. **"Reply pre-fills To with the original sender and quotes the original
   body"** — PASS. `composeIntent.ts::buildComposeSeed`'s default branch
   sets `toName`/`toEmail` from `message.fromName`/`fromEmail` and `body`
   to a `>`-quoted copy of the original. Verified by 2 unit tests in
   `composeIntent.test.ts` and an integration test in
   `ComposeWindow.test.tsx` that renders with `sourceMessageId`+`intent="reply"`
   and checks the rendered To field and body textarea.

2. **"Reply All pre-fills To with sender + all original recipients"** —
   PASS, under the scope the user approved during `/implement`: with only
   a single-recipient message model, Reply and Reply All had nothing to
   differ on, so — after explicit confirmation via `AskUserQuestion` — Cc
   support was added to the data model. Reply All keeps the sender in To
   (same as Reply) and populates **Cc** with the other original
   recipients (original To if it wasn't the trainee, plus original Cc
   minus the trainee, de-duplicated) rather than stuffing everyone into
   the To field literally. This is a clarified interpretation of the AC
   text, not a deviation discovered now — it's the design the user picked
   when asked. Verified by 5 unit tests (empty-Cc common case, original-To
   promotion, original-Cc carry-through, de-dup across To/Cc, sender
   exclusion) and an integration test confirming the Cc chip renders and
   is persisted on send.

3. **"Forward clears To, keeps quoted body, and allows picking new
   recipients"** — PASS. `buildComposeSeed('forward', ...)` returns empty
   `toName`/`toEmail` and the same quoted body; the existing persona
   `<select>` for To is unchanged and remains fully pickable (Send stays
   disabled until a recipient is chosen, same as a from-scratch compose).
   Verified by unit tests plus a `ComposeWindow.test.tsx` integration test
   that picks a new recipient and sends.

4. **"All three mock-send into Sent the same way as a new compose"** —
   PASS. All three intents flow through the same unmodified `persist()` in
   `ComposeWindow.tsx`; verified directly for reply, replyAll, and forward
   (each asserts `messages.create` called with `folderId: 'sent'` and the
   expected fields), alongside the pre-existing from-scratch-compose test
   using the identical code path.

5. **"Subject is prefixed appropriately (Re:/Fwd:) without duplicating
   prefixes on repeated replies"** — PASS. `addSubjectPrefix` skips
   re-prepending when the subject already starts with that exact prefix
   (case-insensitive); a reply to an already-`Re:` subject stays `Re: …`
   and a forward of an already-`Fwd:` subject stays `Fwd: …`, while
   cross-prefix stacking (`Re: Fwd: …`) is preserved as standard mail
   client behavior. Covered by 7 unit tests including case-insensitivity
   and an empty-subject edge case.

**Live Electron GUI verification: attempted, blocked by the sandbox, judged
non-blocking.** Tried to launch the real app to click through the reading
pane and compose window by hand:
- No `Xvfb`/`xvfb-run` binary exists in this environment (only stray
  bash-completion scripts referencing the name).
- `apt-get install -y xvfb` failed — no filesystem write permission to
  dpkg's lock without root.
- `sudo apt-get install -y xvfb` failed — requires interactive password
  auth, which isn't available to a non-interactive session.
- Tried launching Electron directly without a display: with
  `--ozone-platform=headless --disable-gpu` it segfaults; with default
  flags and no `$DISPLAY` it hangs indefinitely (killed by timeout,
  no diagnostic output either way).

This is the same sandbox display limitation logged for feature 001
("manual offscreen-Electron launch... no lint tooling exists yet, flagged
not blocking") and feature 002 ("full-app launch unverified... same
sandbox display limitation as feature 001, not a regression") — a
pre-existing environment gap, not something this feature introduced or
could fix from inside `/validate`. Given: (a) the logic this feature adds
is now covered end-to-end by unit + integration tests down to the exact
DOM interactions a user would perform, (b) the highest-risk part (the
SQLite migration) was verified against the user's actual on-disk database
copy above, and (c) `/accept` is the human gate where the user drives the
real app themselves anyway, this is treated as a flagged-but-non-blocking
gap rather than a failed check. If the user wants a scripted
Playwright/xvfb driver for future features, that's worth setting up
separately (would need `sudo apt-get install xvfb` + `libnss3` etc., which
this session can't do unattended).

## Acceptance Log

Presented the feature summary (behavior per AC, the Cc-based scope note,
validation results including the 87/87 test run and the real-DB migration
check, and the live-GUI-verification gap) via `AskUserQuestion` with three
options: Accept / Request changes / Reject. The user selected **Accept**.

**Decision: accepted.**
