---
id: 035
title: File menu — About section
status: accept
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
656 → 661 net (+5, all passing; full suite re-run 2x, stable):

- `src/renderer/src/test/mockApi.ts`: added the missing `app.getVersion`
  mock (genuinely failing typecheck after `/implement`), resolving to a
  fixed `'0.1.0'` so version-display assertions are deterministic.
- `RibbonBar.test.tsx`, new `describe('About entry (035)')` (5 tests):
  About is present but collapsed until clicked (AC1); clicking it calls
  `window.api.app.getVersion()` and displays "Version 0.1.0" (AC2 — proves
  it's sourced from the API, not a literal string in the component);
  the GitHub URL renders as a `role="link"` with `href` exactly
  `https://github.com/barrven/outlook-sim/` and `target="_blank"` (AC3,
  and the `target="_blank"` half of AC4 — see below for what isn't
  covered); clicking About again collapses it; closing the File menu
  (Escape) and reopening it leaves About collapsed again (the "don't
  leak state across menu opens" behavior from Implementation Notes, not
  itself an AC but worth pinning since it's easy to silently regress).

AC4's "opens in the OS's default browser, not inside the Electron window"
is only partially covered here, deliberately: RTL/jsdom can assert the
link has `target="_blank"` (done above), but jsdom doesn't run Electron's
`webContents.setWindowOpenHandler` — that's what actually redirects the
navigation to `shell.openExternal` instead of opening a real popup, and
it lives in `windows.ts`, completely untouched by this feature (confirmed
by diff) and already exercised by every other external-link case in this
app (compose/popout windows). Re-testing Electron's own window-open
routing here would just be re-proving pre-existing, unrelated behavior;
the meaningful, feature-specific unit is "does this link have the shape
that triggers it," which is what's tested.

## Validation Notes
- `npm run lint` — clean, no errors/warnings.
- `npm run typecheck` — clean.
- `npm run build` — succeeds (main/preload/renderer all bundle).
- `npx vitest run` (full suite) — 661/661 passing, re-run 3x, stable.

Acceptance criteria, checked against current source:
- **AC1 (File menu has an "About" entry)** — `RibbonBar.tsx`'s File
  dropdown renders a `role="menuitem"` "About" button below a divider,
  after Settings. Covered by the `About entry (035)` test block. Pass.
- **AC2 (selecting it shows the app's current version, sourced from
  package.json rather than hardcoded)** — clicking About calls
  `window.api.app.getVersion()` (`RibbonBar.tsx` line 65), which invokes
  the `app:getVersion` IPC channel (`main/index.ts` line 52) returning
  Electron's own `app.getVersion()` — that reads the `version` field
  straight out of this project's `package.json` (currently `0.1.0`),
  not a string duplicated anywhere in the renderer. Covered by the test
  asserting `window.api.app.getVersion` was called and "Version 0.1.0"
  renders. Pass.
- **AC3 (shows/links the GitHub repo URL exactly as
  https://github.com/barrven/outlook-sim/)** — the About panel's `<a>`
  has both `href` and visible text set to that exact string (`RibbonBar.tsx`
  lines 145-146), byte-for-byte. Covered directly by test. Pass.
- **AC4 (clicking the link opens it in the OS's default browser, not
  inside the Electron window)** — the link carries `target="_blank"`;
  the main window (`windows.ts`'s `createMainWindow`, unmodified by this
  feature) already installs `setWindowOpenHandler` that denies every
  window-open request and routes it through `shell.openExternal` instead
  — pre-existing behavior this feature relies on rather than duplicates.
  `target="_blank"` is verified by test; the actual OS-handoff isn't
  (and can't be) exercised under jsdom — see Test Notes for why that gap
  is acceptable (Electron's window-open routing is untouched, existing,
  and already exercised elsewhere in the app for compose/popout windows).
  Pass by inspection + partial test coverage.

All 4 acceptance criteria pass. No regressions found elsewhere (full
suite green; every other RibbonBar/App test still passes unmodified
aside from the new mock and About-specific additions).

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
