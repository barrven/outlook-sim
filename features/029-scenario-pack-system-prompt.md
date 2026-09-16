---
id: 029
title: Scenario packs include the system prompt
status: done
priority: medium
---

## Description
Both saving and loading a scenario pack now include the system prompt,
alongside the existing inbox/personas/calendar/timed-messages. Loading a
pack replaces the current system prompt the same way it already replaces
personas/calendar/inbox.

## Acceptance Criteria
- [ ] Save Scenario Pack writes the current system prompt into the pack's
      JSON
- [ ] Load Scenario Pack applies the pack's system prompt, replacing
      whatever was configured before
- [ ] A pack saved before this feature (missing the system-prompt field)
      still loads without error, leaving the current system prompt
      unchanged
- [ ] Round-tripping (save, then load into a fresh store) preserves the
      system prompt exactly

## Implementation Notes

**Data shape.** Added `systemPrompt?: string` to `ScenarioPack`
(`shared/data-types.ts`) — genuinely optional (`undefined`), not defaulted
to `''` like every other pack field. This is the key design decision: a
pre-029 pack's JSON has no `systemPrompt` key at all, and AC3 requires
that case to leave the current system prompt untouched, which is a
different behavior than "replace with empty" (what an explicitly-empty
`systemPrompt: ""` in a pack should do, per AC2 — replacing whatever was
configured before, including replacing it with nothing). Distinguishing
"key absent" from "key present but empty" is exactly what `undefined` vs
`''` gives here; defaulting to `''` the way `optionalString` does for
every other field would have collapsed that distinction and broken AC3.

**Validation** (`validateScenarioPack`). `root.systemPrompt === undefined
? undefined : requireString(...)` — present-but-wrong-typed still fails
validation with a clear error (consistent with every other field); absent
passes through as `undefined`.

**Apply** (`applyScenarioPack`). `if (pack.systemPrompt !== undefined)
config.setSystemPrompt(...)` — only touches the current system prompt when
the pack actually carried one (AC2 + AC3 in one guard).

**Build** (`buildScenarioPack`). Always includes the current
`config.getSystemPrompt().systemPrompt` (AC1) — system prompt lives in its
own `system-prompt.json`, not `Settings`/API keys, so this doesn't
conflict with the function's existing "never reads Settings, so secrets
can't end up in the file" guarantee (still true, unchanged).

No renderer changes: `SettingsView.tsx`'s Save/Load Scenario Pack flow
already just calls `scenario.savePack()`/`scenario.applyPack()` and
doesn't itself inspect pack contents — the system prompt now riding along
is entirely a main-process concern. Live-refreshing the System Prompt
textarea after a pack load is out of scope (a separate, not-yet-built
feature, 030 — no panel refreshes live after a pack load today).

**Verified live before finishing:** a standalone `esbuild`-bundled
`scenarioPack.ts`/`config.ts`/`db.ts`/`clock.ts` script drove all 4 ACs
directly: `buildScenarioPack` picks up a real configured system prompt;
`applyScenarioPack` replaces a different current one with the pack's;
a hand-constructed pre-029-shaped pack object (the `systemPrompt` key
deleted entirely) validates fine and, when applied, leaves the current
system prompt completely untouched; and building a pack then applying it
into a totally fresh `ConfigStore`/`MailDb`/`SimClock` reproduces the
exact same system prompt string.

Files touched: `src/shared/data-types.ts`, `src/main/data/scenarioPack.ts`.
`src/main/data/scenarioPack.test.ts`'s one exact-shape `toEqual` assertion
needed a content touch-up for the new field — no unrelated behavior
changes.

