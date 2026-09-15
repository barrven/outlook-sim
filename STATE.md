# Dev Loop State

This file is the single source of truth for where the project is in the
lifecycle. Every stage command reads it first and updates it last.

- **Outer iteration:** 2
- **Phase:** accept
- **Active feature:** 028 (Trainee identity & personas — org-structure fields)
- **Last updated:** 2026-09-15

## Phases

`spec -> features -> [implement -> test -> validate -> accept]* -> retro -> (back to spec)`

Valid values for **Phase**: `spec`, `features`, `implement`, `test`, `validate`,
`accept`, `retro`.

## History

<!-- Append a one-line entry here every time the phase changes, oldest last is fine, newest-first preferred. -->
- 2026-09-15 — feature 028 (Trainee identity & personas — org-structure
  fields) validated: lint/typecheck/build pass; full test suite
  (498/498) re-run 3x, stable; confirmed via `git diff` that `/test`
  touched only test files/docs, no implementation drift. All 4 ACs
  verified by tests + code inspection plus an unusually strong
  independent live check — this session's own real, in-use
  `~/.config/outlook-sim/config/identity.json`/`personas.json` genuinely
  predate this feature (no synthetic fixture needed): loading them via a
  fresh `esbuild`-bundled `config.ts` against a scratch copy didn't throw,
  every reader defaulted the missing `reportsTo`/`department` to `''`
  while leaving all other real data (15 personas, trainee identity)
  intact, and a further round-trip of real org-structure values persisted
  correctly without disturbing other personas' defaults. Real on-disk
  config confirmed byte-for-byte unchanged (md5) afterward. No live
  multi-window Electron GUI click-through attempted — no attached
  display; same non-blocking gap as every prior feature. Phase set to
  `accept`.
- 2026-09-15 — feature 028 (Trainee identity & personas — org-structure
  fields) tested: added 13 tests (485 → 498, all passing; re-run 3x,
  stable), all AC-traceable by number, across 3 layers — `config.test.ts`
  (+6, real `ConfigStore`): identity/persona org-fields persistence across
  close/reopen, both fields round-tripping as empty when left blank, and
  raw pre-028-shaped `identity.json`/`personas.json` written directly to
  disk loading without error and defaulting to `''`; `SettingsView.test.tsx`
  (+4): Reports To/Department prefill and save alongside existing identity
  fields, blank-is-valid, and a legacy identity object missing both fields
  rendering blank rather than crashing; `PersonasSettings.test.tsx` (+5):
  create/edit persisting Reports To, blank-is-valid on create, and a
  legacy persona missing `reportsTo` entirely opening for edit without
  error. lint/typecheck/build all pass. Test Notes filled in; phase set to
  `validate`.
- 2026-09-14 — feature 028 (Trainee identity & personas — org-structure
  fields) implemented: added `reportsTo`/`department` to `TraineeIdentity`
  and `reportsTo` to `Persona` (shared types), plus form fields in
  `SettingsView.tsx`'s Trainee Identity section and `PersonasSettings.tsx`'s
  persona editor. AC4 (pre-feature data loads without error, defaulting to
  empty) enforced at the data layer: `ConfigStore.getIdentity()`/
  `getPersonas()` now merge/default missing fields on every read, not just
  in the UI. `applyScenarioPack` defaults a loaded persona's `reportsTo` to
  `''`, same as `isClient`. Verified live: a standalone `esbuild`-bundled
  `config.ts` script wrote raw pre-028-shaped JSON directly to disk and
  confirmed it loads without error, correctly defaulting; a throwaway RTL
  smoke test drove the full UI including legacy (missing-field) identity
  and persona objects rendering blank without error. lint/typecheck/build
  pass; existing suite unchanged 485/485 (11 existing test files needed
  compile touch-ups for the two now-required fields, no unrelated
  behavior changes). Phase set to `test`.
- 2026-09-14 — feature 027 (LLM error banner — Retry button and durable
  failure log) accepted by user; logged to CHANGELOG. Active feature set
  to 028 (Trainee identity & personas — org-structure fields, next in
  BACKLOG.md table order), phase set to `implement`.
- 2026-09-14 — feature 027 (LLM error banner — Retry button and durable
  failure log) validated: lint/typecheck/build pass; full test suite
  (485/485) re-run 3x, stable; confirmed via `git diff` that `/test`
  touched only test files/docs, no implementation drift. All 4 ACs
  verified by tests + code inspection plus an independent live check —
  bundled `config.ts` standalone with `esbuild` and ran it against a
  scratch copy of the real, in-use `~/.config/outlook-sim/config/`
  directory (15 real personas carried over): two appended failure-log
  entries survived a close/reopen cycle in order, and the real config
  directory was confirmed byte-for-byte unchanged (md5) afterward. Flagged
  one cosmetic, non-blocking nit (a type declaration sitting between two
  import statements in `App.tsx`). No live multi-window Electron GUI
  click-through attempted — no attached display; same non-blocking gap as
  every prior feature. Phase set to `accept`.
- 2026-09-14 — feature 027 (LLM error banner — Retry button and durable
  failure log) tested: added 18 tests (467 → 485, all passing; re-run 3x,
  stable), all AC-traceable by number, across 5 layers — `config.test.ts`
  (+3): failure-log round-trip, ordered multi-source appends, close/reopen
  persistence; `scheduler.test.ts` (+3, plus a log assertion added to an
  existing test): the scheduler's own tick() logs exactly once per real
  failure, a dedicated `attemptUnsolicitedMail` block covers a real
  failure logging, a success logging nothing, and the no-personas no-op
  logging nothing either; `ipc.test.ts` (+6): personaReply/test failure
  logging, and a concrete Retry-mechanics test that calls
  `llm:personaReply` with the same `sentMessageId` twice (fail then
  succeed), proving both the success broadcast and that the failure log
  keeps the first attempt's entry; a new `llm:retryUnsolicitedMail`
  describe block covers both outcomes; `App.test.tsx` (+4): Retry calls
  `llm.personaReply` with the exact original `sentMessageId`, a second
  Retry failure updates the same single `role="alert"` banner rather than
  stacking, a successful Retry clears it, and the unsolicited-mail
  banner's Retry/clear path; `SettingsView.test.tsx` (+4): Retry/Dismiss
  visibility, Retry re-calling `llm.test` with the exact currently-
  displayed settings, a second failure replacing the displayed message,
  and Dismiss clearing the error without touching any form field.
  lint/typecheck/build all pass. Test Notes filled in; phase set to
  `validate`.
