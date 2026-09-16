---
id: 046
title: Tasks side panel
status: testing
priority: medium
---

## Description
A lightweight Tasks panel, toggled on/off from the View ribbon tab, renders
as a column on the right-hand side of the UI. It shows every currently-
flagged email and lets the user add/complete/remove freestanding tasks that
aren't tied to any email.

## Acceptance Criteria
- [ ] View tab has a Tasks toggle; turning it on shows a right-hand column
      panel, off hides it
- [ ] The panel lists every message currently flagged, live-updating as
      flags change elsewhere in the app
- [ ] The user can add a freestanding task (text + optional due indicator)
      directly in the panel
- [ ] Freestanding tasks can be marked complete and removed
- [ ] Freestanding tasks persist across restarts (a new data model/store —
      flagged mail already persists via existing message flags)
- [ ] The panel's on/off state and freestanding tasks are unaffected by
      which Mail folder or Calendar view is active

## Implementation Notes
New data model + store, following the existing `calendar_items`/
`filevine_notes` pattern exactly, no new architecture:
- `shared/data-types.ts`: `Task { id, text, done, dueAt, createdAt }` +
  `NewTask`/`TaskPatch`. `dueAt` is the spec's optional "due indicator" —
  implemented as a plain due-date timestamp, not a full scheduling feature.
- `main/data/db.ts`: new `tasks` table (`id, text, done, due_at,
  created_at`) + `listTasks`/`getTask`/`createTask`/`updateTask`/
  `deleteTask`, mirroring `calendar_items`'s methods. Deliberately **not**
  touched by `resetMailboxAndCalendar`/free-play/scenario-pack loads —
  freestanding tasks are the trainee's own to-do list, not scenario data,
  so they survive a scenario reset the same way Settings/personas already
  do (a judgment call, not spelled out in the AC).
- `main/data/ipc.ts` + `preload/index.ts`/`index.d.ts`: new
  `db:tasks:list/get/create/update/delete` channels and `window.api.data.tasks`,
  symmetric with every other entity's CRUD surface (`get` unused by the
  renderer but kept for interface consistency, matching the codebase's
  existing convention).

UI:
- `RibbonBar.tsx`: View becomes a real, clickable tab (previously a
  disabled placeholder — the code comment there already anticipated this
  feature). It's tracked as its own `viewTabActive` concern, independent
  of `showFileVine`/`activeModule`, since selecting it only swaps which
  ribbon action set shows (now `['Tasks']`) — it never touches which
  Mail/Calendar content is displayed (AC1, and structurally supports AC6).
  The Tasks button is a toggle, not a fire-once action: `aria-pressed` +
  a `.ribbon-action.active` style reflect `showTasksPanel`.
- `App.tsx`: new `viewTabActive`/`showTasksPanel` state. Neither is reset
  by `handleSelectFolder`/`handleSelectModule` — that's what makes AC6
  hold (panel state survives folder/calendar-view navigation) without any
  special-casing. `TasksPanel` renders as an `app-body` sibling after the
  main content, shown whenever `showTasksPanel` is true and Settings isn't
  open (Settings already takes over the whole content area; hiding Tasks
  behind it matches that existing full-screen-takeover convention).
- New `TasksPanel.tsx`: two sections. "Flagged Mail" derives from
  `window.api.data.messages.list()` filtered by `isFlagged` — no new
  broadcast needed, it just refetches on the same `messagesVersion` prop
  App.tsx already bumps on every `data:messages-changed` broadcast (AC2),
  identical to how MessageListPane/ReadingPane already stay live. "Tasks"
  owns its own local list, refetched after each of its own
  create/update/delete calls (no cross-window broadcast — same
  no-broadcast-needed pattern `CalendarView` already uses for its own
  mutations, since nothing else in the app writes to this store).

Tradeoff: the toggle's on/off state is plain in-memory React state, not
persisted — the AC only requires freestanding *tasks* to survive a
restart, not the panel's visibility.

**Requested-changes round (post-accept-gate):**
- `TasksPanel.tsx`: moved the add-task row (text input, due-date input,
  Add button) above the task list, not below it — it's the JSX-order
  change that keeps it visually fixed in place as the list grows, no CSS
  positioning needed.
- `global.css`: `.tasks-panel-flagged-item`/`.tasks-panel-task` each got
  `border-top: 1px solid var(--border)`, with a `:last-child` selector
  adding a matching `border-bottom` — so every item shows a line above
  and below without doubling the border thickness between adjacent items
  (an item's bottom edge is the next item's top border). `.tasks-panel-
  add-row`'s spacing flipped from `margin-top` to `margin-bottom` to match
  its new position above the list.
- Verified live: a throwaway RTL check confirmed the add-row now precedes
  the task list in DOM order. The border styling itself isn't unit-tested
  — jsdom in this project's test environment doesn't load the external
  stylesheet, so computed-style assertions read browser defaults, not the
  actual CSS (confirmed by a failed throwaway attempt); no other CSS rule
  in this codebase is verified that way either, so this isn't a new gap.

## Test Notes
608 → 631 net (+23, all passing; re-run 3x, stable), across 5 files:

- `main/data/db.test.ts` (+4): CRUD round-trip, `getTask`/`updateTask`
  returning `null` for a missing id, persistence across a close/reopen
  cycle (AC5), and a regression test pinning that `resetMailboxAndCalendar`
  leaves tasks untouched (the judgment call from Implementation Notes).
