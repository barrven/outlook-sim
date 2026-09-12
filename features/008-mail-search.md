---
id: 008
title: Mail search
status: testing
priority: medium
---

## Description
Trainee can search mail by keyword across subject/body/sender within a
folder or across all folders.

## Acceptance Criteria
- [ ] Search box filters the message list by keyword match against subject,
      body, and sender
- [ ] User can scope search to the current folder or all folders
- [ ] Search results update the message list without needing to change
      folder selection
- [ ] Clearing the search restores the normal folder view

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
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
