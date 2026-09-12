---
id: 022
title: Scenario pack save
status: done
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
Added 14 tests (347 → 361, all passing; re-ran full suite 3x, stable). New `describe('buildScenarioPack', ...)`
block in `scenarioPack.test.ts` covers: name/description passthrough (and description defaulting to `''`);
personas included with the internal `id` dropped (AC2); only `inbox`-folder messages are included (a `sent`
message is excluded), with `offsetMinutes` computed correctly relative to `clock.now()` (AC2); calendar
items' `offsetMinutes`/`durationMinutes` computed from `startTime`/`endTime`, including the `endTime: null`
→ `durationMinutes: null` case (AC2); pending `getScheduledScenarioMessages()` entries are included as
`timedMessages` (AC3 — otherwise a re-save mid-session would silently drop them); an empty mailbox/
calendar/personas/schedule produces an empty pack; and, directly targeting AC4, a test that configures a
real-shaped API key and asserts it appears nowhere in the built pack's JSON. A dedicated round-trip test
builds a pack from populated `db`/`config`, serializes it through `JSON.parse(JSON.stringify(...))` (as a
real save-to-disk-then-load-from-disk would), runs it through `validateScenarioPack` then `applyScenarioPack`
into a *second* fresh store, and asserts the message/calendar item/persona/pending timed message all come
back with identical content and identical absolute timestamps (AC3). `SettingsView.test.tsx` gained a
"Save Scenario Pack" block (4 tests) covering the success/canceled/error/error-then-success-clears-alert
paths, mirroring the existing "Scenario Pack" (load) tests (AC1). The `scenario:savePack` IPC handler
itself (in `main/index.ts`, needs a real `dialog`/`BrowserWindow`) has no unit test — same untestable-
Electron-wiring category as `scenario:pickPack` and `window:openCompose`, already flagged in prior features.
lint/typecheck/build all still pass; phase set to `validate`.

## Validation Notes
lint/typecheck/build all pass. Full test suite (361/361) re-run 3x, stable. Confirmed via `git diff`
(`8b8cc74~1..8b8cc74`) that `/test` touched only test files/docs (`scenarioPack.test.ts`,
`SettingsView.test.tsx`, `STATE.md`, the feature file, `BACKLOG.md`) — no implementation drift.

Acceptance criteria:
- **User can trigger "save scenario pack" and choose a destination filename** — PASS. Verified by
  reading `main/index.ts:68-85`: `scenario:savePack` opens a real `dialog.showSaveDialog` (defaulting to
  `scenario-pack.json`, filtered to `.json`) and writes to whatever path the user picks; canceling the
  dialog returns `{ok:false,canceled:true}` with no write. `SettingsView.tsx`'s "Save Scenario Pack…"
  button wires this end-to-end, confirmed by the 4 `SettingsView.test.tsx` cases (success path shows the
  chosen path, cancel is silent, write error surfaces inline, a later success clears a prior error).
- **Saved pack includes current inbox contents, personas/contacts, and calendar deadlines in the same
  schema 021 can load** — PASS. Verified both by code inspection (`buildScenarioPack` in
  `scenarioPack.ts:190-239` maps `db.listMessages('inbox')`, `db.listCalendarItems()`, and
  `config.getPersonas()` into exactly the `ScenarioPackMessage`/`ScenarioPackCalendarItem`/
  `ScenarioPackPersona` shapes 021's `validateScenarioPack`/`applyScenarioPack` already consume) and by a
  live check: bundled `scenarioPack.ts`/`db.ts`/`config.ts`/`clock.ts` standalone with `tsx` and ran
  `buildScenarioPack` against a scratch copy of the real, in-use `~/.config/outlook-sim` data (8 inbox
  messages, 4 calendar items — a mix of events/deadlines, 15 personas) — the built pack's counts matched
  the real store exactly for all three categories, and the whole thing passed `validateScenarioPack`
  unmodified.
- **A saved-then-reloaded pack round-trips without data loss** — PASS. The same live check wrote the
  built pack to an actual JSON file, read it back, validated it, and applied it into a second fresh
  store: all 8 inbox messages, 4 calendar items, and 15 personas came back with matching
  subject/body/fromEmail, title/itemType, and displayName/email respectively. A pending
  `timedMessages`/scheduled-scenario-message case (none present in the real data right now, so 0/0) is
  separately covered by the automated round-trip test in `scenarioPack.test.ts` using a populated
  fixture — confirms 022 doesn't silently drop pending timed messages on a mid-session re-save, which
  the plain "current mailbox/calendar" reading of the AC could otherwise miss.
- **Save action does not include any API keys or other Settings secrets in the pack file** — PASS. This
  holds structurally: `buildScenarioPack`'s only parameters are `db`/`config`/`clock`, and it never calls
  `config.getSettings()` — there's no code path by which a key could reach the pack, not just a filter
  that could be forgotten elsewhere. Confirmed live: ran the check against the real settings.json (which
  has genuine live Anthropic and Gemini API keys configured) and grepped the built pack's JSON for both
  real key strings — neither appeared. Also confirmed via `md5sum` that the real on-disk
  `outlook-sim.db` was byte-for-byte unchanged after the whole check (all work happened against a
  scratch copy).

No live multi-window Electron GUI click-through attempted (no Xvfb in this sandbox) — same non-blocking
gap noted for every prior feature; the IPC handler's own dialog-driven wiring is covered by code
inspection plus the live standalone check above rather than a unit test, consistent with
`scenario:pickPack`/`window:openCompose`. No issues found; phase set to `accept`.

## Acceptance Log
2026-09-12 — user reviewed the summary (feature description, all 4 ACs mapped to PASS, validation
results including the live check against real on-disk data) and selected "Accept" via the accept-stage
question. Decision: **accepted**. Logged to `docs/CHANGELOG.md`; status set to `done`.
