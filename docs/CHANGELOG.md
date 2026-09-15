# Changelog

> Appended by `/accept` every time a feature is accepted by the user.

<!-- Format:
## 2026-08-31 — Feature title (features/001-slug.md)
What shipped, in user-facing terms.
-->

## 2026-09-14 — LLM error banner — Retry button and durable failure log (features/027-llm-error-retry-and-log.md)
When a persona-reply, unsolicited-mail, or Test Connection LLM call fails,
its failure message now includes a Retry button (alongside dismiss) that
re-attempts the exact same call — the same message for a persona reply,
the currently-displayed settings for Test Connection. A repeat failure
updates the existing message rather than piling up duplicates, and a
successful retry clears it and completes whatever the original call was
meant to do (e.g. the persona's reply gets inserted). Every LLM failure,
across all three surfaces, is now also appended to a durable local log
under the app's config directory, independent of whether its on-screen
message was ever seen or dismissed — useful for spotting a pattern of
repeated failures later.

## 2026-09-14 — FileVine notes/files CRUD with Markdown content (features/048-filevine-notes-markdown.md)
Within a FileVine folder, trainees can now create, edit, and delete notes
— each with a name and a Markdown body. Notes display formatted (real
headings, lists, bold/italic, links) by default; an explicit Edit mode
exposes the raw Markdown source, distinct from the rendered view. Deleting
a folder deletes its notes too, and everything persists across restarts.
Feeding FileVine content into persona LLM context remains a separate,
not-yet-built feature (049).

## 2026-09-14 — FileVine tab — folder structure and client association (features/047-filevine-folders-and-clients.md)
A new "FileVine" ribbon tab (between Home and View) opens a case-file
management UI in the center/right content area, while the mail folder pane
stays visible on the left. Trainees can build a nested folder tree
(create/rename/delete, file-system-style) and associate any folder with a
persona as its "client" — the client dropdown only offers personas flagged
as clients (Settings > Personas now has a "Client" checkbox), so firm staff
can't be assigned as a folder's client. Folder structure and client
associations persist across restarts. Notes/files CRUD and feeding
FileVine content into persona LLM context are separate, not-yet-built
features (048/049).

## 2026-09-14 — Fix: recurring event reminders fire per occurrence (features/026-fix-recurring-reminder-per-occurrence.md)
A recurring event or deadline's reminder now fires for every occurrence
that reaches its reminder time — the 2nd, 3rd, and so on — instead of only
ever once on the series' very first occurrence. Deleted occurrences (per
feature 020's per-occurrence editing) still never fire, and an occurrence
edited to a new time fires its reminder relative to that new time rather
than the original one. Non-recurring reminders are unaffected.

## 2026-09-14 — Fix: attachments persist on the Sent Items copy (features/025-fix-sent-attachments-dropped.md)
Investigated the reported bug (`BUGS.md` B004: attachments dropping from
the Sent Items copy of a message) and could not reproduce it against the
current code — the full path (compose window → IPC → SQLite persistence →
Reading Pane) already correctly carries attachments through for sending,
replying, forwarding, and editing drafts. Confirmed by the user that this
hasn't been observed recently. No behavior changed; added regression tests
across the whole path so this can't silently regress later.

## 2026-09-14 — Fix: persona replies quote the prior thread chain (features/024-fix-persona-reply-quotes-thread.md)
When a persona replies to a trainee's message, the reply now quotes the
message it's replying to — "On [date], Name <email> wrote:" followed by the
original text with "> " prefixes — the same convention the trainee's own
Reply/Reply All/Forward already use. Previously a persona's reply was just
the bare new text with no quoted context, unlike a real email client.

## 2026-09-14 — Fix: sent mail created as read, not unread (features/023-fix-sent-mail-marked-read.md)
Messages the trainee sends — via Send, Reply, Reply All, or Forward — now
land in Sent Items already marked read, since the trainee obviously already
"read" what they just wrote. "Unread" now only ever applies to genuinely
incoming mail (persona replies, unsolicited scheduler mail, scenario-pack
inbox seeding). Existing sent messages are unaffected — nothing was
retroactively changed.

## 2026-09-12 — Calendar recurring events (features/020-calendar-recurring-events.md)
Calendar events and deadlines can now repeat — daily, weekly, or monthly —
via a new "Repeat" option on the event form. Recurring instances show up
correctly across the Day, Work Week, Week, and Month views, each marked with
a small 🔁. Clicking any occurrence of a recurring series now asks whether a
change should apply to just that occurrence or the whole series, so editing
or deleting one date never silently affects the others (or vice versa).
Recurrence patterns and any per-occurrence changes persist across restarts
like everything else. Note: reminders on a recurring event still only fire
once, on the series' first occurrence — per-occurrence reminders aren't part
of this yet.

## 2026-09-12 — Mail mock attachments (features/009-mail-mock-attachments.md)
Compose can now attach one or more mock files by typing a filename — shown
as removable chips, no real file picker or content behind them. Received
and drafted messages show attachments as named, clickable buttons in the
reading pane; clicking one just confirms it's a placeholder with no file
content, never touching the real filesystem. Attachments persist with the
message across restarts like any other field. Simulated persona replies now
also know a file was attached (by name only), so they no longer contradict
what's visibly attached in the trainee's own mailbox.

## 2026-09-12 — Scenario pack save (features/022-scenario-pack-save.md)
Settings' "Scenario Pack" section gains a "Save Scenario Pack…" button
alongside Load. Pick a destination filename and it writes the current
Inbox, personas/contacts, and calendar items out to a JSON scenario pack —
the same format Load reads back in, so a saved-then-reloaded pack round-trips
without losing anything, including any still-pending "timed" messages from a
previously loaded pack. The file never contains API keys or other Settings
values, no matter what's configured.

## 2026-09-12 — Scenario pack load (features/021-scenario-pack-load.md)
Settings gets a new "Scenario Pack" section with a "Load Scenario Pack…"
button. Pick a JSON scenario pack file and it seeds the starting Inbox,
personas/contacts, and calendar deadlines from the pack — replacing whatever
was there before, with a confirmation prompt if that would discard existing
data. A pack can also include "timed" incoming messages that arrive later,
once the simulated office clock reaches each one's specified time, rather
than all at once on load. Picking an invalid or corrupted pack file shows a
specific, readable error instead of crashing.

## 2026-09-12 — Calendar deadlines, all-day items & reminders (features/019-calendar-deadlines-allday-reminders.md)
Every calendar item — event or deadline — can now be edited or deleted: click
it in any view to reopen the same form you created it with, with a Delete
button added. That form also gained a Type selector (Event/Deadline), an
All-day toggle (switches Start to a date-only picker, no time-of-day), and a
Reminder dropdown (None through 1 day before). When simulated time reaches a
reminder, a dismissible banner appears — visible no matter which module
you're in — and it only ever fires off the simulated office clock, never
while that clock is paused. Recurring events aren't part of this yet.

## 2026-09-11 — Calendar views & persistence (features/018-calendar-views-persistence.md)
The Calendar module is real now: Day, Work Week, Week, and Month views, each
switchable from tabs at the top of the calendar pane, with Previous/Next
navigation and a "Today" button that jumps to the simulated office clock's
current date (not your computer's real date). "New Event" in the ribbon
opens a form (Title, Description, Start, End) — created events show up
correctly no matter which view you're looking at, and everything persists
in the same local SQLite store as the rest of the app, surviving a restart.
Deadlines, all-day items, reminders, and recurring events aren't part of
this yet (that's next); "New Meeting" is hidden until meeting invites/RSVP
are built, since that's out of scope for now.

## 2026-09-11 — Free-play mode bootstrap (features/017-free-play-mode-bootstrap.md)
Settings gets a new "Session" section with a "Start Free-Play" button. Click
it and the mailbox and calendar reset to a fresh, empty state — ready for
the LLM scheduler and persona-reply features to drive activity from there,
using whatever system prompt/personas/trainee identity you've already
configured. No scenario pack is required. If you already have mail or
calendar data, you'll get a confirmation prompt before anything is wiped;
starting from an already-empty state just resets silently. Folder structure
(including any custom folders) and your Settings themselves are untouched.

## 2026-09-11 — Mail search (features/008-mail-search.md)
The message list now has a search box. Type a keyword and it filters
live against subject, body, and sender (name or email) — case-
insensitive, no need to press Enter or change folders. A scope dropdown
next to it lets you search just the current folder or across every
folder at once. Clearing the box brings back the normal folder view
exactly as it was.

## 2026-09-11 — Mail read/unread, flags & categories (features/007-mail-read-flags-categories.md)
Messages now track more than just their contents. Opening a message marks
it read automatically, and a Mark as read/unread button in the Reading
Pane lets you flip that manually at any time — unread messages still show
bold in the message list. A Flag/Unflag toggle is available both in the
Reading Pane and as a small flag button right on each row in the message
list, so you can flag something for follow-up without opening it. You can
also tag a message with one or more free-form categories from the Reading
Pane (type a name and press Enter, remove one with its × ), see them
summarized on each row in the list, and filter the list down to a single
category via a dropdown that appears once any message in the folder has
one. All three — read state, flags, categories — persist across restarts
like everything else in the mailbox.

## 2026-09-11 — Mail delete & Deleted Items (features/006-mail-delete-deleted-items.md)
You can now delete a message from any folder — Inbox, Sent, Drafts, or a
custom folder — and it moves to Deleted Items instead of vanishing. From
Deleted Items you can Restore a message back to wherever it came from, or
permanently delete it for good. Deleted Items survives closing and
reopening the app, same as every other folder. The Delete button works
both from the Reading Pane and from the ribbon (the ribbon's Delete had
been a non-functional placeholder since the very first version of the
app — it's wired up now too).

## 2026-09-11 — LLM unsolicited incoming mail scheduler (features/016-llm-unsolicited-mail-scheduler.md)
Your Inbox is no longer only reactive. While the simulated clock is
running, your configured personas will occasionally send you mail on
their own — a status update, a reminder, a demand, a new request —
without you having written to them first. Each one references what's
actually going on: recent correspondence with that persona and any
upcoming calendar deadlines, so it reads as a continuation of an
ongoing working relationship rather than a random ping. Nothing arrives
while the clock is paused, and the schedule survives closing and
reopening the app. If generation ever fails, a dismissible banner
explains why instead of failing silently.

## 2026-09-11 — LLM persona reply generation (features/015-llm-persona-reply-generation.md)
Sending or replying to a message addressed to one of your configured
personas now actually gets a response. The app assembles the system
prompt, that persona's details (role, bio, writing style), and the
thread history so far, and asks the LLM to reply in character — the
reply lands in Inbox from that persona, timestamped with the simulated
clock. If a reply genuinely isn't warranted for that message (e.g. a
pure FYI), the persona may not reply at all, same as a real person
would. If generation fails (bad key, network trouble, rate limit), a
dismissible banner explains what went wrong instead of silently doing
nothing or crashing.

## 2026-09-11 — LLM client integration (features/014-llm-client-integration.md)
Under the hood, the app can now actually talk to an LLM provider. Whatever
provider/model/key you've set in Settings — OpenAI, Anthropic, Gemini, or
Grok (xAI) — the app can send it a prompt and get generated text back
through one common internal interface, with clear, readable errors (bad
key, network trouble, rate limits) instead of crashing. To try it
yourself, Settings' LLM Provider section has a new "Test Connection"
button: enter a real key and model and click it to confirm the app can
actually reach that provider. Nothing calls this automatically yet — no
feature sends an LLM-generated reply or message on its own until the
persona-reply and unsolicited-mail features (next up) are built on top of
it.

## 2026-09-11 — Simulated office clock (features/013-simulated-office-clock.md)
The ribbon bar now shows a simulated clock with Start/Pause and a speed
multiplier (1x/2x/5x/10x/30x/60x), separate from your computer's actual
clock. New message timestamps use this simulated time instead of the real
wall clock, so a training scenario can compress days into minutes.
Pausing freezes the simulated time exactly where it is; resuming picks up
from there, and the clock's position survives quitting and relaunching
the app rather than jumping back to wall-clock time. Reminder firing will
also use this clock once the calendar/reminders feature exists — there's
nothing to wire it into yet.

## 2026-09-10 — Settings: personas (contacts) CRUD (features/012-settings-personas-crud.md)
The Settings screen gets a 4th section: Personas. Create, edit, and delete
contacts with a display name, email, role, bio, writing-style notes, and
an optional extra prompt. These personas are the same ones that show up
as selectable recipients in mail compose's To field, and this is where
you manage that list.

## 2026-09-10 — Settings: trainee identity & system prompt (features/011-settings-identity-system-prompt.md)
The Settings screen now has two more sections. "Trainee Identity" lets you
set your Display Name, Job Title, and From Email — this is what's used as
the From name/email on every message you send. "System Prompt" is a
free-text box for the domain, goals, tone, and rules that will drive the
simulation once the LLM integration lands. Each section saves
independently.

## 2026-09-10 — Settings: LLM provider, model & API key storage (features/010-settings-provider-model-api-key.md)
There's now a Settings screen (a new "Settings" button below the Mail/
Calendar switcher in the nav rail). Pick a provider — OpenAI, Anthropic,
Gemini, or Grok (xAI) — type in the model you want to use, and enter an
API key for that provider. Switching providers shows that provider's own
key without losing what you typed for the others; Save persists everything
to local JSON. No LLM calls happen yet (that's a later feature) — this is
just where the configuration lives.

## 2026-09-10 — Mail reply, reply all & forward (features/005-mail-reply-reply-all-forward.md)
From the reading pane you can now Reply, Reply All, or Forward the selected
message. Each opens a compose window pre-filled accordingly: Reply sets To
to the original sender and quotes the body; Reply All does the same and
also fills Cc with the message's other original recipients (compose
windows gained a Cc field, with add/remove chips, to support this); Forward
clears To so you can pick a new recipient but keeps the quoted body. All
three mock-send into Sent exactly like a new compose, and the subject gets
a Re:/Fwd: prefix that won't stack on repeated replies or forwards.

## 2026-09-10 — Mail compose, mock-send & drafts (features/004-mail-compose-send-drafts.md)
You can now compose mail. "New Email" on the ribbon opens a real compose
window with To (choose from your configured personas), Subject, and Body.
Send moves the message into Sent Items with a timestamp; Save & Close
stores it in Drafts. Click a draft, then "Edit draft" in the reading pane,
to reopen it — sending from there moves that same message into Sent rather
than creating a duplicate. Nothing here touches the network; sending is
purely local persistence, same as everything else in the app so far.

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
