---
id: 034
title: Move Settings into the File menu
status: testing
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
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
