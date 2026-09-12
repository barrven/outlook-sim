---
id: 007
title: Mail read/unread, flags & categories
status: validating
priority: medium
---

## Description
Messages track read/unread state (auto-marking read on open, manual
toggle), can be flagged for follow-up, and can be tagged with one or more
categories.

## Acceptance Criteria
- [ ] Unread messages are visually distinguished in the message list
- [ ] Opening a message marks it read; user can manually mark read/unread
- [ ] User can flag/unflag a message from the message list or reading pane
- [ ] User can assign one or more categories to a message and see/filter by
      them in the list
- [ ] All three states persist across restarts

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
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
