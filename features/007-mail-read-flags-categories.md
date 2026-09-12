---
id: 007
title: Mail read/unread, flags & categories
status: accept
priority: medium
---

## Description
Messages track read/unread state (auto-marking read on open, manual
toggle), can be flagged for follow-up, and can be tagged with one or more
categories.

## Acceptance Criteria
- [x] Unread messages are visually distinguished in the message list
- [x] Opening a message marks it read; user can manually mark read/unread
- [x] User can flag/unflag a message from the message list or reading pane
- [x] User can assign one or more categories to a message and see/filter by
      them in the list
- [x] All three states persist across restarts

## Implementation Notes
The data model and persistence already existed in full from feature 002
(`isRead`, `isFlagged`, `categories: string[]` columns on `messages`,
round-tripped through `updateMessage`/`getMessage`) — this feature is
entirely UI, wiring the Reading Pane and Message List to those existing
fields via the existing generic `db:messages:update` IPC path. No schema
or IPC changes.

**Read/unread (AC1, AC2):** `MessageListPane.tsx` already bolded unread
subjects via a `.unread` class (from feature 003) — that's AC1, unchanged.
For AC2, `ReadingPane.tsx`'s message-fetch effect now checks
`!result.isRead` after loading and fires `messages.update(id, { isRead:
true })` if so; the resulting broadcast bumps `messagesVersion`, which
re-triggers the same effect (now returning `isRead: true`, so no further
update — no loop) and refreshes `MessageListPane`'s unread styling. A
manual "Mark as read"/"Mark as unread" toggle button (label flips based on
current state) was added to all three of the Reading Pane's action-row
branches (Drafts / Deleted Items / everything else).

**Flags (AC3):** a "Flag"/"Unflag" toggle button added alongside the read
toggle in all three Reading Pane branches. In `MessageListPane.tsx`, each
row is now a `<li>` containing two sibling buttons — the existing select
button plus a new small flag-glyph button (⚑/⚐) — rather than nesting a
button inside a button (invalid HTML); `event.stopPropagation()` on the
flag button prevents its click from being treated as a row-select even
though they aren't nested (defensive, not load-bearing here).

**Categories (AC4):** free-form, user-typed strings (no predefined
taxonomy exists anywhere in the app/spec). Reading Pane gained a
`.reading-pane-categories` row: existing categories as removable pill
tags (× button per tag) plus a small text input (Enter to add, dedups
against existing). Message List gained an inline category-tag summary
per row (comma-joined) and a `<select>` filter in the header populated
from the union of categories present in the *currently loaded* folder
(client-side filter of the already-fetched list, no new IPC) — the
select only renders once at least one message in the folder has a
category, so folders with none look unchanged. Both the input draft and
the filter selection reset when the message/folder changes; this needed
to be done via the "adjust state during render" pattern (comparing the
prop to a mirrored `useState`) rather than a `useEffect` calling
`setState`, since `eslint-plugin-react-hooks`'s `set-state-in-effect` rule
flags the latter.

**AC5 (persistence):** no new work — same SQLite round-trip these three
columns already had.

One TS wrinkle: the Reading Pane's toggle/category handlers are nested
function declarations defined after the `if (!displayedMessage) return`
guard; TS doesn't carry the null-narrowing on `displayedMessage` across
that closure boundary, so they're written against a separate
`const currentMessage: MailMessage = displayedMessage` binding instead.

Files touched: `src/renderer/src/components/ReadingPane.tsx`,
`src/renderer/src/components/MessageListPane.tsx`,
`src/renderer/src/styles/global.css`. `App.tsx` untouched — no new props
needed, since the existing global `data:messages-changed` broadcast +
`messagesVersion` refresh loop (already used by delete/restore) is enough
to keep both panes in sync after any of these direct updates.

Had to fix one existing-test regression along the way: I'd first wrapped
the message-list header's folder name in a `<span>` (for flex layout next
to the new filter `<select>`), which broke several pre-existing
`screen.findByText('Inbox', { selector: '.message-list-header' })`-style
assertions — Testing Library's `getByText` only looks at an element's
*direct* text-node children, not full recursive `textContent`, so
wrapping the text in a child element made it invisible to that query.
Reverted to a bare text child with the `<select>` as a sibling.

