---
id: 034
title: Move Settings into the File menu
status: accept
priority: low
---

## Description
Settings is no longer a left-nav-rail button; it's opened via a new File
menu/tab instead, matching classic Outlook's File > Options-style pattern.

## Acceptance Criteria
- [ ] Nav rail no longer has a "Settings" button
- [ ] Ribbon has a File menu/tab that includes a "Settings" entry
- [ ] Clicking it opens the same Settings view as before (all existing
      sections/behavior unchanged)
- [ ] Settings' existing close (✕) affordance (from B001) still works to
      return to Mail/Calendar

## Implementation Notes
`RibbonBar.tsx`: File is no longer part of the uniform `TABS.map()` render
(that array is now just `['Home', 'FileVine', 'View']`) — it's rendered
explicitly first, as its own clickable button that toggles a `fileMenuOpen`
local state instead of switching the active tab. When open, a `role="menu"`
dropdown (`.file-menu`, wrapped in a `.ribbon-tab-file` positioning
container) shows one `role="menuitem"` entry, Settings, which calls the new
required `onOpenSettings` prop and closes the menu. Click-outside/Escape-
to-close mirrors `MessageContextMenu`'s existing pattern exactly (same
`mousedown`/`keydown` listener shape), rather than inventing a new one.
This also establishes the File-menu dropdown shell that feature 035 (File
menu — About section) will add a second entry to.

`App.tsx`: nav rail's `<button className="settings-nav-button">` removed;
`RibbonBar` now gets `onOpenSettings={() => setShowSettings(true)}` —
same state setter as before, just triggered from the new location. AC4
(existing ✕ close affordance) is untouched: `SettingsView`'s `onClose`
wiring in `App.tsx` wasn't touched by this change.

`global.css`: added `.ribbon-tab-file`/`.file-menu`/`.file-menu
button[role='menuitem']` (copied from `.message-context-menu`'s existing
button styling, since it's the same visual pattern — a bordered dropdown
list). Removed the now-dead `.settings-nav-button`/`.settings-nav-
button:hover` rules.

Tradeoff: `onOpenSettings` was added as a required prop (matching
`onSelectHomeTab`/`onSelectFileVineTab`/`onSelectViewTab`'s existing
required-prop convention for tab-triggered navigation), not optional —
`App.tsx` always provides it, there's no scenario where Settings
shouldn't be reachable.

Known, expected test breakage (this repo's established convention: `/test`
fixes these for real, `/implement` doesn't pre-empt it): `RibbonBar.tsx`
now requires `onOpenSettings`, so every `RibbonBar` render in
`RibbonBar.test.tsx` is missing a required prop, and the "File tab is
disabled" assertion is now wrong (File is enabled and clickable). In
`App.test.tsx`, every test that did `getByRole('button', { name: 'Settings'
})` fails because that button no longer exists in the nav rail — it now
requires opening the File menu first.

## Test Notes
649 → 656 net (+7, all passing; full suite re-run 2x, stable), across two
files:

- `RibbonBar.test.tsx`: existing "renders ribbon tabs" test (genuinely
  failing after `/implement`, since it asserted File was disabled)
  rewritten to assert File is enabled. New `describe('File menu (034)')`
  block (6 tests, AC2/AC3): menu isn't in the document until File is
  clicked; clicking File opens a `role="menu"` with a `role="menuitem"`
  Settings entry and flips `aria-expanded`; clicking Settings calls
  `onOpenSettings` and closes the menu; clicking File again toggles it
  closed; clicking outside closes it; Escape closes it (the last two
  cover the click-outside/Escape behavior copied from
  `MessageContextMenu`, not spelled out in the AC but load-bearing enough
  to regress silently otherwise). `tabProps()` test helper extended with
  `onOpenSettings: vi.fn()`.
- `App.test.tsx`: every test that opened Settings via
  `getByRole('button', { name: 'Settings' })` (also genuinely failing —
  that button no longer exists in the nav rail) now goes through a new
  `openSettings(user)` helper that clicks File then the Settings
  menuitem, matching the new UI path (AC2/AC3 end-to-end: File > Settings
  opens the same `SettingsView`). New test `034 AC1: the nav rail has no
  Settings button` added directly for that criterion. The renamed test
  "opens Settings from the File menu..." (was "...from the nav rail...")
  keeps covering AC3 (same SettingsView, all sections/behavior unchanged)
  and, via its return-to-Mail step, AC4 indirectly (Settings only closes
  through the ✕/tab navigation already covered elsewhere — see below).

AC4 (existing ✕ close affordance still works) is deliberately not
re-tested here: `SettingsView.test.tsx` already covers the ✕ button
calling `onClose` at the component level, and `App.tsx`'s wiring of that
prop wasn't touched by this feature (confirmed by diff) — writing a new
end-to-end test for a path this change provably didn't touch would just
be reprinting existing coverage.

## Validation Notes
- `npm run lint` — clean, no errors/warnings.
- `npm run typecheck` — clean.
- `npm run build` — succeeds (main/preload/renderer all bundle).
- `npx vitest run` (full suite) — 656/656 passing, re-run 3x, stable.

Acceptance criteria, checked against current source:
- **AC1 (nav rail no longer has a "Settings" button)** —
  `App.tsx`'s `.app-nav-rail` (lines 275-287) now renders only
  `FolderPane`/`CalendarFolderPane` and `NavSwitcher`; the
  `settings-nav-button` element is gone, and `grep` confirms no
  `settings-nav-button` reference remains anywhere in `src/`. Covered by
  the new `034 AC1: the nav rail has no Settings button` test. Pass.
- **AC2 (ribbon has a File menu/tab that includes a "Settings" entry)** —
  `RibbonBar.tsx`'s File button (lines 97-121) opens a `role="menu"`
  dropdown containing a `role="menuitem"` "Settings" button. Covered by
  `File menu (034)` tests: menu hidden until clicked, opens with the
  Settings entry present, `aria-expanded` toggles correctly. Pass.
- **AC3 (clicking it opens the same Settings view as before, all
  sections/behavior unchanged)** — the Settings entry's `onClick` calls
  `onOpenSettings`, which `App.tsx` wires to the exact same
  `setShowSettings(true)` state setter the old nav-rail button used; the
  `<SettingsView>` render branch and its props (`onClose`,
  `onFreePlayStarted`, `onScenarioPackLoaded`) are byte-for-byte
  unchanged from before this feature (confirmed via diff — only the
  trigger's location moved, never `SettingsView`'s own props or
  behavior). Covered end-to-end by the renamed "opens Settings from the
  File menu..." test (same assertions as before: Provider field
  present, mail panes hidden) plus the free-play and Tasks-panel-hiding
  tests, which now reach Settings the new way and still pass. Pass.
- **AC4 (existing ✕ close affordance still works)** — `SettingsView.tsx`
  line 170's `.settings-view-close` button and its `onClose` wiring are
  untouched by this feature's diff; `App.tsx` still passes
  `onClose={() => setShowSettings(false)}` unchanged.
  `SettingsView.test.tsx` already covers the ✕ button at the component
  level (pre-existing, not modified here), and the App-level tests that
  return to Mail after opening Settings (via the module tab, not ✕, but
  exercising the same `setShowSettings(false)` path) all still pass.
  Pass — not re-tested end-to-end via ✕ specifically since neither the
  affordance nor its wiring changed (see Test Notes for the reasoning).

All 4 acceptance criteria pass. No regressions found elsewhere (full
suite green; every other App/RibbonBar test — FileVine, Tasks panel,
reminders, calendar, etc. — still passes unmodified aside from the
Settings-access path).

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
