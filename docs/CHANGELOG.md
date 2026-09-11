# Changelog

> Appended by `/accept` every time a feature is accepted by the user.

<!-- Format:
## 2026-08-31 — Feature title (features/001-slug.md)
What shipped, in user-facing terms.
-->

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