- `main/data/ipc.test.ts`: the exhaustive channel-list assertion updated
  with the 5 new `db:tasks:*` entries (this is the test that was failing
  after `/implement`, now fixed for real rather than patched to compile),
  plus a new IPC round-trip test mirroring the existing calendar-item one.
- `RibbonBar.test.tsx`: the "View tab is disabled" assertion (also
  genuinely failing after `/implement`) rewritten to reflect that View is
  now real — a new `describe('View tab (046)')` block covers View becoming
  active (not Home/FileVine) when selected, the action row swapping to
  just `Tasks` regardless of mail/calendar module, and the Tasks button's
  `aria-pressed`/`.active` state tracking `showTasksPanel` and calling
  `onToggleTasksPanel` on click.
- New `TasksPanel.test.tsx` (unit-level, 12 tests): AC2 flagged-only
  filtering plus a live refetch on a `messagesVersion` bump (both empty
  and non-empty transitions), the "(no subject)" fallback; AC3 Add sends
  the typed text + a real due-date timestamp (or `null` when the due-date
  field is left blank), Enter is equivalent to clicking Add, blank text
  disables Add and makes Enter a no-op; AC4 the checkbox toggles `done`
  via the real store shape and applies the `done` class, Remove calls
  delete and the item disappears; empty-state text for both sections.
- `App.test.tsx` (+3, integration-level, real ribbon click-through): AC1
  View → Tasks shows/hides the panel without touching the underlying Mail
  content; AC6 the panel and a freestanding task both stay visible across
  a real Mail↔Calendar module switch (not just a re-render); Settings
  hides the panel (a design decision from Implementation Notes, not an
  AC — worth a test since it's the one place the panel deliberately
  doesn't show).

Deliberately not covered: real multi-window Electron behavior (there's
only ever one Tasks panel, no pop-out) and the toggle's on/off state
surviving a restart (Implementation Notes: intentionally not persisted,
only the AC5 task data itself is).

**Requested-changes round:** the existing `TasksPanel.test.tsx` suite
didn't assert DOM order or border classes, so none of it needed rewriting
— every existing assertion (add/complete/remove call-throughs, empty
states, live refetch) still passes unchanged against the reordered JSX.
Not independently re-verified here since a throwaway check already
confirmed the DOM-order move during `/implement`; re-run as part of this
stage's full-suite pass regardless.

## Validation Notes
lint/typecheck/build all pass. Full test suite (631/631) re-run 3x, stable
(re-verified in a freshly recovered worktree after the original one was
cleaned up mid-session — see the History entry on `STATE.md` for that
detour; the recovered worktree's commits, tests, build, and full suite
were all re-confirmed identical/green before writing this). Confirmed via
`git diff --stat` (f52357e..b210896) that `/test` touched only test/doc
files, no implementation drift.

All 6 ACs re-verified directly against current source:
- AC1: `RibbonBar.tsx`'s View tab is a real, clickable tab
  (`tabHandlers.View`); its action row swaps to `['Tasks']` when active, a
  toggle button (`aria-pressed`/`.active` tracking `showTasksPanel`) wired
  to `App.tsx`'s `handleToggleTasksPanel`. `TasksPanel` is rendered only
  when `showTasksPanel` is true, as a right-hand `app-body` sibling
  (`flex: 0 0 260px`, `border-left`).
- AC2: `TasksPanel.tsx`'s flagged-mail effect depends on the
  `messagesVersion` prop, which `App.tsx` bumps inside the exact same
  `onMessagesChanged` listener every other live-updating pane
  (MessageListPane/ReadingPane) already uses — so a flag toggled from the
  ribbon, context menu, or Reading Pane anywhere in the app reaches this
  panel through the identical mechanism, not a bespoke one.
- AC3/AC4: `handleAddTask`/`handleToggleDone`/`handleRemoveTask` call
  `window.api.data.tasks.create/update/delete` and refetch locally — a
  freestanding task is created with `text` + an optional `dueAt` (the
  spec's "due indicator"), can be toggled `done` independent of removal,
  and removal is a separate, explicit action.
- AC5: `main/data/db.ts`'s `tasks` table + CRUD methods persist to the
  same on-disk SQLite file every other entity uses. Independently
  re-verified live (beyond the test suite) via a standalone script:
  bundled `db.ts` with esbuild, created a task, marked it done, closed
  the `MailDb`, opened a *second* `MailDb` against the same directory (a
  real restart, not a mock) — the task came back with `done: true` and
  its text intact.
- AC6: `App.tsx`'s `handleSelectFolder`/`handleSelectModule` — the two
  handlers that fire on Mail-folder and Calendar-view navigation — touch
  neither `showTasksPanel` nor `viewTabActive`, and `TasksPanel` itself
  takes no folder/module prop at all, so there's structurally nothing
  for folder/view navigation to affect.

No live multi-window Electron GUI click-through attempted — no attached
display; same non-blocking gap as every prior feature. All checks pass,
no gaps found.

## Acceptance Log
2026-09-16 — Presented the AC-by-AC mapping and validation summary
(631/631 tests stable, no implementation drift, plus the worktree-recovery
detour noted in `STATE.md`). User selected "Request changes" via the
accept-stage decision prompt, then specified: (1) add a visual separator
(line above and below) between each task in the Tasks list; (2) the same
separator treatment for each item in the Flagged Mail list; (3) move the
add-task input row to the top of the Tasks section so it stays fixed in
place rather than being pushed down as tasks are added. Decision:
**changes requested**.
