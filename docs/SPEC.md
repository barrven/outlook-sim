# Product Spec

> Living document. Updated by `/spec` at the start of every outer-loop
> iteration and amended by `/retro` at the end of one.

## Vision
A Windows desktop training sandbox that looks and feels like classic Outlook,
where office employees practice email correspondence and calendar/deadline
management against LLM-generated mock correspondents in a workplace domain
defined entirely by an editable system prompt and personas. No real mail is
ever sent or received, and there is no scoring, grading, or coaching UI —
practice only.

## Users
- **Trainee**: a generic office employee practicing correspondence and
  deadline management. In v1 the trainee also configures their own scenario
  (system prompt, personas, trainee identity) — there is no separate
  operator/admin role.

## Core Requirements
1. The app is a Windows-only Electron desktop app; no real mail is ever sent
   or received over SMTP, Exchange, Graph, or IMAP — all correspondence is
   local and LLM-generated.
2. The UI mimics classic Windows Outlook (not New Outlook / Outlook on the
   web): left folder pane, center message list, a reading pane, top
   ribbon/toolbar, with Mail and Calendar modules in the left navigation.
   The ribbon's Send/Receive and Folder tabs stay hidden until there is real
   functionality behind them. Settings is opened from the File menu (not a
   left-nav-rail button); the File menu also has an About section listing
   the app version and a link to its GitHub repo
   (https://github.com/barrven/outlook-sim/). The app window/taskbar icon is
   the project's `email.png` asset. The overall layout, density, and chrome
   stay classic-Outlook; individual interactive elements (buttons, chips,
   panels, flags, etc.) use a logical/semantic color system and a modest
   border-radius for a more modern feel, without restyling the ribbon/pane
   structure itself.
3. The Mail module supports: compose and mock-send; reply, reply all,
   forward (replies quote the full prior thread/email chain, not just the
   immediately preceding message); drafts; delete and Deleted Items;
   Inbox/Sent/Drafts/Deleted Items plus custom folders; read/unread state
   (a message the trainee sends is created already read — "unread" only
   applies to incoming mail); flags (shown in red); categories; search (a
   box in the ribbon, between the View tab and the simulated-clock display);
   and mock attachments (filename + placeholder only, no real file payload —
   attachments persist correctly on both the original/draft copy and the
   Sent Items copy of a sent message). The message list supports multi-select
   (Ctrl-click, Shift-click) and a right-click context menu — Move to folder,
   Mark read/unread, Flag/Unflag, Add to category, Reply/Reply All/Forward,
   Delete — whose actions apply to the whole current selection. Double-
   clicking a message opens it in its own pop-out reading window. The View
   ribbon tab toggles the inline reading pane itself between "Right"
   (default) and "Off" (read only via double-click pop-out), and separately
   toggles a lightweight Tasks side panel (see requirement 14).
4. The Calendar module supports day, work-week, week, and month views;
   deadlines and all-day items; reminders (a recurring event's reminder
   fires on every occurrence, not only once on the series' first
   occurrence); and recurring events. Clicking a calendar item opens it in a
   read-only "view" mode (the same form component as create/edit, with
   distinct view/edit modes) rather than straight into editing; clicking a
   different item while one is open swaps the panel to the newly clicked
   item; double-clicking a calendar item pops it out into its own separate
   window.
5. A simulated office clock (start, pause, speed controls) drives all message
   timestamps and reminder firing — not wall-clock time — so multi-day
   deadline scenarios can run in one sitting. The clock's display renders in
   black text; clicking it opens a dropdown month-view mini-calendar with
   the current simulated day highlighted, Previous/Next-month navigation,
   and clicking any other day shows how much simulated time remains until
   it.
6. When the trainee sends or replies, the app generates an LLM-written reply
   in the relevant persona's voice whenever a reply is appropriate for that
   persona/context, quoting the full prior thread/email chain the same way
   the trainee's own replies do.
7. The app also generates unsolicited incoming mail (status updates, demands,
   reminders, new requests) driven by the system prompt, personas, current
   mailbox/calendar state, and simulated time.
8. Settings let the user pick an LLM provider (OpenAI, Anthropic, Gemini, or
   Grok/xAI) and model, and store an API key per provider locally. If an LLM
   call fails (persona reply, unsolicited mail, or Test Connection), the
   error banner includes a Retry button, and failures are logged somewhere
   durable for troubleshooting repeated failures — not just shown
   transiently in the UI.
9. Settings let the user define: trainee identity (display name, job title,
   From email, reports-to, and department); one editable system prompt
   (domain, goals, tone, rules); and personas (contacts) with display name,
   email, role, short bio, writing-style notes, an optional per-persona
   extra prompt, and a reports-to field (so the configured personas — plus
   the trainee's own reports-to/department — express a real corporate
   reporting structure). Settings also offers a "Load Personas" button that
   imports a persona list from a standalone JSON file (independent of a full
   scenario pack), and a "Generate Personas" UI that asks the configured LLM
   to generate a full set of personas — including reports-to relationships —
   from a short company/industry description, as an alternative to manual
   entry.
10. Personas double as contacts and as From/To parties on mock mail.
11. The app supports two modes: **free-play** (the user sets prompt +
    personas + trainee identity and starts from an empty or lightly seeded
    mailbox/calendar) and **packaged scenarios** (load/save a JSON scenario
    pack containing starting inbox, contacts/personas, calendar deadlines,
    the system prompt, and optional timed incoming messages). Loading a pack
    updates any already-open Settings sections (in particular Personas)
    immediately, without needing to close and reopen Settings.
12. Runtime app data (messages, folders, calendar items, flags, read state)
    persists in SQLite; configuration (settings, system prompt, trainee
    identity, personas, scenario packs) persists as JSON files — all local to
    the machine.
13. The app never sends network traffic outside itself except LLM API calls
    to the user's configured provider.
14. A lightweight Tasks panel — not a full Tasks module — can be toggled
    on/off from the View ribbon tab. When on, it renders as a column on the
    right-hand side of the UI showing every flagged email plus any
    freestanding tasks the user adds directly in the panel.
15. A "FileVine" ribbon tab sits between Home and View. Clicking it swaps the
    center/right content area (where the message list and reading pane
    normally render) to a case-file/matter management UI, while the left-hand
    folder pane keeps showing the mail folder list underneath it. FileVine
    lets the trainee build a folder structure (like a file system) and
    associate any folder with a specific persona as that folder's client.
    Each folder supports full CRUD over notes/files, where a file entry is a
    name plus full text content stored as Markdown and rendered as formatted
    (not raw) Markdown in the viewing UI. When generating a reply or
    unsolicited mail for a persona that has an associated FileVine folder,
    that folder's notes/files are included in the persona's LLM context, so
    personas can meaningfully reference and correspond about documents
    located there.

## Non-goals
- People as a first-class module. (A full Tasks module — its own left-nav
  entry and dedicated views — remains out of scope; Core Requirement 14's
  flagged-mail-plus-freestanding-tasks side panel is a deliberately narrower
  feature, not an exception. A standalone, general-purpose Notes module also
  remains out of scope; Core Requirement 15's FileVine notes/files are
  scoped to case-file folders tied to a persona/client, not a free-standing
  notes app.)
- Conversation threading (as a distinct grouped-view UI; replies quoting the
  prior chain inline in the message body, per requirement 3/6, is not
  conversation threading)
- Meeting invite workflow (accept/tentative/decline) and
  appointments-as-meetings with persona attendees/RSVP
- Real SMTP, Exchange, Graph, or IMAP integration
- Scoring, grading, or coaching UI — this is a practice sandbox only
- macOS/Linux support (Windows only for v1)
- Cloud backend or telemetry of any kind

## Constraints
- Platform: Windows only, built as an Electron desktop app.
- Storage: SQLite for runtime data; JSON files for configuration and
  scenario packs, loadable/savable from the UI.
- LLM providers: OpenAI, Anthropic, Gemini, Grok (xAI) — user supplies and
  stores their own API key per provider, locally.
- No hardcoded domain: the workplace (legal, insurance, medical office, etc.)
  is entirely defined by the editable system prompt and personas.
- No real mail transport of any kind; simulated time drives all
  correspondence timing, not wall-clock time.

## Open Questions
- How should provider API keys be protected at rest (plaintext JSON vs. OS
  keychain / encryption)? Defaulting to plaintext local JSON for v1, given
  this is a single-user, offline-except-LLM-calls app with no cloud backend —
  flag if stronger protection is wanted before `/features` locks this in.
- Does the app support multiple saved mailbox/calendar "sessions" in
  parallel, or is there always exactly one active state, with loading a
  scenario pack replacing it? Defaulting to a single active state for v1.
- No cost/rate-limiting behavior for the unsolicited-mail scheduler was
  specified in the source prompt. `/features` will default to a reasonable
  scheduler interval unless the user specifies one first.

## Ideas for next spec revision
_Staging area for feature ideas noticed outside the dev loop (not bugs —
see `BUGS.md` for those). `/spec` should fold these into Core Requirements
or Non-goals as appropriate, then clear them from this list._

_(empty — the retry-button/durable-logging idea noted 2026-09-12 was folded
into Core Requirement 8 on 2026-09-14)_

## Changelog of spec revisions
_Appended by `/retro` — what changed about the spec itself and why._

- 2026-08-31 — initial scaffold, spec not yet written
- 2026-09-09 — first real draft written from `docs/outlook-trainer-spec-prompt.md`
- 2026-09-14 — (iteration 2) revised after v1's full backlog (all 22
  features) shipped and was accepted. Folded in the three bugs open in
  `BUGS.md` (sent mail wrongly starting unread, persona replies not quoting
  the prior chain, attachments dropping from the Sent Items copy), the
  recurring-event per-occurrence reminder gap noted during feature 020, and
  the already-staged retry-button/durable-logging idea — all now Core
  Requirements instead of open gaps. Also added, at the user's direction: a
  richer Settings surface (system prompt now travels with scenario packs;
  trainee identity and personas both gain a reports-to/org-structure
  concept; personas can be imported from JSON or LLM-generated from a
  company/industry description); a reworked ribbon (Send/Receive and Folder
  hidden until built out, Settings moved into the File menu with a new About
  section, search moved into the ribbon); mail message-list multi-select
  plus a right-click context menu; pop-out windows for double-clicked mail
  and calendar items; a view/edit-mode split for calendar items; a
  simulated-clock dropdown mini-calendar; a new lightweight Tasks side panel
  — narrowed deliberately from the standing "no first-class Tasks module"
  non-goal (Core Requirement 14 / Non-goals); a custom app icon
  (`email.png`); an element-level styling pass (logical/semantic colors,
  border-radius) that deliberately does not touch the classic-Outlook
  layout/chrome (Core Requirement 2); and a new "FileVine" case-file/matter
  panel (Core Requirement 15) that reverses the previously-stated
  "Case-file / matter panel" non-goal outright, at the user's explicit
  direction — folders tied to a persona-as-client, Markdown-backed notes/
  files rendered formatted, and folder contents fed into that persona's LLM
  context so personas can reference and correspond about the documents
  there. `/features` is next, to turn this into a new backlog.
