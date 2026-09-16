---
id: 036
title: App icon uses email.png
status: validating
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
Added 4 tests (661 → 665, all passing; re-run 3x, stable), across 2 new
files:

- `src/main/windows.test.ts` (+3, AC1/AC2): mocks `electron`'s
  `BrowserWindow` as a plain class that records its constructor options
  (same mocking pattern `ipc.test.ts` already uses for `electron`), so
  `createMainWindow`/`createComposeWindow`/`createMessagePopoutWindow` run
  for real against a fake window. One test asserts the main window's
  `icon` option resolves to the actual `resources/email.png` file on disk
  (a real `fs.existsSync` check, not just a string match, so a future
  rename/move of the asset without updating the code fails loudly); two
  more assert the compose and message-pop-out windows are given the exact
  same icon value as the main window, which is what AC2 (taskbar
  consistency) actually depends on structurally.
- `src/main/buildIcon.test.ts` (+1, AC3): reads the real
  `electron-builder.yml` off disk, extracts its `icon:` value, asserts it
  points at a `.png` (not a pre-built `.ico` — the point of AC3 is that no
  one hand-builds a `.ico` per release), and asserts the referenced file's
  first 8 bytes are a valid PNG signature. This is a static/structural
  check, not a full packaging run.

Deliberately not covered: actually invoking electron-builder's icon
conversion pipeline (verified once by hand during `/implement` against
`app-builder-lib`'s real `convertIcon`, and documented there) or running
`npm run dist:win` end-to-end — both need network access and, for a full
NSIS build, Wine on this Linux box, and the project's existing tests avoid
network dependencies (see `no-network.test.ts`'s explicit guarantee).
Likewise not covered: the actual rendered taskbar/title-bar icon pixels
(no attached display/live Electron GUI to click through), same
non-blocking gap as every prior feature's manual-verification notes.
lint/typecheck/build all pass.

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
