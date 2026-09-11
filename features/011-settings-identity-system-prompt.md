---
id: 011
title: "Settings: trainee identity & system prompt"
status: done
priority: high
---

## Description
Settings screen lets the trainee set their identity (display name, job
title, From email) and edit the single system prompt that defines the
simulation's domain, goals, tone, and rules.

## Acceptance Criteria
- [x] User can set and persist display name, job title, and From email
- [x] Outgoing mock mail uses the configured From email/display name
- [x] User can edit a single free-text system prompt and it persists across
      restarts
- [x] The system prompt is stored in a form ready for later LLM prompt
      assembly

## Implementation Notes

**Backend already existed:** `TraineeIdentity { displayName, jobTitle,
fromEmail }` and `SystemPromptConfig { systemPrompt }`, their JSON
persistence in `ConfigStore` (`identity.json`/`system-prompt.json`), and
the `window.api.data.identity.get/set` + `systemPrompt.get/set` IPC
surface all already existed from feature 002. This feature is UI-only.

**AC2 was already true before this feature touched anything:**
`ComposeWindow.tsx`'s `persist()` (from feature 004) already calls
`window.api.data.identity.get()` and sets `fromName`/`fromEmail` on every
outgoing message from `identity.displayName`/`identity.fromEmail` — see
`src/renderer/src/ComposeWindow.tsx:80-89`. There was previously just no
UI to edit that identity; once this feature adds one, AC2 falls out for
free. No code change was needed there.

**`SettingsView.tsx` restructured into three sections** on one scrolling
page (each a `<section aria-label="...">` — giving it an accessible
`region` role, used to scope tests since all three sections now use the
same "Save"/"Saved" wording): the existing "LLM Provider" section
(feature 010, unchanged behavior) plus two new ones:
- **Trainee Identity:** Display Name / Job Title / From Email text inputs
  bound to `TraineeIdentity`, its own Save button calling
  `identity.set()` (AC1).
- **System Prompt:** a single `<textarea aria-label="System Prompt">`
  bound to `SystemPromptConfig.systemPrompt`, its own Save button calling
  `systemPrompt.set()` (AC3).

Chose three independent sections with their own local state + Save +
"Saved" indicator (rather than one page-wide Save) to match the pattern
already established by the Provider section in feature 010, and because
provider/identity/system-prompt are three genuinely separate JSON files —
one combined save button would misleadingly imply they're one unit.

All three sections now load together in one `Promise.all` on mount
(previously just `settings.get()`) so the page still has a single
`loaded` gate, matching the existing convention (e.g. `ComposeWindow`'s
`loaded` state).

