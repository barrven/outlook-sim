---
id: 022
title: Scenario pack save
status: testing
priority: medium
---

## Description
Trainee can save the current mailbox/calendar/persona state out to a JSON
scenario pack file for reuse or sharing.

## Acceptance Criteria
- [ ] User can trigger "save scenario pack" and choose a destination
      filename
- [ ] Saved pack includes current inbox contents, personas/contacts, and
      calendar deadlines in the same schema 021 can load
- [ ] A saved-then-reloaded pack round-trips without data loss
- [ ] Save action does not include any API keys or other Settings secrets
      in the pack file

## Implementation Notes
New `buildScenarioPack(db, config, clock, name, description?)` in `main/data/scenarioPack.ts` — the
inverse of 021's `applyScenarioPack` — snapshots `db.listMessages('inbox')`, `db.listCalendarItems()`,
and `config.getPersonas()` into the same `ScenarioPack` shape 021 loads, converting each item's absolute
timestamp back to `offsetMinutes` relative to `clock.now()`. Also snapshots any currently-pending
`config.getScheduledScenarioMessages()` into `timedMessages`, so re-saving mid-session after loading a
pack with timed messages doesn't silently drop them (a real data-loss case AC3 would otherwise miss).
Deliberately never reads `config.getSettings()`, so API keys/other secrets can't end up in the file (AC4)
— this is structural (the function has no path to that data), not a filter.

New `scenario:savePack` IPC handler in `main/index.ts` (mirrors `scenario:pickPack`'s placement — needs
`dialog`/`mainWindow`, so it lives here rather than in `data/ipc.ts`): opens a native save dialog
defaulting to `scenario-pack.json`, derives the pack's `name` from the chosen filename (no separate
name/description prompt — AC1 only asks for a destination filename), and writes the built pack as
pretty-printed JSON. New `SaveScenarioPackResult` type in `shared/data-types.ts` mirrors
`PickScenarioPackResult`'s canceled/error shape. Exposed as `window.api.scenario.savePack()`.

New "Save Scenario Pack…" button added to the existing Settings "Scenario Pack" section, alongside Load;
reuses the section rather than adding a new one since it's the same feature area. Verified the full
build→validate→apply round trip standalone (inbox message, calendar deadline, persona, and a pending
timed message all survived byte-for-byte through save→reload) before wiring in the UI. lint/typecheck/
build pass, existing suite still 347/347; phase set to `test`.

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
