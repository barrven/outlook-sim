---
id: 035
title: File menu — About section
status: testing
priority: low
---

## Description
The File menu gains an About entry showing the app's current version number
and a link to its GitHub repo (https://github.com/barrven/outlook-sim/).

## Acceptance Criteria
- [ ] File menu has an "About" entry
- [ ] Selecting it shows the app's current version, sourced from
      `package.json` rather than hardcoded separately
- [ ] It shows/links the GitHub repo URL exactly as
      https://github.com/barrven/outlook-sim/
- [ ] Clicking the link opens it in the OS's default browser, not inside
      the Electron window

## Implementation Notes
`RibbonBar.tsx`'s File menu (established by feature 034) gets a second
entry, About, below a divider (mirroring `MessageContextMenu`'s
`.message-context-menu-divider` convention). Rather than a new modal/
full-view (there's no modal precedent in this codebase, and About's
content is two lines — a version and a link), it reuses
`MessageContextMenu`'s existing "click a menu item to expand an inline
submenu without closing the parent menu" pattern (same shape as its "Add
to category"/"Move to folder" toggles): clicking About toggles a local
`aboutOpen` state and reveals a `.file-menu-about` panel in place, showing
`Version {appVersion}` and the GitHub link. `closeFileMenu()` (used by
every path that closes the File menu — outside-click, Escape, re-clicking
File, and clicking Settings) resets `aboutOpen` too, so About never stays
expanded into the next time the menu opens.

Version sourcing (AC2): a new `app:getVersion` IPC channel in
`main/index.ts` calls Electron's built-in `app.getVersion()`, which reads
the `version` field from `package.json` itself — not a separately
hardcoded string. Wired through `preload/index.ts`
(`window.api.app.getVersion()`) and `preload/index.d.ts` (new `AppApi`
interface), following the same thin-wrapper pattern every other IPC call
in this file uses. `RibbonBar` fetches it once on mount into local state.

GitHub link (AC3/AC4): a plain `<a href="https://github.com/barrven/
outlook-sim/" target="_blank" rel="noreferrer">` showing that exact URL as
its text. No new main-process plumbing was needed for AC4 (opens in the
OS default browser, not inside Electron) — `windows.ts`'s
`createMainWindow` already installs a `setWindowOpenHandler` that denies
every popup and routes it through `shell.openExternal`, so `target=
"_blank"` alone is sufficient; this is existing, pre-034 behavior, not
new.

Known, expected test breakage (this repo's established convention —
`/test` fixes for real): `src/renderer/src/test/mockApi.ts` doesn't yet
implement the new required `AppApi`, so `createMockApi()`'s return type
no longer satisfies `Window['api']`.

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
