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
   web): left folder pane, center message list, right reading pane, top
   ribbon/toolbar, with Mail and Calendar modules in the left navigation.
3. The Mail module supports: compose and mock-send; reply, reply all,
   forward; drafts; delete and Deleted Items; Inbox/Sent/Drafts/Deleted Items
   plus custom folders; read/unread state; flags; categories; search; and
   mock attachments (filename + placeholder only, no real file payload).
4. The Calendar module supports day, work-week, week, and month views;
   deadlines and all-day items; reminders; and recurring events.
5. A simulated office clock (start, pause, speed controls) drives all message
   timestamps and reminder firing — not wall-clock time — so multi-day
   deadline scenarios can run in one sitting.
6. When the trainee sends or replies, the app generates an LLM-written reply
   in the relevant persona's voice whenever a reply is appropriate for that
   persona/context.
7. The app also generates unsolicited incoming mail (status updates, demands,
   reminders, new requests) driven by the system prompt, personas, current
   mailbox/calendar state, and simulated time.
8. Settings let the user pick an LLM provider (OpenAI, Anthropic, Gemini, or
   Grok/xAI) and model, and store an API key per provider locally.
9. Settings let the user define: trainee identity (display name, job title,
   From email); one editable system prompt (domain, goals, tone, rules); and
   personas (contacts) with display name, email, role, short bio, writing-style
   notes, and an optional per-persona extra prompt.
10. Personas double as contacts and as From/To parties on mock mail.
11. The app supports two modes: **free-play** (the user sets prompt +
    personas + trainee identity and starts from an empty or lightly seeded
    mailbox/calendar) and **packaged scenarios** (load/save a JSON scenario
    pack containing starting inbox, contacts/personas, calendar deadlines,
    and optional timed incoming messages).
12. Runtime app data (messages, folders, calendar items, flags, read state)
    persists in SQLite; configuration (settings, system prompt, trainee
    identity, personas, scenario packs) persists as JSON files — all local to
    the machine.
13. The app never sends network traffic outside itself except LLM API calls
    to the user's configured provider.

## Non-goals
- People, Tasks, and Notes as first-class modules
- Conversation threading
- Case-file / matter panel
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

- Network fetch error banner (currently just a message + dismiss ✕, added
  in feature 016/personaReply's error handling) should also get a **Retry**
  button, and failures should be logged somewhere durable for
  troubleshooting repeated failures (currently only surfaced transiently in
  the UI banner, nowhere persisted). Noted 2026-09-12.

## Changelog of spec revisions
_Appended by `/retro` — what changed about the spec itself and why._

- 2026-08-31 — initial scaffold, spec not yet written
- 2026-09-09 — first real draft written from `docs/outlook-trainer-spec-prompt.md`
