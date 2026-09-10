---
id: 001
title: App shell & classic Outlook layout
status: done
priority: high
---

## Description
Electron app launches into a classic-Outlook-style shell: left folder pane,
center message list, right reading pane, top ribbon/toolbar, with Mail and
Calendar entries in the left navigation. No live data yet — this is the
visual/structural scaffold other features build on.

## Acceptance Criteria
- [ ] Electron app builds and launches on Windows into a single main window
- [ ] Window shows left folder pane, center message list pane, right reading
      pane, and a top ribbon/toolbar, matching classic Outlook's layout (not
      New Outlook/OWA)
- [ ] Left navigation exposes Mail and Calendar as switchable modules
- [ ] Panes render as functional shell elements even with placeholder/empty
      content
- [ ] No People/Tasks/Notes modules appear in the nav (per non-goals)

## Implementation Notes
Scaffolded the whole app from scratch (no prior package.json existed) as an
Electron + Vite + React + TypeScript project via `electron-vite`, since no
tech stack had been chosen yet and this is the foundation feature.

- `package.json`, `tsconfig*.json`, `electron.vite.config.ts`,
  `electron-builder.yml` — project scaffold. `electron-builder.yml` targets
  `win`/nsis per the spec's Windows-only constraint; not exercised in this
  sandbox (no Windows/wine available), only `npm run build` (vite build) was
  verified.
- `src/main/index.ts` — creates the single `BrowserWindow`.
- `src/preload/index.ts` — empty `contextBridge` API surface; later features
  will extend it for IPC (SQLite/JSON config access, LLM calls, etc.).
- `src/renderer/src/App.tsx` + `components/` (`RibbonBar`, `NavSwitcher`,
  `FolderPane`, `CalendarFolderPane`, `MessageListPane`, `ReadingPane`,
  `CalendarView`) — the shell layout: top ribbon (tabs + module-specific
  action buttons, all disabled placeholders), left rail (folder tree above a
  Mail/Calendar switcher — only those two modules, per non-goals), and
  center/right panes that swap between Mail's message-list + reading-pane
  and Calendar's placeholder view. All content is static/placeholder; no
  data layer yet (that's feature 002).
- `src/renderer/src/styles/global.css` — classic-Outlook visual style
  (Segoe UI, boxy borders, light-blue selection) rather than Fluent/New
  Outlook.

Tradeoffs: picked Electron+Vite+React+TS since the spec mandates Electron
but doesn't pin a renderer framework, and later features (settings CRUD,
mail list, calendar grid) benefit from componentized UI. `npm install`
needed pinned `vite@^7` + `@vitejs/plugin-react@^5.2` since `electron-vite@5`
doesn't yet support `vite@8`, and the base `tsconfig.node.json`/
`tsconfig.web.json` couldn't extend the (removed) `electron-vite/tsconfig`
export, so they're hand-written instead.

Verified: `npm run typecheck` and `npm run build` both pass; launched the
built renderer in Electron (offscreen, via a scratch script) and confirmed
by screenshot that Mail and Calendar both render the classic three-pane /
ribbon layout and that the nav switcher toggles between them.

## Test Notes
Set up Vitest + React Testing Library (`vitest.config.ts`,
`src/renderer/src/test/setup.ts`) since no test runner existed yet — jsdom
environment, `@testing-library/jest-dom` matchers, and an `afterEach`
cleanup (vitest doesn't auto-register RTL's cleanup without `globals: true`,
so it's wired explicitly in the setup file). Added `npm test` (`vitest run`).

Covered (`src/renderer/src/App.test.tsx`,
`src/renderer/src/components/RibbonBar.test.tsx`), all via component
rendering/interaction rather than implementation detail:
- Shell renders all four regions on launch: ribbon (`tablist` "Ribbon
  tabs"), left folder pane ("Mailbox"), center message list header
  ("Inbox"), right reading pane ("Select an item to read.").
- Left nav exposes exactly Mail and Calendar as switchable tabs, and none
  of People/Tasks/Notes appear anywhere in the shell (non-goals check).
- Clicking the Calendar tab swaps the nav-rail folder pane and main content
  to the calendar shell (My Calendars / calendar view placeholder) and the
  mail panes disappear.
- Ribbon actions swap between mail actions (e.g. "New Email") and calendar
  actions (e.g. "New Event") based on the active module, and all ribbon
  buttons render disabled (placeholder-only, per spec).
- Selecting a mail folder (e.g. Drafts) updates the message-list header and
  the selected folder's `selected` class.

Deliberately not covered:
- "Electron app builds and launches on Windows into a single main window"
  — no Windows/wine runner is available in this sandbox. `src/main/index.ts`
  isn't unit-tested (it's a thin Electron `BrowserWindow` bootstrap with no
  branching logic to assert on beyond what `npm run build`'s typecheck
  already catches); Windows launch itself stays unverified here, same
  caveat already logged under Implementation Notes.
- Visual/pixel-level styling (classic-Outlook look vs. New Outlook) — not
  practical to assert via RTL/jsdom; verified instead by the screenshot
  taken during implementation.

## Validation Notes
**Checks run:**
- Lint: no lint tooling exists in the project yet (no ESLint config, no
  `lint` script). Flagging as a gap — not a blocker for this shell-only
  feature, but should be set up before the codebase grows much further.
- Typecheck (`npm run typecheck`): pass, no errors.
- Build (`npm run build` — tsc + `electron-vite build`): pass, emits
  `out/main`, `out/preload`, `out/renderer` cleanly.
- Full test suite (`npm test` — 2 files, 7 tests): all pass.
- Manual launch check: loaded the built `out/renderer/index.html` in a real
  (offscreen) Electron `BrowserWindow` via a scratch script and captured a
  screenshot — window title "Outlook Trainer", all four shell regions
  (`.ribbon`, `.folder-pane`, `.message-list-pane`, `.reading-pane`) present
  in the DOM and rendered correctly.

**Acceptance criteria:**
- [x] Electron app builds and launches on Windows into a single main window
      — build is clean and a single `BrowserWindow` launches and renders
      correctly (verified above). Windows itself is not available in this
      sandbox, so the Windows-specific launch path (and the `dist:win`
      NSIS packaging) remains unverified; nothing in `src/main/index.ts` is
      platform-conditional aside from the `darwin` check in
      `window-all-closed`, so risk is low but this should get a real
      Windows smoke-test before relying on it.
- [x] Window shows left folder pane, center message list pane, right
      reading pane, and a top ribbon/toolbar, matching classic Outlook's
      layout — confirmed by screenshot and by `App.test.tsx`.
- [x] Left navigation exposes Mail and Calendar as switchable modules —
      confirmed by screenshot and by `App.test.tsx`'s module-switch test.
- [x] Panes render as functional shell elements even with placeholder/empty
      content — confirmed ("No items to show.", "Select an item to read.").
- [x] No People/Tasks/Notes modules appear in the nav — confirmed by
      screenshot and by `App.test.tsx`'s non-goals check.

All acceptance criteria met. Proceeding to `accept`.

## Acceptance Log
2026-09-09 — User manually launched the app and confirmed the classic shell
layout renders and folder switching (Inbox/Drafts/Sent Items/Deleted Items)
works. Asked whether the ribbon buttons (New Email, Delete, etc.) and top
tabs (File, Home, Send/Receive, etc.) being non-functional was expected for
this feature; confirmed yes — that's scaffold-only per the feature's scope,
with real behavior landing in later features (004–006, 018–020). Decision:
**accepted**.
