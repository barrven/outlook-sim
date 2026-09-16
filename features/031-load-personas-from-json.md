---
id: 031
title: Settings — load personas from a JSON file
status: accept
priority: medium
---

## Description
Settings' Personas section gains a "Load Personas…" button that imports a
persona list from a standalone JSON file (its own schema, distinct from a
full scenario pack), replacing the current persona list.

## Acceptance Criteria
- [ ] "Load Personas…" button opens a native file picker
- [ ] Selecting a valid personas JSON file replaces the current persona
      list with its contents
- [ ] Selecting an invalid/corrupted file shows a specific, readable error
      instead of crashing or silently doing nothing
- [ ] Loading personas this way does not touch mailbox, calendar, or system
      prompt — scope stays personas-only, unlike a full scenario pack load
- [ ] Imported personas persist across restarts like manually-entered ones

## Implementation Notes

**File format.** A bare top-level JSON array of persona entries (not
wrapped in `{ name, description, personas: [...], ... }` like a scenario
pack) — new `PersonasFilePersona` type (`shared/data-types.ts`):
`displayName`/`email` required, `role`/`bio`/`writingStyleNotes`/
`extraPrompt` optional (default `''`), and — unlike `ScenarioPackPersona`,
which deliberately omits them as trainer-side data — `isClient`/
`reportsTo` are also importable here (optional, default `false`/`''`),
since this feature is specifically about managing the persona cast, not
scenario data.

**Validation** (`main/data/personasFile.ts`, new). Mirrors
`scenarioPack.ts`'s validation conventions (never throws; a malformed
file comes back as a specific `path.field must be a T` error) but is
deliberately self-contained rather than sharing its private helpers —
duplicates the small object/string/boolean primitives it needs (~15
lines) instead of extracting a shared module, to avoid touching
`scenarioPack.ts`'s already-tested code for this feature. Flagging that
as a candidate for a future cleanup pass if a third JSON-file format shows
up and the duplication grows.

