---
id: 061
title: Settings — Appearance color scheme switcher
status: accept
priority: medium
---

## Description
Add an "Appearance" control in Settings letting the user pick between all
available color schemes (feature 058's default, feature 059's two
additional light schemes, and feature 060's dark scheme). The choice
persists like any other setting.

## Acceptance Criteria
- [x] A new "Appearance" control in Settings lists all 4 available color
      schemes and lets the user pick one
- [x] Selecting a scheme applies it immediately across the whole app, no
      restart required
- [x] The selected scheme persists across app restarts, stored the same
      way other settings are (JSON config)
- [x] On launch, the app applies the persisted scheme; a fresh install
      defaults to the revised default scheme from feature 058

## Implementation Notes
New "Appearance" config category, following the exact pattern
`systemPrompt`/`identity` already use end to end:

- `shared/data-types.ts`: `ColorScheme` union (`'default' | 'sage' |
  'plum' | 'dark'`, the same four values as global.css's
  `:root[data-theme='...']` blocks) and `AppearanceConfig { colorScheme
  }`.
- `main/data/config.ts`: `appearance.json`, default `{ colorScheme:
  'default' }` (AC4 — fresh install gets 058's default scheme),
  `getAppearance`/`setAppearance`.
- `main/data/ipc.ts`: `config:appearance:get`/`:set` handlers.
  `:set` also calls a new `broadcastAppearanceChanged`, mirroring the
  existing `broadcastMessagesChanged`/`broadcastCalendarItemsChanged`
  cross-window pattern — every open window (main, Compose, message/
  calendar pop-outs) is its own document with its own `data-theme`
  attribute, so a change made in one has to reach all of them (AC2).
- `preload/index.ts` + `index.d.ts`: exposes `data.appearance.get/set`
  and `onAppearanceChanged`.
- `renderer/src/main.tsx`: on every window's own bootstrap, fetches the
  persisted scheme and sets `document.documentElement.dataset.theme`
  (AC3 — applies on launch), then subscribes to
  `onAppearanceChanged` for live updates from other windows. This one
  file is the shared entry point for all four window types (App/
  Compose/MessagePopout/CalendarPopout — see the query-param branch
  below it), so this covers all of them without touching each
  component.
- `renderer/src/components/SettingsView.tsx`: new "Appearance" section,
  a single `<select>` (like the Provider picker) listing all 4 schemes.
  Unlike every other section here, there's no Save button — `onChange`
  applies the scheme to the current window immediately
  (`document.documentElement.dataset.theme`) *and* persists+broadcasts
  via `appearance.set`, matching AC2's "applies immediately" wording.
- `renderer/src/test/mockApi.ts` + `main/data/ipc.test.ts`: updated the
  shared `Window['api']` mock and the "registers every documented
  channel" list — both are typed/asserted against the full API surface,
  so they don't compile/pass without the new members even though this
  isn't new feature-specific test coverage (deferred to `/test`).

Scenario pack load does NOT refresh Appearance (unlike System Prompt/
Personas) — color scheme is a device-level preference, not scenario
content, same reasoning `settings` (LLM provider) is already excluded
from that refresh.

`index.html`'s static `data-theme="default"` is left as-is — it's only
ever the pre-JS fallback; `main.tsx` overwrites it on every load.

## Test Notes
783 → 793 net (+10, all passing; re-run twice, stable), spread across
three files:

- `main/data/config.test.ts` (+3): AC4 a fresh `ConfigStore` writes
  `appearance.json` and defaults to `{ colorScheme: 'default' }`; AC3
  `setAppearance`/`getAppearance` round-trip, and the value survives a
  close/reopen cycle (real JSON on disk, not just in-memory), same
  pattern as every other config store test in this file.
- `main/data/ipc.test.ts` (+2): AC3 `config:appearance:get`/`:set`
  round-trip through the IPC layer; AC2 `:set` broadcasts
  `config:appearance-changed` with the new scheme to every open window,
  same pattern as the existing messages/calendar-items broadcast tests.
- `components/SettingsView.test.tsx` (+5, new "Appearance (061)" block):
  AC1 the picker lists all 4 schemes with their labels; prefill from
  `appearance.get()`; AC2 selecting a scheme applies
  `document.documentElement.dataset.theme` to the current window
  synchronously with no Save button present; AC3 the selection is sent
  through `appearance.set` (the config API), not just held in local
  state; AC4 confirms `appearance.get()` is called on mount so launch
  reflects whatever was persisted, not always the default.

Deliberately not covered: `main.tsx`'s own bootstrap (applying the
persisted theme and subscribing to the live broadcast on every window's
launch, independent of whether Settings is even open). It has no
existing test of any kind in this codebase — it's a module-level
side-effecting entry script keyed off `window.location.search`, and
there's no established pattern here for testing that shape of file.
The two things it does are already covered independently: persistence
+ the default (config.test.ts), and the broadcast payload (ipc.test.ts).
Also not covered: real cross-window behavior in a live multi-window
Electron process, and visual/pixel rendering of the applied scheme
(consistent with 058/059/060, which only ever check CSS/token source,
not a rendered page).

## Validation Notes
lint/typecheck/build all pass clean. Full suite 793/793, re-run 3x,
stable. `git diff --stat` (9a455ba..HEAD) confirms `/implement`+`/test`
touched only expected files (data-types, config/ipc/preload plumbing,
main.tsx, SettingsView + its test, mockApi.ts, ipc.test.ts, and the
feature/BACKLOG/STATE bookkeeping) — no unrelated component touched.

All 4 ACs re-verified independently (not just re-running the vitest
files):

- **AC1** (lists all 4 schemes): a Node script parsed global.css's
  `:root[data-theme='...']` blocks directly and cross-checked them
  against `ColorScheme`'s union members and `SettingsView`'s
  `COLOR_SCHEMES` picker list — all three are the identical 4-element
  set (`default`/`sage`/`plum`/`dark`), so the picker can't drift from
  what the CSS actually defines.
- **AC2** (applies immediately, no restart): direct source inspection of
  `handleChangeColorScheme` in SettingsView.tsx confirms
  `document.documentElement.dataset.theme` is set synchronously,
  *before* the `await window.api.data.appearance.set(...)` call — so the
  current window updates independent of IPC round-trip latency, backed
  by the AC2 test. The IPC layer's `broadcastAppearanceChanged` call
  (verified by its own ipc.test.ts assertion) carries the change to
  every other open window, the same pattern already used for messages/
  calendar-items.
- **AC3** (persists like other settings): direct source inspection
  confirms `appearancePath = join(configDir, 'appearance.json')` — the
  exact same `configDir` as `settings.json`/`system-prompt.json`/etc,
  not a separate location. config.test.ts's close/reopen-cycle test
  exercises the real `ConfigStore` class against a real temp directory
  (genuine disk I/O, not a mock).
- **AC4** (launch applies persisted scheme, fresh install defaults to
  058's default): source inspection confirms `DEFAULT_APPEARANCE = {
  colorScheme: 'default' }` literally, and `main.tsx` fetches
  `appearance.get()` and applies `dataset.theme` unconditionally on
  every window's own bootstrap — not gated behind Settings being open.

All checks pass, no gaps found. (Noted in Test Notes: main.tsx's own
bootstrap has no direct automated test — verified here by source
inspection instead, since its two behaviors are independently covered
by config.test.ts/ipc.test.ts.)

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
