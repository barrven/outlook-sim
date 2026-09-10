# Changelog

> Appended by `/accept` every time a feature is accepted by the user.

<!-- Format:
## 2026-08-31 — Feature title (features/001-slug.md)
What shipped, in user-facing terms.
-->

## 2026-09-10 — Mail folders, message list & reading pane (features/003-mail-folders-list-reading-pane.md)
The Mail module is now wired to real data. The folder pane shows the four
default folders (Inbox, Drafts, Sent Items, Deleted Items) plus any custom
folders you create, with rename and delete for custom folders. Selecting a
folder loads its messages into the message list, and selecting a message
shows its full content — subject, from/to, timestamp, and body — in the
reading pane. All of this reads from and writes to the local SQLite store
added in the previous release; there's still no way to compose or send a
new message yet (that's next).

## 2026-09-10 — Local data layer: SQLite + JSON config store (features/002-local-data-layer.md)
The app now persists data locally: a SQLite database (`outlook-sim.db`,
under the OS's app-data directory) holds folders, messages, and calendar
items with read/flag state, and four JSON files (settings, system prompt,
trainee identity, personas) hold configuration. Both are exposed internally
via `window.api.data.*` for upcoming features to build on. No UI yet, and
no network calls are made by this layer.

## 2026-09-09 — App shell & classic Outlook layout (features/001-app-shell.md)
The app now launches into a classic-Outlook-style window: top ribbon with
File/Home/Send-Receive/Folder/View tabs, a left nav rail with Mail and
Calendar folder panes plus a module switcher, a center message list, and a
right reading pane. Mail folders (Inbox/Drafts/Sent Items/Deleted Items)
are switchable. No live mail/calendar data or working actions yet — ribbon
buttons and tabs are placeholders that later features will wire up.