**Wiring.** New `personasFile:pick` IPC handler (`main/index.ts`,
alongside `scenario:pickPack`/`savePack` — same file, since that's where
`dialog`/`mainWindow` already live): opens a native file picker
(AC1), reads + `JSON.parse`s the chosen file, and returns
`validatePersonasFile`'s result — same canceled/error/ok shape as
`PickScenarioPackResult`. New `window.api.personasFile.pick()` (preload +
`PersonasFileApi`). `PersonasSettings.tsx`'s new `handleLoadPersonas`
converts each validated entry to a full `Persona` (generating an id via
the same `generatePersonaId()` the manual create form already uses) and
calls the *existing* `personas.set` IPC — the same call the manual
create/edit/delete paths already use, so persistence-across-restarts
(AC5) needed no new code, and scope staying personas-only (AC4) is
structural: `validatePersonasFile` takes only raw JSON and returns parsed
personas — it has no `db`/`config`/`clock` reference to touch mailbox,
calendar, or system prompt even by accident. A successful load also
closes any open create/edit form (same "don't leave a form open pointing
at stale data" precedent as feature 030's scenario-pack-reload handling)
and replaces the list entirely, not merging with the existing one.

**Verified live before finishing:** a standalone `esbuild`-bundled
`personasFile.ts` script drove `validatePersonasFile` directly: a valid
file with a mix of default and explicit `isClient`/`reportsTo` values
parsed correctly (AC2); five different malformed shapes (non-array root,
`null`, missing `displayName`, missing `email`, wrong-typed `isClient`)
each produced a specific, readable error rather than throwing (AC3); and
confirmed by inspection that the function's only parameter is the raw
JSON data — no way to reach mailbox/calendar/system prompt (AC4,
structural). A throwaway RTL smoke test (written, run, deleted — not
part of this diff) drove the full UI: a valid file replaces the list, an
invalid file shows the specific error without crashing (and the app stays
usable afterward), canceling the dialog is a no-op, and loading a file
replaces an existing list rather than merging with it.

Files touched: `src/shared/data-types.ts`, `src/main/index.ts`,
`src/preload/index.ts`, `src/preload/index.d.ts`,
`src/renderer/src/test/mockApi.ts`,
`src/renderer/src/components/PersonasSettings.tsx`; new
`src/main/data/personasFile.ts`. No changes to `ipc.ts`/`registerDataIpcHandlers`
or its exhaustive-channel-list test — `personasFile:pick` lives in
`main/index.ts` alongside `scenario:pickPack`/`savePack`, which are
likewise outside that registration function and its test (same
established split, and same known gap: this dialog-wiring handler isn't
unit-testable without heavily mocking Electron's `dialog` module, same as
those two already-existing handlers).

lint/typecheck/build pass; existing suite unchanged at 515/515 (no
existing test needed updates, and no new tests added here — full
coverage is `/test`'s job next). Phase set to `test`.

## Test Notes
Added 21 tests across 2 files (515 → 536, all passing, re-run 3x stable),
all AC-traceable by number:

- **`personasFile.test.ts`** (+17, new file, real `validatePersonasFile`,
  no mocking) — AC2: a fully-populated file, multiple entries, an empty
  array (valid, empty result), and optional-field defaulting (`role`/
  `bio`/`writingStyleNotes`/`extraPrompt`/`isClient`/`reportsTo` all
  default correctly when omitted). AC3: a parameterized `it.each` covering
  12 malformed shapes — non-array roots (`null`, a string, a number, a
  wrapping object), non-object array entries (`null`, a string, a nested
  array), missing required fields (`displayName`, `email`), and
  wrong-typed optional fields (`role`, `isClient`, `reportsTo`) — each
  asserting the exact clear per-field error and that the function never
  throws; plus a dedicated test confirming a multi-entry file identifies
  *which* entry is invalid by index (`personas[1]...`, not just
  `personas[0]...`).
- **`PersonasSettings.test.tsx`** (+4) — AC1: clicking "Load Personas…"
  invokes `window.api.personasFile.pick()` (the closest testable proxy for
  "opens a native file picker" — the actual dialog lives in
  `main/index.ts` and isn't unit-testable without heavily mocking
  Electron's `dialog` module, same gap already accepted for
  `scenario:pickPack`/`savePack`). AC2/AC5: a valid file replaces the
  current list (not merges — the prior persona is asserted gone) and
  persists via the real `personas.set` call shape (a generated, non-empty
  `id` plus the imported fields). AC3: an invalid file shows the specific
  error text and the app stays fully usable afterward (existing list and
  "+ New Persona" control still present, nothing crashed). Plus canceling
  the dialog is confirmed to be a true no-op (no error, no change, no
  `personas.set` call).

Deliberately not covered by a new test: AC4 (scope stays personas-only —
never touches mailbox/calendar/system prompt) is a structural guarantee,
not a runtime behavior — `validatePersonasFile`'s only parameter is the
raw JSON data (no `db`/`config`/`clock` reference exists to touch
anything else), and `PersonasSettings.tsx`'s load handler only ever calls
the existing `personas.set`. Confirmed correct by code inspection during
`/implement`; there's no meaningful runtime assertion to add beyond what
TypeScript's function signature already enforces. AC5's "persists across
restarts" is exercised at the data layer for the underlying `personas.set`/
`ConfigStore.setPersonas`/`getPersonas` round trip already, by
`config.test.ts`'s existing persona-persistence tests — this feature adds
no new persistence code, so no new restart-cycle test was needed. Real
Electron IPC/contextBridge serialization untested (same non-blocking
sandbox gap noted in every prior feature). Full suite re-run 3x, stable;
lint/typecheck/build all pass.

## Validation Notes
lint/typecheck/build all pass. Full test suite 536/536, re-run 3x, stable.
`git diff 840b737..e51934a` (the `/test` stage's commit) confirms it
touched only test files and docs — no implementation drift.

Acceptance criteria, each checked independently of `/implement`'s and
`/test`'s own checks:

- **AC1** (button opens a native file picker) — **pass** by inspection:
  `PersonasSettings.tsx` has a "Load Personas…" button calling
  `handleLoadPersonas`, which invokes `window.api.personasFile.pick()`;
  `main/index.ts` registers `personasFile:pick` with a real
  `dialog.showOpenDialog(mainWindow, {...})` call, mirroring
  `scenario:pickPack`'s already-established pattern exactly.
- **AC2** (valid file replaces the current list) — **pass**. Independently
  re-verified live below with real, not synthetic, data.
- **AC3** (invalid file: specific error, no crash) — **pass**. Re-verified
  live below by corrupting real persona data.
- **AC4** (personas-only scope) — **pass**, structural: re-confirmed
  `validatePersonasFile`'s source file has no import from `./db`,
  `./config`, or `./clock` at all — there is no reference through which it
  could touch mailbox, calendar, or system prompt, even by accident.
- **AC5** (imported personas persist like manual ones) — **pass**:
  `handleLoadPersonas` calls the same `window.api.data.personas.set(...)`
  the manual create/edit/delete paths already use, which is already
  covered end-to-end by `config.test.ts`'s existing persona
  close/reopen-cycle tests — no new persistence path was introduced for
  this feature to separately break.

Live check (independent of `/implement`'s and `/test`'s own): bundled
`personasFile.ts` standalone with `esbuild` and fed it the real, in-use
`~/.config/outlook-sim/config/personas.json`'s persona array (15 real
personas, from this session's own live config — read-only, never
written to) as a "someone exported their real cast" input. All 15
validated successfully, correctly tolerating extra fields the schema
doesn't know about (`id`) rather than rejecting them, and each re-imports
into a clean `PersonasFilePersona`. Corrupting one real entry
(`displayName` removed) produced the exact expected
`personas[3].displayName must be a string` — pinpointing the corrupted
entry by index within 15 real records, not just "some record is broken."

No live multi-window Electron GUI click-through attempted — same
non-blocking sandbox gap noted in every prior feature (no attached
display). The RTL test coverage plus the live check against real
production persona data are the strongest available substitute.

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