lint/typecheck/build pass; existing suite unchanged at 498/498 (no new
tests added here — full coverage is `/test`'s job next). Phase set to
`test`.

## Test Notes
Added 8 tests, all in `scenarioPack.test.ts` (498 → 506, all passing,
re-run 3x stable), plus 2 existing tests extended in place — all
AC-traceable by number:

- **`validateScenarioPack`** (+4, plus the existing "defaults ... to empty
  arrays when omitted entirely" test extended) — a present `systemPrompt`
  parses through unchanged; an explicitly empty one (`''`) is preserved as
  empty, not conflated with "absent"; a pack with no `systemPrompt` key at
  all parses with it `undefined` (AC3 — the extended "omitted entirely"
  test asserts this directly, not just "no crash"); a non-string
  `systemPrompt` is rejected with the same clear per-field error message
  convention every other field already uses.
- **`applyScenarioPack`** (+3) — AC2: a pack's system prompt replaces the
  current one; a pack with an *explicitly empty* system prompt clears the
  current one (proving AC2's "replacing whatever was configured before"
  applies even when the new value is empty, not just non-empty). AC3: a
  hand-constructed pre-029-shaped pack (parsed via `validateScenarioPack`
  with the `systemPrompt` key deleted from the JSON first) applies without
  throwing and leaves the current system prompt completely untouched.
- **`buildScenarioPack`** (+1 dedicated test, plus the existing
  comprehensive "round-trips through validateScenarioPack and
  applyScenarioPack without data loss" test extended) — AC1: a configured
  system prompt is included in the built pack. AC4: the round-trip test
  now also sets a real system prompt before building, asserts it's on the
  built pack, serializes through actual `JSON.stringify`/`JSON.parse` (as
  a real save/load would), applies into a *completely fresh*
  `MailDb`/`ConfigStore`/`SimClock`, and asserts the system prompt comes
  back byte-for-byte identical alongside the personas/inbox/calendar/
  timed-messages already covered there — proving the whole round trip,
  not just isolated apply/build halves.

Deliberately not covered: real Electron IPC/contextBridge serialization,
and the actual file-system Save/Load dialogs (`scenario:savePack`/
`scenario:pickPack` IPC handlers) — unchanged by this feature, since it's
`applyScenarioPack`/`buildScenarioPack` (the functions those handlers
call) that carry the new behavior, and those are exercised directly here.
No renderer test changes needed — `SettingsView.tsx`'s Save/Load Scenario
Pack UI doesn't inspect pack contents. Full suite re-run 3x, stable;
lint/typecheck/build all pass.

## Validation Notes
lint/typecheck/build all pass. Full test suite 506/506, re-run 3x, stable.
`git diff 5c5b99f..2a13fb7` (the `/test` stage's commit) confirms it
touched only test files and docs — no implementation drift.

Acceptance criteria, each checked independently of `/implement`'s and
`/test`'s own checks, using real data rather than only synthetic
fixtures:

- **AC1** (Save writes the current system prompt into the pack) —
  **pass**. `scenarioPack.test.ts` covers this directly; independently
  re-verified live below.
- **AC2** (Load applies the pack's system prompt, replacing whatever was
  configured before) — **pass**. Confirmed both by the test suite and
  live below.
- **AC3** (a pre-feature pack, missing the field, loads without error and
  leaves the current system prompt unchanged) — **pass**, unusually
  strongly confirmed: found two of the user's own real, previously-saved
  scenario pack files on disk (`~/Downloads/scenario-pack1.json`,
  `scenario-pack2.json`) — genuinely pre-029, with no `systemPrompt` key
  at all (not synthetic fixtures shaped to match the bug). A fresh
  `esbuild`-bundled script validated and applied both real files: each
  parsed with `systemPrompt` correctly `undefined`, and applying either
  left a freshly-set current system prompt completely untouched. Both
  source files confirmed unmodified (md5, read-only access) afterward.
- **AC4** (round-tripping preserves the system prompt exactly) —
  **pass**. Live check below built a pack with a real system prompt,
  serialized it through actual `JSON.stringify`/`parse`, and applied it
  into a completely fresh `MailDb`/`ConfigStore`/`SimClock` — the prompt
  came back byte-for-byte identical.

Live check details: bundled `scenarioPack.ts`/`config.ts`/`db.ts`/
`clock.ts` standalone with `esbuild`; ran the two real legacy pack files
through `validateScenarioPack` → `applyScenarioPack` (AC3), then built a
fresh pack with a real system prompt and confirmed it round-trips through
build → replace-the-current-one → full JSON (de)serialize → apply-into-
a-fresh-store (AC1/AC2/AC4) — all against scratch `MailDb`/`ConfigStore`
instances, nothing written back to the user's real config or downloaded
files.

No live multi-window Electron GUI click-through attempted — same
non-blocking sandbox gap noted in every prior feature (no attached
display). The RTL/unit test coverage plus the live check against the
user's own real, genuinely pre-feature scenario pack files are the
strongest available substitute.

## Acceptance Log
2026-09-15 — Presented the AC table and validation summary (lint/typecheck/
build clean, full suite 506/506 re-run 3x stable, and an unusually strong
AC3 check using two of the user's own real, previously-saved scenario pack
files that genuinely predate this feature) along with the design decision
to make the new field genuinely optional (undefined) rather than defaulted
to empty. User said **Accept**.