- 2026-09-14 — feature 027 (LLM error banner — Retry button and durable
  failure log) implemented: persona-reply failures now carry their
  `sentMessageId` through the `llm:persona-reply-failed` broadcast so
  Retry can re-issue the exact same `llm.personaReply` call; unsolicited-
  mail Retry goes through a new `llm:retryUnsolicitedMail` IPC handler
  (no caller-supplied input exists to replay there, so Retry just
  re-attempts generation via the same `attemptUnsolicitedMail` wrapper the
  scheduler's own tick() now uses). `App.tsx`'s single-slot background-
  failure state widened to a discriminated union so Retry knows which call
  to reissue while keeping the existing non-stacking behavior (AC2).
  Retry clears the banner based on the IPC call's own resolved result
  (`result.ok`), not a broadcast, since `data:messages-changed` doesn't
  fire when a persona legitimately declines to reply. Settings' Test
  Connection reuses its own existing retry-equivalent
  (`handleTestConnection`) and gained a Dismiss button. New durable
  `ConfigStore.appendLlmFailureLog`/`getLlmFailureLog`
  (`config/llm-failure-log.json`) records every failure at the point it
  happens, independent of whether its banner is later shown/dismissed — no
  in-app viewer built, not an AC bullet. `PersonaReplyResult`/
  `GenerateUnsolicitedMailResult` moved from `main/llm/*.ts` to
  `shared/data-types.ts` so the renderer/preload can type them. Verified
  live: a standalone `esbuild`-bundled script confirmed the failure log
  persists across restart and `attemptUnsolicitedMail` logs exactly once
  per real failure (zero for a no-personas no-op); two throwaway RTL smoke
  tests drove the full Retry flow for both the App-level banner (same
  `sentMessageId` replayed, clears on success, second failure updates
  rather than stacks) and Settings' Test Connection (Retry + new Dismiss).
  lint/typecheck/build pass; existing suite unchanged 467/467 (only
  `ipc.test.ts`/`App.test.tsx` needed compile touch-ups for the new
  channel and the two-argument failure callback). Phase set to `test`.
- 2026-09-14 — feature 048 (FileVine notes/files CRUD with Markdown
  content) accepted by user; logged to CHANGELOG. All high-priority
  backlog items (023-026, 047, 048) are now done. Active feature set to
  027 (LLM error banner — Retry button and durable failure log, the first
  remaining medium-priority item), phase set to `implement`.
- 2026-09-14 — feature 048 (FileVine notes/files CRUD with Markdown
  content) validated: lint/typecheck/build pass; full test suite
  (467/467) re-run 3x, stable; confirmed via `git diff` that `/test`
  touched only test files/docs, no implementation drift. All 5 ACs
  verified by tests + code inspection plus fresh independent live checks —
  a throwaway jsdom check fed `renderMarkdown` headings, a list, italic,
  bold, and a link, confirming real DOM elements come back (not raw
  source) and that a raw `<script>` tag is actually stripped, not just
  displayed-as-text; a standalone `esbuild`-bundled `db.ts` script drove
  note create/edit/close-reopen-persist/cascade-delete (including a
  nested child folder's note) against a scratch copy of the real, in-use
  `~/.config/outlook-sim/outlook-sim.db` — all correct, and the real
  on-disk DB confirmed byte-for-byte unchanged (md5) afterward. No live
  multi-window Electron GUI click-through attempted — this session has no
  attached display; same non-blocking gap as every prior feature. Phase
  set to `accept`.
- 2026-09-14 — feature 048 (FileVine notes/files CRUD with Markdown
  content) tested: added 13 tests (454 → 467, all passing; re-run 3x,
  stable), all AC-traceable by number, across 3 layers — `db.test.ts` (+6,
  real `MailDb`): create/edit/delete, folder-scoped listing, close/reopen
  persistence, and a regression test mirroring 047's own cascade-delete
  FK-ordering bug for a folder-with-nested-child's notes; `ipc.test.ts`
  (+1, incl. the exhaustive channel-list update done during `/implement`):
  full CRUD (scoped listing across two folders) through the actual
  registered handlers; `FileVineView.test.tsx` (+6): empty state, create
  (incl. blank-name no-op) and delete, a Markdown-rendering test that
  explicitly asserts the raw `# `/`**` source text does *not* appear
  anywhere (not just that the rendered tags do), a distinct-edit-mode test
  proving the rendered view is hidden while a note is mid-edit, and a
  UI-level regression for the `/implement`-stage `selectFolder()` state-
  reset fix (switching folders shows the new folder's own notes, not the
  previous folder's). lint/typecheck/build all pass. Test Notes filled in;
  phase set to `validate`.
- 2026-09-14 — feature 048 (FileVine notes/files CRUD with Markdown
  content) implemented: new `FileVineNote { id, folderId, name, content }`
  (Markdown source) plus a `filevine_notes` SQLite table and full CRUD on
  `MailDb`, mirroring 047's `filevine_folders` conventions; `047`'s
  `deleteFileVineFolder` cascade now also deletes each deleted folder's
  notes (AC5), same FK-ordering fix pattern as 047 itself. Added `marked` +
  `dompurify` (new deps — no Markdown library existed yet) behind a small
  `renderer/src/markdown.ts` wrapper for sanitized-HTML rendering, the
  app's first `dangerouslySetInnerHTML` use. Extended `FileVineView.tsx`'s
  detail pane with a Notes section: create/edit inline forms (name +
  Markdown-source textarea) following the folder tree's existing
  conventions, a rendered (not raw) view when a note is selected, and a
  structurally distinct edit mode (AC1-3). A first attempt at resetting
  note-selection state via a `useEffect` on folder-change tripped
  `react-hooks/set-state-in-effect`; fixed by moving the reset into an
  explicit `selectFolder()` handler used everywhere `selectedFolderId`
  changes, leaving the effect to only fetch. Verified live: a standalone
  `esbuild`-bundled `db.ts` script drove full note CRUD, close/reopen
  persistence, and cascade-delete (including a nested descendant folder's
  notes) against a real `MailDb`; a throwaway RTL smoke test (written, run,
  deleted) drove the full UI flow including confirming real rendered
  `<h1>`/`<strong>` tags appear, not literal Markdown source. lint/
  typecheck/build pass; existing suite unchanged 454/454 (only
  `ipc.test.ts`'s exhaustive channel-list test needed a content
  touch-up for the 5 new channels). Phase set to `test`.
- 2026-09-14 — feature 047 (FileVine tab — folder structure and client
  association) accepted by user, with one change requested before sign-off:
  the FileVine client dropdown was listing all personas (including Grollo
  Law staff), so a folder could be assigned an employee as its "client".
  Added a structured `isClient` boolean to `Persona` (a "Client" checkbox in
  Settings > Personas), filtered `FileVineView`'s client `<select>` to
  `isClient` personas (preserving an already-assigned persona in the
  dropdown even if later unmarked), and defaulted scenario-pack-loaded
  personas to `isClient: false`. Re-verified lint/typecheck/build/full
  suite (454/454, +3 tests) after the change, outside the normal
  `/test`/`/validate` stages since it was requested at this gate. Logged to
  CHANGELOG. Active feature set to 048 (FileVine notes/files CRUD with
  Markdown content), phase set to `implement`.
- 2026-09-14 — feature 047 (FileVine tab — folder structure and client
  association) validated: lint/typecheck/build pass; full test suite
  (451/451) re-run 3x, stable; confirmed via `git diff` that `/test`
  touched only test files/docs, no implementation drift. All 5 ACs
  verified by tests + code inspection plus a live end-to-end check —
  bundled `db.ts` standalone with `esbuild` and built a 3-level nested
  folder structure with a real persona client association against a
  scratch copy of the real, in-use
  `~/AppData/Roaming/outlook-sim/outlook-sim.db`: nesting, client
  association, and a close/reopen cycle all round-tripped correctly, and
  deleting a mid-tree folder correctly cascaded to its child while leaving
  an unrelated sibling intact; real on-disk DB confirmed byte-for-byte
  unchanged (md5) afterward. No live multi-window Electron GUI
  click-through attempted — this session runs on a real Windows machine
  but, as a background job, has no attached display; same non-blocking
  gap as every prior feature, different underlying reason. Phase set to
  `accept`.
- 2026-09-14 — feature 047 (FileVine tab — folder structure and client
  association) tested: added 21 tests (430 → 451, all passing; re-run 3x,
  stable), all AC-traceable by number, across 4 layers — `db.test.ts` (+7,
  real `MailDb`): create/rename/delete, nesting, a regression test pinning
  the `/implement`-stage cascade-delete FK fix, client associate/change/
  un-associate, and close/reopen persistence; `ipc.test.ts` (+1, incl. the
  exhaustive channel-list update): full CRUD through the actual registered
  handlers; new `FileVineView.test.tsx` (+11, in-memory fake store): empty
  states, create/nest/rename/delete, a DOM-structure test proving real
  nesting (not flat-with-indentation), and client association incl.
  pre-selected existing client and switching between personas; `App.test.tsx`
  (+2, on top of 2 `RibbonBar.test.tsx` tests already added during
  `/implement` for AC1): the FileVine tab actually swapping the
  center/right content area while the mail folder pane stays visible, and
  that selecting a mail folder / switching to Calendar both close it.
  lint/typecheck/build all pass. Test Notes filled in; phase set to
  `validate`.
- 2026-09-14 — feature 047 (FileVine tab — folder structure and client
  association) implemented: new `FileVineFolder` type (nests via
  `parentId`, loosely references a persona as `clientPersonaId`) plus a
  `filevine_folders` SQLite table and full CRUD on `MailDb`, mirroring
  `calendarItems`'s conventions; `db:fileVineFolders:*` IPC channels +
  `window.api.data.fileVineFolders`. New `FileVineView.tsx` (two-pane tree
  + detail UI, always-expanded nested lists, inline create/rename/delete
  following `FolderPane.tsx`'s conventions). `RibbonBar`'s tab row — static/
  disabled since feature 001 — gained a real, clickable "FileVine" tab
  between Home and View; clicking it (or Home) overlays/hides
  `FileVineView` in `App.tsx` in place of the message list/reading pane
  while staying in the Mail module, so the mail folder pane stays visible
  underneath it per spec. Caught and fixed a real bug live before writing
  any tests: cascade-deleting a folder with children threw a `FOREIGN KEY
  constraint failed` (deleted parent before children in insertion order);
  fixed by deleting in reverse pre-order. Verified end-to-end with a
  standalone `esbuild`-bundled `db.ts` script (real `MailDb`) and a
  throwaway RTL smoke test of the full UI flow (written, run, deleted —
  not part of the diff) before finishing. lint/typecheck/build pass;
  existing suite 428 → 430 (2 new RibbonBar tests for the now-interactive
  tab; `RibbonBar.test.tsx`/`ipc.test.ts` needed compile/content
  touch-ups, no unrelated behavior changes). Notes/files CRUD (048) and
  LLM context wiring (049) deliberately out of scope. Phase set to `test`.
- 2026-09-14 — feature 026 (fix: recurring event reminders fire per
  occurrence) accepted by user; logged to CHANGELOG. All four high-priority
  bug fixes (023-026) are now done. Active feature set to 047 (FileVine tab
  — folder structure and client association), phase set to `implement`.
- 2026-09-14 — feature 026 (fix: recurring event reminders fire per
  occurrence) validated: lint/typecheck/build pass; full test suite
  (428/428) re-run 3x, stable; confirmed via `git diff` that `/test`
  touched only test files/docs, no implementation drift. All 4 ACs
  verified by tests + code inspection plus a fresh live end-to-end check —
  bundled `db.ts`/`reminderScheduler.ts` standalone with `esbuild` and ran
  a real `MailDb` against a scratch copy of the real, in-use
  `~/AppData/Roaming/outlook-sim/outlook-sim.db`: a daily recurring event
  fired distinct, correctly-timed reminders on day 1 and day 2 (the actual
  bug — previously impossible), with no double-fire on a re-tick; real
  on-disk DB confirmed byte-for-byte unchanged (md5) afterward. No live
  multi-window Electron GUI click-through attempted (no Xvfb, same
  non-blocking gap as every prior feature). Phase set to `accept`.
- 2026-09-14 — feature 026 (fix: recurring event reminders fire per
  occurrence) tested: added 6 tests (422 → 428, all passing; re-run 3x,
  stable), all AC-traceable by name in `reminderScheduler.test.ts`'s new
  "026: recurring reminders fire per occurrence" block plus one
  `App.test.tsx` test — AC1 (1st/2nd/3rd occurrence each fire distinctly
  across ticks), AC2 (no refire of the same occurrence across repeated
  ticks, while a later occurrence still fires independently), AC3 x2 (a
  deleted occurrence never fires; an occurrence edited to a new start time
  fires at the new time, not the old one — a first draft of this test
  caught its own ambiguity, 6 calls instead of 1, correctly diagnosed as
  multiple long-overdue occurrences firing in one big time jump rather
  than a bug, then re-scoped to isolate just the one occurrence), AC4
  regression (non-recurring items still fire at most once, full
  pre-existing suite unchanged); `App.test.tsx` proves two occurrences of
  the *same* series get independent, independently-dismissible banners
  (the actual UI-facing consequence of the old `CalendarItem`-keyed
  broadcast shape). lint/typecheck/build all pass; phase set to
  `validate`.
- 2026-09-14 — feature 026 (fix: recurring event reminders fire per
  occurrence) implemented: root cause was `CalendarItem.reminderFired`
  being a single boolean on the series' template row, so a recurring
  series' reminder could fire at most once ever. Replaced it with
  `remindersFired: number[]` (per-occurrence `originalStartTime` keys);
  moved `recurrence.ts` to `src/shared/` so the main-process
  `ReminderScheduler` reuses the exact same occurrence-expansion/exception
  logic the renderer's calendar view already had, rather than
  reimplementing it; scheduler now expands each item's occurrences within a
  lookahead window and fires/marks each due-and-unfired one independently.
  New `FiredReminder` broadcast type (keyed per-occurrence, not per-series)
  replaces `CalendarItem` on the `calendar:reminder-fired` channel so
  multiple fired occurrences of one series get independently-dismissible
  banners. `db.ts` migration adds `reminders_fired` and back-fills from any
  pre-026 `reminder_fired` boolean. Live-verified all 4 ACs with a
  standalone script driving a real `MailDb`/`SimClock`/`ReminderScheduler`
  through a daily recurring event across 4 simulated days (distinct fires
  per day, no double-fire, deleted occurrence skipped, edited occurrence
  fires at its new time not the old one). lint/typecheck/build pass;
  existing suite 422/422 (421 baseline + 1 new migration test; rest are
  compile/rename touch-ups, no behavior change to prior features). Phase
  set to `test`.
- 2026-09-14 — feature 025 (fix: attachments persist on the Sent Items
  copy) accepted by user: asked directly whether the underlying bug
  (`BUGS.md` B004) was still observed live; user confirmed no, likely a
  stale report from feature 009's development session. Accepted as
  verified-not-reproducible, backed by the regression tests added in
  `/test`; logged to CHANGELOG. Active feature set to 026 (Fix — recurring
  event reminders fire per occurrence), phase set to `implement`.
- 2026-09-14 — feature 025 (fix: attachments persist on the Sent Items
  copy) validated: lint/typecheck/build pass; full test suite (421/421)
  re-run 3x, stable; confirmed via `git diff` that `/test` touched only test
  files/docs, no implementation drift (unsurprising — `/implement` made no
  source change). All 4 ACs verified by tests + code inspection plus a
  fresh live check (independent of `/implement`'s): bundled `db.ts`
  standalone with `esbuild` and ran the exact `createMessage` call
  `ComposeWindow` makes for Send-with-attachment against a scratch copy of
  the real, in-use `~/AppData/Roaming/outlook-sim/outlook-sim.db` — the
  created Sent Items row came back with its attachment intact, Sent count
  went 4→5 as expected; real on-disk DB confirmed byte-for-byte unchanged
  (md5) afterward. No live multi-window Electron GUI click-through
  attempted (no Xvfb, same non-blocking gap as every prior feature).
  Flagged one open item (not a validation failure): the user hasn't yet
  confirmed whether they still see the original bug live — if so it must
  live outside the traced Node-side path (most likely the real
  contextBridge/IPC boundary), worth a direct check at `/accept`. Phase set
  to `accept`.
- 2026-09-14 — feature 025 (fix: attachments persist on the Sent Items
  copy) tested: since `/implement` found no code defect, added regression
  coverage closing the gap that let B004 go unverified — 7 new tests
  (414 → 421, all passing, re-run 3x stable): `db.test.ts` (+4, real
  `MailDb`, no mocking) covers a `sent`-folder create with attachments
  surviving both an immediate re-fetch and a close/reopen, the
  draft-then-update-to-sent path `ComposeWindow` actually uses, a reply/
  forward-shaped sent message with an attachment, and a regression check
  that editing a draft without touching `attachments` in the patch leaves
  it untouched; `ComposeWindow.test.tsx` (+2) covers attaching a file while
  replying and while forwarding, asserting it reaches `messages.create`
  (previously only fresh-compose was covered); `ReadingPane.test.tsx` (+1)
  covers a `sent`-folder message's attachments actually rendering (no
  prior test had set `folderId: 'sent'` specifically). lint/typecheck/build
  all pass. Test Notes filled in; phase set to `validate`.
- 2026-09-14 — feature 025 (fix: attachments persist on the Sent Items
  copy) implemented: investigated `BUGS.md` B004 across the full data path
  (`ComposeWindow.tsx`'s `persist()` → `db:messages:create`/`update` IPC
  passthroughs → `MailDb.createMessage`/`updateMessage` → `ReadingPane.tsx`
  rendering) and could not reproduce it — every link already correctly
  threads `attachments` through, confirmed via `git log` (unchanged since
  feature 002) and a live standalone `esbuild`-bundled `db.ts` check against
  a real `MailDb` covering all 4 ACs (fresh send, draft-then-send via
  update, reply/forward-shaped sent message with a freshly-added
  attachment, and an unrelated draft resave) — attachments round-tripped
  intact in every case. No source change made; flagged the non-reproduction
  explicitly rather than guessing at a fix. Left regression-test coverage
  of the full path for `/test`, per the loop's normal split. Phase set to
  `test`.
- 2026-09-14 — feature 024 (fix: persona replies quote the prior thread
  chain) accepted by user; logged to CHANGELOG; active feature set to 025
  (Fix — attachments persist on the Sent Items copy), phase set to
  `implement`.
- 2026-09-14 — feature 024 (fix: persona replies quote the prior thread
  chain) validated: lint/typecheck/build pass; full test suite (414/414)
  re-run 3x, stable; confirmed via `git diff` that `/test` touched only test
  files/docs plus `vitest.config.ts`'s `include` list, no implementation
  drift; all 4 ACs verified by tests + code inspection plus a live
  end-to-end check — bundled `db.ts`/`config.ts`/`clock.ts`/`personaReply.ts`
  standalone with `esbuild` and ran `generatePersonaReply` against a scratch
  copy of the real, in-use `~/AppData/Roaming/outlook-sim` data (real law-firm
  training scenario, 15 personas, 27 messages, a real configured Gemini API
  key): a genuine LLM reply came back with the stored body correctly
  containing "\<reply text\>" followed by the exact "On \<date\>, Name
  \<email\> wrote:" header and "\> "-prefixed quoted original, including a
  quoted blank line — matching feature 005's convention byte-for-byte, since
  both paths call the same shared `quoteBody()`; real on-disk DB/config files
  confirmed untouched (only the scratch copy was written to); no live
  multi-window Electron GUI click-through attempted (no Xvfb, same
  non-blocking gap as every prior feature); phase set to `accept`.
- 2026-09-14 — feature 024 (fix: persona replies quote the prior thread
  chain) tested: added a new `src/shared/quoteBody.test.ts` (4 tests) — the
  shared `quoteBody()` extracted in `/implement` had no dedicated test file
  yet; discovered and fixed a real gap while adding it — `vitest.config.ts`'s
  `include` list covered only `src/renderer/**` and `src/main/**`, so
  `src/shared/**` tests were silently never run by `npm test`; added
  `'src/shared/**/*.test.ts'` to `include`. Strengthened `personaReply.test.ts`
  with an exact byte-for-byte comparison against an independently-computed
  `quoteBody(sentMessage)` (AC2, "identical convention not just similar") and
  an explicit AC4-named test for the missing-prior-message guard (no crash,
  no LLM call, no Inbox insert). Full suite 408 → 414, all passing, re-run 3x
  stable; lint/typecheck/build all pass. Test Notes filled in; phase set to
  `validate`.
- 2026-09-14 — feature 024 (fix: persona replies quote the prior thread
  chain) implemented: extracted the trainee's own reply-quoting format
  (feature 005) out of `composeIntent.ts`'s private `quoteBody()` into a new
  shared `src/shared/quoteBody.ts`, used by both `composeIntent.ts`
  (renderer) and `personaReply.ts` (main) — guarantees the two never drift
  apart rather than just documenting a matching convention. Persona replies
  now build their stored body as `text + quoteBody(sentMessage)`; the
  "immediately-preceding message" is exactly `sentMessage` (the trainee's
  message that triggered the reply), which the function's existing early-
  return already guarantees is non-null, so the no-prior-message guard (AC4)
  holds structurally rather than via an added conditional. One existing
  `personaReply.test.ts` assertion needed a compile/content touch-up
  (exact-body match → `toContain` checks) since the body now legitimately
  contains more than just the LLM's text; `composeIntent.test.ts` untouched
  and still passing, confirming the extraction didn't change trainee-side
  behavior. lint/typecheck/build pass, existing suite still 408/408; also
  live-verified the exact quote format with a standalone `tsx` script
  against a real `MailDb`/`SimClock`. phase set to `test`.
- 2026-09-14 — feature 023 (fix: sent mail created as read, not unread)
  accepted by user; logged to CHANGELOG; active feature set to 024 (Fix —
  persona replies quote the prior thread chain), phase set to `implement`.
- 2026-09-14 — feature 023 (fix: sent mail created as read, not unread)
  validated: lint/typecheck/build pass; full test suite (408/408) re-run 3x,
  stable; confirmed via `git diff` that `/test` touched only test files/docs,
  no implementation drift, and that the entire implementation is a 2-line
  change in `ComposeWindow.tsx`; all 4 ACs verified by the test suite plus a
  live scripted check — bundled `db.ts` standalone with `tsx` against a real
  (non-mocked) `MailDb`/SQLite in a fresh temp dir: a real Send-shaped insert
  landed `is_read: 1`, a real inbox-shaped insert (no `isRead` passed, as
  every incoming-mail path does) landed `is_read: 0`, and a "legacy"
  pre-fix-shaped sent message (`isRead: false`) survived a close/reopen
  cycle unchanged, confirming no retroactive migration; no real
  `~/.config/outlook-sim` install exists in this (Windows) environment to
  cross-check against, unlike prior sessions' Linux sandbox — noted, not
  blocking, since the change is renderer-side logic only with no schema
  change; no live multi-window Electron GUI click-through attempted (no
  Xvfb, same non-blocking gap as every prior feature); phase set to `accept`.
- 2026-09-14 — feature 023 (fix: sent mail created as read, not unread)
  tested: added 2 tests (406 → 408, all passing; re-ran full suite 3x,
  stable) and extended 8 existing assertions in place of new scaffolding —
  `ComposeWindow.test.tsx`'s Send/Save & Close/draft-Send/reply/reply-all/
  forward tests now assert the right `isRead` value (AC1/AC2);
  `personaReply.test.ts`/`scheduler.test.ts`/`scenarioMailScheduler.test.ts`
  now assert `isRead: false` on inserted incoming mail (AC3, alongside
  `scenarioPack.test.ts` which already did); two new `db.test.ts` tests prove
  `createMessage` doesn't infer `isRead` from `folderId` and that an existing
  sent message's `isRead: false` survives a close/reopen untouched (AC4, no
  retroactive migration). lint/typecheck/build all still pass; phase set to
  `validate`.
- 2026-09-14 — feature 023 (fix: sent mail created as read, not unread)
  implemented: `ComposeWindow.tsx`'s single `persist()` call site (shared by
  Send/Reply/Reply All/Forward and Save & Close) now sends `isRead: folderId
  === 'sent'` to `messages.create`/`messages.update`; every incoming-mail
  creation path (`personaReply.ts`, unsolicited-mail `scheduler.ts`,
  `scenarioMailScheduler.ts`, `scenarioPack.ts` inbox seeding) never sets
  `isRead` and was confirmed by inspection to be untouched, still defaulting
  to unread via `MailDb.createMessage`. No retroactive migration — only the
  renderer's sent value changed, not `db.ts`'s insert/update SQL or
  defaulting. lint/typecheck/build pass, existing suite still 406/406
  unchanged; phase set to `test`.
- 2026-09-14 — iteration 2 backlog generated: decomposed the revised spec's
  new/changed Core Requirements into 27 new features (023-049) — 4 bug
  fixes (023-026, high priority: sent-mail-read, persona-reply quoting,
  Sent Items attachments, per-occurrence recurring reminders), the FileVine
  module (047/048 high priority for the core folder/client/notes CRUD, 049
  medium for the LLM-context wiring), and the rest of the spec revision's
  scope (Settings/scenario-pack/persona enhancements, ribbon rework, mail
  multi-select/context-menu/pop-out, calendar view/edit split + pop-out,
  clock mini-calendar, Tasks panel, styling pass) at medium/low priority.
  None of the 22 `done` features from iteration 1 were touched or
  invalidated — this iteration only adds to/extends them. `features/BACKLOG.md`
  rewritten to include all 49 entries, ordered by priority. Active feature
  set to 023 (first backlog item by priority), phase set to `implement`.
- 2026-09-14 — retro for iteration 1 closed: all 22 backlog features shipped and accepted. Revised `docs/SPEC.md` with the user (three open `BUGS.md` items folded in as Core Requirements, plus a large set of new/changed requirements gathered interactively — Settings scenario-pack/persona enhancements, ribbon rework incl. Settings-in-File-menu and a new About section, mail multi-select + context menu + pop-out windows, calendar view/edit-mode split + pop-out, simulated-clock mini-calendar, a scoped-in lightweight Tasks panel, an element-level styling pass, and a new "FileVine" case-file/matter panel that explicitly reverses a prior non-goal). Outer iteration bumped to 2, phase set to `spec` per the retro routing rule (spec changed this iteration) — `/spec` (or straight to `/features`) is next.
- 2026-09-12 — feature 020 (calendar recurring events) accepted by user; logged to CHANGELOG; backlog is now fully `done` — no active feature; phase set to `retro`
- 2026-09-12 — feature 020 (calendar recurring events) validated: lint/typecheck/build pass; full test suite (406/406) re-run 3x, stable; confirmed via `git diff` that `/test` touched only test files/docs plus a 7-line type-signature-only fix in `recurrence.ts` (verified the function body is byte-identical, no behavior change); all 4 ACs verified by tests + code inspection plus a live end-to-end check — bundled `db.ts`/`recurrence.ts`/`calendarDates.ts` standalone with `tsx` against a scratch copy of the real, in-use `~/.config/outlook-sim/outlook-sim.db` (5 real calendar items): the `recurrence_exceptions` migration ran cleanly, a weekly recurring item + an instance exception survived a simulated restart byte-for-byte, and occurrence expansion was independently re-checked across all 4 view types (day/workWeek/week/month) — specifically closing the one gap the Test Notes themselves flagged as unit-untested (work-week), which came back correct; real on-disk file confirmed byte-for-byte unchanged (md5) afterward; no live multi-window Electron GUI click-through attempted (no Xvfb, same non-blocking gap as every prior feature); phase set to `accept`
- 2026-09-12 — feature 020 (calendar recurring events) tested: added 33 tests (373 → 406, all passing; re-ran full suite 3x, stable) — new `recurrence.test.ts` (17) covers occurrence expansion (daily/weekly/monthly, DST safety, the monthly-clamping regression itself, exceptions matching by natural start time) and `upsertException`; `CalendarView.test.tsx` (+13) covers the Repeat select, multi-view occurrence display, the recurring 🔁 indicator, and the full "this event vs. the whole series" chooser/edit/delete flows; `db.test.ts` (+3) covers recurrenceRule/recurrenceExceptions defaulting, round-tripping through update, surviving a close/reopen cycle, and the column migration against a simulated pre-020 database. lint/typecheck/build all still pass; phase set to `validate`
- 2026-09-12 — feature 020 (calendar recurring events) implemented: a recurring series stays one `CalendarItem` row (the template); `recurrenceRule` narrowed to `'daily'|'weekly'|'monthly'|null`; new `recurrenceExceptions` field (JSON column + migration) holds per-occurrence overrides/deletions keyed by natural start time. New pure `renderer/src/recurrence.ts` expands a series into occurrences for the visible date range (day/week/month all now render off this), with a monthly-clamping bug (Jan 31 → Feb 28 → wrongly staying at Mar 28 instead of Mar 31) caught and fixed via a standalone script before wiring in. `CalendarItemForm` gained a Repeat select (hidden when editing a single occurrence); clicking a recurring occurrence now asks "this event or the whole series?" before opening the form, so edit/delete scope is unambiguous (AC3) — non-recurring items are unaffected, same UX as before. Deliberately flagged, not fixed: `ReminderScheduler` only fires a recurring event's reminder once (tied to the template row), never per-occurrence — out of 020's ACs but a real cross-feature gap, same category as the attachments/persona-reply issue from 009. Verified the full create/multi-view/instance-edit/series-delete flow with a throwaway RTL script before finishing, then deleted it. lint/typecheck/build pass, existing suite still 373/373 (compile-only fixture touch-ups for the new required field in 4 test files); phase set to `test`
- 2026-09-12 — feature 009 (mail mock attachments) accepted by user; logged to CHANGELOG; only feature 020 (Calendar recurring events) remains in the backlog; active feature set to 020, phase set to `implement`
- 2026-09-12 — feature 009 (mail mock attachments) accept-stage fix: user found live that a persona's LLM reply denied seeing a mock attachment the trainee had sent. Root cause: `personaReply.ts`'s thread-transcript builder (feature 015) never referenced `message.attachments` at all. Fixed by adding an `Attachments: <filenames>` line per message that has any; not a 009-AC failure, but a real cross-feature inconsistency. Added 2 regression tests (371 → 373, stable); lint/typecheck/build all still pass; phase stays `accept`
- 2026-09-12 — feature 009 (mail mock attachments) validated: lint/typecheck/build pass; full test suite (371/371) re-run 3x, stable; confirmed via `git diff` that `/test` touched only test files/docs, no implementation drift; all 4 ACs verified by tests + code inspection plus a live check — attachments confirmed structurally file-I/O-free (grepped all of `src/main`/`src/preload`, found only an opaque JSON column) and confirmed to survive a real restart via a scratch copy of the real, in-use `~/.config/outlook-sim/outlook-sim.db` (added attachments to a real message, closed/reopened `MailDb`, got identical content back); real on-disk DB confirmed byte-for-byte unchanged (md5) afterward; no live multi-window Electron GUI click-through attempted (no Xvfb, same non-blocking gap as every prior feature); phase set to `accept`
- 2026-09-12 — feature 009 (mail mock attachments) tested: added 10 tests (361 → 371, all passing; re-ran full suite 3x, stable) — `ComposeWindow.test.tsx` (+5) covers adding/removing attachment chips, sending them along, draft prefill, and reply deliberately not carrying attachments over; `ReadingPane.test.tsx` (+4) covers attachment rendering, the click-to-toggle placeholder note (with no `messages.update` call as a proxy for "no real file I/O"), and the note resetting on message change; `db.test.ts` (+1) covers attachments surviving a close/reopen cycle. lint/typecheck/build all still pass; phase set to `validate`
- 2026-09-12 — feature 009 (mail mock attachments) implemented: entirely UI — the `MessageAttachment`/`attachments` data model and SQLite persistence already existed from feature 002. `ComposeWindow.tsx` gained an attachments chip-list (add-by-filename form, remove button per chip), following the existing Cc pattern exactly; loaded from an existing draft, but fresh/reply/reply-all/forward all start empty (composeIntent.ts never carried attachments, so continuing that is not a scope expansion). `ReadingPane.tsx` renders attachments as 📎-prefixed buttons; clicking one toggles a "no file content" note via pure React state, with no filesystem/IPC call in the path, so AC4 holds structurally. Verified live that attachments survive a simulated `MailDb` close/reopen. lint/typecheck/build pass, existing suite still 361/361 unchanged; phase set to `test`
- 2026-09-12 — feature 022 (scenario pack save) accepted by user; logged to CHANGELOG; only low-priority features remain in the backlog (009, 020); active feature set to 009 (Mail mock attachments), phase set to `implement`
- 2026-09-12 — feature 022 (scenario pack save) validated: lint/typecheck/build pass; full test suite (361/361) re-run 3x, stable; confirmed via `git diff` that `/test` touched only test files/docs, no implementation drift; all 4 ACs verified by tests + code inspection plus a live end-to-end check — bundled `scenarioPack.ts`/`db.ts`/`config.ts`/`clock.ts` standalone with `tsx` and ran `buildScenarioPack` against a scratch copy of the real, in-use `~/.config/outlook-sim` data (8 inbox messages, 4 calendar items, 15 personas, real live Anthropic/Gemini API keys configured): built-pack counts matched the real store exactly across all three categories, passed `validateScenarioPack` unmodified, round-tripped through an actual save-to-file/reload/apply cycle into a second fresh store with all content preserved, and neither real API key appeared anywhere in the built pack's JSON; real on-disk `outlook-sim.db` confirmed byte-for-byte unchanged (md5) afterward; no live multi-window Electron GUI click-through attempted (no Xvfb, same non-blocking gap as every prior feature); phase set to `accept`
- 2026-09-12 — feature 022 (scenario pack save) tested: added 14 tests (347 → 361, all passing; re-ran full suite 3x, stable) — new `buildScenarioPack` tests cover name/description, persona id-dropping, inbox-only message scoping with correct `offsetMinutes`, calendar item offset/duration math (incl. `endTime: null`), pending scheduled messages surfacing as `timedMessages`, an empty-pack case, and a direct AC4 check that a configured API key never appears in the built pack's JSON; a dedicated round-trip test (build → JSON round trip → validate → apply into a second fresh store) confirms message/calendar item/persona/pending-timed-message all survive exactly (AC3); `SettingsView.test.tsx` gained 4 tests for the Save button's success/canceled/error/error-then-success paths. `scenario:savePack`'s IPC wiring itself (needs real Electron `dialog`) has no unit test, same category as `scenario:pickPack`/`window:openCompose`. lint/typecheck/build all still pass; phase set to `validate`
- 2026-09-12 — feature 022 (scenario pack save) implemented: new `buildScenarioPack` in `main/data/scenarioPack.ts` (inverse of 021's `applyScenarioPack`) snapshots current inbox/calendar/personas/pending-timed-messages into the same `ScenarioPack` schema; new `scenario:savePack` IPC (native save dialog, name derived from chosen filename) + `SaveScenarioPackResult` type + `window.api.scenario.savePack()`; new "Save Scenario Pack…" button in Settings' existing Scenario Pack section. Never reads Settings/API keys (AC4 holds structurally). Verified the full build→validate→apply round trip standalone (message/calendar item/persona/pending timed message all survived exactly) before wiring in the UI. lint/typecheck/build pass, existing suite still 347/347; phase set to `test`
- 2026-09-12 — feature 021 (scenario pack load) accepted by user; logged to CHANGELOG; active feature set to 022 (Scenario pack save), phase set to `implement`
- 2026-09-12 — feature 021 (scenario pack load) validated: lint/typecheck/build pass; full test suite (347/347) re-run 3x, stable; confirmed via `git diff` that `/test` touched only test files/docs, no implementation drift; all 5 ACs verified by tests + code inspection plus a live end-to-end check — bundled `scenarioPack.ts`/`db.ts`/`config.ts`/`clock.ts`/`scenarioMailScheduler.ts` standalone with `esbuild` and ran the full validate→apply→scheduled-delivery chain against a scratch copy of the real, in-use `~/.config/outlook-sim` data (11 messages, 4 calendar items, 15 personas): a bad pack came back with a specific error, applying a good pack replaced all three fully, the timed message stayed pending until the clock started running, then delivered exactly once; real on-disk files confirmed unmodified afterward; no live multi-window Electron GUI click-through attempted (no Xvfb, same non-blocking gap as every prior feature); phase set to `accept`
- 2026-09-12 — feature 021 (scenario pack load) tested: added 42 tests (305 → 347, all passing; re-ran full suite 3x, stable) — new `scenarioPack.test.ts` (26 tests) covers `validateScenarioPack`'s per-field errors/defaults and `applyScenarioPack`'s replace-not-append semantics, persona replacement, and offset-based timestamp math; new `scenarioMailScheduler.test.ts` (7 tests) covers due/not-due/paused/redeliver/multi-item/start-stop plus a real-`SimClock` pause/resume integration test; `ipc.test.ts` (+4) covers `scenario:applyPack`'s confirm/re-confirm handshake against a real DB; `SettingsView.test.tsx` (+5) covers the pick→apply→status flow, a canceled dialog showing nothing, an invalid pack's error reaching the screen verbatim, and the confirm/decline branches. `scenario:pickPack` itself has no unit test (same untestable-Electron-wiring category as `window:openCompose`). lint/typecheck/build all still pass; phase set to `validate`
- 2026-09-12 — feature 021 (scenario pack load) implemented: designed the `ScenarioPack` JSON schema (`shared/data-types.ts`) that 022 will reuse for saving — all timing is relative (`offsetMinutes` from load time), not absolute, since packs are meant to be reusable. New `main/data/scenarioPack.ts` hand-rolls JSON validation (no new dependency) returning a clear per-field error instead of throwing, plus `applyScenarioPack` which resets the mailbox/calendar (reusing 017's `resetMailboxAndCalendar`), replaces personas, seeds inbox/calendar entries at `clock.now() + offsetMinutes`, and persists `timedMessages` for a new `ScenarioMailScheduler` (mirrors the reminder/unsolicited-mail schedulers' shape) to deliver later. New `scenario:pickPack` IPC (main-process file dialog, since the renderer has no fs access) and `scenario:applyPack` (mirrors `session:startFreePlay`'s confirm/re-confirm handshake). New "Scenario Pack" section in Settings. Manually verified the full validate→apply→paused-no-deliver→running-delivers-once chain standalone before automated tests. lint/typecheck/build pass, existing suite still 305/305 (one exhaustive-channel-list fixture touch-up); phase set to `test`
- 2026-09-12 — feature 019 (calendar deadlines, all-day items & reminders) accepted by user; logged to CHANGELOG; active feature set to 021 (Scenario pack load), phase set to `implement`
- 2026-09-12 — feature 019 (calendar deadlines, all-day items & reminders) accept-stage UI fixes: (1) the All-day checkbox was small and not flush-left because it inherited the shared text-input rule's padding/border — fixed with a higher-specificity `input[type='checkbox']` rule giving it an explicit 18px size and no padding/border. (2) toggling All-day (which hides the End field) was visually shifting the All-day checkbox itself, since the form sits below a `flex:1` grid in a column flex layout — shrinking the form's height let the grid grow and pushed the form's top edge (and everything near it) down. Fixed by keeping the End row always mounted and hiding it via a new `visibility:hidden` class instead of unmounting it, so the form's height stays constant regardless of the toggle; updated the one test that checked for DOM removal to check the hidden class instead. lint/typecheck/build pass; full suite 305/305, re-run 3x, stable; phase stays `accept`
- 2026-09-12 — feature 019 (calendar deadlines, all-day items & reminders) validated: lint/typecheck/build pass; full test suite (305/305) re-run 3x, stable; confirmed via `git diff` that `/test` touched only test files/docs, no implementation drift; all 4 ACs verified by tests + code inspection plus a live end-to-end check — bundled `db.ts`/`clock.ts`/`reminderScheduler.ts` standalone with `esbuild` and, against a scratch copy of the real, in-use `~/.config/outlook-sim/outlook-sim.db`: created/edited a deadline, created/deleted an all-day item, and drove a real reminder through paused→no-fire, started→fires-once, ticked-again→no-refire, paused-again-with-a-new-due-item→no-fire; real on-disk DB confirmed byte-for-byte unchanged afterward; no live multi-window Electron GUI click-through attempted (no Xvfb, same non-blocking gap as every prior feature); phase set to `accept`
- 2026-09-12 — feature 019 (calendar deadlines, all-day items & reminders) tested: added 26 tests (279 → 305, all passing; re-ran full suite 3x, stable) — new `reminderScheduler.test.ts` (9 tests) covers fire-once/no-refire/paused-blocks-firing/multi-item-in-one-tick plus a real-`SimClock` pause/resume integration test; `db.test.ts` (+4) covers `reminderFired` defaulting/round-trip/persistence/migration; `ipc.test.ts` (+2) covers `broadcastReminderFired`; `CalendarView.test.tsx` (+13) covers Deadline creation, All-day toggle + exact local-midnight start time, reminder selection, and a full edit/delete/precedence-rule block; `App.test.tsx` (+2) covers the dismissible reminder banner(s). Caught and fixed a test-authoring race (not a product bug) where an early draft opened the create form on the very first render before the simulated-clock effect resolved. lint/typecheck/build all still pass; phase set to `validate`
- 2026-09-11 — feature 019 (calendar deadlines, all-day items & reminders) implemented: added `reminderFired` to `CalendarItem` (new column + migration); generalized 018's create-only form into `CalendarItemForm`, reused for create AND edit/delete — every calendar item is now a clickable button opening it pre-filled; new Type (Event/Deadline) and All-day (swaps Start to a native date input) fields cover AC1/AC2; new Reminder select plus a new `ReminderScheduler` (main process, matches the unsolicited-mail scheduler's real-time-poll-but-simulated-time-check shape) covers AC3, broadcasting `calendar:reminder-fired` to a new dismissible amber banner in `App.tsx`; AC4 holds both because `SimClock.now()` itself doesn't advance while paused and because the scheduler also explicitly checks `running`. Manually verified the scheduler's fire-once/no-refire/paused-blocks-firing logic and the DB migration against a scratch copy of the real DB before automated tests. lint/typecheck/build pass, existing suite still 279/279 (one compile fixture touch-up in `CalendarView.test.tsx`'s `makeItem` helper); phase set to `test`
- 2026-09-11 — feature 018 (calendar views & persistence) accepted by user (including the three accept-round fixes: simulated-clock "today" bug, duplicate ribbon view buttons + inactive-looking tab styling, and hiding the dead "New Meeting" button); logged to CHANGELOG; active feature set to 019 (Calendar deadlines, all-day items & reminders), phase set to `implement`
- 2026-09-11 — feature 018 (calendar views & persistence) third accept-stage UI fix (same round): removed the ribbon's "New Meeting" button entirely (was a disabled placeholder for meeting invites/RSVP, an explicit v1 non-goal per `docs/SPEC.md`) rather than leave a button that can never be wired up until that feature is built; `CALENDAR_ACTIONS` is now just `['New Event']`; updated `RibbonBar.test.tsx` accordingly. lint/typecheck/build pass; full suite 279/279, re-run 3x, stable; phase stays `accept`
- 2026-09-11 — feature 018 (calendar views & persistence) two more accept-stage UI fixes (same live-check round): (1) removed the ribbon's redundant Today/Day/Work Week/Week/Month buttons entirely — they duplicated CalendarView's own view-tab header; New Event/New Meeting stay; updated `RibbonBar.test.tsx` accordingly. (2) `.calendar-view-tab`'s unselected state used `--text-muted` (a leftover from its feature-001 static-mockup days), making real clickable tabs look disabled — changed to `--text` + `cursor: pointer`, matching the `.nav-switcher-item` convention; the active tab's highlight is unchanged. lint/typecheck/build pass; full suite 279/279, re-run 3x, stable; phase stays `accept`
- 2026-09-11 — feature 018 (calendar views & persistence) accept-stage bug fixed: user reported live that the calendar's "today" seemed to use the actual real-world date rather than the simulated clock's date. Root cause: two `Date.now()` call sites (the `today` highlight state's initializer, and the "Today" nav button) used the real wall clock, unlike the initial anchor load which already correctly used `clock.now()`. Fixed by routing both through the simulated clock (`today` is now `useState`/`setToday` kept in sync with `anchorMs`; a new `goToToday()` re-fetches simulated now for the button). Added 2 regression tests using a simulated date far from the real system date; confirmed both fail against the pre-fix code and pass after. lint/typecheck/build all still pass; full suite 278/278 (was 276), re-run 3x, stable; phase stays `accept`
- 2026-09-11 — feature 018 (calendar views & persistence) validated: lint/typecheck/build pass; full test suite (276/276) re-run 3x, stable; confirmed via `git diff` that `/test` touched only test files/docs, no implementation drift; all 4 ACs verified by tests + code inspection plus a live check — bundled `db.ts` standalone with `esbuild` and created a calendar item (using the exact shape `CalendarEventForm` sends) against a scratch copy of the real, in-use `~/.config/outlook-sim/outlook-sim.db` (3 real items already present): survived a close/reopen with identical fields, count correctly went 3→4→3 after cleanup, and the real on-disk file was confirmed byte-for-byte unchanged afterward; no live multi-window Electron GUI click-through attempted (no Xvfb, same non-blocking gap as every prior feature); phase set to `accept`
- 2026-09-11 — feature 018 (calendar views & persistence) tested: added 32 tests (244 → 276, all passing; re-ran full suite 3x, stable) — new `calendarDates.test.ts` (19 tests) covers the day/work-week/week/month range math plus the DST and month-overflow edge cases called out during `/implement`; new `CalendarView.test.tsx` (9 tests) covers AC4 (confirms the component reads through `window.api.data.calendarItems.list()`), AC2 (view-tab switching), and the core AC3 case (an event created via the form appears in Day view and stays visible after switching to Week and Month, plus a negative case for an out-of-range event); `RibbonBar.test.tsx` (+3) and `App.test.tsx` (+1) cover the New Event wiring end-to-end and that the other calendar ribbon buttons stay disabled placeholders. AC1 has no new test (unchanged since 001, already covered). lint/typecheck/build all still pass; phase set to `validate`
- 2026-09-11 — feature 018 (calendar views & persistence) implemented: replaced the feature-001 `CalendarView.tsx` placeholder with a real view over the existing `db:calendarItems:*` IPC from 002; new pure `calendarDates.ts` computes day/work-week/week/month date ranges (month is a fixed 42-day Sunday-start grid to sidestep DST/variable-week-count math) plus prev/next navigation and range labels — manually sanity-checked standalone via esbuild across a DST boundary and a month-end edge case before wiring in. View tabs (already a static mockup since 001) are now wired to real state; items fetched once and bucketed client-side per view, so AC3 ("events visible across views") holds by construction. Ribbon's long-disabled "New Event" placeholder is finally wired to an inline create form (Title/Description/start/end via `datetime-local` inputs; always `itemType:'event'`, no all-day/reminder/recurrence — that's 019/020 scope). Ribbon's Today/Day/Work Week/Week/Month/New Meeting stay disabled placeholders (view-switching lives in CalendarView's own tabs; meeting workflow is an explicit spec non-goal). lint/typecheck/build pass, existing suite still 244/244 unchanged (the empty-state message was deliberately kept identical so no existing assertions needed touching); phase set to `test`
- 2026-09-11 — feature 017 (free-play mode bootstrap) accepted by user; logged to CHANGELOG; active feature set to 018 (Calendar views & persistence), phase set to `implement`
- 2026-09-11 — feature 017 (free-play mode bootstrap) validated: lint/typecheck/build pass; full test suite (244/244) re-run 3x, stable; confirmed via `git diff` that `/test` touched only test files/docs, no implementation drift; all 3 ACs verified by tests + code inspection plus a live check — bundled `db.ts` standalone with `esbuild` and ran `hasMailboxOrCalendarData`/`resetMailboxAndCalendar` against a scratch copy of the real, in-use `~/.config/outlook-sim/outlook-sim.db` (11 real messages, 3 real calendar items, a real custom folder): messages/calendar wiped to empty, all folders including the custom one survived, and the real on-disk file was confirmed byte-for-byte unchanged (md5/mtime) afterward; AC2 confirmed by grepping the full `src/` tree for any scenario-pack dependency (none exists yet, 021/022 still backlog); no live multi-window Electron GUI click-through attempted (no Xvfb, same non-blocking gap as every prior feature); phase set to `accept`
- 2026-09-11 — feature 017 (free-play mode bootstrap) tested: added 15 tests on top of the coverage already written during `/implement` (230 → 244, all passing; re-ran full suite 3x, stable) — `db.test.ts` covers `hasMailboxOrCalendarData()`/`resetMailboxAndCalendar()` including that custom folders survive a reset and the reset persists across close/reopen; `ipc.test.ts` covers the `session:startFreePlay` confirm/re-confirm handshake end-to-end (empty resets without a prompt, non-empty mailbox or calendar-only data is refused and left intact, `confirmed:true` wipes and broadcasts, an unconfirmed call broadcasts nothing); `SettingsView.test.tsx` covers the Session section's `window.confirm` gating in both accept/decline directions; `App.test.tsx` covers the previously-selected message getting cleared after a free-play reset. AC2 (zero scenario pack) has no dedicated test since no scenario-pack concept exists yet to interact with. lint/typecheck/build all still pass; phase set to `validate`
- 2026-09-11 — feature 017 (free-play mode bootstrap) implemented: new `session:startFreePlay` IPC (`window.api.session.startFreePlay`) wraps two new `MailDb` methods, `hasMailboxOrCalendarData()` and `resetMailboxAndCalendar()` (clears `messages` + `calendar_items` only — folders, Settings, personas, identity, system prompt untouched); a confirm/re-confirm handshake (`StartFreePlayResult`) means an already-empty mailbox resets with no prompt, while a non-empty one gets a native `window.confirm` before wiping. New "Session" section in `SettingsView.tsx` with a "Start Free-Play" button; `App.tsx` clears `selectedMessageId` via a new `onFreePlayStarted` callback since the selected message may no longer exist post-reset. Deliberately left untouched: folder structure, the sim clock, and the unsolicited-mail scheduler's due-time state (none are "mailbox/calendar" per the feature's scope); implemented as an empty reset rather than "lightly seeded" to avoid baking in a hardcoded domain the spec explicitly forbids. lint/typecheck/build pass; existing suite still 230/230 (one pre-existing exhaustive-channel-list test updated to include the new IPC channel, no behavior change); phase set to `test`
- 2026-09-11 — feature 008 (mail search) accepted by user; logged to CHANGELOG; active feature set to 017 (Free-play mode bootstrap), phase set to `implement`
- 2026-09-11 — feature 008 (mail search) validated: lint/typecheck/build pass; full test suite (230/230) re-run 3x, stable; confirmed via `git diff` that `/test` touched only test files, no implementation drift; all 4 ACs verified by tests + code inspection — this feature is pure renderer UI with no separate main-process/DB layer to additionally exercise standalone, so the real-component Vitest suite (mocking only `window.api`) is the strongest available check; no live multi-window Electron GUI click-through attempted (no Xvfb, same non-blocking gap as every prior feature); phase set to `accept`
- 2026-09-11 — feature 008 (mail search) tested: added 7 tests on top of the coverage already written during `/implement` (223 → 230, all passing; re-ran full suite 3x, stable) — one test proves all four searched fields (subject/body/sender name/sender email) match case-insensitively; two cover the folder-vs-all-folders scope (including that the unscoped fetch stays lazy until "All folders" is actually picked); one proves live updates without a folder change; one proves clearing restores the folder view; two extra ones cover a distinct no-results empty state and search combining with the existing category filter. lint/typecheck/build all still pass; phase set to `validate`
- 2026-09-11 — feature 008 (mail search) implemented: entirely UI in `MessageListPane.tsx` — a search input filters by case-insensitive substring match against subject/body/sender (name+email), plus a scope select ("This folder"/"All folders"); "all folders" reuses the existing unscoped `messages.list()` call from feature 002 (no new IPC), fetched lazily only while that scope is active. Filter pipeline is messages → search → category filter (existing, unchanged) → rendered rows; clearing the query falls through to the plain folder view for free, and nothing here touches folder selection so results update live without navigating. Search/scope deliberately not reset on folder change (unlike the category filter), matching real Outlook. lint/typecheck/build pass, existing suite still 223/223; phase set to `test`
- 2026-09-11 — feature 007 (mail read/unread, flags & categories) accepted by user (including the read/unread bug fix); logged to CHANGELOG; active feature set to 008 (Mail search), phase set to `implement`
- 2026-09-11 — feature 007 (mail read/unread, flags & categories) accept-stage bug fixed: user reported that clicking "Mark as unread" in the Reading Pane immediately flipped the message back to read while it stayed open. Root cause: the fetch effect re-ran on every `messagesVersion` bump (including the one from the user's own toggle) and unconditionally re-applied the auto-mark-read check. Fixed with a `lastCheckedIdRef` that limits the auto-mark check to the first time a given message id is opened; a first fix attempt (stamping the ref only when a mark occurred) was caught as still-broken by a new regression test before landing the corrected version (stamp on every check, mark-or-not). Added 2 regression tests (221 → 223, stable across 3 runs); lint/typecheck/build all still pass; phase stays `accept`
- 2026-09-11 — feature 007 (mail read/unread, flags & categories) validated: lint/typecheck/build pass; full test suite (221/221) re-run 3x, stable; confirmed via `git diff` that `/test` touched only test files, no implementation drift; all 5 ACs verified by tests + code inspection plus a live check — bundled `db.ts` standalone with `esbuild` and drove a real (non-mocked) `MailDb` through create→mark read/unread→flag→categorize→close/reopen, all correct; cross-checked the user's real `~/.config/outlook-sim/outlook-sim.db` for schema sanity (no regression, though the new UI hasn't been exercised there yet since the app hasn't been relaunched); no live multi-window Electron GUI click-through attempted (no Xvfb, same non-blocking gap as every prior feature); phase set to `accept`
- 2026-09-11 — feature 007 (mail read/unread, flags & categories) tested: added 13 tests on top of the coverage already written during `/implement` (208 → 221, all passing; re-ran full suite 3x, stable) — `ReadingPane.test.tsx` covers auto-mark-read-on-open (and no-op when already read), the read/flag toggle buttons in both directions, and category add (with dedup)/remove; `MessageListPane.test.tsx` covers the per-row flag button (without triggering row-select), the category filter appearing only when needed, correctly narrowing the list, and resetting on folder change; `db.test.ts` covers a populated isRead/isFlagged/categories message surviving a close/reopen cycle (AC5). lint/typecheck/build all still pass; phase set to `validate`
- 2026-09-11 — feature 007 (mail read/unread, flags & categories) implemented: entirely UI — the `isRead`/`isFlagged`/`categories` data model and persistence already existed from feature 002. `ReadingPane.tsx`'s fetch effect now auto-marks a message read on open (fires `messages.update` then relies on the existing `messagesVersion` broadcast loop to refresh); added Mark as read/unread and Flag/Unflag toggle buttons to all three action-row branches; added a categories row (removable pill tags + add-category input, free-form strings, no predefined taxonomy). `MessageListPane.tsx` rows now have a sibling flag-glyph button (not nested, since buttons can't nest) plus an inline category-tag summary, and the header gained a category filter `<select>` (client-side filter of the already-fetched folder list). No `App.tsx` or backend changes needed — the existing `data:messages-changed` broadcast keeps both panes in sync. Fixed a self-inflicted regression along the way (wrapping the folder name in a `<span>` broke `getByText(..., {selector: '.message-list-header'})` assertions, since Testing Library's `getByText` only reads direct text-node children, not full `textContent`); lint/typecheck/build pass, existing suite still 208/208; phase set to `test`
- 2026-09-11 — feature 006 (mail delete & Deleted Items) accepted by user (including the ribbon-Delete fix); logged to CHANGELOG; active feature set to 007 (Mail read/unread, flags & categories), phase set to `implement`
- 2026-09-11 — feature 006 (mail delete & Deleted Items) accept-stage feedback addressed: user reported the ribbon's "Delete" button does nothing; root cause was a pre-existing feature-001 placeholder (disabled, no distinct disabled styling, same pattern as Reply/Reply All/Forward in the ribbon) that predates this feature but became misleading now that Delete actually works elsewhere; user chose to wire it up rather than log it separately or leave it. `RibbonBar.tsx` now maps each action name to an optional handler (`onDelete` alongside the existing `onNewEmail`) instead of special-casing New Email; `App.tsx` enables it via `canDeleteSelected = selectedMessageId && selectedFolderId !== 'deleted'` (disabled in Deleted Items since Delete isn't a Reading Pane action there either) and reuses a new shared `moveMessageToDeleted` helper so both the ribbon and `handleDeleteMessage` go through the same path; added 4 tests (204 → 208, stable across 3 runs); lint/typecheck/build all still pass; phase stays `accept`
- 2026-09-11 — feature 006 (mail delete & Deleted Items) validated: lint/typecheck/build pass; full test suite (204/204) re-run 3x, stable; all 3 ACs verified by tests + code inspection plus a live check — bundled `db.ts` standalone with `esbuild` and drove a real (non-mocked) `MailDb` through delete-from-inbox/sent/drafts, restore, and permanent-delete, all behaving correctly; additionally cross-checked the user's real `~/.config/outlook-sim/outlook-sim.db`, which had already picked up the `previous_folder_id` migration from a real app launch since `/implement`, with all 8 pre-existing real messages intact — strong non-scripted evidence the migration is production-safe; no live multi-window Electron GUI click-through attempted (no Xvfb, same non-blocking gap as every prior feature); phase set to `accept`
- 2026-09-11 — feature 006 (mail delete & Deleted Items) tested: added 11 tests on top of the coverage already written during `/implement` (193 → 204, all passing; re-ran full suite 3x, stable) — `db.test.ts` covers `previousFolderId` defaulting, delete-then-restore round-tripping, permanent deletion from Deleted Items, close/reopen persistence of a deleted message, and the `previous_folder_id` migration path for pre-existing DBs; `ReadingPane.test.tsx` covers Delete appearing (and firing) in both normal folders and Drafts, and Deleted Items showing only Restore/Delete permanently; `App.test.tsx` covers the three handlers calling the right `window.api.data.messages.*` calls with the right arguments and clearing the selection; lint/typecheck/build all still pass; UI-layer persistence-across-a-real-restart remains untested (no Playwright/xvfb driver, same gap as prior features) — DB-layer persistence is covered instead; phase set to `validate`
- 2026-09-11 — feature 006 (mail delete & Deleted Items) implemented: "Delete" is a soft move to the `deleted` folder (reuses the existing generic `db:messages:update` IPC path, no new channels); added `previousFolderId: string | null` to `MailMessage` (new nullable `previous_folder_id` SQLite column + `ALTER TABLE` migration for pre-existing DBs, alongside the existing `cc` migration) so Restore knows the original folder; `ReadingPane.tsx`'s action row now branches three ways — Drafts (Edit draft + Delete), Deleted Items (Restore + Delete permanently, the latter calling the existing real `db:messages:delete`), everything else (Reply/Reply All/Forward + Delete) — with handlers in `App.tsx` clearing the selection afterward; no new UI in `MessageListPane` or the ribbon, consistent with Reply/Forward's existing ReadingPane-only pattern; lint/typecheck/build pass, existing suite still 193/193 (compile-only fixture touch-ups — new `previousFolderId` field / mock props — in 7 test files, no behavior changes there); verified the migration against a scratch copy of the real `~/.config/outlook-sim/outlook-sim.db` (column added, rows intact); phase set to `test`
- 2026-09-11 — feature 016 (LLM unsolicited incoming mail scheduler) accepted by user; logged to CHANGELOG; all high-priority features now done; active feature set to 006 (Mail delete & Deleted Items), phase set to `implement`
- 2026-09-11 — feature 016 (LLM unsolicited incoming mail scheduler) validated: lint/typecheck/build pass; full test suite (193/193) re-run 3x, stable; all 4 ACs verified by tests + a skeptical code-level read of scheduler.ts/index.ts/App.tsx; two non-blocking design notes recorded (the "upcoming calendar items" filter excludes already-overdue-but-still-open deadlines, since CalendarItem has no resolved/completed field yet to distinguish that case; the Subject/body parser has no defense against a model wrapping its response in markdown fences, though it fails safe rather than inserting garbled content); live end-to-end generation check from `/implement` re-confirmed as valid evidence for AC2; live Electron app-lifecycle wiring and real network calls remain flagged, non-blocking gaps; phase set to `accept`
- 2026-09-11 — feature 016 (LLM unsolicited incoming mail scheduler) tested: added 4 tests on top of the 14 already written during `/implement` (189 → 193, all passing; re-ran full suite 3x, stable) — interval-bounds assertion (1-3 simulated hours), persona selection actually varying across multiple configured personas, correspondence scoping (a second persona's mail doesn't leak into the chosen persona's prompt), a concurrency guard test (overlapping ticks don't double-fire), and a real-`SimClock` (not mocked) pause/start/pause integration test; lint/typecheck/build all still pass; live-API and real Electron-lifecycle paths remain flagged, non-blocking limitations — see feature file Test Notes; phase set to `validate`
- 2026-09-11 — feature 016 (LLM unsolicited incoming mail scheduler) implemented: new `src/main/llm/scheduler.ts` with `generateUnsolicitedMail` (picks a random persona, prompts for a Subject/body-formatted new email referencing recent correspondence + upcoming calendar deadlines, parses and inserts into Inbox) and `UnsolicitedMailScheduler` (a real-time 10s poller checking a `ConfigStore`-persisted `nextDueSimTime` against `clock.now()`, only firing while the sim clock is running, randomized 1-3 simulated hours between attempts); wired into `index.ts` alongside the existing clock start/pause lifecycle (AC4), broadcasting through the existing `data:messages-changed` plus a new `llm:unsolicited-mail-failed` channel — generalized 015's error banner in `App.tsx` to handle both sources without duplicating UI; lint/typecheck/build pass, tests 175→189 (14 new: scheduler content-generation + scheduling-logic tests, config.ts scheduler-state round-trip, App.tsx banner test); additionally ran a real end-to-end check against the already-configured real Anthropic key + personas with a seeded calendar deadline — got back a coherent, in-character email correctly referencing that deadline; calendar items have no creation UI yet (018/019 still backlog) so the coherent-deadline-reference behavior is implemented/tested but not yet user-demonstrable from a fresh install without seeding; phase set to `test`
- 2026-09-11 — feature 015 (LLM persona reply generation) accepted by user, who independently confirmed it live in the running app first (sent "please respond" to persona Patricia Sim, got a real in-character reply in Inbox 2 seconds later); logged to CHANGELOG; active feature set to 016 (LLM unsolicited incoming mail scheduler), phase set to `implement`
- 2026-09-11 — feature 015 (LLM persona reply generation) validated: lint/typecheck/build pass; full test suite (175/175) re-run 3x, stable; all 4 ACs verified by tests + code inspection; additionally ran a real live end-to-end sanity check — bundled `personaReply.ts` with the real `MailDb`/`ConfigStore`/`SimClock` (temp-dir-backed, not mocked) and a real invalid OpenAI key, confirming the whole pipeline (persona lookup → thread assembly → real network call → error handling) works correctly with zero Inbox rows and no crash; one non-blocking robustness observation noted (an uncaught hypothetical DB-insert failure would produce an unhandled-rejection warning, not a crash — not one of AC4's stated failure modes); live Electron multi-window verification not attempted (no Xvfb, same non-blocking sandbox gap as prior features); phase set to `accept`
- 2026-09-11 — feature 015 (LLM persona reply generation) tested: added 6 tests on top of the 18 already written during `/implement` (169 → 175, all passing; re-ran full suite 3x, stable) — thread exclusion (unrelated subject stays out of the prompt), correct-persona matching among several configured personas, case-insensitive persona email matching, simulated-vs-wall-clock timestamp independence, a Cc-only persona not also getting a reply (locks in the scope decision), and the Reply flow (not just fresh Send) triggering persona-reply generation; lint/typecheck/build all still pass; live-API and real multi-window Electron paths remain flagged, non-blocking limitations — see feature file Test Notes; phase set to `validate`
- 2026-09-11 — feature 015 (LLM persona reply generation) implemented: new `generatePersonaReply(db, config, clock, sentMessageId)` in `src/main/llm/personaReply.ts`, triggered (fire-and-forget) from `ComposeWindow.tsx`'s Send path via a new `llm:personaReply` IPC channel; matches the sent message's `toEmail` against configured Personas, assembles system prompt + persona fields + a thread history found via normalized-subject/participant matching (no explicit conversation id in the schema), calls the existing `generateText` (014) with instructions to respond with a literal `NO_REPLY` marker when a reply isn't warranted, and inserts into Inbox (persona as From, simulated `clock.now()` timestamp) only on a genuine successful reply decision; failures broadcast a new `llm:persona-reply-failed` event shown as a dismissible banner in `App.tsx` (no such error-surfacing mechanism existed before); lint/typecheck/build pass, tests 151→169 (18 new: personaReply unit tests incl. thread-matching, ipc handler tests, ComposeWindow trigger-wiring tests, App banner test); scope deliberately limited to the primary To persona only (no fan-out to Cc'd personas); phase set to `test`
- 2026-09-11 — feature 014 (LLM client integration) validated: lint/typecheck/build pass; full test suite (151/151) re-run 3x, stable; all 4 ACs verified by tests + code inspection (grepped for provider-literal leakage and for every `window.api.llm.*` call site); additionally ran a real live-network sanity check — bundled `client.ts` standalone with `esbuild` and hit all four real provider APIs (OpenAI/Anthropic/Gemini/xAI) with invalid keys, confirming real 401/400 error responses get parsed into clear messages exactly as the mocked tests assumed, without throwing; success-path text extraction remains unverified against a real 2xx response (no valid API keys in this sandbox) and AC4's real trigger path remains unverified (015/016 don't exist yet) — both flagged, neither blocking; live Electron GUI verification not attempted (no Xvfb, same non-blocking sandbox gap as prior features); phase set to `accept`
- 2026-09-11 — feature 014 (LLM client integration) tested: added 3 tests on top of the already-substantial suite written during `/implement` (148 → 151, all passing; re-ran full suite 3x, stable) — a `client.test.ts` test proving one identical call/result shape across all four providers (AC3), a `SettingsView.test.tsx` test proving no LLM call happens merely from mounting/loading Settings (AC4), and an `ipc.test.ts` test proving registering the IPC handlers alone triggers no `fetch` (AC4); lint/typecheck/build all still pass; AC1's live-API verification and AC4's "no scheduler/persona-reply exists yet to test the real trigger path" remain flagged limitations (no API keys in this sandbox; 015/016 not built yet) — see feature file Test Notes; phase set to `validate`
- 2026-09-11 — feature 014 (LLM client integration) implemented: new provider-agnostic `generateText(settings, input)` in `src/main/llm/client.ts` calling OpenAI/xAI (`/v1/chat/completions`), Anthropic (`/v1/messages`), and Gemini (`generateContent`) directly via `fetch` (no SDKs added), never throwing — always resolving `{ok:true,text}` or `{ok:false,error}`; exposed via two thin IPC wrappers (`llm:generate` reads persisted Settings, `llm:test` takes explicit settings) and `window.api.llm.*`; added a "Test Connection" button to Settings' LLM Provider section as the explicit, user-triggered way to exercise AC1/AC2 end-to-end (015/016, the real triggered callers, don't exist yet, and AC4 forbids any automatic call); lint/typecheck/build pass, tests 131→148 (16 new: client unit tests against mocked `fetch` per provider + error paths, IPC channel tests, SettingsView Test Connection tests); AC1's "successfully call the real APIs" verified only against mocked responses shaped like each documented API (no API keys available in this sandbox) — deferred to the user's manual check at `/accept`; also caught up a backlog of prior-session work that had never been committed (feature 013 simulated office clock, B001 Settings-close bug fix, and the commit/push step added to the dev-loop skill files themselves) in two separate commits before starting 014, per user's explicit choice when asked; a `seed-data/` folder with what looks like sensitive scenario data was deliberately left uncommitted; phase set to `test`
- 2026-09-11 — set up `BUGS.md` as the ad-hoc bug tracker (outside the active-feature loop); backfilled B001 (Settings screen had no way to close) into it
- 2026-09-11 — ad-hoc bug fix (outside the active-feature loop, feature stays 014, phase stays `implement`): Settings screen had no way to close once opened; see `BUGS.md` B001 for details. Tests + typecheck pass.
- 2026-09-11 — feature 013 (simulated office clock) accepted by user; logged to CHANGELOG; active feature set to 014 (LLM client integration), phase set to `implement`
- 2026-09-11 — feature 013 (simulated office clock) validated: lint/typecheck/build pass; full test suite (131/131) re-run 3x, stable; all 5 ACs verified by direct code inspection plus the existing automated coverage (AC3's reminder-firing half reconfirmed genuinely out of scope — no consumer exists anywhere in the app, grepped `reminderMinutesBefore`); cross-checked the real on-disk `~/.config/outlook-sim/config/clock.json` matches the `ClockState` type and reflects a sane paused/60x state from prior manual use, not a wall-clock reset; confirmed the `before-quit` → `simClock.pause()` design decision is wired as claimed; live Electron GUI verification not attempted (no Xvfb in this sandbox, same non-blocking gap as features 001/005), deferred to `/accept`; phase set to `accept`
- 2026-09-10 — feature 013 (simulated office clock) tested: added 21 tests across 4 files (110 → 131, all passing; re-ran full suite 3x to rule out flakiness from the timing-sensitive tests) — `clock.test.ts` uses fake timers for exact anchor-math verification (start/pause/resume/speed-change/restart-persistence), `ipc.test.ts` drives the clock through real IPC handlers, `OfficeClock.test.tsx` covers the UI (exported `computeDisplayTime` for direct testing after an initial flaky DOM-timing approach was abandoned) plus interval setup/teardown via spies, and `ComposeWindow.test.tsx` proves message timestamps come from simulated time by deliberately diverging it from a spied wall-clock; lint/typecheck/build all still pass; AC3's reminder-firing half and the `before-quit` Electron lifecycle hook remain untested (no consumer / no real Electron process available to a unit test, respectively) — flagged for `/validate`; phase set to `validate`
- 2026-09-10 — feature 013 (simulated office clock) implemented: new `SimClock` (`src/main/data/clock.ts`), an anchor-based (sim time + real time + running + speed) JSON-persisted clock exposed via `clock:*` IPC / `window.api.data.clock`; pauses automatically on app quit so restarts resume exactly where they left off rather than drifting through real downtime; new `OfficeClock.tsx` (Start/Pause + speed select + live display, ticking locally) rendered in `RibbonBar`; `ComposeWindow.tsx`'s message timestamps now come from `clock.now()` instead of `Date.now()`; reminder firing has no consumer yet (no reminder mechanism exists anywhere in the app) so that half of AC3 is forward-looking, same pattern as recent features; lint/typecheck/build/tests (110/110) all pass, including compile-fixes to `ipc.test.ts` and `mockApi.ts`; phase set to `test`
- 2026-09-10 — feature 012 (settings: personas (contacts) CRUD) accepted by user; logged to CHANGELOG; active feature set to 013 (simulated office clock), phase set to `implement`
- 2026-09-10 — feature 012 (settings: personas (contacts) CRUD) validated: lint/typecheck/build/tests (110/110) all pass; all 4 ACs verified by tests + code inspection; confirmed via `git diff` that backend/preload/ComposeWindow files are genuinely untouched; cross-checked the real `personas.json` matches its type exactly; directly read `ComposeWindow.tsx:23,128-138` to confirm the pre-existing AC3 wiring; live Electron GUI verification not re-attempted (same sandbox limitation, non-blocking); phase set to `accept`
- 2026-09-10 — feature 012 (settings: personas (contacts) CRUD) tested: added 7 tests in `PersonasSettings.test.tsx` (103 → 110, all passing) covering empty state, list rendering, Add-Persona validation, create (all fields incl. optional extra prompt left blank), edit-in-place, cancel-discards, and delete-persists-remaining-array; AC2's restart-persistence half and AC3 (compose To dropdown) confirmed already covered by pre-existing `config.test.ts`/`ComposeWindow.test.tsx` coverage; lint/typecheck/build all still pass; phase set to `validate`
- 2026-09-10 — feature 012 (settings: personas (contacts) CRUD) implemented: UI-only — persona data model, JSON persistence, and IPC already existed from feature 002, and AC3 (personas selectable in compose To) was already true via `ComposeWindow`'s existing persona fetch from feature 004. New `PersonasSettings.tsx` component (list + inline create/edit/delete form, immediate full-array persist on each action, no confirmation dialog — matching `FolderPane`'s CRUD pattern) rendered as a 4th section in `SettingsView.tsx`; lint/typecheck/build/tests (103/103) all pass; phase set to `test`
- 2026-09-10 — feature 011 (settings: trainee identity & system prompt) accepted by user; logged to CHANGELOG; active feature set to 012 (settings: personas (contacts) CRUD), phase set to `implement`
- 2026-09-10 — feature 011 (settings: trainee identity & system prompt) validated: lint/typecheck/build/tests (103/103) all pass; all 4 ACs verified by tests + code inspection; confirmed via `git diff` that backend/preload/ComposeWindow files are genuinely untouched by this feature; cross-checked the real `identity.json`/`system-prompt.json` match their types exactly; directly read `ComposeWindow.tsx:79-91` to confirm the pre-existing AC2 wiring; live Electron GUI verification not re-attempted (same sandbox limitation, non-blocking); phase set to `accept`
- 2026-09-10 — feature 011 (settings: trainee identity & system prompt) tested: added 7 tests in `SettingsView.test.tsx` (96 → 103, all passing) covering identity prefill/save/independent-Saved-indicator and system-prompt prefill/save/independent-Saved-indicator; hit and fixed a real accessible-name collision between the System Prompt section's `aria-label` and its textarea's `aria-label` (both "System Prompt") by scoping via role instead; AC2 confirmed already covered by pre-existing `ComposeWindow.test.tsx` coverage from feature 004; lint/typecheck/build all still pass; phase set to `validate`
- 2026-09-10 — feature 011 (settings: trainee identity & system prompt) implemented: UI-only — identity/system-prompt data model, JSON persistence, and IPC already existed from feature 002, and AC2 (outgoing mail uses configured identity) was already true via `ComposeWindow`'s existing `persist()` from feature 004. Restructured `SettingsView.tsx` into three sections (LLM Provider, Trainee Identity, System Prompt), each with its own load-on-mount prefill, Save button, and "Saved" indicator; fixed a resulting test ambiguity (three same-named "Save" buttons) by scoping the Provider section's existing tests via its new `region` role; lint/typecheck/build/tests (96/96) all pass; phase set to `test`
- 2026-09-10 — feature 010 (settings: LLM provider, model & API key storage) accepted by user; logged to CHANGELOG; active feature set to 011 (settings: trainee identity & system prompt), phase set to `implement`
- 2026-09-10 — feature 010 (settings: LLM provider, model & API key storage) validated: lint/typecheck/build/tests (96/96) all pass; all 5 ACs verified by tests + code inspection; confirmed `config.ts` untouched by this feature (`git diff` empty) so no persistence/migration risk, and cross-checked the real `~/.config/outlook-sim/config/settings.json` matches the `Settings` shape exactly; live Electron GUI verification not re-attempted (same sandbox limitation documented in feature 005, non-blocking); phase set to `accept`
- 2026-09-10 — feature 010 (settings: LLM provider, model & API key storage) tested: added 9 tests across 2 files (87 → 96, all passing) — `SettingsView.test.tsx` covering the provider list, prefill, model editing, per-provider API key switching/preservation, and full-record Save; `App.test.tsx` covering the Settings nav-button entry/exit wiring; lint/typecheck/build all still pass; AC3's JSON-persistence-across-restarts half and AC5's no-network claim were left to their existing pre-feature coverage (`config.test.ts`, `no-network.test.ts`) rather than re-tested at the UI layer; phase set to `validate`
- 2026-09-10 — feature 010 (settings: LLM provider, model & API key storage) implemented: UI-only — the Settings data model/JSON persistence/IPC already existed from feature 002. Added `SettingsView.tsx` (provider select, free-text model input, per-provider password-masked API key input, explicit Save) and wired it into `App.tsx` via a new "Settings" nav-rail button (not a NavSwitcher tab, since that's deliberately Mail/Calendar-only) that swaps the main content pane; lint/typecheck/build/tests (87/87) all pass; AC4/AC5's "subsequent LLM calls" have no runtime yet (that's feature 014) so this delivers the data-model invariant (`apiKeys[provider]`) and confirms zero network calls, not an actual call-time key selection; phase set to `test`
- 2026-09-10 — feature 005 (mail reply, reply all & forward) accepted by user; logged to CHANGELOG; active feature set to 010 (settings: LLM provider, model & API key storage), phase set to `implement`
- 2026-09-10 — feature 005 (mail reply, reply all & forward) validated: lint/typecheck/build/tests (87/87) all pass; all 5 ACs verified by the test suite plus code inspection (AC2 confirmed against the Cc-based design the user approved in `/implement`); additionally verified the SQLite `cc`-column migration against a scratch copy of the user's actual `~/.config/outlook-sim/outlook-sim.db` (untouched original confirmed via mtime); live Electron GUI verification was attempted but blocked by the sandbox (no Xvfb, `apt-get`/`sudo` both require privileges unavailable here) — flagged as a pre-existing, non-blocking environment gap consistent with features 001/002's history, deferred to the user's own check at `/accept`; phase set to `accept`
- 2026-09-10 — feature 005 (mail reply, reply all & forward) tested: added 26 tests across 5 files (61 → 87, all passing) — a new `composeIntent.test.ts` unit-testing the reply/reply-all/forward prefill+subject-prefix-dedup logic directly, `ComposeWindow`/`ReadingPane`/`App` integration coverage for the UI wiring and mock-send path, and `db.test.ts` coverage for Cc round-tripping plus (most importantly) the `ALTER TABLE` migration path against a simulated pre-existing on-disk DB without the `cc` column; lint/typecheck/build all still pass; live multi-window Electron verification remains deferred to `/validate`; phase set to `validate`
- 2026-09-10 — feature 005 (mail reply, reply all & forward) implemented: added Cc support to the data model (user-approved scope expansion — Reply and Reply All had nothing to differ on with only a single-recipient message model) via a new `cc: MessageRecipient[]` field, SQLite column + migration for existing DBs; reply/reply-all/forward wired from new ReadingPane buttons through compose-window query params to a pure `buildComposeSeed` helper handling recipient/Cc prefill, quoted body, and dedup'd Re:/Fwd: subject prefixing; all three mock-send via the existing compose persist path unchanged; lint/typecheck/build/tests (61/61) all pass, including compile-only fixture touch-ups in 4 existing test files; live Electron verification deferred to `/validate` (no Playwright/xvfb driver exists in this repo); phase set to `test`
- 2026-09-10 — feature 004 (mail compose, mock-send & drafts) accepted by user; logged to CHANGELOG; active feature set to 005 (mail reply, reply all & forward), phase set to `implement`
- 2026-09-10 — feature 004 (mail compose, mock-send & drafts) validated: lint/typecheck/build/tests (61/61) all pass; all 5 ACs verified both by the new automated suite and by the round-1 live `/implement` run against the real app; incidentally corroborated by a real draft the user created themselves in the running app between sessions; phase set to `accept`
- 2026-09-10 — feature 004 (mail compose, mock-send & drafts) tested: added `ComposeWindow.test.tsx` (7 tests) plus new coverage in `RibbonBar`/`ReadingPane`/`MessageListPane`/`ipc` test files (4 more), 61/61 tests pass (up from 48); lint/typecheck/build unaffected; phase set to `validate`
- 2026-09-10 — feature 004 (mail compose, mock-send & drafts) implemented: compose opens in a real separate Electron window (confirmed with user), with a persona-sourced To dropdown, Subject/Body fields, Send→Sent and Save→Drafts (same row moves, no duplication), and an "Edit draft" reopen path from the reading pane; required new main-process work (`src/main/windows.ts`, a `window:openCompose` IPC handler, and a `data:messages-changed` broadcast on message create/update/delete so the main window refreshes when the compose window saves); live-verified end-to-end via a scripted real-Electron run (multi-window IPC can't be tested by Vitest); lint/typecheck/build pass, 48/48 existing tests still pass (kept compiling via mechanical prop/mock syncing), but zero new test coverage exists yet for the feature itself; phase set to `test`
- 2026-09-10 — feature 003 (mail folders, message list & reading pane) accepted by user; logged to CHANGELOG; active feature set to 004 (mail compose, mock-send & drafts), phase set to `implement`
- 2026-09-10 — feature 003 (mail folders, message list & reading pane) validated (round 2): lint/typecheck/build/tests (48/48) all pass; all 5 ACs verified both by the new automated suite and by the round-1 live `/verify` run against the real app and real SQLite DB; phase set to `accept`
- 2026-09-10 — feature 003 (mail folders, message list & reading pane) tested: added `src/renderer/src/test/mockApi.ts` (shared `window.api` mock) plus new test files for `FolderPane`/`MessageListPane`/`ReadingPane` and a rewritten async-aware `App.test.tsx`; 48/48 tests pass (was 23/28); lint/typecheck/build all still pass; phase set to `validate`
- 2026-09-10 — feature 003 (mail folders, message list & reading pane) validated: lint/typecheck/build pass; full test suite **fails** (23/28 — `App.test.tsx`'s 5 tests throw on the new `window.api` calls with no mock in place, and `FolderPane`/`MessageListPane`/`ReadingPane` have zero dedicated tests); all 5 ACs independently confirmed working via a live scripted run of the real Electron app against the real `~/.config/outlook-sim` SQLite DB (screenshots captured during `/verify`) — so this is a test-coverage gap, not a broken feature. Deviating from the standard "failure → back to implement" routing since there's no implementation defect to fix: status set to `testing`, phase set back to `test` directly, with the required test work spelled out in the feature file's Validation Notes.
- 2026-09-10 — feature 003 (mail folders, message list & reading pane) implemented: wired FolderPane/MessageListPane/ReadingPane to the `window.api.data` IPC surface from 002 (folders now real, dynamic, with custom-folder create/rename/delete UI; message list and reading pane fetch live data); no main-process changes needed; typecheck/lint/build all pass; phase set to `test`
- 2026-09-10 — feature 002 (local data layer) accepted by user after confirming the DB/config files exist at `~/.config/outlook-sim/` and cleaning up a stray `~/.config/Electron/outlook-sim.db`+`config/` from an earlier dev run; logged to CHANGELOG; active feature set to 003 (mail folders, message list & reading pane), phase set to `implement`
- 2026-09-10 — feature 002 (local data layer) validated: typecheck/build/tests (28) all pass, all 5 ACs verified against the real `MailDb`/`ConfigStore` classes; full-app launch unverified (same sandbox display limitation as feature 001, not a regression); no lint tooling exists yet (flagged, not blocking); phase set to `accept`
- 2026-09-09 — feature 002 (local data layer) tested: 20 new Vitest tests (db, config, IPC bridge, no-network check) against real temp-dir-backed stores, 28/28 total passing; switched test env default to `node` for `node:sqlite` support; phase set to `validate`
- 2026-09-09 — feature 002 (local data layer) implemented: SQLite (`node:sqlite`) store for folders/messages/calendar items + JSON config store (settings/system prompt/identity/personas), exposed via IPC (`window.api.data.*`); no UI, per scope; phase set to `test`
- 2026-09-09 — feature 001 (app shell) accepted by user after manual launch check; logged to CHANGELOG; active feature set to 002 (local data layer), phase set to `implement`
- 2026-09-09 — feature 001 (app shell) validated: typecheck/build/tests all pass, manual offscreen-Electron launch confirmed all 5 ACs; no lint tooling exists yet (flagged, not blocking); phase set to `accept`
- 2026-09-09 — feature 001 (app shell) tested: set up Vitest + React Testing Library, 7 passing tests covering all shell ACs except Windows-launch and pixel styling; phase set to `validate`
- 2026-09-09 — feature 001 (app shell) implemented: Electron+Vite+React+TS scaffold, classic Outlook 3-pane/ribbon layout with Mail/Calendar switcher; phase set to `test`
- 2026-09-09 — backlog of 22 features created from spec, phase set to `implement`, active feature set to 001
- 2026-09-09 — spec drafted from docs/outlook-trainer-spec-prompt.md, phase set to `features`
- 2026-08-31 — scaffold created, phase set to `spec`
