---
id: 008
title: Mail search
status: accept
priority: medium
---

## Description
Trainee can search mail by keyword across subject/body/sender within a
folder or across all folders.

## Acceptance Criteria
- [x] Search box filters the message list by keyword match against subject,
      body, and sender
- [x] User can scope search to the current folder or all folders
- [x] Search results update the message list without needing to change
      folder selection
- [x] Clearing the search restores the normal folder view

## Implementation Notes
Entirely UI, in `MessageListPane.tsx` (same file that already owns
folder-scoped fetching and the category filter from feature 007) — no
schema, IPC, or `App.tsx` changes. `window.api.data.messages.list()`
already supported an unscoped "all folders" query (`folderId` is
optional; the backend does `db.listMessages(undefined)` → all messages)
from feature 002, so AC2's "all folders" scope needed no new plumbing
either.

**Search UI:** a new row below the header — a text `<input type="search">`
(AC1) plus a scope `<select>` ("This folder" / "All folders", AC2), always
visible (not conditional on having typed anything, to avoid layout shift).

**Filtering:** `matchesQuery` does a case-insensitive substring match
against `subject`, `body`, `fromName`, and `fromEmail` (AC1's "subject,
body, and sender" — sender covers both display name and email address).
A second effect fetches an unscoped `allMessages` list, but only while
`searchScope === 'all'` (gated in the effect body), so a plain
current-folder view or a folder-scoped search never pays for the extra
IPC round trip. The existing per-folder `messages` fetch is untouched and
remains the base for both the normal view and folder-scoped search.

Filter pipeline, in order: `messages` (or `allMessages` if scoped to "all"
and a query exists) → search match → category filter (from feature 007,
unchanged) → rendered rows. AC3 falls out for free: nothing here touches
`selectedFolderId`, `FolderPane`, or folder selection — only local state
inside `MessageListPane` — so results update live without navigating
away. AC4 falls out for free too: an empty/whitespace-only query
(`query = searchQuery.trim().toLowerCase()`, falsy when empty) makes
`searchedMessages` fall through to the plain `messages` array, so clearing
the box exactly restores the pre-search folder view — including the
scope `<select>`'s value being irrelevant once there's no query to scope.

Minor polish beyond the literal ACs: the empty-state message now reads
"No results found." instead of "No items to show." when a search query is
active but matches nothing, since those are different situations for the
user.

The category-filter dropdown's own source list (`allCategories`) stays
derived from folder-scoped `messages` only, not the search results —
deliberately not reactive to "all folders" search scope, to avoid
conflating two independent filters' semantics; category filtering already
worked this way before this feature and wasn't touched.

Search query and scope are NOT reset on folder change (unlike the
category filter) — a deliberate choice: switching folders while a
folder-scoped search is active just re-scopes it to the new folder, which
reads as "still searching, now looking somewhere else" rather than an
unexpected wipe. Nothing in the ACs asks for a reset, and real Outlook
doesn't clear an active folder search on navigation either.

Files touched: `src/renderer/src/components/MessageListPane.tsx`,
`src/renderer/src/styles/global.css`.

lint/typecheck/build pass; existing test suite still 223/223 (no new
tests yet — that's `/test`).

## Test Notes
Added 7 tests to `MessageListPane.test.tsx` on top of the coverage
written during `/implement` (223 → 230, all passing; re-ran full suite 3x,
stable):

- **AC1** — one test with five messages, each matching the query
  `'budget'` (typed lowercase) through a different field: subject, body,
  sender display name, and sender email, plus a fifth message matching
  none of them; asserts the four matches show and the non-match doesn't,
  proving all four fields are searched and matching is case-insensitive
  (query lowercase, fixture data mixed-case).
- **AC2** — one test proving the default "This folder" scope only
  searches the folder-scoped `messages` fetch (a same-keyword match in a
  different folder stays hidden) and that switching the scope `<select>`
  to "All folders" then reveals it too, backed by a `mockImplementation`
  that returns different lists depending on whether `messages.list` was
  called with a folder id or with none; a second test confirms the
  unscoped fetch is genuinely lazy — `messages.list` is never called with
  zero arguments until "All folders" is actually selected (guards the
  "no extra IPC round trip" design decision from Implementation Notes).
- **AC3** — one test typing two different, non-overlapping queries in
  sequence and checking the visible rows flip each time, with the
  `selectedFolderId` prop held constant throughout and an explicit
  assertion that `messages.list` was never called with a different
  folder id — proving results update live without a folder change.
- **AC4** — one test that searches, confirms the list narrowed, clears the
  input, and confirms the full pre-search list is back.
- Two extra tests beyond the literal ACs, for confidence in the pipeline
  described in Implementation Notes: a distinct "No results found." empty
  state for a query that matches nothing (vs "No items to show." for a
  genuinely empty folder), and search + the existing category filter
  (feature 007) narrowing together rather than one silently overriding
  the other.

Deliberately not covered: a live Electron round trip proving the "all
folders" scope reflects messages from folders the trainee isn't currently
viewing in a real running app — the unscoped IPC call itself
(`db:messages:list` with no folder id) already has dedicated coverage in
`db.test.ts` from feature 002, so this only needed to prove
`MessageListPane` calls it correctly and renders whatever it returns,
which the scope test's `mockImplementation` does directly. Also not
covered: multi-word / phrase queries beyond a single keyword, and search
combined with the "All folders" scope in the same test as the category
filter — each of those is the same code path already exercised
separately, and stacking every combination would test the pipeline
mechanism repeatedly rather than new behavior.

## Validation Notes
lint: pass. typecheck: pass (both `tsconfig.node.json` and
`tsconfig.web.json`). build (`electron-vite build`): pass. Full test suite:
230/230, re-run 3x back-to-back, stable. Confirmed via `git diff 8419d59
3b82ace --stat` that the `/test` stage touched only
`MessageListPane.test.tsx`, the feature file, and the loop bookkeeping
files — no implementation drift to re-review.

Per-AC check (code inspection of `MessageListPane.tsx` plus the new
tests, since this feature is pure renderer UI with no main-process/DB
layer to exercise standalone the way prior features' `esbuild`-bundled
`MailDb` checks did — the Vitest suite already runs the real component
against real React/DOM, mocking only `window.api`, which is the strongest
non-Electron-GUI check available here):

- **AC1 (keyword match against subject/body/sender):** PASS.
  `matchesQuery` checks `subject`, `body`, `fromName`, and `fromEmail`,
  all lowercased on both sides for case-insensitivity. The new test
  constructs five messages, each matching the query through exactly one
  of those four fields (plus a fifth matching none), and confirms exactly
  the four expected rows show.
- **AC2 (scope to current folder or all folders):** PASS. A `<select>`
  toggles `searchScope` between `'folder'` and `'all'`; `searchedMessages`
  reads from the folder-scoped `messages` state or the separately-fetched
  `allMessages` state accordingly. Confirmed by a test using a
  `mockImplementation` that returns different lists depending on whether
  `messages.list` was called with a folder id or none, proving the scope
  switch actually changes which dataset is searched — plus a second test
  proving the unscoped fetch is genuinely lazy (never called until "All
  folders" is selected), matching the documented design intent.
- **AC3 (results update without changing folder selection):** PASS. By
  construction: nothing in the search/filter code path touches
  `selectedFolderId`, calls `onSelectMessage`, or reaches outside this
  component's own state. The new test types two different, mutually
  exclusive queries in sequence against a fixed `selectedFolderId` prop
  and confirms the visible rows change each time, with an explicit
  assertion that `messages.list` was never called with a different
  folder id during the whole interaction.
- **AC4 (clearing search restores normal view):** PASS. `query` is
  computed via `.trim().toLowerCase()`, which is falsy for an
  empty/whitespace string, so `searchedMessages` falls through to the
  plain `messages` array — no special-case "restore" code path exists
  because none is needed. Confirmed by a test that searches, clears, and
  checks the full original list is back.

Two extra tests beyond the literal ACs were also re-checked: the
distinct "No results found." vs "No items to show." empty states render
correctly, and an active search plus the pre-existing (feature 007)
category filter narrow the list together rather than one overriding the
other — both consistent with the documented filter pipeline order
(messages/allMessages → search → category → render).

Non-blocking gap, consistent with every prior feature in this project: no
live multi-window Electron GUI click-through was performed (no
Xvfb/Playwright driver in this sandbox). Unlike features 006/007 there was
no separate main-process/DB logic to additionally exercise via a
standalone `esbuild`-bundled script — this feature's entire surface is
renderer-side React state and the pre-existing, already-validated
`db:messages:list` IPC call, so the real-component Vitest suite already
represents the strongest available check.

All four acceptance criteria verified. No regressions found.

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