**AC4 (system prompt "stored in a form ready for later LLM prompt
assembly"):** already true — `SystemPromptConfig.systemPrompt` is a plain
string (feature 002), which is the simplest and most directly usable
format for concatenating into a prompt. No transformation/structuring
logic exists or is needed until an LLM client (feature 014/015) actually
assembles a prompt from it; inventing a richer structure now would be
guessing at what that future code needs.

**Compile-only touch-up:** `SettingsView.test.tsx`'s existing Provider
-section tests queried `getByRole('button', { name: 'Save' })` /
`queryByText('Saved')` at the page level, which is now ambiguous across
three sections; scoped them to `within(screen.getByRole('region', { name:
'LLM Provider' }))`. No new test coverage for the two new sections yet —
that's `/test`'s job.

**Files touched:** `src/renderer/src/components/SettingsView.tsx`,
`src/renderer/src/components/SettingsView.test.tsx` (compile fix only),
`src/renderer/src/styles/global.css`. No changes to `data-types.ts`,
`config.ts`, `ipc.ts`, preload, or `ComposeWindow.tsx` — all already
correct from features 002/004.

## Test Notes

Added 7 new tests in `SettingsView.test.tsx` (96 → 103 total, all
passing), plus typecheck/lint/build all clean.

- **Trainee Identity (4 tests):**
  - Display Name / Job Title / From Email prefill from `identity.get()`
    (AC1).
  - Editing all three and clicking Save calls `identity.set()` with the
    edited values (AC1).
  - The section's "Saved" indicator appears independently — saving
    Identity does *not* show "Saved" in the Provider or System Prompt
    sections, proving the three sections' save state doesn't leak into
    each other.
  - The From Email input is `type="email"` (basic input-type sanity
    check, not itself an AC).
- **System Prompt (3 tests):**
  - The textarea prefills from `systemPrompt.get()` (AC3).
  - Typing and clicking Save calls `systemPrompt.set({ systemPrompt })`
    with the edited text (AC3).
  - Its own "Saved" indicator is independent of the other two sections,
    same pattern as Identity.
- Hit and fixed one real ambiguity while writing these: the System Prompt
  `<section aria-label="System Prompt">` and its `<textarea aria-label=
  "System Prompt">` share the exact same accessible name, so
  `screen.findByLabelText('System Prompt')` matched both and threw.
  Queries for that section now go through `within(await screen.findByRole
  ('region', { name: 'System Prompt' }))` then `getByRole('textbox')`
  instead — a test-only fix, not a markup change, since the collision
  only mattered for `getByLabelText`'s broader (non-form-only) matching,
  not for real assistive-tech behavior (a screen reader can still
  distinguish "System Prompt region" from "System Prompt textbox" by
  role).

**AC2 ("outgoing mock mail uses the configured From email/display
name"):** not re-tested here — it's already covered by
`ComposeWindow.test.tsx`'s pre-existing "enables Send once a recipient is
chosen, and sends into the Sent folder" test (from feature 004), which
asserts `messages.create` is called with `fromName: IDENTITY.displayName,
fromEmail: IDENTITY.fromEmail`. That test predates this feature — it's
been proving this AC true since `ComposeWindow` was built, this feature
just finally gives the trainee a way to edit that identity.

**Deliberately not covered:**
- JSON persistence across restarts (AC1's and AC3's "persists" halves)
  — already covered by `config.test.ts`'s pre-existing
  `round-trips trainee identity` / `persists all four stores across a
  close/reopen cycle` tests (identity) and the settings round-trip tests
  (which exercise the same `readJsonFile`/`writeJsonFile` path
  `system-prompt.json` uses) — `ConfigStore` is unchanged by this
  feature, confirmed via `git diff`.
- No network-call assertion re-added for identity/system-prompt saves —
  same `ConfigStore` JSON-write path already covered by
  `no-network.test.ts`, and this feature adds no new I/O code.
- AC4's "ready for later LLM prompt assembly" — there's no prompt
  -assembly code to test against yet (feature 014/015); what's testable
  today (the string persists and round-trips) is covered above and in
  `config.test.ts`.

## Validation Notes

**Automated checks — all pass:**
- `npm run lint` — clean, no output.
- `npm run typecheck` — clean, no output.
- `npm run build` — clean (main/preload/renderer all built successfully).
- `npm test` — **103/103 passing** (full suite, not just this feature's
  new tests).
- No leftover `console.*`/`TODO`/`FIXME` in `SettingsView.tsx`.

**Extra mechanical checks:**
- `git diff --stat HEAD -- src/main/data/config.ts src/shared/data-types.ts
  src/main/data/ipc.ts src/preload/index.ts src/preload/index.d.ts
  src/renderer/src/ComposeWindow.tsx` — empty. Confirms the Implementation
  Notes' central claim (this is UI-only, backend/preload/compose
  untouched) rather than just trusting the prose.
- Read the real, already-existing `~/.config/outlook-sim/config/identity.json`
  and `system-prompt.json` (untouched, read-only) — both match the
  `TraineeIdentity`/`SystemPromptConfig` shapes exactly, so there's no
  compatibility gap against the user's actual files.
- Read `ComposeWindow.tsx:79-91` directly to confirm the AC2 claim in the
  Implementation Notes: `persist()` calls `identity.get()` and sets
  `fromName`/`fromEmail` from `identity.displayName`/`fromEmail` on every
  outgoing message, unconditionally.

**Acceptance criteria:**

1. **"User can set and persist display name, job title, and From email"**
   — PASS. `SettingsView`'s Trainee Identity section binds three inputs
   to `TraineeIdentity` and calls `identity.set()` on Save; verified by
   tests covering prefill and edit-then-save with the exact expected
   object. Cross-server-restart persistence rides on the unmodified,
   already-tested `ConfigStore`.

2. **"Outgoing mock mail uses the configured From email/display name"**
   — PASS, and pre-existing: `ComposeWindow.persist()` has called
   `identity.get()` and used it for `fromName`/`fromEmail` since feature
   004, confirmed by direct code read above and by
   `ComposeWindow.test.tsx`'s existing send test. This feature's
   contribution is making that identity editable in the first place —
   there was no prior UI gap in the *mail-sending* logic, only in
   configuring the identity it reads.

3. **"User can edit a single free-text system prompt and it persists
   across restarts"** — PASS. The System Prompt section's textarea binds
   to `SystemPromptConfig.systemPrompt` and calls `systemPrompt.set()` on
   Save; verified by prefill and edit-then-save tests. Persistence is the
   same unmodified `ConfigStore` JSON path already covered by
   `config.test.ts`.

4. **"The system prompt is stored in a form ready for later LLM prompt
   assembly"** — PASS by design: a plain string is the most directly
   usable form for concatenating into a prompt, and no richer structure
   is specified anywhere in the spec or the other Settings features.
   Nothing here blocks feature 014/015 from reading `systemPrompt` and
   using it; there's no "assembly" step to verify yet since no LLM client
   exists.

**Live Electron GUI verification:** not re-attempted — same sandbox
limitation (no Xvfb, no passwordless sudo) documented in detail during
feature 005's `/validate` and reconfirmed non-blocking in feature 010's.
Nothing about the environment has changed. Given this feature only adds
two more form sections following an already-validated pattern (feature
010's Provider section), and is covered by integration-level tests that
exercise the real rendered DOM, this is judged low-risk and deferred to
the user's own check at `/accept`.

## Acceptance Log

Presented the feature summary (behavior per AC, the "already-true AC2"
note, validation results including the 103/103 test run and the
real-JSON-file compatibility check, and the live-GUI-verification gap)
via `AskUserQuestion` with three options: Accept / Request changes /
Reject. The user selected **Accept**.

**Decision: accepted.**
