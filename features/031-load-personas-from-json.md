---
id: 031
title: Settings — load personas from a JSON file
status: testing
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
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
