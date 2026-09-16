---
id: 041
title: Double-click message opens a pop-out reading window
status: testing
priority: medium
---

## Description
Double-clicking a message in the list opens it in its own separate
Electron window (mirroring the existing compose pop-out pattern from
feature 004), showing the same content as the inline Reading Pane.

## Acceptance Criteria
- [ ] Double-clicking a message opens a new window showing that message's
      full content
- [ ] The pop-out window reflects live state (e.g. read/flag/category
      changes made elsewhere), consistent with the app's existing
      cross-window refresh pattern
- [ ] Closing the pop-out window doesn't affect the main window's
      selection/state
- [ ] Works whether the inline Reading Pane is currently "Right" or "Off"
      (feature 042)

## Implementation Notes
Mirrors the existing compose pop-out pattern (feature 004) exactly: a new
`window:openMessagePopout` IPC handler in `main/index.ts` looks up the
message's subject (for the window title, via the already-in-scope
`mailDb.getMessage`) and calls a new `createMessagePopoutWindow` in
`main/windows.ts` (same shape as `createComposeWindow` — a child
`BrowserWindow` loading the renderer with a `messagePopout=1&messageId=…`
query string). `main.tsx` routes that query combination to a new
`MessagePopoutWindow.tsx`, a thin host that renders the *same*
`ReadingPane` component the main window uses (AC1: identical content and
action buttons, not a reimplementation) with `selectedMessageId` fixed to
the message id and `selectedCount={1}`.

AC2 (live cross-window refresh) needed no new plumbing: every
create/update/delete already broadcasts `data:messages-changed` to
*every* open `BrowserWindow` (`main/data/ipc.ts`), so the pop-out window
just needs its own `messagesVersion` counter bumped on that same
`onMessagesChanged` listener `App.tsx` already uses — `ReadingPane`'s
existing fetch-by-id effect does the rest, including for changes made
*inside* the pop-out itself (its own Delete/Restore/Permanent-delete/
Mark-read/Flag calls round-trip through the same broadcast and refetch,
so e.g. clicking Delete correctly flips the pane to the Deleted-Items
button set in place, with no pop-out-specific state machine needed).

AC3 (closing the pop-out doesn't affect the main window) is structural,
not code: the pop-out is a wholly separate `BrowserWindow`/renderer
process with no shared React state — it never touches `App.tsx`'s
`selectedMessageIds`.

AC4 (works whether the Reading Pane is "Right" or "Off", feature 042):
042 doesn't exist yet (still `backlog`), so there is currently no "Off"
state to test against — but nothing in this feature depends on the
inline Reading Pane's visibility at all. The double-click handler lives
on the message-list row itself (`MessageListPane.tsx`, calling
`window.api.messagePopout.open(message.id)` directly, no new prop
threaded from `App.tsx`) and fires regardless of whatever else is
rendered beside it, so this AC will keep holding once 042 lands.

Reply/Reply All/Forward/Edit-draft/Delete/Restore/Permanent-delete inside
the pop-out are small standalone one-liners against `window.api`
directly (not imported from `App.tsx`) — each renderer entry point
(main window, compose window, and now this one) is its own isolated
process/React tree with no way to share component-local functions across
them; `ComposeWindow.tsx` already follows this same
each-window-is-self-contained convention rather than importing from
`App.tsx`.

New `MessagePopoutApi` (`preload`) exposes `messagePopout.open(messageId)`
→ `window:openMessagePopout`. No shared-type changes. Test's mock API
(`src/renderer/src/test/mockApi.ts`) needed a matching `messagePopout`
stub to keep the `Window['api']` type satisfied.

Verified live with a throwaway RTL suite (6 cases, all passing): the
pop-out renders the real message content via the real `ReadingPane`;
refetches on the `onMessagesChanged` broadcast; Reply calls
`compose.open` with the correct `sourceMessageId`/intent; Delete calls
`messages.update` with the correct Deleted-Items patch; a message already
in Deleted Items shows Restore/Delete-permanently instead; and
double-clicking a row in `MessageListPane` calls
`window.api.messagePopout.open` with that message's id.

lint/typecheck/build all pass; existing suite unchanged 596/596 (no new
tests added yet — that's `/test`'s job).

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