lint/typecheck/build pass; existing test suite still 208/208 (no new
tests yet — that's `/test`).

**Addendum (post-accept-review bug fix):** user reported that clicking
"Mark as unread" in the Reading Pane while the message stayed open
immediately flipped it back to read. Root cause: the fetch effect ran on
`[selectedMessageId, messagesVersion]`, and the manual toggle's own
`messages.update` call broadcasts `data:messages-changed` → bumps
`messagesVersion` → re-triggers that same effect for the still-open
message → refetches it now `isRead: false` → the unconditional
`!result.isRead` auto-mark check fired again and immediately re-marked it
read. Fixed with a `lastCheckedIdRef` ref: the auto-mark check now only
*acts* the first time a given `selectedMessageId` is seen (a genuinely new
open); a same-id refetch triggered by any other update (manual toggle,
flag, category change) updates local state but skips the auto-mark check
entirely. Key subtlety that a first fix attempt missed: the ref must be
stamped with the current id on *every* fetch for that id — including when
the message was already read on first open — not only when a mark
actually happens; otherwise a message that started read (so the ref never
got set) would still get incorrectly re-marked the first time it was
manually turned unread. Caught by a new regression test before fixing it
"for real" (see Test Notes) — the initial ref-only-on-mark version passed
every pre-existing test but failed the new regression test, which is
exactly why that test was worth writing.

## Test Notes
Added 13 tests on top of the coverage written during `/implement` (208 →
221, all passing; re-ran full suite 3x, stable):

- `ReadingPane.test.tsx` (9 new): opening an unread message fires
  `messages.update(id, { isRead: true })` automatically; an already-read
  message does *not* trigger a spurious update on open (guards the
  no-infinite-loop assumption from Implementation Notes); the Mark as
  unread/Mark as read toggle button shows the correct label for each state
  and calls `update` with the flipped boolean; the Flag/Unflag toggle
  likewise for `isFlagged`; existing categories render as tags whose
  remove (×) button calls `update` with that category filtered out; typing
  a new category and pressing Enter calls `update` with it appended and
  clears the input, while re-typing an already-present category calls
  `update` zero additional times (dedup).
- `MessageListPane.test.tsx` (4 new): each row's flag button toggles that
  message's `isFlagged` via `update` without ever calling
  `onSelectMessage` (proving AC3's "from the message list" independently
  of AC2/AC3's Reading Pane path); no category filter `<select>` renders
  when no message in the folder has a category; the filter appears once
  any message has one, correctly narrows the visible rows to a chosen
  category (a message with multiple categories stays visible for any of
  them) and "All categories" restores the full list; the filter resets to
  "All categories" when the folder changes (so a filter picked in Inbox
  doesn't silently hide messages after switching to Drafts).
- `db.test.ts` (1 new): a message with `isRead`/`isFlagged`/`categories`
  all set survives a `MailDb` close/reopen cycle intact — the AC5 check
  specific to this feature's three fields (the pre-existing close/reopen
  test only exercised default/empty values for them).

AC1 (unread bolding) already had dedicated coverage from feature 003
(`'renders messages for the folder, bolding unread ones'`) — not
duplicated here.

**Addendum (regression tests for the re-mark-read bug):** added 2 more
tests (221 → 223, all passing; re-ran full suite 3x, stable) —
`'does not immediately re-mark a message read after manually marking it
unread while still open (regression)'` reproduces the exact reported
sequence (open a read message, click Mark as unread, simulate the
resulting `messagesVersion` bump re-fetching it as unread) and asserts no
further `update` call happens; `'does re-auto-mark-read when a different,
unread message is opened next'` guards the fix's other half — navigating
to a genuinely different unread message must still auto-mark it, so the
fix doesn't overcorrect into never auto-marking anything.

Deliberately not covered: a live end-to-end round trip through the actual
`data:messages-changed` broadcast (i.e., verifying `MessageListPane`
visually updates the moment `ReadingPane`'s auto-mark-read IPC call
resolves) — that broadcast plumbing itself is already covered by feature
006's delete/restore tests, and re-proving it here would be testing the
same wiring rather than this feature's own logic. Each component's tests
mock `window.api` directly, which is the established pattern in this
codebase and also means neither test file needed a real `App`-level
integration test — App.tsx wasn't touched by this feature.

## Validation Notes
lint: pass. typecheck: pass (both `tsconfig.node.json` and
`tsconfig.web.json`). build (`electron-vite build`): pass. Full test suite:
221/221, re-run 3x back-to-back, stable. Confirmed via `git diff
6063fe7 6f9d205 --stat` that the `/test` stage touched only test files
(plus docs) — no implementation drift to re-review.

Per-AC check:

- **AC1 (unread visually distinguished):** PASS. Pre-existing from feature
  003 (`.message-list-item.unread .message-list-item-subject { font-weight:
  600 }`), unchanged by this feature; covered by
  `MessageListPane.test.tsx`'s `'renders messages for the folder, bolding
  unread ones'`.
- **AC2 (auto-mark-read on open + manual toggle):** PASS. Code inspection:
  `ReadingPane.tsx`'s fetch effect calls `messages.update(id, { isRead:
  true })` when a loaded message has `isRead: false`; a Mark as
  read/unread button (label reflects current state) appears in all three
  action-row branches and calls `update` with the flipped boolean.
  Confirmed by `ReadingPane.test.tsx` (auto-mark fires for unread, does
  *not* fire for already-read; manual toggle works both directions) and
  additionally by a live check: bundled `db.ts` standalone with `esbuild`
  and drove a real `MailDb` through create (unread by default) → mark
  read → mark unread, all correct.
- **AC3 (flag/unflag from list or reading pane):** PASS. Reading Pane has
  a Flag/Unflag toggle (all three branches); Message List has a per-row
  flag-glyph button as a sibling of the select button (not nested — HTML
  doesn't allow buttons inside buttons) with `stopPropagation` so it can't
  accidentally trigger row-select. Confirmed by tests in both files
  (`MessageListPane.test.tsx`'s new test explicitly asserts
  `onSelectMessage` is never called by the flag click) plus the same live
  `MailDb` check (flag update round-trips correctly).
- **AC4 (assign categories, see/filter in list):** PASS. Reading Pane
  gained a category-tag row (add via Enter with dedup, remove via a ×
  button per tag); Message List shows each row's categories inline and a
  filter `<select>` that appears only once at least one message in the
  folder has a category, correctly narrows the visible rows (a
  multi-category message stays visible under any of its categories), and
  resets to "All categories" on folder change. All confirmed by the new
  tests in both component test files, and by the live `MailDb` check
  (categories array round-trips through `updateMessage`/`getMessage`
  correctly).
- **AC5 (persists across restarts):** PASS. No new persistence code was
  needed — `isRead`/`isFlagged`/`categories` were already ordinary SQLite
  columns from feature 002. `db.test.ts`'s new close/reopen test proves a
  message with all three populated survives a `MailDb` restart intact;
  additionally re-verified live via the same `esbuild`-bundled `MailDb`
  script: created a message, set isRead/isFlagged/categories, closed and
  reopened the database, and re-read the exact same values back.

Non-blocking gap, consistent with every prior feature in this project: no
live multi-window Electron GUI click-through was performed (no
Xvfb/Playwright driver in this sandbox). The full click-to-read-to-list-
unbolds loop across components is only proven by per-component unit tests
plus the already-validated `data:messages-changed` broadcast wiring from
feature 006 — not re-exercised end-to-end here, since that would be
re-testing shared plumbing rather than this feature's own logic. Cross-
checked the user's real `~/.config/outlook-sim/outlook-sim.db`: all 8
existing real messages still have valid `is_read`/`is_flagged`/`categories`
columns (unread/unflagged/empty, since the app hasn't been relaunched with
this feature's UI yet) — confirms no schema regression, though it doesn't
exercise the new UI paths since those require the running app.

All five acceptance criteria verified. No regressions found.

**Re-validation after the re-mark-read bug fix:** lint/typecheck/build
still pass; full suite now 223/223, re-run 3x, stable. AC2 specifically
re-confirmed: verified the new regression test actually catches the bug
(it failed against the first fix attempt, which stamped the tracking ref
only when a mark occurred, before the corrected always-stamp version made
it pass) — genuine red→green, not a test written to match the fix.

## Acceptance Log
- 2026-09-11 — user reported, while reviewing before accepting: "I notice
  when testing that to mark an email as unread, you click the button in
  the reading pane, but then since the email is open, it immediately
  marks as read again." Decision: changes requested. Root cause: the
  message-fetch effect re-ran on every `messagesVersion` bump (including
  the one caused by the user's own manual-unread update) and unconditionally
  re-applied the "mark read if unread" check. Fixed with a ref that limits
  the auto-mark check to the first time a given message id is opened, not
  every subsequent refetch of the same open message; added 2 regression
  tests (one of which caught a bug in the first fix attempt). Re-validated
  in the same pass — see the addenda above.
