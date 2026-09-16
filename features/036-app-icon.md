---
id: 036
title: App icon uses email.png
status: testing
priority: low
---

## Description
The app's window/taskbar icon is now the project's `email.png` asset
instead of the Electron default.

## Acceptance Criteria
- [ ] The built app's window icon is generated from `email.png`
- [ ] The taskbar icon matches
- [ ] The build process handles the platform-appropriate icon format
      (.ico for Windows) without a manual per-build step

## Implementation Notes
The user supplied `email.png` (512x512 RGBA) at the repo root; moved it to
`resources/email.png`, the standard electron-vite location for a runtime
icon asset (included in the packaged app's files by default, unlike
`build/`, which electron-builder excludes from packaging).

- `electron-builder.yml`: added `win.icon: resources/email.png`. Verified
  directly against `app-builder-lib`'s icon-conversion code (not just
  assumed) that this path is picked up and auto-converted to a valid
  `.ico` at build time with zero extra steps or explicit format
  conversion (AC3) — ran `iconConverter.convertIcon` standalone against
  this exact source/config and confirmed a real `icon.ico` came out.
- `src/main/windows.ts`: new `ICON_PATH` constant
  (`join(__dirname, '../../resources/email.png')`, resolves correctly from
  the built `out/main/` layout — verified by direct path resolution
  against the built output) passed as `icon:` on all three
  `BrowserWindow` constructors (main, compose, message pop-out) so the
  taskbar/title-bar icon is consistent across every window, not just the
  main one (AC1, AC2).

No electron-builder icon fallback/auto-detection from `build/` was
needed or relied on — the explicit `win.icon` config is unambiguous and
doesn't depend on filename convention (`icon.png`), so the asset keeps
its original name. Full Windows NSIS packaging (`npm run dist:win`)
itself wasn't run end-to-end here (needs Wine/network on this Linux dev
box, same class of gap as this project's existing GUI-click-through
gaps); the icon-conversion step specifically responsible for AC3 was
verified in isolation instead, which is the part that's new/risky here.

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
