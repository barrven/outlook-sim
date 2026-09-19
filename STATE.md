# Dev Loop State

This file is the single source of truth for where the project is in the
lifecycle. Every stage command reads it first and updates it last.

- **Outer iteration:** 3
- **Phase:** accept
- **Active feature:** 057 (Tasks panel — Tasks section redesign (inline edit, header Add, due-date sort))
- **Last updated:** 2026-09-18

## Phases

`spec -> features -> [implement -> test -> validate -> accept]* -> retro -> (back to spec)`

The inner cycle (`implement` → `test` → `validate`) runs as one pass when
`/implement` is invoked; `/accept` is the only inner-loop human gate. After
a feature is accepted, wait for `/implement` before starting the next one.

Valid values for **Phase**: `spec`, `features`, `implement`, `test`, `validate`,
`accept`, `retro`.

## History

<!-- Append a one-line entry here every time the phase changes, oldest last is fine, newest-first preferred. -->
- 2026-09-18 — feature 057 (Tasks panel — Tasks section redesign)
  validated: lint/typecheck/build pass; full suite (872/872) re-run 4x
  total, stable; `git diff --stat` (53a26a3..HEAD) confirms
  `/implement`+`/test` touched only the expected files, no new
  dependency. All 7 ACs re-verified directly against current source:
  AC1/AC2 header layout + form-visibility gating; AC3 the Fragment
  places the inline form directly after the edited task's own `<li>`;
  AC4 single-valued state; AC5 the real `tasks.update` call; AC6 the
  sort comparator matches spec exactly; AC7 `git diff` confirms
  `handleToggleDone` byte-for-byte unchanged and `handleRemoveTask`
  gained exactly one guard line. Also re-confirmed the date round-trip
  fix's `getUTC*` accessors directly in source. Not independently
  re-verified: rendered visual layout (no attached display). All checks
  pass, no blocking gaps. Phase set to `accept`.
- 2026-09-18 — feature 057 (Tasks panel — Tasks section redesign) tested:
  861 → 872 net (+11, all passing; re-run 3x, stable), all in
  `TasksPanel.test.tsx` (18 → 29 tests, matching the overall delta — no
  other file touched). Rewrote the 5 tests this feature's AC1/AC2 broke
  into the new hidden-by-default behavior. New coverage per AC: AC1/AC2
  form visibility; AC3 real DOM child-order placement + pre-fill
  (including the undated case); AC4 three angles (Edit-replaces-Edit,
  Edit-closes-Add, Cancel-closes-edit); AC5 Save persists via the real
  API; AC6 a 4-task mixed-sort assertion; AC7 remove-while-editing closes
  the form. Also locked in the date round-trip fix end-to-end (edit
  without touching the date reproduces the exact same stored timestamp).
  lint/typecheck/build all pass. Test Notes filled in; phase set to
  `validate`.
- 2026-09-18 — feature 057 (Tasks panel — Tasks section redesign)
  implemented: shared add/edit form (`taskForm`, a plain JSX variable) and
  `creating`/`editingTaskId` state, mirroring `PersonasSettings.tsx`'s
  inline-edit pattern (050). Header gained an "Add" button
  (`.tasks-panel-section-header`), hidden while any form is open (AC1/
  AC2). Each task gained an "Edit" button opening the form inline in a
  per-task `<Fragment>` (AC3), single-valued state giving AC4's mutual
  exclusion for free. `handleSaveTask` branches create-vs-update via the
  real `tasks.update`/`tasks.create` APIs (AC5). New `sortedTasks`
  (undated first, newest-created-first among themselves, then dated
  ascending — AC6) computed as a copy, `tasks` state untouched.
  `handleRemoveTask` gained a defensive close-if-editing guard (AC7,
  matching PersonasSettings' identical pattern). Also added
  `dueAtToDateInputValue`, inverting the existing UTC-parse quirk in how
  due dates are already stored (feature 046, left unchanged per AC7) so
  editing a date-having task's date round-trips correctly. Verified live
  via a throwaway RTL script (not committed): all 6 ACs plus the date
  round-trip fix confirmed end-to-end. lint/typecheck/build pass; full
  suite 856/861 — 5 pre-existing tests fail because they drove the old
  always-visible add row this feature deliberately replaced, left for
  `/test` to rewrite per this repo's established convention. Phase set to
  `test`.
- 2026-09-18 — feature 056 (Tasks panel — unflag and pop-out controls on
  Flagged Mail rows) accepted by user (selected "Accept (Recommended)"
  against the validation summary and AC-by-AC mapping, no changes
  requested); logged to CHANGELOG. This was the second-to-last backlog
  feature. Active feature set to 057 (Tasks panel — Tasks section
  redesign, the last remaining `backlog`-status feature in BACKLOG.md),
  phase set to `implement`.
- 2026-09-18 — feature 056 (Tasks panel — unflag and pop-out controls on
  Flagged Mail rows) validated: lint/typecheck/build pass; full suite
  (861/861) re-run 4x total, stable; `git diff --stat` (74827f6..HEAD)
  confirms `/implement`+`/test` touched only the expected files, no new
  dependency. All 4 ACs re-verified directly against current source: AC1
  a real unflag button per row; AC2 the real `messages.update` IPC call,
  no new local refetch logic added; AC3 the same `messagePopout.open`
  call `MessageListPane.tsx` uses; AC4 confirmed the two buttons are
  sibling elements, never nested, a structural (not `stopPropagation()`-
  based) guarantee against dblclick bubbling between them. Not
  independently re-verified: rendered visual layout (no attached
  display). All checks pass, no blocking gaps. Phase set to `accept`.
- 2026-09-18 — feature 056 (Tasks panel — unflag and pop-out controls on
  Flagged Mail rows) tested: 856 → 861 net (+5, all passing; re-run 3x,
  stable), all in `TasksPanel.test.tsx`'s new "056" block. AC1 confirms
  the unflag button calls the real `messages.update` API. AC2 confirms
  the row disappears via the same broadcast-driven refetch path the
  existing 046 test already exercises. AC3 confirms double-clicking the
  subject opens the real pop-out with the right id. AC4 covers both
  directions of non-interference (unflag double-click never opens the
  pop-out; subject double-click never calls unflag). lint/typecheck/build
  all pass. Test Notes filled in; phase set to `validate`.
- 2026-09-18 — feature 056 (Tasks panel — unflag and pop-out controls on
  Flagged Mail rows) implemented: each Flagged Mail row now renders two
  sibling `<button>`s (never nested, mirroring `MessageListPane.tsx`'s
  row-button/flag-button pattern) instead of plain text — a subject
  button with `onDoubleClick` calling `messagePopout.open` (AC3), and a
  new unflag button calling `messages.update(id, { isFlagged: false })`
  (AC1). No local refetch needed: the update triggers the same broadcast
  → `messagesVersion` bump path this component's `flaggedMessages` effect
  is already keyed on (AC2). AC4 (no interference) is structural — since
  the buttons are siblings, a double-click on one can never bubble into
  the other's handler. Verified live via a throwaway RTL script (not
  committed): unflag calls the right API, double-clicking the subject
  opens the pop-out, double-clicking the unflag button never does. lint/
  typecheck/build pass; full suite unchanged at 856/856. Phase set to
  `test`.
- 2026-09-18 — feature 055 (Mail message list — show each message's
  timestamp) accepted by user (selected "Accept (Recommended)" against
  the validation summary and AC-by-AC mapping, no changes requested);
  logged to CHANGELOG. Active feature set to 056 (Tasks panel — unflag
  and pop-out controls on Flagged Mail rows, next in BACKLOG.md table
  order), phase set to `implement`.
- 2026-09-18 — feature 055 (Mail message list — show each message's
  timestamp) validated: lint/typecheck/build pass; full suite (856/856)
  re-run 4x total, stable; `git diff --stat` (293c602..HEAD) confirms
  `/implement`+`/test` touched only the expected files, no new
  dependency. All 3 ACs re-verified directly against current source: AC1
  both `MessageListPane.tsx` and `ReadingPane.tsx` call the identical
  `new Date(x).toLocaleString()` expression; AC2 all existing row content
  and handlers untouched; AC3 `visibleMessages` (the search/filter/sort
  computation) is entirely outside this diff's line range. Not
  independently re-verified: rendered visual layout (no attached
  display). All checks pass, no blocking gaps. Phase set to `accept`.
- 2026-09-18 — feature 055 (Mail message list — show each message's
  timestamp) tested: 852 → 856 net (+4, all passing; re-run 3x, stable),
  all in `MessageListPane.test.tsx`'s new "055" block. AC1 confirms exact
  `toLocaleString()` text match plus per-row correctness (two messages,
  two different timestamps, neither shared/stale). AC2 confirms from/
  subject/categories/flag button all still present alongside a real
  `.message-list-item-timestamp` element. AC3 confirms search filtering
  is unaffected. lint/typecheck/build all pass. Test Notes filled in;
  phase set to `validate`.
- 2026-09-18 — feature 055 (Mail message list — show each message's
  timestamp) implemented: `MessageListPane.tsx`'s row gained a
  `.message-list-item-top-row` (from + a new timestamp span, flex
  space-between) above the existing subject/categories, formatted via
  `new Date(message.timestamp).toLocaleString()` — the exact same call
  `ReadingPane.tsx` already uses (AC1). Subject/categories/flag button
  unchanged in position (AC2); `visibleMessages`'s filtering/sort logic
  untouched (AC3). New CSS gives the from-span ellipsis truncation (now a
  flex child alongside a fixed-width timestamp) and the timestamp
  `flex: 0 0 auto`/`white-space: nowrap`. Verified live via a throwaway
  RTL script (not committed): rendered timestamp text matches
  `toLocaleString()` exactly, all other row content intact. lint/
  typecheck/build pass; full suite unchanged at 852/852. Phase set to
  `test`.
- 2026-09-18 — feature 054 (Mail message list — flagged-row styling)
  accepted by user (selected "Accept (Recommended)" against the
  validation summary and AC-by-AC mapping, no changes requested); logged
  to CHANGELOG. Active feature set to 055 (Mail message list — show each
  message's timestamp, next in BACKLOG.md table order), phase set to
  `implement`.
- 2026-09-18 — feature 054 (Mail message list — flagged-row styling)
  validated: lint/typecheck/build pass; full suite (852/852) re-run 4x
  total, stable; `git diff --stat` (1ba8223..HEAD) confirms
  `/implement`+`/test` touched only the expected files (AC1's flag-icon
  size predates this range, already credited to the user's earlier
  manual commit). All 4 ACs re-verified directly against current source:
  AC1 font-size 20px confirmed by direct read; AC2 the `.flagged` rule
  uses `--flag-bg`; AC3 `.flagged` (line 1055) precedes `.selected` (line
  1059) in source, confirmed directly, giving `.selected` the cascade
  win; AC4 the class is a plain derived value with no caching. Not
  independently re-verified: rendered visual appearance across all 4
  color schemes (no attached display). All checks pass, no blocking
  gaps. Phase set to `accept`.
- 2026-09-18 — feature 054 (Mail message list — flagged-row styling)
  tested: 846 → 852 net (+6, all passing; re-run 3x, stable) across 2
  files. New "flagged-row styling (054)" block in
  `globalCssStyling.test.ts` (+3) — matching that file's established
  CSS-source-assertion convention rather than a renderer test — locks in
  the flag icon's `font-size: 20px` (AC1 regression guard), the
  `.flagged` rule's `background: var(--flag-bg)` (AC2), and that
  `.flagged` is declared before `.selected` in source order (AC3's
  mechanism). `MessageListPane.test.tsx` (+3) covers AC2 (class presence/
  absence), AC3 (both classes coexist on a flagged+selected row), and
  AC4 (re-rendering with a newly-flagged message immediately adds the
  class, mirroring the broadcast-refetch pattern). lint/typecheck/build
  all pass. Test Notes filled in; phase set to `validate`.
- 2026-09-18 — feature 054 (Mail message list — flagged-row styling)
  implemented: AC1 (larger flag icon) was already done by the user
  directly, in the same manual commit as feature 053 (`3158af7`) —
  confirmed via `git log -p` that `.message-list-flag-btn`'s font-size
  went 14px → 20px. AC2-AC4 implemented here: `MessageListPane.tsx`'s row
  gained a conditional `flagged` class; new CSS
  `.message-list-item.flagged { background: var(--flag-bg); }`, declared
  before `.selected` in source order so selection wins the cascade when a
  row is both flagged and selected (AC3's precedence decision, documented
  in Implementation Notes). AC4 needs no extra code — the class is a plain
  derived value from `message.isFlagged`, updating live the same way
  `unread`/`selected` already do. Verified live via a throwaway RTL script
  (not committed): flagged-only vs flagged+selected rows carry the right
  class combinations. lint/typecheck/build pass; full suite unchanged at
  846/846 (no new feature-specific tests yet — that's `/test`'s job).
  Phase set to `test`.
- 2026-09-18 — feature 053 (Ribbon — Home tab: remove dead placeholder
  buttons) accepted: the user reported having already implemented this
  directly (not through `/implement`) and asked to verify and mark it
  done. Confirmed via source inspection and `git log -p` that the work
  was already on `master` (commit `3158af7`, 2026-09-17, predating this
  feature being picked up) and satisfies all 3 ACs; full suite green
  (846/846, stable across 3 runs). Fixed one stale comment and relabeled
  one stale test name found along the way (no behavior/assertion
  changes). No separate implement/test/validate cycle was run — this was
  a verification + housekeeping pass over existing work, per the user's
  explicit instruction. Logged to CHANGELOG. Active feature set to 054
  (Mail message list — flagged-row styling, next in BACKLOG.md table
  order), phase set to `implement`.
- 2026-09-18 — feature 052 (Settings — spacing between Scenario Pack Load
  and Save sections) accepted by user (selected "Accept (Recommended)"
  against the validation summary and AC-by-AC mapping, no changes
  requested); logged to CHANGELOG. Active feature set to 053 (Ribbon —
  Home tab: remove dead placeholder buttons, next in BACKLOG.md table
  order), phase set to `implement`.
- 2026-09-18 — feature 052 (Settings — spacing between Scenario Pack Load
  and Save sections) validated: lint/typecheck/build pass; full suite
  (846/846) re-run 4x total, stable; `git diff --stat` (2e33bfe..HEAD)
  confirms `/implement`+`/test` touched only the expected files, no new
  dependency. All 3 ACs re-verified directly against current source: AC1
  the new CSS gives a 16px margin/padding + border-top divider; AC2
  `git diff` confirms the change is a pure wrap, zero lines touched
  inside the load/save handlers or their state; AC3 exactly one JSX usage
  and one CSS rule for the new class, everything else untouched. Not
  independently re-verified: rendered visual spacing (no attached
  display). All checks pass, no blocking gaps. Phase set to `accept`.
- 2026-09-18 — feature 052 (Settings — spacing between Scenario Pack Load
  and Save sections) tested: 841 → 846 net (+5, all passing; re-run 3x,
  stable), all in `SettingsView.test.tsx`'s existing "Scenario Pack"
  block. AC1 confirms the Save subsection sits inside the new wrapper
  while Load's own note does not (a genuine sub-boundary), plus the Save
  button itself is inside it. AC2 exercises both Load and Save end-to-end
  through the new markup (success + error paths for Save). AC3 confirms
  exactly one wrapper element exists app-wide. lint/typecheck/build all
  pass. Test Notes filled in; phase set to `validate`.
- 2026-09-18 — feature 052 (Settings — spacing between Scenario Pack Load
  and Save sections) implemented: `SettingsView.tsx`'s Save subsection
  (note + actions + error) wrapped in a new
  `<div className="scenario-pack-save-section">`; new CSS gives it a
  16px top margin/padding plus a 1px border-top divider, mirroring
  `.persona-editor`'s existing divider convention. Load subsection's own
  markup untouched, only wrapped-around; `handleLoadScenarioPack`/
  `handleSaveScenarioPack` and their state unchanged — markup/CSS-only.
  Verified live via a throwaway RTL script (not committed): Save's note
  is inside the new wrapper, Load's note is not, and exactly one such
  wrapper exists app-wide. lint/typecheck/build pass; full suite
  unchanged at 841/841 (existing 48-test `SettingsView.test.tsx` suite
  passes unmodified). Phase set to `test`.
- 2026-09-18 — feature 051 (Settings — Persona editor's Client checkbox
  left-aligned) accepted by user (selected "Accept (Recommended)" against
  the validation summary and AC-by-AC mapping, no changes requested);
  logged to CHANGELOG. Active feature set to 052 (Settings — spacing
  between Scenario Pack Load and Save sections, next in BACKLOG.md table
  order), phase set to `implement`.
- 2026-09-18 — feature 051 (Settings — Persona editor's Client checkbox
  left-aligned) validated: lint/typecheck/build pass; full suite
  (841/841) re-run 4x total, stable; `git diff --stat` (87c9cfb..HEAD)
  confirms `/implement`+`/test` touched only the expected files, no new
  dependency. All 4 ACs re-verified directly against current source: AC1
  the new CSS overrides the `flex: 1 1 auto` drift cause; AC2 diffed
  `.calendar-event-form-row-checkbox` against the new
  `.settings-field-row-checkbox` directly — byte-for-byte identical rule
  bodies; AC3 only the Client row carries the modifier class, base rules
  untouched; AC4 the checkbox's `onChange` handler unchanged, new test
  confirms persistence. Not independently re-verified: rendered visual
  alignment (no attached display — same non-blocking gap as every prior
  CSS feature). All checks pass, no blocking gaps. Phase set to `accept`.
- 2026-09-18 — feature 051 (Settings — Persona editor's Client checkbox
  left-aligned) tested: 838 → 841 net (+3, all passing; re-run 3x,
  stable), all in `PersonasSettings.test.tsx`'s new "051" block. AC1/AC2
  confirms the Client row carries both `settings-field-row` and the new
  `settings-field-row-checkbox` class. AC3 confirms all 7 other fields'
  rows do not. AC4 confirms toggling and Save persists `isClient: true`.
  lint/typecheck/build all pass. Test Notes filled in; phase set to
  `validate`.
- 2026-09-18 — feature 051 (Settings — Persona editor's Client checkbox
  left-aligned) implemented: mirrors `.calendar-event-form-row-checkbox`'s
  existing pattern exactly. `PersonasSettings.tsx`'s Client row gained a
  `settings-field-row-checkbox` modifier class alongside the base
  `settings-field-row`; new CSS gives that row `justify-content:
  flex-start` and the checkbox itself `flex: 0 0 auto` + fixed 18×18 size,
  stopping the `flex: 1 1 auto` every other input gets from stretching it.
  Only the Client row touched — no other persona editor field's classes or
  the base `.settings-field-row` rules changed; `onChange` logic
  untouched. lint/typecheck/build pass; full suite unchanged at 838/838
  (existing tests query by label/role/checked state, not CSS classes).
  Phase set to `test`.
- 2026-09-18 — feature 050 (Settings — Persona editor opens inline under
  the edited persona) accepted by user (selected "Accept (Recommended)"
  against the validation summary and AC-by-AC mapping, no changes
  requested); logged to CHANGELOG. Active feature set to 051 (Settings —
  Persona editor's Client checkbox left-aligned, next in BACKLOG.md table
  order), phase set to `implement`.
- 2026-09-18 — feature 050 (Settings — Persona editor opens inline under
  the edited persona) validated: lint/typecheck/build pass; full suite
  (838/838) re-run 4x total, stable; `git diff --stat` (5922271..HEAD)
  confirms `/implement`+`/test` touched only the expected files, no new
  dependency. All 4 ACs re-verified directly against current source: AC1
  the editor `<li>` sits directly after the matching persona's own `<li>`
  inside the same `<ul>`; AC2 `editingId` remains a single value,
  structurally never more than one match; AC3 the `creating` render path
  is untouched in position, same "below the list" slot; AC4 `git diff`
  confirms `handleSubmit`/`closeEditor`/`handleDelete` are byte-for-byte
  unchanged — only the JSX return statement and the new `editorForm`
  extraction changed. Not independently re-verified: rendered visual
  spacing (no attached display). All checks pass, no blocking gaps. Phase
  set to `accept`.
- 2026-09-18 — feature 050 (Settings — Persona editor opens inline under
  the edited persona) tested: 833 → 838 net (+5, all passing; re-run 3x,
  stable), all in `PersonasSettings.test.tsx`'s new "050" block. AC1
  asserts the editor's actual DOM position (immediately after the clicked
  persona's row, strictly before the next one), including a second-persona
  case to guard against an always-first-position bug. AC2 confirms
  exactly one editor open when switching between personas. AC3 confirms
  "+ New Persona" still renders outside `.persona-list`. A supporting test
  locks in create/edit mutual exclusion. AC4 unaffected — the pre-existing
  Edit/Cancel/Delete tests (28, unmodified) already cover it and pass
  against the new placement. lint/typecheck/build all pass. Test Notes
  filled in; phase set to `validate`.
- 2026-09-18 — feature 050 (Settings — Persona editor opens inline under
  the edited persona) implemented: scoped entirely to
  `PersonasSettings.tsx` + a small CSS addition. Pulled the editor form
  JSX into a single `editorForm` variable, rendered inline right after the
  edited persona's own `<li>` row (via a keyed `Fragment` per persona) when
  `editingId` matches it, instead of below the whole list; creating a new
  persona still renders it below the whole list, unchanged (AC3). AC2
  (only one open at a time) falls out of `editingId` already being a
  single value. AC4 (Save/Cancel/Delete) untouched — placement-only
  change. Verified live via a throwaway RTL script (not committed): editor
  row lands immediately after the clicked persona's row in the actual DOM
  order, switching to a different persona's edit replaces it, create still
  works below the list, Save persists the same payload shape. lint/
  typecheck/build pass; full suite unchanged at 833/833 (existing 28-test
  `PersonasSettings.test.tsx` suite passes unmodified — it queries by
  label/role, not DOM position). Phase set to `test`.
- 2026-09-18 — feature 067 (Mail — pop-out window for viewing attachments)
  accepted by user (selected "Accept (Recommended)" against the
  validation summary and AC-by-AC mapping, no changes requested); logged
  to CHANGELOG. This was the last `medium`-priority backlog feature —
  remaining backlog is all low priority. Active feature set to 050
  (Settings — Persona editor opens inline under the edited persona, next
  in BACKLOG.md table order), phase set to `implement`.
- 2026-09-18 — feature 067 (Mail — pop-out window for viewing attachments)
  validated: lint/typecheck/build pass; full suite (833/833) re-run 4x
  total, stable; `git diff --stat` (100df33..HEAD) confirms
  `/implement`+`/test` touched only the expected files, no new
  dependency. Cleaned up an unnecessary type cast in
  `AttachmentPopoutWindow.tsx` (code-quality only). All 4 ACs re-verified
  directly against current source: AC1 both entry points (Reading Pane +
  message pop-out) share the exact same `handleAttachmentClick`, confirmed
  by re-reading `MessagePopoutWindow.tsx`; AC2 the generated-document
  detection can only match a `writeGeneratedAttachment`-produced
  attachment, confirmed against `attachmentExtraction.ts`'s unchanged
  extension lists; AC3 both branches read existing fields with no new IPC;
  AC4 no cross-window subscription anywhere in the new component, genuine
  separate `BrowserWindow`. Not independently re-verified: rendered
  appearance and a live click-through (no attached display — same
  established manual-gap category as other `shell`/window-creation
  features). All checks pass, no blocking gaps. Phase set to `accept`.
- 2026-09-18 — feature 067 (Mail — pop-out window for viewing attachments)
  tested: 821 → 833 net (+12, all passing; re-run 3x, stable) across 3
  files. New `AttachmentPopoutWindow.test.tsx` (+8) covers AC2 (Markdown-
  rendered generated document, real DOM elements not literal text), AC3
  (verbatim real-attachment text, the `.html`-without-extractedText edge
  case correctly falling back, and the full fallback+open-with-default-app
  path), and AC4 (no cross-window state, closes itself on a missing
  message or attachment). `windows.test.ts` (+3) covers
  `createAttachmentPopoutWindow`'s icon/title/query-param wiring.
  `ReadingPane.test.tsx` rewrote the one test 067 broke into AC1's actual
  behavior, plus a new multi-attachment-index test. lint/typecheck/build
  all pass. Test Notes filled in; phase set to `validate`.
- 2026-09-18 — feature 067 (Mail — pop-out window for viewing attachments)
  implemented: new `AttachmentPopoutWindow.tsx` mirrors the existing
  message/calendar pop-out pattern (own `BrowserWindow`, opened via
  `window:openAttachmentPopout` + `attachmentPopout.open(messageId,
  attachmentIndex)`, parented to whichever window triggered it).
  `ReadingPane.tsx`'s attachment click now opens this pop-out (AC1)
  instead of handing off to the OS; that OS handoff moves inside the
  pop-out as an AC3 fallback button. Content resolved from existing
  fields only (no new provenance flag, per 066's feedback): `.html` +
  `extractedText` → Markdown-rendered generated document (AC2);
  `extractedText` alone → verbatim real-attachment text (AC3); neither →
  fallback with "open with default app" (AC3). AC4 (closing is isolated)
  falls out of being a genuinely separate window, same as the existing
  pop-outs. Verified live via a throwaway RTL script (not committed): all
  3 content paths render correctly, the window self-closes on a missing
  message/attachment, and `ReadingPane`'s click now calls the new API
  instead of the old one. lint/typecheck/build pass; full suite 820/821 —
  one pre-existing 065 test now fails because it asserts the exact old
  click behavior this feature replaces, left for `/test` to rewrite per
  this repo's established convention. Phase set to `test`.
- 2026-09-18 — feature 066 (Mail — save an attachment into FileVine)
  accepted by user (selected "Accept (Recommended)" against the revised
  validation summary and AC-by-AC mapping after the requested-changes fix,
  no further changes requested); logged to CHANGELOG. Active feature set
  to 067 (Mail — pop-out window for viewing attachments, next in
  BACKLOG.md table order), phase set to `implement`.
- 2026-09-18 — feature 066 (Mail — save an attachment into FileVine)
  validated (requested changes): lint/typecheck/build pass; full suite
  (821/821) re-run 4x total, stable; `git diff --stat` (1c9a5d6..HEAD)
  confirms only expected files touched, no new dependency. Confirmed via
  grep that `generated` is fully gone from `data-types.ts`/
  `generatedAttachment.ts`/`ReadingPane.tsx` (only unrelated hits remain),
  and `ReadingPane.tsx`'s button condition is exactly
  `attachment.extractedText !== undefined` — the revised AC1 holds. Fixed
  one stale comment caught during this pass. AC2/AC3/AC4 unaffected by
  this fix, re-read to confirm. All checks pass, no blocking gaps. Phase
  set to `accept`.
- 2026-09-18 — feature 066 (Mail — save an attachment into FileVine)
  tested (requested changes): 822 → 821 net (all passing; re-run 3x,
  stable) — removed the obsolete "marks the attachment as generated" unit
  test; rewrote `ReadingPane.test.tsx`'s AC1 test to assert both a real
  attachment and an LLM-generated-shaped one get the action (neither
  special-cased), plus a new test confirming a content-less attachment
  still gets none; the other 7 tests in that block needed only a fixture
  rename. lint/typecheck/build all pass. Test Notes addendum filled in;
  phase set to `validate`.
- 2026-09-18 — feature 066 (Mail — save an attachment into FileVine)
  implemented (requested changes): removed the `generated` gate entirely —
  `MessageAttachment.generated` dropped from shared/data-types.ts, no
  longer set by `writeGeneratedAttachment`; `ReadingPane.tsx`'s "Save to
  FileVine" button now shows for any attachment with
  `extractedText !== undefined`, real or LLM-generated, no distinction.
  lint/typecheck/build pass. Phase set to `test`.
- 2026-09-18 — feature 066 (Mail — save an attachment into FileVine, title
  updated from "...a generated attachment...") sent back from `/accept`
  with "Request changes": the user said "you don't need to differentiate
  between LLM generated attachments. any attachment should be able to be
  saved into filvine." Description/AC1 revised to drop the
  generated-only scoping; the requested code change (drop the `generated`
  gate, show the action for any attachment with content) is written into
  the feature file's Implementation Notes addendum. Phase set back to
  `implement`.
- 2026-09-18 — feature 066 (Mail — save a generated attachment into
  FileVine) validated: lint/typecheck/build pass; full suite (822/822)
  re-run 4x total, stable; `git diff --stat` (0e93b36..HEAD) confirms
  `/implement`+`/test` touched only the expected files, no new dependency
  added. All 4 ACs re-verified directly against current source: AC1 the
  button is gated on `attachment.generated` (only 065's
  `writeGeneratedAttachment` sets it), never a real attachment even one
  with its own extractedText; AC2 the save call is the exact same
  `fileVineNotes.create` API `FileVineView.tsx` already uses, confirmed
  that component's unchanged render path handles the new note identically;
  AC3 neither save function ever calls `messages.*`; AC4 the no-folders
  state is an inline create-folder-and-save form, not a dead end. Also
  confirmed `MessagePopoutWindow.tsx` gets the action for free (same
  `ReadingPane`, no overrides). Not independently re-verified: rendered
  dialog appearance (no attached display) and a live Electron IPC
  click-through — same non-blocking category as this project's other
  IPC-touching features. All checks pass, no blocking gaps. Phase set to
  `accept`.
- 2026-09-18 — feature 066 (Mail — save a generated attachment into
  FileVine) tested: 813 → 822 net (+9, all passing; re-run 3x, stable)
  across 2 files. `generatedAttachment.test.ts` (+1) locks in
  `generated: true`. `ReadingPane.test.tsx` (+9, new "066" block) covers
  AC1 (action shown only for a generated attachment, even one alongside a
  real attachment with its own `extractedText`), AC1/AC2 (picking a folder
  and saving calls `fileVineNotes.create` with the exact content, dialog
  closes), AC3 (no `messages.update` call, attachment unaffected), AC4 (no
  folders → inline create-folder-and-save path, no dead end, blank name
  rejected), plus Cancel and cross-message-reset behavior. lint/typecheck/
  build all pass. Test Notes filled in; phase set to `validate`.
- 2026-09-18 — feature 066 (Mail — save a generated attachment into
  FileVine) implemented: `MessageAttachment` gained an optional
  `generated?: boolean`, set by `writeGeneratedAttachment` (065) so the UI
  can tell a generated (incoming) attachment apart from a real,
  trainee-picked one. `ReadingPane.tsx` (shared by the main window and the
  message pop-out, feature 041) gained a "Save to FileVine…" action on a
  generated attachment, opening an inline dialog: a folder `<select>` +
  Save when folders exist (calling the existing `fileVineNotes.create` API
  with the attachment's `extractedText` — already the raw Markdown — as
  content), or an inline create-folder-then-save form when none exist
  (AC4). Saving never touches the message/attachment (AC3, structurally).
  Verified live via a throwaway RTL script (not committed): both paths
  call the right APIs with the right args, and a real (non-generated)
  attachment never shows the action. lint/typecheck/build pass; full suite
  unchanged at 813/813 (no new feature-specific tests yet — that's
  `/test`'s job). Phase set to `test`.
- 2026-09-18 — feature 064 (Mail — multimodal image attachments sent
  directly to the LLM) accepted by user (selected "Accept (Recommended)"
  against the validation summary and AC-by-AC mapping, no changes
  requested); logged to CHANGELOG. Active feature set to 066 (Mail — save a
  generated attachment into FileVine, next in BACKLOG.md table order),
  phase set to `implement`.
- 2026-09-18 — feature 064 (Mail — multimodal image attachments sent
  directly to the LLM) validated: lint/typecheck/build pass; full suite
  (813/813) re-run 4x total, stable; `git diff --stat` (c2052c2..HEAD)
  confirms `/implement`+`/test` touched only the expected files, no new
  dependency added (part of AC3's evidence). All 3 ACs re-verified directly
  against current source: AC1 `readImageAttachment` covers PNG/JPG/JPEG,
  `personaReply.ts` collects images from every attachment with a `path`
  across the whole thread, `client.ts` attaches them as each provider's
  real multimodal content-block shape (OpenAI/xAI `image_url`, Anthropic
  base64 `image` source, Gemini `inline_data`); AC2 the original send is
  structurally independent of the LLM call (already persisted before the
  fire-and-forget reply call starts), and `generateText` retries once
  without images on a failed first attempt so an unsupported provider/model
  still yields a normal reply — a disclosed response-driven design choice
  since this app has no per-model capability list; AC3 `readImageAttachment`
  does only `readFileSync` + base64-encode (no parsing library), and
  `attachmentExtraction.ts` still has no image extensions, confirmed
  unchanged. Not independently re-verified: a live multimodal-provider call
  actually referencing image content, and a live non-multimodal model's
  real rejection shape — both inherently manual, same category as this
  project's other live-LLM ACs. All checks pass, no blocking gaps. Phase
  set to `accept`.
- 2026-09-18 — feature 064 (Mail — multimodal image attachments sent
  directly to the LLM) tested: 793 → 813 net (+20, all passing; re-run 3x,
  stable) across 3 files. New `imageAttachment.test.ts` (+9) covers
  `readImageAttachment` directly (mime types, exact byte round-trip proving
  no OCR/extraction per AC3, graceful `undefined` cases). `client.test.ts`
  (+8) covers AC1's exact content-block shape for all 4 providers plus
  AC2's graceful retry-without-images behavior on a failed first attempt.
  `personaReply.test.ts` (+4) covers the end-to-end wiring: a real image
  attachment becomes an image block with the exact original bytes and the
  filename line intact, images collected across the whole thread, a
  non-image attachment never becomes one, and AC2 end-to-end via a failed
  first call. Deliberately uncovered: a live call against a real
  multimodal provider actually referencing image content (manual, same
  category as other live-LLM ACs). lint/typecheck/build all pass. Test
  Notes filled in; phase set to `validate`.
- 2026-09-18 — feature 064 (Mail — multimodal image attachments sent
  directly to the LLM) implemented: new `src/main/llm/imageAttachment.ts`
  reads a real PNG/JPEG attachment's bytes off disk and base64-encodes them
  (never OCR'd, per AC3), returning `undefined` for anything else, a missing
  file, or a read error. `LlmGenerateInput` gained an optional `images`
  array; `personaReply.ts` collects image attachments fresh from the thread
  at generation time and passes them to `generateText`. `client.ts`'s
  `buildRequest` attaches images as each provider's native multimodal
  content block (OpenAI/xAI `image_url`, Anthropic `image` base64 source,
  Gemini `inline_data`) — plain-string content unchanged when there are no
  images (AC1). AC2's graceful degradation: since `model` is free-text with
  no capability list, `generateText` tries the request with images first
  and retries once without them only if that attempt fails, so an
  unsupported provider/model still produces a normal reply instead of a
  failed generation. Verified via a throwaway vitest script (not committed):
  confirmed the exact content-block shape for all 4 providers and that the
  retry-without-images path returns a clean success. lint/typecheck/build
  pass; full suite unchanged at 793/793 (no new feature-specific tests yet —
  that's `/test`'s job). Phase set to `test`.
- 2026-09-18 — feature 061 (Settings — Appearance color scheme switcher)
  accepted by user (selected "Accept (Recommended)" against the
  validation summary and AC-by-AC mapping, no changes requested); logged
  to CHANGELOG. Active feature set to 064 (Mail — multimodal image
  attachments sent directly to the LLM, next in BACKLOG.md table order),
  phase set to `implement`.
- 2026-09-18 — feature 061 (Settings — Appearance color scheme switcher)
  validated: lint/typecheck/build pass; full suite (793/793) re-run 3x,
  stable; `git diff --stat` (9a455ba..HEAD) confirms `/implement`+`/test`
  touched only expected files. All 4 ACs re-verified independently (not
  just re-running the test files): AC1 a Node script cross-checked
  global.css's 4 theme blocks against `ColorScheme`'s union and
  SettingsView's picker list — identical sets; AC2 source inspection
  confirms `dataset.theme` is set synchronously before the IPC `set`
  call, plus the broadcast reaches every other open window; AC3 source
  inspection confirms `appearance.json` lives in the same `configDir` as
  every other settings file, backed by a real-filesystem round-trip
  test; AC4 source inspection confirms the literal default and that
  main.tsx applies the persisted scheme unconditionally on every
  window's own launch. All checks pass, no gaps found. Phase set to
  `accept`.
- 2026-09-18 — feature 061 (Settings — Appearance color scheme switcher)
  tested: 783 → 793 net (+10, all passing; re-run twice, stable) across
  config.test.ts (+3, persistence/default), ipc.test.ts (+2, IPC
  round-trip + broadcast), and a new "Appearance (061)" block in
  SettingsView.test.tsx (+5, AC1-AC4 at the UI level). main.tsx's own
  bootstrap application of the theme is deliberately not covered — no
  existing test of any kind covers that module-level entry script, and
  its two behaviors (persistence, broadcast payload) are already
  covered independently. Phase set to `validate`.
- 2026-09-18 — feature 061 (Settings — Appearance color scheme switcher)
  implemented: new "Appearance" config category end to end (data-types,
  ConfigStore's appearance.json, IPC get/set + a broadcastAppearanceChanged
  cross-window sync), a Settings section with a scheme `<select>` that
  applies immediately (no Save button, matching AC2's wording) and
  persists, and main.tsx applying the persisted scheme with
  `document.documentElement.dataset.theme` on every window's own
  bootstrap plus live updates via the broadcast. Also updated the shared
  mockApi.ts and the ipc.test.ts channel-list assertion, both required by
  their own types/assertions to compile/pass against the new API surface
  (not new feature-specific coverage — that's `/test`'s job). lint/
  typecheck/build/full-suite (783/783, unchanged) all pass. Phase set to
  `test`.
- 2026-09-18 — feature 060 (Dark color scheme) accepted by user
  (selected "Accept (Recommended)" against the validation summary and
  AC-by-AC mapping, no changes requested — after an initial "Reject"
  click was clarified by the user as accidental); logged to CHANGELOG.
  Active feature set to 061 (Settings — Appearance color scheme
  switcher, next in BACKLOG.md table order), phase set to `implement`.
- 2026-09-17 — feature 060 (Dark color scheme) validated: lint/
  typecheck/build pass; full suite (783/783) re-run 3x, stable;
  `git diff --stat` (56c893d..HEAD) confirms `/implement`+`/test` touched
  only expected files. All 4 ACs re-verified with independent Python
  scripts (not just re-running the test file): AC1 dark block has all
  23 tokens, pane/ribbon/nav-rail luminance 0.0085/0.0174/0.0135
  (genuinely dark); AC2 dark's token-name set is identical to
  default/sage/plum's; AC3 an independent WCAG contrast implementation
  confirms text/text-muted/accent on --pane-bg (7.35-14.9:1), white on
  --primary-bg (5.2:1), and the standalone-text tokens --danger-border/
  --success/--flag-border against the backgrounds they actually render
  on (5.96-8.16:1) all clear 4.5:1; AC4 no layout property anywhere in
  the dark block, no disclosed exceptions needed. All checks pass, no
  gaps found. Phase set to `accept`.
- 2026-09-17 — feature 060 (Dark color scheme) tested: 776 → 783 net
  (+7, all passing; re-run twice, stable), all in
  `globalCssStyling.test.ts`'s new "dark color scheme (060)" block. AC1
  checks the full 23-token set plus that pane/ribbon/nav-rail
  backgrounds are genuinely dark (relative luminance < 0.1). AC2 checks
  the exact token-name set matches every other scheme. AC3 checks WCAG
  contrast (>=4.5:1) for text/text-muted/accent on --pane-bg, white on
  this scheme's --primary-bg, and the standalone-text tokens
  (--danger-border/--success/--flag-border) against the actual
  background they render on in the app. AC4 no layout property in the
  dark block. Phase set to `validate`.
- 2026-09-17 — feature 060 (Dark color scheme) implemented: added a
  `:root[data-theme='dark']` block to global.css with the same 23-token
  set as the other schemes, dark backgrounds throughout (including
  --pane-bg, unlike 059's light schemes). Most status tokens kept
  identical to other schemes (self-contained pairs); --danger-border and
  --success brightened since both are also used as standalone text on
  dark backgrounds and the light-tuned values fail WCAG AA there.
  Phase set to `test`.
- 2026-09-17 — feature 059 (Two additional light color schemes) accepted
  by user (selected "Accept (Recommended)" against the validation
  summary and AC-by-AC mapping, no changes requested); logged to
  CHANGELOG. Active feature set to 060 (Dark color scheme, next in
  BACKLOG.md table order), phase set to `implement`.
- 2026-09-17 — feature 059 (Two additional light color schemes)
  validated: lint/typecheck/build pass; full suite (776/776) re-run 3x,
  stable; `git diff --stat` (0114c28..57be71e) confirms `/implement`+
  `/test` touched only expected files. All 4 ACs re-verified with
  independent scripts (not just re-running the test file): AC1/AC2 a
  fresh Node script confirms all three schemes define the identical
  23-token set; AC3 an independent Python WCAG contrast implementation
  confirms sage/plum both clear 4.5:1 (5.13-8.24:1 range) and that
  accent/primary-bg/text are pairwise distinct across all three schemes;
  AC4 zero layout properties anywhere in the feature's diff, no
  disclosed exceptions needed this time. All checks pass, no gaps found.
  Phase set to `accept`.
- 2026-09-17 — feature 059 (Two additional light color schemes) tested:
  769 → 776 net (+7, all passing; re-run 3x, stable), all in
  `globalCssStyling.test.ts`'s new "two additional light color schemes
  (059)" block. AC1 checks each scheme's full 23-token set; AC2 turns
  the ad-hoc token-name-set-equality check from `/implement` into a
  permanent test; AC3 adds a real WCAG relative-luminance contrast
  calculator (written in the test file) confirming both new schemes
  clear 4.5:1 for muted text and white-on-primary-button text, plus
  pairwise distinctness across all three schemes' accent/primary/text
  hues; AC4 confirms no layout property appears in either new scheme's
  block. Deliberately uncovered: actual rendered appearance (jsdom
  doesn't load the stylesheet) and any end-to-end switch-and-see-it-
  change flow (no Settings UI yet — that's feature 061). lint/typecheck/
  build all pass. Test Notes filled in; phase set to `validate`.
- 2026-09-17 — feature 059 (Two additional light color schemes)
  implemented: two new `:root[data-theme='sage']`/`:root[data-theme='plum']`
  blocks in `global.css`, mirroring 058's exact structure (including its
  post-acceptance `--primary`/filled-button revision) — no component/JSX
  changes needed, since every themed surface already reads colors only
  through tokens. Each scheme gets its own neutral chrome + accent/
  primary hue (green/purple respectively); `--pane-bg` stays white in
  both; semantic status colors (danger/warning/success/flag) kept
  identical across all light schemes on purpose. AC1 verified
  structurally — all three scheme blocks define the exact same 23-token
  set, so switching can never leave a surface with an undefined value.
  Contrast checked by hand against WCAG's luminance formula for the two
  highest-risk pairs (muted text, white-on-primary), both schemes
  comfortably clear 4.5:1. Generalized `globalCssStyling.test.ts`'s
  "no hex outside a token block" helper to a `KNOWN_THEMES` list so 060's
  dark scheme won't need a parallel regex. lint/typecheck/build pass;
  full suite unchanged at 769/769; `git diff` confirms zero layout
  properties touched. Phase set to `test`.
- 2026-09-17 — feature 058 (Color scheme infrastructure + revised default
  palette) accepted by user: after the initial /validate pass, the user
  pushed their own manual styling edits (filled-button look, new
  `--primary` token, simplified ribbon actions, flagged-state color
  intentionally removed). Found and fixed one real regression from that
  pass (invisible white-on-white error text after `--danger` was
  remapped to white) after the user confirmed the fix and confirmed the
  flagged-state removal was intentional; updated tests to match the
  final design. Re-validated (769/769, lint/typecheck/build clean), then
  user selected "Accept (Recommended)"; logged to CHANGELOG. Active
  feature set to 059 (Two additional light color schemes, next in
  BACKLOG.md table order, directly building on 058's infrastructure),
  phase set to `implement`.
- 2026-09-17 — feature 058 (Color scheme infrastructure + revised default
  palette) validated: lint/typecheck/build pass; full suite (768/768)
  re-run 3x, stable; `git diff --stat` (1ee7b5d..844db12) confirms the
  whole feature (palette revision + button-coloring addition) touched
  only expected files. All 5 ACs re-verified directly against current
  source: AC1 every hex color lives inside `:root[data-theme='default']`,
  none outside it; AC2 `data-theme="default"` + tokens gated behind that
  selector, never duplicated in the plain `:root`; AC3 037's tests still
  pass, the 5 grayest original tokens confirmed changed, `--pane-bg`
  stays white; AC4 zero layout-property changes across the entire diff,
  one disclosed `opacity` exception for disabled-button dimming judged
  in-scope; AC5 the color-class lookup is gated on a real handler,
  confirmed disabled ribbon actions never get colored, and all 3
  `ReadingPane.tsx` branches carry their new classes. Not independently
  re-verified: rendered appearance in a live browser (no attached
  display) — the palette revision itself got the user's own live look
  earlier, but the newer button-coloring addition hasn't yet; worth a
  glance during `/accept`. All checks pass, no blocking gaps. Phase set
  to `accept`.
- 2026-09-17 — feature 058 (Color scheme infrastructure + revised default
  palette): after seeing the revised palette live (post-`/test`, before
  `/validate`), the user asked for semantic button coloring — Delete red,
  New Email/Reply/Reply All/Forward blue, Mark-as-(un)read gray, Flag
  amber. Added as AC5 to the feature file and implemented on the two
  surfaces where these actions are actually wired (ribbon Home tab's New
  Email/Delete; Reading Pane's full action row) — MessageContextMenu's
  equivalent items deliberately left unstyled (menu items, not toolbar
  buttons) and flagged as a scoping choice. New `--flag`/`--flag-bg`/
  `--flag-border` tokens; everything else reuses existing 037/058 tokens.
  Disabled ribbon actions (Reply/Reply All/Forward/New Items have no
  handler) never get a color class, and gained a `:disabled` dimming
  rule they were missing before (a latent pre-existing gap). New tests:
  768 total (was 759), stable across 3 runs; lint/typecheck/build pass.
  Feature file's Implementation/Test Notes updated with a dated addendum
  documenting this as a user-directed addition, not silently folded into
  the original scope. Status remains `validating`.
- 2026-09-17 — feature 058 (Color scheme infrastructure + revised default
  palette) tested: 755 → 759 net (+4, all passing; re-run 3x, stable),
  all in `globalCssStyling.test.ts`'s new "color scheme infrastructure
  (058)" block. AC2 covered by reading the real `index.html`/`global.css`
  off disk: `<html>` carries `data-theme="default"`, and — the meaningful
  check — the color tokens exist ONLY inside `:root[data-theme='default']`,
  never duplicated in the plain `:root` (which would silently defeat
  switching). AC1/AC3 covered by asserting the 5 grayest 037-era tokens
  are no longer their exact original hex values (catches a partial
  revert, not just any edit) plus a lock-in that `--pane-bg` stayed pure
  white. AC4 (no layout changes) and the actual rendered appearance
  remain manual/inspection-only, same non-blocking category as every
  prior pure-CSS feature (037/042). lint/typecheck/build all pass. Test
  Notes filled in; phase set to `validate`.
- 2026-09-17 — feature 058 (Color scheme infrastructure + revised default
  palette) implemented: `<html>` gains `data-theme="default"`
  (`index.html`), and `global.css`'s color tokens moved from the bare
  `:root { ... }` block into `:root[data-theme='default'] { ... }` — the
  switch point for future schemes (059/060) and Settings (061), each just
  another selector/attribute value. Non-color radius tokens (037) stay in
  the unconditional bare `:root`. Revised the default palette's flat
  neutral grays into a soft blue-tinted family (border/ribbon-bg/
  nav-rail-bg/hover-bg/text-muted), deepened accent/selected-border
  slightly; `--pane-bg` stays pure white for content readability; 037's
  semantic status colors left untouched. Updated `globalCssStyling.test.ts`'s
  token-extraction helper to match the new selector (037's actual
  guarantees unchanged, just relocated) — new dedicated tests for 058's
  own ACs left for `/test`. Confirmed via the actual `npm run build`
  output that `data-theme` survives Vite's HTML processing. lint/
  typecheck/build pass; full suite unchanged at 755/755 (CSS-only change,
  jsdom doesn't load the stylesheet — same pre-existing gap as every
  prior CSS feature). Phase set to `test`.
- 2026-09-17 — feature 065 (Mail — LLM-generated incoming attachments)
  accepted by user (selected "Accept (Recommended)" against the
  validation summary and the full two-round live-testing/fix history, no
  further changes requested); logged to CHANGELOG. This was the last
  `backlog`-status high-priority feature — remaining backlog is all
  medium/low priority. Active feature set to 058 (Color scheme
  infrastructure + revised default palette, next in BACKLOG.md table
  order), phase set to `implement`.
- 2026-09-17 — feature 065 (Mail — LLM-generated incoming attachments):
  user re-tested live after the second fix round and confirmed a real
  generated attachment now actually appears. The last open item
  (live-model-compliance) is closed; all checks pass with nothing
  outstanding. Ready for `/accept`.
- 2026-09-17 — feature 065 (Mail — LLM-generated incoming attachments),
  second fix round: the first fix worked in one sense (the model started
  using the `---ATTACHMENT:---` marker), but a second round of the user's
  live testing showed the raw, unrendered Markdown block sitting in the
  message body instead of a real attachment. Diagnosed by pulling the
  exact failed message straight from the live SQLite db: the model wrote
  a full 6-part, ~3,500-character OCF-3 legal form and simply never came
  back to append the required closing `---END ATTACHMENT---` marker — a
  required closing marker is inherently fragile for exactly the kind of
  long document this feature exists to generate. Redesigned the protocol
  to need no closing marker at all — a document's content now runs from
  its marker line to the next marker (or end of response); a model that
  still writes a closing marker gets it stripped for a clean result, but
  it's optional. Also hardened `extractAttachmentBlocks` against an
  unnamed marker silently discarding real trailing content. Re-verified
  by running the trainee's exact previously-failed raw response (read
  byte-for-byte from the live db) through the new code: now correctly
  extracts the complete document. Full suite 753 → 755, stable; lint/
  typecheck/build pass. Feature file's notes updated again; status
  remains `accept`, still pending the user's own live re-test.
- 2026-09-17 — feature 065 (Mail — LLM-generated incoming attachments):
  before running `/accept`, the user live-tested against a real Anthropic
  API and reported a persona claimed to send attachments that never
  appeared in the UI. Diagnosed directly against the live app's own
  SQLite db (`~/.config/outlook-sim/outlook-sim.db`): the model narrated
  fictional attachments in prose but never once emitted the
  `---ATTACHMENT---` protocol block across 37 real messages — a prompt-
  compliance gap, not a UI or parsing bug. Fixed by (1) rewording
  `ATTACHMENT_PROMPT_INSTRUCTION` into an explicit two-way rule (narrating
  an attachment without its block, or vice versa, is now a stated
  violation) and (2) generalizing the protocol from one attachment per
  response to `extractAttachmentBlocks` (plural) supporting several
  interleaved blocks, matching the real failure shape (a model listing
  multiple realistic documents) instead of fighting it; also fixed a
  formatting bug caught during re-verification where removing a block ate
  the paragraph break after it. Re-verified live by replaying the actual
  failing message (Danny Ferreira's multi-attachment reply) through the
  fixed code. New regression tests added (751 → 753, stable); lint/
  typecheck/build pass. Feature file's Implementation/Test/Validation
  Notes updated to document the gap and fix; status remains `accept` —
  ready for the user to re-run `/accept` (optionally after confirming
  live once more, since AC1's real-provider compliance is inherently a
  manual check, same category as this project's other live-LLM ACs).
- 2026-09-17 — feature 065 (Mail — LLM-generated incoming attachments)
  validated: lint/typecheck/build pass; full suite (751/751) re-run 3x,
  stable; `git diff --stat` (1b39043..31fa317) confirms `/implement`+
  `/test` touched only the expected files. All 4 ACs re-verified directly
  against current source: AC1 both generators import/append the shared
  `ATTACHMENT_PROMPT_INSTRUCTION` and run `extractAttachmentBlock` before
  any other response parsing; AC2 the same `app.getPath('userData')`
  value already used by `MailDb`/`ConfigStore`/`SimClock` is threaded
  into `writeGeneratedAttachment`, which writes a real rendered HTML
  file there; AC3 the new `attachments:open` (`shell.openPath`) handler
  is wired into `ReadingPane.tsx`'s attachment click handler, also
  closing a gap feature 062 left open for real outgoing attachments; AC4
  falls out of AC2's durable-directory choice plus `MailDb`'s unchanged
  JSON persistence, proven live during `/implement`; AC5 confirmed both
  by the prompt's explicit "most emails do NOT need one" wording and
  structurally (`attachments: []` unless the model actually included a
  block), with every pre-existing test in both generator files passing
  unmodified. All checks pass, no gaps found. Phase set to `accept`.
- 2026-09-17 — feature 065 (Mail — LLM-generated incoming attachments)
  tested: 733 → 751 net (+18, all passing; re-run 3x, stable) across 4
  files. New `generatedAttachment.test.ts` (+12) covers
  `extractAttachmentBlock` (well-formed/absent/malformed/empty blocks) and
  `writeGeneratedAttachment` (real file on disk with rendered content,
  `.html` forced regardless of requested extension, path-traversal
  filenames contained, embedded `<script>` stripped, no collisions between
  same-named attachments). `personaReply.test.ts` (+3) and
  `scheduler.test.ts` (+2) cover both real generators end-to-end: a
  response with a block produces a real generated attachment and a clean
  body; a response without one leaves `attachments: []` unaffected (AC5);
  and (personaReply only) a block riding along with `NO_REPLY` is
  discarded entirely, nothing written or created. `ReadingPane.test.tsx`
  (+1) covers AC3: a real-`path` attachment click opens via
  `window.api.attachments.open` instead of the mock placeholder, with the
  existing mock-attachment test tightened to assert that API is never
  called for a `path`-less attachment. Deliberately uncovered: the
  `attachments:open`/`extractText` IPC handlers' actual `shell`/`dialog`
  delegation (no established main-process mocking pattern in this repo,
  same as other dialog-wrapping handlers) and a live OS file-association
  double-click (no attached display). lint/typecheck/build all pass. Test
  Notes filled in; phase set to `validate`.
- 2026-09-17 — feature 065 (Mail — LLM-generated incoming attachments)
  implemented: new `src/main/llm/generatedAttachment.ts` defines a shared
  protocol — a persona reply or unsolicited-mail response may end with a
  fenced `---ATTACHMENT: <filename>---\n<Markdown>\n---END ATTACHMENT---`
  block, anchored to the end of the raw text regardless of the surrounding
  format. `extractAttachmentBlock()` never throws (missing/malformed block
  → no attachment, AC5); `writeGeneratedAttachment()` renders the Markdown
  via `marked`, sanitizes it with a new `sanitize-html` dependency (a
  lightweight Node-native alternative to the renderer's `marked`+
  `DOMPurify` pairing, which needs a browser DOM this main-process code
  doesn't have), and writes a real HTML file under
  `<userDataDir>/generated-attachments/<uuid>/`, reusing the `path`/
  `extractedText` fields features 062/063 already added (no schema
  change). Both generators gained a `userDataDir` parameter threaded from
  `main/index.ts` (same value already passed to `MailDb`/`ConfigStore`/
  `SimClock`). AC3 (reachable from the UI) added a new `attachments:open`
  IPC handler (`shell.openPath`) wired into `ReadingPane.tsx`'s existing
  attachment click handler — which also fixes a pre-existing gap: a real
  outgoing attachment (feature 062) previously still showed the stale
  "Mock attachment" placeholder, since 062/063 never touched
  `ReadingPane.tsx`. Verified live end-to-end via a throwaway script with
  a stubbed `fetch`: both generators produce a real file on disk with
  correct content and a clean email body when the model includes a block,
  `attachments: []` when it doesn't; reopening the db (simulating a
  restart) still returns the attachment; a hostile filename and an
  embedded `<script>` tag were both neutralized. ~50 pre-existing test
  call sites needed a mechanical new-parameter fix (compile-shape only,
  using each test file's own existing temp-dir fixture) — no behavioral
  rewrite. lint/typecheck/build pass; full suite unchanged at 733/733.
  Phase set to `test`.
- 2026-09-17 — feature 063 (Mail — extract real attachment content into
  persona LLM context) accepted by user (selected "Accept (Recommended)"
  against the validation summary, AC-by-AC mapping, and the flagged
  `.pptx`-only scoping call, no changes requested); logged to CHANGELOG.
  Active feature set to 065 (Mail — LLM-generated incoming attachments,
  next in BACKLOG.md table order), phase set to `implement`.
- 2026-09-17 — feature 063 (Mail — extract real attachment content into
  persona LLM context) validated: lint/typecheck/build pass; full suite
  (733/733) re-run 3x, stable; `git diff --stat` (9839f64..259ac2c)
  confirms `/implement`+`/test` touched only the expected files (plus
  checked-in binary fixtures). All 4 ACs re-verified directly against
  current source: AC1 extraction happens only at send time and flows into
  the same `fields` object used for both draft-update and sent-create;
  AC2 extracted content lands in the LLM user-prompt as a labeled block,
  with the "live LLM references it" half flagged as an inherently manual
  check (same category as other live-LLM ACs); AC3 confirmed against real
  fixture files for all 6 supported formats, with one scoping note
  surfaced — only modern `.pptx` is supported, not legacy binary `.ppt`
  (graceful "unsupported" fallback per AC4, but flagged for explicit user
  sign-off at `/accept` since the AC's literal wording groups PPT with
  PPTX); AC4 confirmed both at the extraction-function level (try/catch,
  never throws) and end-to-end (Compose still sends on a failed/unsupported
  extraction). All checks pass; the one open item is a scoping
  interpretation flagged for the user, not a defect. Phase set to `accept`.
- 2026-09-17 — feature 063 (Mail — extract real attachment content into
  persona LLM context) tested: 714 → 733 net (+19, all passing; re-run 3x,
  stable) across 3 files. New `attachmentExtraction.test.ts` (+13) is the
  core coverage, against real fixture files (checked into
  `src/main/llm/attachmentFixtures/`, generated via LibreOffice headless
  conversion so the real `officeparser` parsing path is exercised, not a
  mock) — one per supported format, plus AC4's unsupported/corrupted/
  missing/empty-file cases and the 4000-char truncation cap.
  `personaReply.test.ts` (+2) covers AC2's prompt-wiring half — extracted
  content appears in a labeled block in the LLM user-prompt when present,
  omitted when absent — leaving AC2's "live LLM response references it"
  half as the same category of manual check as this project's other
  live-LLM ACs. `ComposeWindow.test.tsx` (+4) covers AC1/AC4 end-to-end:
  extraction happens (and persists) only at send time, an
  unsupported/failed extraction still sends normally, and re-sending an
  already-extracted attachment doesn't re-extract. Deliberately
  uncovered: the `attachments:extractText` IPC handler itself (pure
  delegation, same untested-wrapper convention as this repo's other
  `dialog`-adjacent handlers). lint/typecheck/build all pass. Test Notes
  filled in; phase set to `validate`.
- 2026-09-17 — feature 063 (Mail — extract real attachment content into
  persona LLM context) implemented: new `src/main/llm/attachmentExtraction.ts`
  dispatches by extension — `.txt`/`.csv` read directly as text,
  `.pdf`/`.docx`/`.xlsx`/`.pptx` via the new `officeparser` dependency
  (pinned to the 5.x line specifically to avoid its 6.0.0+ tesseract/OCR
  dependency, which this project deliberately has none of); anything
  unsupported or any extraction error resolves to `undefined`, never
  throws. New `attachments:extractText` IPC + preload exposure;
  `MessageAttachment` gained `extractedText?: string`, truncated at 4000
  chars mirroring feature 049's FileVine convention. `ComposeWindow.tsx`'s
  `persist()` extracts text per attachment only at send time (not on draft
  autosave), idempotently. `personaReply.ts`'s thread transcript now
  appends each attachment's extracted content as a labeled block after the
  message body. Verified live: real LibreOffice-generated fixture files
  (docx/xlsx/pptx/pdf/txt/csv, each with a unique marker string) all
  extracted correctly via a throwaway script; unsupported extension and
  missing file both degraded to `undefined` without throwing.
  lint/typecheck/build pass; full suite unchanged at 714/714 (all new
  fields optional). Phase set to `test`.
- 2026-09-17 — feature 062 (Mail — real outgoing attachments (file picker))
  accepted by user (selected "Accept (Recommended)" against the validation
  summary, AC-by-AC mapping, and diff, no changes requested); logged to
  CHANGELOG. Active feature set to 063 (Mail — extract real attachment
  content into persona LLM context, next in BACKLOG.md table order), phase
  set to `implement`.
- 2026-09-16 — feature 062 (Mail — real outgoing attachments (file picker))
  validated: lint/typecheck/build pass; full suite (714/714) re-run 3x,
  stable; `git diff --stat` (734dd28..c37e44c) confirms `/implement`+`/test`
  touched only the expected files. All 4 ACs re-verified directly against
  current source: AC1 `attachments:pick` mirrors the `scenario:pickPack`/
  `personasFile:pick` `dialog.showOpenDialog` pattern exactly, and the old
  text-input form is fully gone from `ComposeWindow.tsx`; AC2 the picked
  `path` flows through `persist()`'s single `fields` object into both
  draft-update and sent-create calls, and `MailDb` round-trips the
  attachments array via plain JSON with no per-field allow-list, so `path`
  survives; AC3 the append/remove logic is unchanged from before this
  feature, only the attachment source changed; AC4 the dialog config has no
  `filters` option (unlike the two JSON-only handlers it's modeled on).
  Not independently re-verified: a live OS dialog / real Electron
  click-through (no attached display, same non-blocking gap as every prior
  `dialog`-touching feature). All checks pass, no gaps found. Phase set to
  `accept`.
- 2026-09-16 — feature 062 (Mail — real outgoing attachments (file picker))
  tested: 713 → 714 net (+1, all passing; re-run 3x, stable), all within
  `ComposeWindow.test.tsx`. Rewrote the 5 tests `/implement` left failing
  (driving the removed text-input UI) to mock `window.api.attachments.pick`
  and use the new "Add attachment..." button instead — covers multiple
  attachments added in sequence, a canceled dialog adding nothing, chip
  removal, and both reply/forward Sent-copy tests now asserting the `path`
  field round-trips. Added one new test: picking a file with an unusual
  extension succeeds (AC4, no type filtering). While rewriting, found and
  fixed a real bug from `/implement`: the field's `<label htmlFor=...>`
  still pointed at the button's `id`, and since `<button>` is a native
  labelable element, the label's text silently overrode the button's own
  accessible name, breaking every `getByRole` lookup for it — fixed by
  making the caption a plain, unassociated `<span>` and restoring matching
  CSS (also replacing now-dead `.compose-attachment-add-form` rules left
  over from the removed mock form). lint/typecheck/build all pass. Test
  Notes filled in; phase set to `validate`.
- 2026-09-16 — feature 062 (Mail — real outgoing attachments (file picker))
  implemented: new `attachments:pick` IPC handler in `main/index.ts` mirrors
  the existing `scenario:pickPack`/`personasFile:pick` `dialog.showOpenDialog`
  pattern (no file-type filter or JSON validation needed — any file type is
  attachable), returning `{ ok: true, filename, path }` or
  `{ ok: false, canceled: true }` (new `PickAttachmentResult` type), using
  `BrowserWindow.fromWebContents(event.sender)` so the dialog is modal to the
  Compose window itself rather than always `mainWindow`. `MessageAttachment`
  gained an optional `path` field; `ComposeWindow.tsx`'s old
  text-input-plus-form mock UI is replaced by a single "Add attachment..."
  button wired to `window.api.attachments.pick()`, feeding the same
  `attachments` state persistence already handles unchanged. Exposed through
  preload + a mock entry in `test/mockApi.ts`. Left the 5 pre-existing
  `ComposeWindow.test.tsx` attachment tests (driving the old text-input UI)
  failing for `/test` to rewrite, per this repo's established convention;
  full suite otherwise green (708/713); lint/typecheck/build all pass. Phase
  set to `test`.
- 2026-09-16 — `/features` (iteration 3): decomposed the post-retro spec
  additions into 18 new backlog features (050-067). 8 small UI fixes
  (low priority, straight from "Ideas for next spec revision": persona
  editor inline-edit placement + Client checkbox alignment, Scenario
  Pack Load/Save spacing, removing the Home tab's dead placeholder
  buttons, flagged-row/flag-icon styling, message-list timestamps, Tasks
  panel Flagged-Mail unflag+pop-out controls, and a Tasks-section
  redesign). 4 color-scheme features (medium priority, split for
  independent shippability: scheme-switching infrastructure + revised
  default palette, two more light schemes, a dark scheme, and the
  Settings Appearance switcher). 6 attachment features replacing mock
  attachments (Core Requirement 3): real outgoing file picker (062) and
  content extraction into LLM context (063) and LLM-generated incoming
  HTML documents (065) as high priority — these replace the app's core
  mock-attachment behavior; multimodal image sending (064), saving a
  generated attachment into FileVine (066), and an attachment pop-out
  viewer (067) as medium priority, each layered on top of one of the
  three high-priority pieces. Cleared "Ideas for next spec revision" in
  `docs/SPEC.md` (all 8 items now have feature files). Active feature set
  to 062 (first backlog item by priority/table order), phase set to
  `implement`.
- 2026-09-16 — retro for iteration 2 closed: all 27 planned features
  (023-049) shipped and accepted, one "Request changes" round (046)
  addressed in the same pass, no rejections. Nothing surfaced a genuine
  spec-level gap; two implementation nuances flagged along the way (038
  search-text persistence across FileVine/Settings, 043 Cancel-returns-
  to-view) didn't need spec language. User then requested two follow-up
  UI fixes (Settings — Personas: open the edit panel inline under the
  persona being edited instead of a shared editor below the whole list;
  left-align the Client/`isClient` checkbox, mirroring the calendar event
  form's existing All-day-checkbox alignment fix) — queued in
  `docs/SPEC.md`'s "Ideas for next spec revision" for `/features` to
  turn into backlog directly, no Core Requirement changed. Outer
  iteration bumped to 3, phase set to `features`.
- 2026-09-16 — feature 045 (Simulated clock — black text and dropdown
  mini-calendar) accepted by user (selected "Accept (Recommended)", no
  changes requested); logged to CHANGELOG. This was the last
  `backlog`-status feature in `features/BACKLOG.md` — Active feature
  cleared, phase set to `retro`.
- 2026-09-16 — feature 045 (Simulated clock — black text and dropdown
  mini-calendar) validated: lint/typecheck/build pass; full suite
  (713/713) re-run 3x, stable; `git diff --stat` (b837c4e..027ed92)
  confirms `/test` touched only docs/test files, no implementation
  drift. All 5 ACs re-verified directly against current source: AC1
  `.office-clock-time` sets `color: var(--text)`; AC2 the clock button's
  `onClick` toggles the `role="dialog"` mini-calendar; AC3 today's grid
  cell gets `today` via the same live `computeDisplayTime` the clock
  itself uses; AC4 Previous/Next call only `setMiniCalendarAnchorMs`,
  nowhere near any `clock.pause/start/setSpeed` call; AC5 the readout
  only renders for a non-today selection, computed against the live
  simulated time. All checks pass, no gaps found. Phase set to `accept`.
- 2026-09-16 — feature 045 (Simulated clock — black text and dropdown
  mini-calendar) tested: 705 → 713 net (+8, all passing; re-run 3x,
  stable) across 2 files. `globalCssStyling.test.ts` (+1, AC1) statically
  confirms `.office-clock-time` uses `var(--text)`. `OfficeClock.test.tsx`
  (+7, AC2-AC5) covers open/close via repeat-click/Escape/outside-click,
  today's cell highlighting, Previous/Next explicitly asserting
  `clock.pause`/`start`/`setSpeed` are never called and the real
  displayed time stays unchanged, an exact "in 4 days, 14 hours" readout
  for a future day (hand-verified date math), "... ago" for a past day,
  and no readout for today itself. lint/typecheck/build all pass. Test
  Notes filled in; phase set to `validate`.
- 2026-09-16 — feature 045 (Simulated clock — black text and dropdown
  mini-calendar) implemented: scoped entirely to `OfficeClock.tsx` +
  CSS. AC1: `.office-clock-time` gained `color: var(--text)` (was
  inheriting the container's muted color). AC2: the clock display is now
  a `<button>` (was a `<span>`, styled identically) toggling a
  `miniCalendarAnchorMs` state, mirroring `RibbonBar`'s file-menu click-
  outside/Escape pattern. AC3/AC4: the mini-calendar reuses
  `calendarDates.ts`'s existing month-grid helpers (same math
  `CalendarView`'s own Month view uses) with its own anchor state fully
  separate from the real clock — Previous/Next never call any
  `clock.*` API; "today" highlight compares against the live simulated
  time each render. AC5: clicking another day computes "in N days, M
  hours" (or "... ago") against the live simulated time. Verified live
  via a throwaway RTL script (correct month/today highlight, nav leaves
  the real clock untouched, correct readout text, click-outside closes).
  lint/typecheck/build pass; full suite unchanged at 705/705. Phase set
  to `test`.
- 2026-09-16 — feature 044 (Double-click calendar item opens a pop-out
  window) accepted by user (selected "Accept (Recommended)", no changes
  requested); logged to CHANGELOG. Active feature set to 045 (Simulated
  clock — black text and dropdown mini-calendar, last remaining
  `backlog`-status feature in BACKLOG.md), phase set to `implement`.
- 2026-09-16 — feature 044 (Double-click calendar item opens a pop-out
  window) validated: lint/typecheck/build pass; full suite (705/705)
  re-run 3x, stable; `git diff --stat` (370eaf9..54e81fe) confirms
  `/test` touched only docs/test files, no implementation drift. All 4
  ACs re-verified directly against current source: AC1 double-click
  wired to `openPopout` in both day/month views, pop-out renders the
  real `CalendarItemPanel` starting in view mode; AC2
  `broadcastCalendarItemsChanged()` now fires from all 3
  `db:calendarItems:*` handlers, both windows subscribe and refetch,
  mirroring the messages pattern exactly; AC3 the pop-out is a genuinely
  separate `BrowserWindow`/process with zero reference to `App.tsx`'s
  state; AC4 the single-click handler is untouched and independent of
  the new double-click handler, and the full pre-existing
  `CalendarView.test.tsx` suite ran green throughout. All checks pass,
  no gaps found. Phase set to `accept`.
- 2026-09-16 — feature 044 (Double-click calendar item opens a pop-out
  window) tested: 688 → 705 net (+17, all passing; re-run 3x, stable)
  across 4 files. New `CalendarPopoutWindow.test.tsx` (+11) covers view/
  edit/recurrence-scope via the pop-out, save/delete closing the window,
  cross-window broadcast refetch, and the close-on-vanished fix found
  during `/implement`. `CalendarView.test.tsx` (+4) covers double-click
  opening the pop-out from both day and month views, single-click staying
  unaffected, and the main window's own broadcast refetch.
  `ipc.test.ts`/`windows.test.ts` (+1 each) mirror existing
  messages-changed-broadcast and same-icon-everywhere coverage for the
  new calendar mechanism/window. The pre-existing `CalendarView.test.tsx`
  suite (43 tests) ran unchanged and green throughout, serving as the
  refactor's own regression check. lint/typecheck/build all pass. Test
  Notes filled in; phase set to `validate`.
- 2026-09-16 — feature 044 (Double-click calendar item opens a pop-out
  window) implemented: extracted feature 043's view/edit/recurrence-scope
  state machine out of `CalendarView.tsx` into a new, prop-driven
  `CalendarItemPanel` component (pure code-motion, confirmed
  behavior-preserving — full suite passed unchanged afterward) so it can
  be reused by a new `CalendarPopoutWindow`. Added
  `broadcastCalendarItemsChanged()` (calendar items never broadcast
  cross-window before this feature) wired into the calendarItems IPC
  handlers, plus the standard pop-out plumbing (main/windows.ts,
  window:openCalendarPopout handler, preload API, main.tsx routing)
  mirroring feature 041. The pop-out reconstructs its exact occurrence via
  `expandOccurrences([series], originalStartTime, originalStartTime + 1)`
  and closes itself after save/delete or if the item vanishes elsewhere
  while open. Live verification caught and fixed a real bug: the
  close-on-vanished guard used `items.length` instead of a `hasFetched`
  flag, which failed specifically when the popped-out item was the only
  one and got deleted. lint/typecheck/build pass; full suite unchanged at
  688/688. Phase set to `test`.
- 2026-09-16 — feature 042 (View tab — Reading Pane Right/Off toggle)
  accepted by user (selected "Accept (Recommended)", no changes
  requested); logged to CHANGELOG. Active feature set to 044
  (Double-click calendar item opens a pop-out window, next in
  BACKLOG.md table order — 045 remains lower in the table), phase set
  to `implement`.
- 2026-09-16 — feature 042 (View tab — Reading Pane Right/Off toggle)
  validated: lint/typecheck/build pass; full suite (688/688) re-run 3x,
  stable; `git diff --stat` (3cbecaa..83802d5) confirms `/test` touched
  only docs/test files, no implementation drift. All 4 ACs re-verified
  directly against current source: AC1 the `<select>` is gated on
  `viewTabActive` with the two Right/Off options; AC2 `<ReadingPane>`
  renders only when `readingPaneMode === 'right'` and `.full-width`
  (`flex: 1 1 auto`, no border-right) fills the freed space; AC3 the
  double-click pop-out handler has zero dependency on `readingPaneMode`,
  and with no `<ReadingPane>` mounted there's nothing for a click to open
  inline; AC4 confirmed as a deliberate session-only `useState`, matching
  the AC's explicit permission. All checks pass, no gaps found. Phase set
  to `accept`.
- 2026-09-16 — feature 042 (View tab — Reading Pane Right/Off toggle)
  tested: 681 → 688 net (+7, all passing; re-run 3x, stable) across 3
  files. `RibbonBar.test.tsx` (+2) covers the control's View-tab scoping
  and prop/callback wiring (AC1). `MessageListPane.test.tsx` (+1) covers
  the `full-width` class (AC2 structural). `App.test.tsx` (+4) is the
  real end-to-end coverage: default Right, Off removes the inline pane
  with no dead placeholder and stops single-click from opening it while
  double-click still pops out (AC2/AC3), the list widens when Off (AC2),
  and switching back to Right restores both. lint/typecheck/build all
  pass. Test Notes filled in; phase set to `validate`.
- 2026-09-16 — feature 042 (View tab — Reading Pane Right/Off toggle)
  implemented: new `readingPaneMode: 'right' | 'off'` state in `App.tsx`
  (session-only — AC4 explicitly permits this, and a persisted config
  file felt disproportionate for a low-priority cosmetic toggle). A new
  labelled `<select aria-label="Reading Pane">` in `RibbonBar`'s View-tab
  action row (AC1) controls it. `<ReadingPane>` only renders when
  `'right'`; `<MessageListPane>` gets a new `fullWidth` prop applying a
  `.full-width` CSS class (`flex: 1 1 auto`, no border-right) so it fills
  the freed space instead of leaving a blank gap (AC2). AC3 (single-click
  no longer opens inline, double-click still pops out) fell out for free
  — no `<ReadingPane>` mounted means nothing for a click-driven selection
  to open, and the pop-out's `messagePopout.open` call is independent of
  it. Verified live via a throwaway full-App RTL script covering the
  whole flow both directions. lint/typecheck/build pass; full suite
  unchanged at 681/681 (no pre-existing test depended on Reading Pane
  visibility; two test files' shared prop-default helpers updated for
  the new required props, compile-shape only). Phase set to `test`.
- 2026-09-16 — feature 038 (Move mail search into the ribbon) accepted by
  user (selected "Accept (Recommended)", no changes requested); logged to
  CHANGELOG. Active feature set to 042 (View tab — Reading Pane Right/Off
  toggle, next in BACKLOG.md table order — 039-041/043/046/049/033-037
  are all done, 044/045 remain lower in the table), phase set to
  `implement`.
- 2026-09-16 — feature 038 (Move mail search into the ribbon) validated:
  lint/typecheck/build pass; full suite (681/681) re-run 3x, stable;
  `git diff --stat` (60dce6f..650727e) confirms `/test` touched only
  docs/test files, no implementation drift. All 4 ACs re-verified
  directly against current source: AC1 no search JSX remains in
  `MessageListPane.tsx`; AC2 `.ribbon-tabs`'s DOM order is tabs-list →
  `.ribbon-search` → `OfficeClock`, exactly as specified; AC3 the
  filtering pipeline itself is byte-for-byte unchanged, only the state
  declarations moved to props; AC4 `App.tsx`'s `showMailSearch` formula
  is identical to the pre-existing render condition that used to gate
  `MessageListPane`. One flagged-not-blocking item for `/retro`: search
  text now persists across FileVine/Settings toggles instead of
  resetting, a side effect of the relocation, not a regression against
  any AC. All checks pass, no gaps found. Phase set to `accept`.
- 2026-09-16 — feature 038 (Move mail search into the ribbon) tested: 674
  → 681 net (+7, all passing; re-run 3x, stable) across 3 files. The 7
  pre-existing `MessageListPane.test.tsx` search tests `/implement` left
  failing were rewritten to drive `searchQuery`/`searchScope` via
  props/rerender instead of typing into a removed input — same behaviors
  covered, no fallout beyond the trigger mechanism (AC3); +1 new test
  there confirms no search input renders locally (AC1).
  `RibbonBar.test.tsx` (+2) confirms the search box's conditional
  rendering, DOM position between the tab strip and the clock, and
  prop/callback wiring (AC1/AC2/AC3). `App.test.tsx` (+4) covers the real
  regression surface — `showMailSearch`'s visibility formula — end to
  end: absent from the message-list header, present across a real folder
  switch, hidden behind Settings/FileVine and restored on Home, and
  unaffected by the View tab/Tasks toggle (AC1/AC2/AC4). lint/typecheck/
  build all pass. Test Notes filled in; phase set to `validate`.
- 2026-09-16 — feature 038 (Move mail search into the ribbon) implemented:
  search state (`searchQuery`/`searchScope`) lifted from `MessageListPane`
  up to `App.tsx`, which now passes it to `RibbonBar` (new search
  input/select rendered in `.ribbon-tabs`, between the tab strip and the
  clock) and to `MessageListPane` (read-only, filtering logic unchanged).
  Visibility gated on the exact same condition that used to control
  whether `MessageListPane` rendered at all (`activeModule === 'mail' &&
  !showFileVine && !showSettings`), preserving AC4. Side effect flagged
  for `/retro`: search text now persists across FileVine/Settings toggles
  instead of resetting, since it no longer lives inside a component that
  unmounts — not locked in by any test, read as a minor improvement not a
  regression. Fixed the two test files' shared prop-default helpers for
  the new required props (compile-shape only, per feature 040's
  precedent), which resolved all but 7 pre-existing `MessageListPane`
  tests that genuinely test the old in-component search UI and need a
  real rewrite, left for `/test`. Verified live via a throwaway full-App
  RTL check (DOM placement, live filter, scope, folder-switch survival,
  hidden behind Settings). lint/typecheck/build pass. Phase set to `test`.
- 2026-09-16 — feature 037 (Element-level styling pass) accepted by user
  (selected "Accept (Recommended)", no changes requested); logged to
  CHANGELOG. Active feature set to 038 (Move mail search into the ribbon,
  next in BACKLOG.md table order), phase set to `implement`.
- 2026-09-16 — feature 037 (Element-level styling pass) validated:
  lint/typecheck/build pass; full suite (674/674) re-run 3x, stable;
  `git diff --stat` (0d14f1d..aac62a9) confirms `/test` touched only
  docs/test files, no implementation drift. All 4 ACs re-verified
  directly against current source: AC1 zero hex colors remain outside
  `:root` (independently `awk`+`grep`'d, not just trusting the test);
  AC2 all 39 `border-radius` declarations use a radius token, none
  hardcoded; AC3 both flag rules (`message-list-flag-btn.flagged`,
  `reading-pane-flag-toggle.flagged`) resolve to `var(--danger)`; AC4
  diffed the whole feature end-to-end and confirmed the only non-color/
  non-radius change anywhere is the new (then-empty) flag-toggle
  selector itself — no layout property touched. Not independently
  re-verified: actual rendered appearance in a live browser (no attached
  display), same non-blocking gap class as every prior feature. All
  checks pass, no gaps found. Phase set to `accept`.
- 2026-09-16 — feature 037 (Element-level styling pass) tested: 665 → 674
  net (+9, all passing; re-run 3x, stable), across new
  `src/main/globalCssStyling.test.ts` (+5, AC1/AC2/AC3: reads the real
  `global.css` off disk and asserts no hardcoded hex color exists outside
  `:root`, every `border-radius` uses a radius token, and both flag rules
  resolve to `--danger` — placed under `src/main/` since
  `tsconfig.web.json` has no Node types for `fs`/`path`) and
  `ReadingPane.test.tsx` (+4, AC3: the new flagged-class behavior verified
  across all 3 of its render branches — default, Drafts, Deleted Items).
  Deliberately not covered: actual computed styles in a live browser
  (jsdom doesn't load external stylesheets, a documented pre-existing
  gap) and AC4, verified by `git diff` inspection during `/implement`
  rather than a test. lint/typecheck/build all pass. Test Notes filled
  in; phase set to `validate`.
- 2026-09-16 — feature 037 (Element-level styling pass) implemented:
  scoped entirely to `src/renderer/src/styles/global.css` plus one small
  JSX change. AC1: every ad-hoc hex color replaced with new semantic
  `:root` tokens (`--hover-bg`, `--danger`/`-bg`/`-border`,
  `--warning`/`-bg`/`-border`, `--success`), consolidating 3 near-
  duplicate reds and 2 near-duplicate yellows into one value each. AC2:
  all 39 existing `border-radius` declarations converted to new
  `--radius`/`--radius-pill` tokens — a mechanical upgrade of elements
  that already had some radius (buttons/inputs/chips/dropdowns/cards);
  elements with none (ribbon tabs, nav-switcher, list rows, pane/column
  chrome) deliberately left alone per Core Requirement 2. AC3:
  `.message-list-flag-btn.flagged` recolored from accent-blue to
  `--danger`; `ReadingPane.tsx`'s Flag/Unflag button (all 3 branches, and
  by extension its pop-out reuse) gained a `flagged` class styled the
  same red, since it had no distinct flagged styling before. AC4: `git
  diff` confirms zero layout-affecting properties (padding/margin/width/
  height/flex/gap/position/display) changed anywhere, only
  color/background/border-color/border-radius values. lint/typecheck/
  build pass; full suite unchanged at 665/665 (jsdom doesn't load the
  external stylesheet, so no existing test could regress from a CSS-only
  change; the one markup change — a new className — isn't asserted by any
  existing test). Phase set to `test`.
- 2026-09-16 — feature 036 (App icon uses email.png) accepted by user
  (selected "Accept (Recommended)" against the validation summary and
  diff, no changes requested); logged to CHANGELOG. Active feature set to
  037 (Element-level styling pass, next in BACKLOG.md table order), phase
  set to `implement`.
- 2026-09-16 — feature 036 (App icon uses email.png) validated:
  lint/typecheck/build pass; full suite (665/665) re-run 4x total, stable;
  `git diff --stat` (1c42de4..5c73fcf) confirms `/test` touched only
  docs/test files, no implementation drift. All 3 ACs re-verified directly
  against current source: AC1 `ICON_PATH` resolves to the real
  `resources/email.png` (confirmed a genuine 512x512 RGBA PNG) and is
  passed to every `BrowserWindow`; AC2 all three window-creation functions
  share the identical `ICON_PATH` value, structurally guaranteeing match;
  AC3 independently re-ran `app-builder-lib`'s real `convertIcon` against
  the current `electron-builder.yml` config and got back a valid `.ico`
  (correct header, 3 embedded resolutions) with no manual conversion step.
  Not independently re-verified: live taskbar rendering (no attached
  display) and a full `npm run dist:win` NSIS build (needs Wine) — same
  non-blocking gap class as every prior feature. All checks pass, no gaps
  found. Phase set to `accept`.
- 2026-09-16 — feature 036 (App icon uses email.png) tested: 661 → 665 net
  (+4, all passing; re-run 3x, stable), across new `windows.test.ts` (+3,
  AC1/AC2: mocks `electron`'s `BrowserWindow` to verify the main window's
  icon resolves to the real `resources/email.png` on disk, and that the
  compose and message-pop-out windows get the identical icon value) and
  `buildIcon.test.ts` (+1, AC3: reads the real `electron-builder.yml`,
  confirms its `icon:` config points at a `.png` — not a hand-built `.ico`
  — with a valid PNG signature). Deliberately not covered: running the
  actual electron-builder icon conversion or `npm run dist:win`
  end-to-end (network/Wine dependency, avoided per this project's
  no-network-in-tests convention; conversion itself was verified by hand
  during `/implement`). lint/typecheck/build all pass. Test Notes filled
  in; phase set to `validate`.
- 2026-09-16 — feature 036 (App icon uses email.png) implemented: the
  session flagged at the start that `email.png` (referenced by both this
  feature and `docs/SPEC.md`) didn't exist anywhere in the repo or git
  history; the user then supplied the file, which was moved to
  `resources/email.png` (the standard electron-vite location, included in
  the packaged app's files by default). `electron-builder.yml` gained
  `win.icon: resources/email.png` — verified directly against
  `app-builder-lib`'s own icon-conversion code that this auto-generates a
  valid `.ico` at build time with no manual per-build step (AC3).
  `src/main/windows.ts` passes the same icon path to all three
  `BrowserWindow` constructors (main, compose, message pop-out) for
  taskbar/title-bar consistency across every window (AC1, AC2). Full
  Windows NSIS packaging wasn't run end-to-end (needs Wine on this Linux
  dev box); the icon-conversion step itself — the new/risky part — was
  verified in isolation instead. lint/typecheck/build all pass. Phase set
  to `test`.
- 2026-09-16 — feature 035 (File menu — About section) accepted by user
  (selected "Accept (Recommended)" against the validation summary, no
  changes requested); logged to CHANGELOG. Active feature set to 036 (App
  icon uses email.png, next in BACKLOG.md table order), phase set to
  `implement`.
- 2026-09-16 — feature 035 (File menu — About section) validated:
  lint/typecheck/build pass; full suite 661/661, re-run 3x, stable. All 4
  ACs re-checked directly against current source and pass — AC1 (About
  menuitem present), AC2 (version sourced via `app:getVersion` IPC ->
  Electron's `app.getVersion()` -> `package.json`, not hardcoded), AC3
  (link href/text exactly match the required GitHub URL), AC4 (target=
  "_blank" plus the main window's pre-existing, unmodified
  `setWindowOpenHandler`/`shell.openExternal` routing — verified by
  inspection since jsdom can't exercise Electron's own window-open
  handling). Phase set to `accept`.
- 2026-09-16 — feature 035 (File menu — About section) tested:
  `mockApi.ts` got the missing `app.getVersion` mock (fixed for real);
  `RibbonBar.test.tsx` got a new `About entry (035)` block (5 tests)
  covering the collapsed/expanded toggle, the version display sourced
  from `window.api.app.getVersion()`, the GitHub link's href/target, and
  About collapsing when the File menu closes. Full suite 656 → 661, all
  passing, re-run stable. Phase set to `validate`.
- 2026-09-16 — feature 035 (File menu — About section) implemented: the
  File menu (034) gets an About entry that expands an inline panel with
  the app version (via new `app:getVersion` IPC calling Electron's
  `app.getVersion()`, sourced from `package.json`) and a GitHub link that
  opens externally via the main window's existing `setWindowOpenHandler`
  (`shell.openExternal`) — no new main-process plumbing needed for that
  part. `src/renderer/src/test/mockApi.ts` has a known, expected typecheck
  failure (missing new `AppApi`) left for `/test` to fix for real, per
  this repo's established convention. Phase set to `test`.
- 2026-09-16 — feature 034 (Move Settings into the File menu) accepted by
  user (selected "Accept (Recommended)" against the validation summary
  and diff, no changes requested); logged to CHANGELOG. Active feature set
  to 035 (File menu — About section, next in BACKLOG.md table order),
  phase set to `implement`.
- 2026-09-16 — feature 034 (Move Settings into the File menu) validated:
  lint/typecheck/build pass; full suite 656/656, re-run 3x, stable. All 4
  ACs re-checked directly against current source and pass — AC1 (nav
  rail's Settings button gone, confirmed by grep and a dedicated test),
  AC2 (File tab opens a `role="menu"` with a Settings `menuitem`), AC3
  (Settings entry wires to the same `setShowSettings(true)`/`SettingsView`
  props as before, unchanged by diff), AC4 (✕ close affordance and its
  wiring untouched by this feature). Phase set to `accept`.
- 2026-09-16 — feature 034 (Move Settings into the File menu) tested:
  `RibbonBar.test.tsx` and `App.test.tsx` updated for the new File-menu
  path (the previously-failing assertions fixed for real, plus 6 new File
  menu tests and a new AC1 nav-rail test); full suite 649 → 656, all
  passing, re-run stable. Phase set to `validate`.
- 2026-09-16 — feature 034 (Move Settings into the File menu) implemented:
  `RibbonBar.tsx`'s File tab is now a clickable dropdown (`role="menu"`)
  with a Settings entry, mirroring `MessageContextMenu`'s click-outside/
  Escape pattern; the nav rail's Settings button is removed, `App.tsx`
  wires the same `setShowSettings(true)` through the new `onOpenSettings`
  prop instead. `RibbonBar.test.tsx` and `App.test.tsx` have known,
  expected failures (missing required prop / relocated Settings trigger)
  left for `/test` to fix for real, per this repo's established
  convention. Phase set to `test`.
- 2026-09-16 — feature 033 (Ribbon — hide Send/Receive and Folder tabs)
  accepted by user (selected "Accept (Recommended)" against the validation
  summary and diff, no changes requested); logged to CHANGELOG. Active
  feature set to 034 (Move Settings into the File menu, next in
  BACKLOG.md table order), phase set to `implement`.
- 2026-09-16 — feature 033 (Ribbon — hide Send/Receive and Folder tabs)
  validated: lint/typecheck/build pass; full suite 649/649, re-run 3x,
  stable. All 4 ACs re-checked directly against current source and pass —
  AC1/AC2 (Send/Receive and Folder no longer in `TABS`, no other render
  path exists), AC3 (Home/View/FileVine untouched, still wired and
  passing their existing tests), AC4 (`grep` across `src/` finds no
  leftover references outside an explanatory comment and the new test).
  Phase set to `accept`.
- 2026-09-16 — feature 033 (Ribbon — hide Send/Receive and Folder tabs)
  tested: `RibbonBar.test.tsx` updated for the removed tabs (the
  previously-failing assertions fixed for real, plus a new explicit
  not-rendered test for AC1/AC2); full suite 648 → 649, all passing,
  re-run stable. Phase set to `validate`.
- 2026-09-16 — feature 033 (Ribbon — hide Send/Receive and Folder tabs)
  implemented: `RibbonBar.tsx`'s `TABS` array shrunk to drop Send/Receive
  and Folder, which were always-disabled placeholders with no other wired
  logic to remove. `RibbonBar.test.tsx` still asserts on the removed tabs
  and is expected to fail until `/test` updates it, per this repo's
  established convention. Phase set to `test`.
- 2026-09-16 — feature 049 (FileVine content feeds persona LLM context)
  accepted by user; logged to CHANGELOG. AC3 (live LLM referencing
  specific content) flagged as inherently manual and accepted with that
  understanding. Active feature set to 033 (Ribbon — hide Send/Receive and
  Folder tabs, next in BACKLOG.md table order), phase set to `implement`.
- 2026-09-16 — feature 049 (FileVine content feeds persona LLM context)
  validated: lint/typecheck/build pass; full test suite (648/648) re-run
  3x, stable; confirmed via `git diff --stat` (7ebd663..a8dd074) that
  `/test` touched only test/doc files, no implementation drift. All 4 ACs
  re-verified directly against current source: AC1 the helper's
  folder/note assembly and its wiring into both `buildSystemPrompt`
  functions; AC2 the no-folder `null` return runs through the exact same
  `.filter(Boolean)` every other optional prompt section already relies
  on, confirmed no other line in either `buildSystemPrompt` changed; AC3
  re-confirmed as inherently a live/manual check (a stubbed `fetch` can't
  prove a real model chooses to reference content) — flagged for the
  user's own confirmation, not treated as a gap blocking acceptance; AC4
  the helper has no cache at all, structurally and by test. No live
  multi-window Electron GUI click-through attempted — same non-blocking
  gap as every prior feature. All checks pass; the one open item (AC3) is
  inherently manual, not a defect. Phase set to `accept`.
- 2026-09-16 — feature 049 (FileVine content feeds persona LLM context)
  tested: 632 → 648 net (+16, all passing; re-run 3x, stable), across new
  `fileVineContext.test.ts` (+9, unit-level: null cases, name+content
  inclusion, multi-folder aggregation, cross-persona exclusion, an
  explicit "no notes/files yet" line for an empty folder, truncation of a
  very large note vs. no truncation of a small one, immediate reflection
  of an update) plus `personaReply.test.ts`/`scheduler.test.ts` (+4/+3,
  AC1/AC2/AC4 each, asserting the actual system-prompt content sent to the
  LLM). AC3 (a live LLM response referencing specific content) deliberately
  left uncovered by automated tests — it needs a real provider response,
  not a stubbed one, so it's a manual step for the user against their own
  API key. lint/typecheck/build all pass. Test Notes filled in; phase set
  to `validate`.
- 2026-09-16 — feature 049 (FileVine content feeds persona LLM context)
  implemented: new `main/llm/fileVineContext.ts`'s
  `buildFileVineContextPrompt(db, personaId)` finds every FileVine folder
  with `clientPersonaId === personaId`, formats each folder's notes (name
  + content, truncated at 4000 chars per note as the "reasonable summary"
  for anything very large) into a prompt section, and returns `null` for
  no-folder personas so the existing `filter(Boolean)` prompt assembly
  omits it entirely (AC2, structural). Wired into both `personaReply.ts`
  (feature 015) and `scheduler.ts` (feature 016)'s `buildSystemPrompt`
  functions, right alongside `persona.bio`/`extraPrompt`. AC4 (no stale
  caching) needed no code — the helper always re-reads fresh from `db`,
  same as every other context source these builders already assemble.
  Verified live: a standalone `esbuild`-bundled script (real `MailDb`/
  `ConfigStore`, stubbed `fetch`) confirmed the LLM-bound system prompt
  includes specific note content + folder name for an associated persona,
  omits the section entirely for one with no folder, and reflects a note
  edit on the very next call with the old content gone. AC3 (a live LLM
  response actually referencing the content) needs a real provider/API
  key — flagged for the user's own manual confirmation, same category as
  every prior feature's no-attached-display GUI gap. lint/typecheck/build
  pass; existing `personaReply.test.ts`/`scheduler.test.ts` unchanged,
  39/39. Phase set to `test`.
- 2026-09-16 — feature 046 (Tasks side panel) accepted by user; logged to
  CHANGELOG. Active feature set to 049 (FileVine content feeds persona LLM
  context, next in BACKLOG.md table order — 033-045 excluding 043/046 are
  lower `low`-priority rows further down the table), phase set to
  `implement`.
- 2026-09-16 — feature 046 (Tasks side panel) validated (requested-changes
  round): lint/typecheck/build pass; full suite (632/632) re-run 3x,
  stable; `git diff --stat` (2eceff4..7d5c3dc) confirms `/test` touched
  only test/doc files. Re-verified both requested changes directly against
  current source: the add-row precedes the list in `TasksPanel.tsx`'s JSX;
  both `.tasks-panel-flagged-item` and `.tasks-panel-task` carry the
  shared-border-top/last-child-border-bottom divider pattern in
  `global.css`, consistent with this codebase's existing `var(--border)`
  divider convention elsewhere. Border rendering itself not re-verified
  via a live GUI (no attached display, same gap as every prior feature).
  All checks pass, no gaps found. Phase set to `accept`.
- 2026-09-16 — feature 046 (Tasks side panel) tested (requested-changes
  round): added one permanent regression test (631 → 632, stable across
  3 runs) confirming the add-task row precedes the first task in DOM
  order with 2+ tasks present. No existing test needed rewriting — none
  asserted DOM order or border classes. The divider-line CSS remains
  unverified by unit test (jsdom here doesn't load the external
  stylesheet, same as every other CSS rule in this codebase). lint/
  typecheck/build all pass. Test Notes filled in; phase set to `validate`.
- 2026-09-16 — feature 046 (Tasks side panel) implemented requested
  changes: (1) added a visual divider (border-top on every item, plus a
  matching border-bottom on the last one, so adjacent items share one
  line instead of doubling it) to both `.tasks-panel-task` and
  `.tasks-panel-flagged-item`; (2) moved the add-task row above the task
  list in `TasksPanel.tsx` (a JSX-order change, no CSS positioning) so it
  stays fixed in place as tasks are added rather than being pushed down;
  `.tasks-panel-add-row`'s margin flipped from `margin-top` to
  `margin-bottom` to match. Verified live: a throwaway RTL check confirmed
  the add-row now precedes the list in DOM order; the border CSS itself
  isn't unit-testable here since jsdom in this project's test setup
  doesn't load the external stylesheet (confirmed by a failed throwaway
  computed-style assertion — not a new gap, no CSS in this codebase is
  verified that way). lint/typecheck/build pass; full suite unchanged at
  631/631 (no existing test asserted DOM order or border classes, so
  nothing needed rewriting). Phase set to `test`.
- 2026-09-16 — feature 046 (Tasks side panel) accept gate: user selected
  "Request changes", then specified (1) a divider line above/below each
  task and each flagged-mail item, (2) move the add-task input row to the
  top of the Tasks section so it stays fixed as tasks are added. Recorded
  in the feature file's Acceptance Log. Status set to `testing` directly
  (the fix was implemented in the same pass rather than stopping at
  `implementing`), phase set to `test`.
- 2026-09-16 — feature 046 (Tasks side panel) validated: lint/typecheck/
  build pass; full test suite (631/631) re-run 3x, stable; confirmed via
  `git diff --stat` (f52357e..b210896) that `/test` touched only test/doc
  files, no implementation drift. Mid-validation detour: the session's
  original worktree (`.claude/worktrees/feature-043-calendar-view-mode`)
  had been cleaned up — its git registration and tracked files were gone,
  leaving only a stray `node_modules`, most likely the user's own cleanup
  after fast-forward-merging the branch into their local `master` (per
  their "you merge/pull it" answer at 043's accept gate) and then removing
  the now-redundant worktree/branch. No work was lost: the local `master`
  already had all 6 commits through this feature's `Test 046` commit
  (`b210896`), confirmed via `git log` in the user's own checkout before
  touching anything. Re-entered a fresh worktree
  (`.claude/worktrees/feature-046-tasks-panel`), fast-forwarded it to that
  same `master` tip, `npm install`, and re-ran lint/typecheck/build/full
  suite there — identical green results — before resuming validation. All
  6 ACs re-verified directly against current source (not just tests): AC1
  the View tab's Tasks toggle and `TasksPanel`'s render condition; AC2 the
  flagged-mail effect shares the exact `messagesVersion` mechanism every
  other live pane uses; AC3/AC4 add/complete/remove call through to the
  real store with independent, explicit actions; AC5 independently
  re-verified live via a standalone `esbuild`-bundled script — create a
  task, mark it done, close the `MailDb`, open a *second* one against the
  same directory (a real restart) — it came back intact; AC6 the folder/
  module-switch handlers touch neither the toggle state nor the tasks
  store, and `TasksPanel` takes no folder/module prop at all. No live
  multi-window Electron GUI click-through attempted — no attached display;
  same non-blocking gap as every prior feature. All checks pass, no gaps
  found. Phase set to `accept`.
- 2026-09-15 — feature 046 (Tasks side panel) tested: 608 → 631 net (+23,
  all passing; re-run 3x, stable) across 5 files. Both pre-existing tests
  that `/implement` left genuinely failing (RibbonBar's "View disabled"
  assertion, ipc.test.ts's exhaustive channel list) were fixed for real,
  not patched around. New coverage: `db.test.ts` CRUD/persistence/missing-id
  plus a regression test pinning tasks survive `resetMailboxAndCalendar`;
  `ipc.test.ts` a tasks round-trip mirroring the calendar-item one;
  `RibbonBar.test.tsx` a new View-tab describe block (active-tab tracking,
  action-row swap, Tasks button aria-pressed/active/click); new
  `TasksPanel.test.tsx` (12 unit tests, AC2-AC4); `App.test.tsx` (+3
  integration tests, AC1/AC6, plus Settings hiding the panel). lint/
  typecheck/build all pass. Test Notes filled in; phase set to `validate`.
- 2026-09-15 — feature 046 (Tasks side panel) implemented: new `tasks`
  SQLite table + `MailDb` CRUD (mirrors `calendar_items` exactly),
  `db:tasks:*` IPC channels, and `window.api.data.tasks`, deliberately
  excluded from `resetMailboxAndCalendar`/free-play/scenario-pack resets
  (freestanding tasks are the trainee's own list, not scenario data — a
  judgment call). `RibbonBar`'s View tab is now real and clickable
  (previously a disabled placeholder whose code comment already
  anticipated this feature); it's tracked as its own `viewTabActive`
  concern in `App.tsx`, independent of `showFileVine`/`activeModule`, so
  selecting it only swaps the ribbon's action set (now showing a `Tasks`
  toggle button, `aria-pressed` + new `.ribbon-action.active` style) and
  never touches Mail/Calendar content (AC1). New `TasksPanel.tsx` renders
  as an `app-body` sibling whenever `showTasksPanel` is true and Settings
  isn't open: a "Flagged Mail" section refetches
  `window.api.data.messages.list()` filtered by `isFlagged` on the same
  `messagesVersion` bump every other live-updating pane already uses (AC2,
  no new broadcast needed), and a "Tasks" section owns add/complete/remove
  against the new store (AC3/AC4), refetching locally after each mutation
  (AC5, confirmed via a standalone script: create → update → close and
  reopen a fresh `MailDb` against the same directory → task survives with
  its `done`/`text` intact). Neither `viewTabActive`/`showTasksPanel` nor
  the tasks store is touched by folder/module-switch handlers, which is
  what makes AC6 hold with no special-casing. Verified live: a throwaway
  4-case RTL suite drove AC1 (toggle on/off), AC2 (flagged list plus a
  live update via the messages-changed listener), AC3/AC4/AC5 (add via
  Enter or the Add button, complete via checkbox, remove via the × button,
  all calling through to the real store shape), and AC6 (panel stays open
  across a Mail↔Calendar module switch). lint/typecheck/build pass.
  Existing suite 606/608 (two pre-existing tests now genuinely fail on the
  intentional behavior change — RibbonBar's "View is disabled" assertion
  and ipc.test.ts's exhaustive-channel-list assertion — left for `/test`
  to rewrite rather than papered over here, same convention as 043's
  CalendarView tests). Phase set to `test`.
- 2026-09-15 — feature 043 (Calendar item view-mode and single-open swap)
  accepted by user; logged to CHANGELOG. First accept attempt surfaced that
  this session's isolated worktree branch
  (`worktree-feature-043-calendar-view-mode`) hadn't reached the user's
  local `master` — user chose to merge/pull it themselves rather than have
  it pushed to `master` directly. After merging and testing locally, user
  accepted. Active feature set to 046 (Tasks side panel, next in
  BACKLOG.md table order — 049/033-045 are lower priority or later in the
  table), phase set to `implement`.
- 2026-09-15 — feature 043 (Calendar item view-mode and single-open swap)
  validated: lint/typecheck/build pass; full test suite (608/608) re-run
  3x, stable; confirmed via `git diff` (d84187d..7c578b0) that `/test`
  touched only test/doc files, no implementation drift. All 4 ACs
  re-verified directly against current source: AC1 the view branch renders
  only `<span>`s, structurally nothing to edit; AC2 `startEdit()` flips the
  same panel's mode in place, chooser now correctly gated behind `panelMode
  === 'edit'`; AC3 `openView()` unconditionally resets state on every
  click and `openOccurrence` is a single value, so two panels open at once
  is structurally impossible; AC4 the create branch is byte-for-byte
  unchanged. One flagged-not-blocking item for `/retro`: Cancel returning
  to view (vs. a full close) was a judgment call beyond the literal AC
  text, documented and tested but worth confirming matches intended UX. No
  live multi-window Electron GUI click-through attempted — no attached
  display; same non-blocking gap as every prior feature. All checks pass,
  no gaps found. Phase set to `accept`.
- 2026-09-15 — feature 043 (Calendar item view-mode and single-open swap)
  tested: `CalendarView.test.tsx` net +4 (604 → 608, all passing; re-run 3x,
  stable). Several existing "click an item" tests genuinely asserted the
  old click-opens-edit-directly behavior and were rewritten (not just
  patched to compile) to click through view mode first — a deliberate
  fix-the-test-to-match-intended-behavior change, not weakening. AC1: new
  test confirms a click opens a read-only view with zero
  `textbox`/`checkbox` roles, for both a plain and a recurring item (🔁
  indicator, no chooser yet). AC2: new test confirms Edit reaches the
  pre-filled editable form directly for a plain item; the pre-existing
  scope-chooser tests (recurring shows chooser / non-recurring skips it)
  now trigger via an Edit click rather than the item click itself. AC3: new
  test opens one item into edit, clicks a second item, and asserts exactly
  one dialog exists afterward (the second item's view) — the first is
  fully gone, never both. AC4 needed no new tests — the create-flow
  ternary branch is untouched and its existing coverage (unchanged) already
  covers it. Also added, as a documented design decision beyond the literal
  AC text: two tests confirming Cancel (from the edit form, and from the
  this-event/whole-series chooser) returns to the read-only view rather
  than closing the panel outright, with no API calls either way.
  lint/typecheck/build all pass; full suite 608/608 (30 files), re-run 3x
  stable. Test Notes filled in; phase set to `validate`.
- 2026-09-15 — feature 043 (Calendar item view-mode and single-open swap)
  implemented: `CalendarView.tsx` gained a `panelMode: 'view' | 'edit'`
  alongside its existing `openOccurrence`/`editScope` state. Clicking any
  item (`openView`, renamed from `openEdit`) always (re)opens fresh in
  read-only view mode — a new sibling `CalendarItemView` component
  rendering fields as plain text, no inputs — so clicking a different item
  while one is open naturally replaces the single open panel (AC1, AC3).
  Its "Edit" button (`startEdit`) flips to edit mode: a non-recurring item
  skips straight to the existing form (matching prior skip-the-chooser
  behavior), a recurring one shows the pre-existing this-event/whole-series
  chooser first, now gated on `panelMode === 'edit'` so it doesn't show
  while still viewing (AC2). Design decision beyond the literal AC text:
  Cancel from the edit form or the scope chooser now returns to view mode
  rather than closing outright, since Cancel undoes the edit attempt, not
  the fact that you were looking at the item; a full close still happens
  from the view panel's own Close button and after any successful
  save/delete. Create-flow (`showCreateForm`) untouched, still opens the
  editable form directly first in the render ternary (AC4). Verified live:
  a throwaway 6-case RTL suite drove all 4 ACs directly (view has no
  inputs, Edit reaches the form for a plain item, Edit shows the chooser
  for a recurring item, Cancel returns to view not full-close, switching
  items swaps the single open panel, create still opens directly editable).
  lint/typecheck/build all pass. Existing `CalendarView.test.tsx` now has
  11 failing assertions (was 34/34) because they click an item and expect
  the edit form immediately — expected fallout of the intentional
  click-opens-view-first behavior change, left for `/test` to update rather
  than papered over here. Phase set to `test`.
- 2026-09-15 — feature 041 (Double-click message opens a pop-out reading
  window) accepted by user; logged to CHANGELOG. Active feature set to
  043 (Calendar item view-mode and single-open swap, next in BACKLOG.md
  table order — 042 skipped, it's a `low`-priority feature 041's AC4
  merely references, not a dependency in build order), phase set to
  `implement`.
- 2026-09-15 — feature 041 (Double-click message opens a pop-out reading
  window) validated: lint/typecheck/build pass; full test suite (604/604)
  re-run 3x, stable; confirmed via `git diff` (90fd23a..6b3b05c) that
  `/test` touched only test files/docs, no implementation drift. All 4
  ACs re-verified directly against current source: AC1 confirmed
  end-to-end across every layer (double-click → preload → IPC handler →
  `createMessagePopoutWindow` → routed renderer → real `ReadingPane`);
  AC2 confirmed structurally (`broadcastMessagesChanged` sends to every
  `BrowserWindow` with no window-type distinction, and the pop-out bumps
  its own `messagesVersion` on that same broadcast, same pattern as
  `App.tsx`); AC3 confirmed by inspection (`MessagePopoutWindow`'s only
  prop is `messageId`, no reference to `App.tsx`'s selection state, a
  genuinely separate window/process); AC4 confirmed feature 042 is still
  `backlog` (no "Off" state exists to fail against yet) and that nothing
  in this feature's code reads any Reading-Pane-visibility flag, so
  there's nothing to regress — flagged for `/retro`'s awareness that 042
  should re-confirm this pop-out still works once built. No live
  multi-window Electron GUI click-through attempted — no attached
  display; same non-blocking gap as every prior feature. All checks pass,
  no gaps found. Phase set to `accept`.
- 2026-09-15 — feature 041 (Double-click message opens a pop-out reading
  window) tested: added 8 tests (596 → 604, all passing; re-run 3x,
  stable), all AC-traceable by number, across 2 files — new
  `MessagePopoutWindow.test.tsx` (+7): AC1 content renders via the real
  `ReadingPane` scoped to the right message id; AC2 a `data:messages-
  changed` broadcast triggers a refetch and the listener is cleaned up on
  unmount; plus action-wiring checks (Reply/Reply All/Forward, Delete,
  Restore/Delete-permanently for a message already in Deleted Items, Edit
  draft) all confirmed to call through with the correct arguments, same as
  the inline Reading Pane. `MessageListPane.test.tsx` (+1): AC1's "opens"
  half — double-click calls `messagePopout.open` with the right id, using
  `userEvent.dblClick` (the real click→click→dblclick sequence) rather
  than the bare `fireEvent.doubleClick`. Deliberately not covered: AC3
  (structural — separate window/process, no shared state to test at this
  layer), AC4 (feature 042 doesn't exist yet, nothing to test against, and
  nothing here depends on it), and main-process `BrowserWindow` creation
  (matches the project's existing convention of not unit-testing
  `createComposeWindow` either). lint/typecheck/build all pass. Test Notes
  filled in; phase set to `validate`.
- 2026-09-15 — feature 041 (Double-click message opens a pop-out reading
  window) implemented: mirrors the existing compose pop-out pattern
  (feature 004) exactly — new `window:openMessagePopout` IPC handler in
  `main/index.ts` (looks up the message subject for the window title) plus
  `createMessagePopoutWindow` in `main/windows.ts`; `main.tsx` routes a
  `messagePopout=1&messageId=…` query string to a new
  `MessagePopoutWindow.tsx`, a thin host rendering the *same* `ReadingPane`
  component the main window uses (AC1). AC2 (live cross-window refresh)
  needed no new plumbing — every create/update/delete already broadcasts
  to every open window, so the pop-out just needed its own
  `messagesVersion` bumped on the existing `onMessagesChanged` listener;
  `ReadingPane`'s existing fetch-by-id effect does the rest, including for
  the pop-out's own Delete/Restore/Mark-read/Flag actions. AC3 (closing
  doesn't affect the main window) is structural — a wholly separate
  `BrowserWindow`/renderer process with no shared React state. AC4 (works
  with Reading Pane "Right" or "Off", feature 042): 042 doesn't exist yet,
  but nothing here depends on the inline Reading Pane's visibility — the
  double-click handler lives directly on the message row
  (`MessageListPane.tsx`, calling `window.api.messagePopout.open`
  directly, no new prop from `App.tsx`) and fires regardless. New
  `MessagePopoutApi` in preload; each pop-out action (Reply/Forward/
  Delete/etc.) is a small standalone `window.api` call, matching
  `ComposeWindow.tsx`'s existing each-window-is-self-contained convention
  rather than importing from `App.tsx`. Verified live: a throwaway 6-case
  RTL suite confirmed real content rendering via the real `ReadingPane`,
  refetch on the cross-window broadcast, Reply/Delete calling through
  correctly, the Deleted-Items button set showing for an
  already-deleted message, and the double-click wiring in
  `MessageListPane`. lint/typecheck/build pass; existing suite unchanged
  596/596 (test setup's mock API needed a `messagePopout` stub to satisfy
  the type). Phase set to `test`.
- 2026-09-15 — feature 040 (Message list right-click context menu)
  accepted by user; logged to CHANGELOG. Active feature set to 041
  (Double-click message opens a pop-out reading window, next in
  BACKLOG.md table order), phase set to `implement`.
- 2026-09-15 — feature 040 (Message list right-click context menu)
  validated: lint/typecheck/build pass; full test suite (596/596) re-run
  3x, stable; confirmed via `git diff` (72f30ec..d586ac8) that `/test`
  touched only test files/docs, no implementation drift. All 5 ACs
  re-verified directly against current source: AC1 all 8 action items
  render immediately (Move to folder/Add to category's own sub-panels
  need an extra click, the top-level items don't); AC2 `targetIds`
  correctly preserves the existing selection when the right-clicked row
  is already in it (no `onSelectionChange` call) vs. selecting just that
  row otherwise, including the empty-selection case; AC3 Move to folder
  lists every folder and moves every targeted id, clearing selection
  after; AC4 Mark read/unread and Flag/Unflag iterate every targeted id,
  Add to category iterates every targeted *message* and skips only ones
  that already carry it; AC5 Reply/Reply All/Forward gated single-only by
  both the `disabled` attribute and a second callback-level guard, Delete
  ungated and its `App.tsx` handler correctly branches move-to-Deleted vs.
  permanent-delete per message (verified end-to-end). One non-blocking nit
  found by fresh inspection: right-clicking the per-row flag button falls
  through to the native menu (no `onContextMenu` there) — intentional,
  mirrors the flag button's existing left-click `stopPropagation`
  treatment as a separate control, not a defect against any AC. No live
  multi-window Electron GUI click-through attempted — no attached
  display; same non-blocking gap as every prior feature. All checks pass,
  no gaps found. Phase set to `accept`.
- 2026-09-15 — feature 040 (Message list right-click context menu) tested:
  added 22 tests (574 → 596, all passing; re-run 3x, stable), all
  AC-traceable by number, across 3 layers — new `MessageContextMenu.test.tsx`
  (+13, unit-level): AC1 every listed action renders; AC5 Reply/Reply
  All/Forward enabled only for a single-message target, Delete works at any
  size; AC4 Mark read/unread and Flag/Unflag label + applied-value switch
  correctly between "not uniformly set" and "every target already set",
  Add to category submits the trimmed name and no-ops on blank; AC3 Move to
  folder stays collapsed until clicked, then lists every folder; plus
  Escape/outside-click dismissal (an inside click doesn't trigger it).
  `MessageListPane.test.tsx` (+8, integration): AC2 both halves — outside
  the selection selects just that message (menu scoped to one, Reply
  enabled), inside an existing multi-selection leaves it untouched (Reply
  disabled); AC4 Mark as read/Flag/Add-to-category applied per selected id
  correctly; AC3 Move to folder moves every selected message and clears
  the selection; AC5 Delete/Reply call through with the correct
  message(s); plus the menu closing on a folder change. `App.test.tsx`
  (+1, end-to-end): the one branch nothing else covers — Delete
  permanently deletes (not re-moves) a message already in Deleted Items,
  confirmed by actually navigating there first. lint/typecheck/build all
  pass. Test Notes filled in; phase set to `validate`.
- 2026-09-15 — feature 040 (Message list right-click context menu)
  implemented: new `MessageContextMenu.tsx` renders a fixed-positioned menu
  (closes on Escape/outside click) with Reply/Reply All/Forward (enabled
  only for a single-message target, AC5), Mark as read/unread and
  Flag/Unflag (label reflects whether every targeted message is already
  read/flagged), Add to category, Move to folder (lists all folders,
  clears selection after since the messages leave the current view), and
  Delete (works for any selection size, permanently deleting instead of
  re-moving when already in Deleted Items — mirroring the Reading Pane's
  existing per-folder split under one label). `MessageListPane.tsx` owns
  the right-click semantics (AC2): right-clicking a message already in the
  selection keeps it; right-clicking outside it selects just that message
  first, same as a plain click. Read/Flag/category/move actions call
  `window.api.data.messages.update` directly per message id (same pattern
  the existing per-row flag button already used, no new IPC); Reply/
  Forward/Delete reuse `App.tsx`'s existing single-message handlers plus a
  new bulk-capable `handleDeleteMessages`. No new IPC channels or shared
  types. Verified live: a throwaway 10-case RTL suite drove every AC
  directly (all passing). `MessageListPane.test.tsx` needed prop-shape
  touch-ups (a shared `defaultProps` spread) to keep compiling; no
  behavioral changes to existing tests. lint/typecheck/build pass; full
  suite unchanged at 574/574. Phase set to `test`.
- 2026-09-15 — feature 039 (Message list multi-select) accepted by user;
  logged to CHANGELOG. Active feature set to 040 (Message list right-click
  context menu, next in BACKLOG.md table order), phase set to `implement`.
- 2026-09-15 — feature 039 (Message list multi-select) validated:
  lint/typecheck/build pass; full test suite (571/571) re-run 3x, stable;
  confirmed via `git diff` that `/test` touched only test files/docs, no
  implementation drift. All 4 ACs verified by tests plus direct code
  inspection — AC1 Ctrl/Cmd-click adds/removes only the clicked id
  without replacing the array; AC2 the range is computed against the
  actual on-screen `visibleMessages` order (correctly honoring search/
  category filters) between the anchor and clicked message inclusive,
  either direction; AC3 a plain click always passes a fresh one-element
  array, never a merge; AC4 `selectedMessageId` is non-null only for a
  true single selection, with `selectedCount` distinguishing 0-selected
  from N>1-selected in the neutral-state branch. Flagged one
  documentation-only inaccuracy in Implementation Notes (a typo in the
  derived-selectedMessageId snippet — the actual code is correct) for
  `/retro`'s awareness, not a code defect. No live multi-window Electron
  GUI click-through attempted — no attached display; same non-blocking
  gap as every prior feature; `App.test.tsx`'s integration test
  substitutes by driving real modifier-key clicks through the real
  component tree. All checks pass, no gaps found. Phase set to `accept`.
- 2026-09-15 — feature 039 (Message list multi-select) tested: added 14
  tests (557 → 571, all passing; re-run 3x, stable), all AC-traceable by
  number, across 3 layers — `MessageListPane.test.tsx` (+10, using
  `fireEvent` for precise modifier keys): AC1 Ctrl-click add/remove
  without disturbing the rest of the selection plus Cmd/Meta-click
  parity, AC2 Shift-click ranging both directions, a second Shift-click
  re-ranging from the same anchor rather than the previous Shift-click's
  target, and a Shift-click with no prior anchor falling back to plain
  single-select, AC3 a plain click replacing a multi-selection, plus
  structural checks that every selected row highlights and the anchor
  resets on folder change; `ReadingPane.test.tsx` (+3): AC4 the
  "N selected" neutral state, confirming the 0-selected and N>1-selected
  cases (both `selectedMessageId === null`) are genuinely distinguished;
  `App.test.tsx` (+1, integration-level through the real component
  wiring): a full plain→Ctrl→plain→Shift click sequence checked against
  the Reading Pane's visible state at each step. lint/typecheck/build all
  pass. Test Notes filled in; phase set to `validate`.
- 2026-09-15 — feature 039 (Message list multi-select) implemented:
  `App.tsx`'s single `selectedMessageId` state became `selectedMessageIds:
  string[]`, with a derived `selectedMessageId` (non-null only when
  exactly one is selected) keeping every existing single-message consumer
  (Reading Pane actions, ribbon Delete, Reply/Forward, Restore/permanent-
  delete) unchanged. `MessageListPane.tsx` owns the click semantics — a
  local `anchorId` (last plain/Ctrl-clicked message, unmoved by Shift-
  click) drives Ctrl-click toggle (AC1), Shift-click contiguous range
  (AC2, computed against its own filtered/searched `visibleMessages`
  order), and plain-click replace (AC3); the `.selected` class check
  changed from `===` to `.includes()` so every selected row highlights.
  `ReadingPane.tsx` gained a `selectedCount` prop (AC4) to distinguish
  "nothing selected" from "multiple selected" in its empty state, both of
  which leave `selectedMessageId` null. No bulk actions were added —
  scoped strictly to selection state and its two visible effects.
  Existing `MessageListPane.test.tsx`/`ReadingPane.test.tsx` needed
  prop-shape touch-ups to keep compiling (one assertion's expected call
  shape also changed, from a plain click now reporting an array);
  `App.test.tsx` needed no changes. Verified live: a throwaway test
  confirmed Ctrl-click add/remove without disturbing the rest of the
  selection, Shift-click ranging both directions plus re-ranging from the
  same anchor on a second Shift-click, a plain click clearing a 3-message
  selection down to one, multiple rows simultaneously carrying the
  `selected` class, and `ReadingPane` showing the single message /
  "N selected" / the original empty state at counts 1/3/0 respectively.
  lint/typecheck/build pass; existing suite unchanged 557/557 (only the
  two component test files needed prop-shape touch-ups). Phase set to
  `test`.
- 2026-09-15 — feature 032 (Settings — generate personas via LLM)
  accepted by user; logged to CHANGELOG. Active feature set to 039
  (Message list multi-select, next in BACKLOG.md table order), phase set
  to `implement`.
- 2026-09-15 — feature 032 (Settings — generate personas via LLM) validated:
  lint/typecheck/build pass; full test suite (557/557) re-run 3x, stable;
  confirmed via `git diff` that `/test` touched only test files/docs, no
  implementation drift. All 5 ACs verified by tests plus code inspection
  plus an independent live check — a standalone `tsx`-run script against
  the real `generatePersonas`/`ConfigStore` code (only `fetch` stubbed)
  drove the full pipeline: generation read the exact configured
  provider/key (AC1), produced a well-formed 2-persona cast with a
  correct reportsTo relationship (AC2), simulated the UI's Accept-append
  flow (AC3), and — critically — opened a *second* `ConfigStore` against
  the same scratch directory (a real restart, not a mock), confirming all
  3 personas (1 pre-existing + 2 generated) survived intact with
  `reportsTo` preserved (AC5). AC4 confirmed by the unit/IPC tests'
  4-failure-shape coverage (network, auth, non-JSON, bad-shape), each
  leaving `config.getPersonas()` untouched. Code inspection independently
  confirmed `personas.set` is never called from the generate handler
  itself, only from Accept, so "shown before committed" (AC2/AC3) is a
  structural guarantee, not just test behavior. No live multi-window
  Electron GUI click-through attempted — no attached display; same
  non-blocking gap as every prior feature. All checks pass, no gaps
  found. Phase set to `accept`.
- 2026-09-15 — feature 032 (Settings — generate personas via LLM) tested:
  added 21 tests (536 → 557, all passing; re-run 3x, stable), all
  AC-traceable by number, across 3 layers — `main/llm/generatePersonas.test.ts`
  (+10, new file, real `ConfigStore` + stubbed `fetch`): AC1 provider/model/
  key read from persisted Settings and the description passed through as
  user prompt; AC2 well-formed parsing incl. reportsTo preserved and a
  code-fence-wrapped response; AC4 network error/auth error/non-JSON/
  missing-field all resolve to a clear error never a throw, persisted
  personas confirmed untouched on failure. `main/data/ipc.test.ts` (+4,
  new `llm:generatePersonas` block): AC1 settings read from real
  ConfigStore; AC4 durable failure-log entry with `source:
  'generatePersonas'` (mirroring 027's `llm:test` pattern), success logs
  nothing, malformed response leaves personas untouched; a dedicated test
  pins that the IPC handler itself never calls `setPersonas` — only the
  renderer's Accept flow does. `PersonasSettings.test.tsx` (+7): AC1
  Generate disabled until text entered, calls `llm.generatePersonas` with
  the exact description; AC2 a successful generation renders a review
  list before `personas.set` is ever called; AC3 Accept appends (not
  replaces) to the existing list and persists the merged array, Discard
  persists nothing; AC4 a failed generation shows the exact error via the
  existing `role="alert"` convention without touching the list; AC5 an
  accepted generated persona goes through the identical `personas.set`
  call manual create/031's Load Personas already use, so no new
  persistence test was needed. lint/typecheck/build all pass. Test Notes
  filled in; phase set to `validate`.
- 2026-09-15 — feature 032 (Settings — generate personas via LLM)
  implemented: new `main/llm/generatePersonas.ts` asks the configured LLM
  (via the existing provider-agnostic `generateText`) to return a JSON
  array shaped exactly like 031's `PersonasFilePersona`, with guidance to
  form a coherent, acyclic `reportsTo` structure (AC1/AC2); the response
  is parsed (stripping an optional code fence) and validated by reusing
  031's existing `validatePersonasFile` as-is, so malformed LLM output is
  caught the same way a bad hand-edited import file is — never thrown,
  never partially applied (AC4). New `llm:generatePersonas` IPC handler
  logs failures to the existing durable LLM failure log (027), matching
  every other user-triggered LLM call. `PersonasSettings.tsx` gained a
  description textarea + Generate button; a successful generation is
  staged in a review list (name/email/role/client/reports-to) with
  Add-N/Discard actions (AC2/AC3) — Accept appends (not replaces) to the
  existing list via the same `personas.set` call manual create/edit
  already uses, so persistence (AC5) needed no new code. Verified live: a
  standalone Vitest+stubbed-fetch check covered a well-formed
  code-fence-wrapped response, non-JSON output, JSON missing a required
  field, and a network failure, all resolving correctly with no throw and
  the persisted persona list confirmed untouched on failure; a throwaway
  RTL smoke test drove the full UI flow (generate → review → Accept
  appends and persists, Discard leaves the list untouched, a failed
  generation shows the exact error without touching the list).
  lint/typecheck/build pass; existing suite unchanged 536/536 (only
  `ipc.test.ts`'s exhaustive channel-list test needed a content touch-up
  for the new channel). Phase set to `test`.
- 2026-09-15 — feature 031 (Settings — load personas from a JSON file)
  accepted by user; logged to CHANGELOG. Active feature set to 032
  (Settings — generate personas via LLM, next in BACKLOG.md table order),
  phase set to `implement`.
- 2026-09-15 — feature 031 (Settings — load personas from a JSON file)
  validated: lint/typecheck/build pass; full test suite (536/536) re-run
  3x, stable; confirmed via `git diff` that `/test` touched only test
  files/docs, no implementation drift. All 5 ACs verified by tests plus
  code inspection plus a live check against real data — bundled
  `personasFile.ts` standalone with `esbuild` and fed it the real, in-use
  `~/.config/outlook-sim/config/personas.json`'s persona array (15 real
  personas): all validated successfully (tolerating extra fields like
  `id` the schema doesn't know about), and corrupting one real entry
  produced the exact expected per-index error. AC4 (personas-only scope)
  re-confirmed structurally — the module has no import from
  `./db`/`./config`/`./clock` at all. No live multi-window Electron GUI
  click-through attempted — no attached display; same non-blocking gap as
  every prior feature. Phase set to `accept`.
- 2026-09-15 — feature 031 (Settings — load personas from a JSON file)
  tested: added 21 tests (515 → 536, all passing; re-run 3x, stable), all
  AC-traceable by number, across 2 files — new `personasFile.test.ts`
  (+17, real `validatePersonasFile`): full/multi-entry/empty-array
  acceptance, optional-field defaulting, a 12-case `it.each` covering
  malformed root/entry shapes and wrong-typed fields with exact per-field
  errors (never throwing), and a by-index error test for a multi-entry
  file; `PersonasSettings.test.tsx` (+4): clicking "Load Personas…"
  invokes the pick IPC call, a valid file replaces (not merges) the list
  and persists with a generated id, an invalid file shows the specific
  error while the app stays usable, and canceling is a true no-op. AC4
  (personas-only scope) and part of AC5 (restart persistence) were
  confirmed by code inspection / existing coverage rather than new tests,
  since they're structural guarantees / already-tested shared code paths
  with nothing new to assert. lint/typecheck/build all pass. Test Notes
  filled in; phase set to `validate`.
- 2026-09-15 — feature 031 (Settings — load personas from a JSON file)
  implemented: new standalone file format (a bare JSON array of persona
  entries, distinct from a scenario pack's wrapping object) — new
  `PersonasFilePersona` type and `main/data/personasFile.ts`'s
  `validatePersonasFile` (never throws, per-field error messages, mirrors
  `scenarioPack.ts`'s conventions but self-contained rather than sharing
  its private helpers). New `personasFile:pick` IPC handler in
  `main/index.ts` (alongside `scenario:pickPack`/`savePack`) opens a
  native file picker and validates the chosen file.
  `PersonasSettings.tsx`'s new "Load Personas…" button converts validated
  entries into full `Persona` objects and calls the existing `personas.set`
  IPC — the same call manual create/edit already use — so persistence
  (AC5) needed no new code and personas-only scope (AC4) is structural
  (the validator has no `db`/`config`/`clock` reference at all). Verified
  live: a standalone `esbuild`-bundled script confirmed valid-file parsing
  with correct isClient/reportsTo handling and five different malformed
  shapes each producing a specific error rather than throwing; a
  throwaway RTL smoke test drove the full UI (load replaces the list, an
  invalid file shows a specific error without crashing, cancel is a
  no-op, replace-not-merge semantics). lint/typecheck/build pass; existing
  suite unchanged 515/515. Phase set to `test`.
- 2026-09-15 — feature 030 (Settings panels refresh live after a scenario
  pack load) accepted by user; logged to CHANGELOG. Active feature set to
  031 (Settings — load personas from a JSON file, next in BACKLOG.md
  table order), phase set to `implement`.
- 2026-09-15 — feature 030 (Settings panels refresh live after a scenario
  pack load) validated: lint/typecheck/build pass; full test suite
  (515/515) re-run 3x, stable; confirmed via `git diff` that `/test`
  touched only test files/docs, no implementation drift. All 4 ACs
  verified by tests plus fresh code inspection (no main-process component
  to independently re-run for this purely renderer-side feature) —
  confirmed `PersonasSettings`'s fetch effect is keyed on `reloadKey`,
  `SettingsView`'s `refreshAfterScenarioPackLoad` re-fetches the system
  prompt directly rather than trusting the pack's in-memory value, and
  `App.tsx`'s ternary rendering genuinely unmounts `SettingsView` when
  closed. No live multi-window Electron GUI click-through attempted — no
  attached display; same non-blocking gap as every prior feature. Phase
  set to `accept`.
- 2026-09-15 — feature 030 (Settings panels refresh live after a scenario
  pack load) tested: added 9 tests (506 → 515, all passing; re-run 3x,
  stable), all AC-traceable by number, across 2 files —
  `PersonasSettings.test.tsx` (+5, unit-level via `rerender`): a
  `reloadKey` bump refetches and shows new data without unmount/remount,
  an unchanged `reloadKey` doesn't cause an extra fetch, an in-progress
  unsaved create *and* edit form are both discarded cleanly on a
  `reloadKey` bump (asserted no accidental save either), and a bare
  render with no `reloadKey` prop stays backward compatible;
  `SettingsView.test.tsx` (+4, integration-level): loading a pack updates
  the visible persona list and System Prompt text in place (no
  navigation), unmounting/remounting Settings (the actual mechanism
  behind "closed is unaffected") shows fresh data with nothing carried
  over, and an in-progress unsaved System Prompt edit is overwritten by a
  pack load without ever being saved. lint/typecheck/build all pass. Test
  Notes filled in; phase set to `validate`.
- 2026-09-15 — feature 030 (Settings panels refresh live after a scenario
  pack load) implemented: `SettingsView.tsx`'s `handleLoadScenarioPack`
  now refreshes System Prompt directly (re-fetches into local state) and
  bumps a new `personasReloadKey` counter passed to `PersonasSettings` as
  a prop — its own mount-only fetch effect now depends on that key,
  mirroring the same version-counter pattern `App.tsx` already uses for
  `messagesVersion`. AC3 (Settings closed ⇒ unaffected) needs no code
  since `SettingsView` already fully unmounts when closed. AC4 (unsaved-
  edit handling): chosen behavior is overwrite/discard, not preserve —
  documented explicitly, consistent with the destructive-replace
  confirmation dialog the user already agreed to and every other
  destructive action in this app already just overwriting. Verified live:
  a throwaway RTL smoke test drove the full flow (System Prompt text and
  persona list both updating in place with Settings open, no navigation;
  an in-progress unsaved "+ New Persona" form gone, not dangling, after a
  pack load). lint/typecheck/build pass; existing suite unchanged 506/506
  (no existing tests needed touch-ups). Phase set to `test`.
- 2026-09-15 — feature 029 (Scenario packs include the system prompt)
  accepted by user; logged to CHANGELOG. Active feature set to 030
  (Settings panels refresh live after a scenario pack load, next in
  BACKLOG.md table order), phase set to `implement`.
- 2026-09-15 — feature 029 (Scenario packs include the system prompt)
  validated: lint/typecheck/build pass; full test suite (506/506) re-run
  3x, stable; confirmed via `git diff` that `/test` touched only test
  files/docs, no implementation drift. All 4 ACs verified by tests plus
  an unusually strong independent live check — found two of the user's
  own real, previously-saved scenario pack files on disk
  (`~/Downloads/scenario-pack1.json`, `scenario-pack2.json`), genuinely
  pre-029 (no `systemPrompt` key at all, not synthetic fixtures): both
  validated and applied via a fresh `esbuild`-bundled script without
  error, correctly leaving a freshly-set current system prompt untouched
  (AC3); a real system prompt built into a fresh pack, JSON-round-tripped,
  and applied into a completely fresh store came back byte-for-byte
  identical (AC1/AC2/AC4). Both real downloaded files confirmed unmodified
  (md5, read-only access) afterward. No live multi-window Electron GUI
  click-through attempted — no attached display; same non-blocking gap as
  every prior feature. Phase set to `accept`.
- 2026-09-15 — feature 029 (Scenario packs include the system prompt)
  tested: added 8 tests (498 → 506, all passing; re-run 3x, stable), all
  AC-traceable by number, plus 2 existing tests extended in place, all in
  `scenarioPack.test.ts` — `validateScenarioPack` (+4): present/absent/
  explicitly-empty `systemPrompt` parse correctly (absent stays
  `undefined`, not defaulted to `''` like every other field), and a
  non-string value is rejected with a clear error. `applyScenarioPack`
  (+3): a pack's system prompt replaces the current one, an explicitly
  empty one clears it, and a hand-constructed pre-029-shaped pack (key
  deleted from the JSON) applies without throwing and leaves the current
  system prompt untouched. `buildScenarioPack` (+1, plus the existing
  comprehensive round-trip test extended): a configured system prompt is
  included when building, and the round-trip test now proves it survives
  build → real `JSON.stringify`/`parse` → apply into a completely fresh
  store, byte-for-byte, alongside the already-covered
  personas/inbox/calendar/timed-messages. lint/typecheck/build all pass.
  Test Notes filled in; phase set to `validate`.
- 2026-09-15 — feature 029 (Scenario packs include the system prompt)
  implemented: added `systemPrompt?: string` to `ScenarioPack` — genuinely
  optional (`undefined`), not defaulted to `''` like other fields, so a
  pre-029 pack (key absent) is distinguishable from a pack that explicitly
  clears the system prompt (key present, empty string). `validateScenarioPack`
  parses it only when present; `applyScenarioPack` only touches the
  current system prompt when the pack carried one (AC2+AC3 in one guard);
  `buildScenarioPack` always includes the current system prompt (AC1) —
  doesn't conflict with the function's existing "never reads
  Settings/API keys" guarantee since the system prompt lives in its own
  config file. No renderer changes needed (Save/Load Scenario Pack is
  main-process-opaque from the UI's perspective; live-refreshing the
  System Prompt textarea after a load is separate future feature 030).
  Verified live: a standalone `esbuild`-bundled script drove all 4 ACs
  directly, including a hand-constructed pre-029-shaped pack (key deleted
  entirely) leaving the current system prompt completely untouched when
  applied. lint/typecheck/build pass; existing suite unchanged 498/498
  (one exact-shape test assertion needed a content touch-up). Phase set
  to `test`.
- 2026-09-15 — feature 028 (Trainee identity & personas — org-structure
  fields) accepted by user; logged to CHANGELOG. Active feature set to
  029 (Scenario packs include the system prompt, next in BACKLOG.md table
  order), phase set to `implement`.
- 2026-09-15 — feature 028 (Trainee identity & personas — org-structure
  fields) validated: lint/typecheck/build pass; full test suite
  (498/498) re-run 3x, stable; confirmed via `git diff` that `/test`
  touched only test files/docs, no implementation drift. All 4 ACs
  verified by tests + code inspection plus an unusually strong
  independent live check — this session's own real, in-use
  `~/.config/outlook-sim/config/identity.json`/`personas.json` genuinely
  predate this feature (no synthetic fixture needed): loading them via a
  fresh `esbuild`-bundled `config.ts` against a scratch copy didn't throw,
  every reader defaulted the missing `reportsTo`/`department` to `''`
  while leaving all other real data (15 personas, trainee identity)
  intact, and a further round-trip of real org-structure values persisted
  correctly without disturbing other personas' defaults. Real on-disk
  config confirmed byte-for-byte unchanged (md5) afterward. No live
  multi-window Electron GUI click-through attempted — no attached
  display; same non-blocking gap as every prior feature. Phase set to
  `accept`.
- 2026-09-15 — feature 028 (Trainee identity & personas — org-structure
  fields) tested: added 13 tests (485 → 498, all passing; re-run 3x,
  stable), all AC-traceable by number, across 3 layers — `config.test.ts`
  (+6, real `ConfigStore`): identity/persona org-fields persistence across
  close/reopen, both fields round-tripping as empty when left blank, and
  raw pre-028-shaped `identity.json`/`personas.json` written directly to
  disk loading without error and defaulting to `''`; `SettingsView.test.tsx`
  (+4): Reports To/Department prefill and save alongside existing identity
  fields, blank-is-valid, and a legacy identity object missing both fields
  rendering blank rather than crashing; `PersonasSettings.test.tsx` (+5):
  create/edit persisting Reports To, blank-is-valid on create, and a
  legacy persona missing `reportsTo` entirely opening for edit without
  error. lint/typecheck/build all pass. Test Notes filled in; phase set to
  `validate`.
- 2026-09-14 — feature 028 (Trainee identity & personas — org-structure
  fields) implemented: added `reportsTo`/`department` to `TraineeIdentity`
  and `reportsTo` to `Persona` (shared types), plus form fields in
  `SettingsView.tsx`'s Trainee Identity section and `PersonasSettings.tsx`'s
  persona editor. AC4 (pre-feature data loads without error, defaulting to
  empty) enforced at the data layer: `ConfigStore.getIdentity()`/
  `getPersonas()` now merge/default missing fields on every read, not just
  in the UI. `applyScenarioPack` defaults a loaded persona's `reportsTo` to
  `''`, same as `isClient`. Verified live: a standalone `esbuild`-bundled
  `config.ts` script wrote raw pre-028-shaped JSON directly to disk and
  confirmed it loads without error, correctly defaulting; a throwaway RTL
  smoke test drove the full UI including legacy (missing-field) identity
  and persona objects rendering blank without error. lint/typecheck/build
  pass; existing suite unchanged 485/485 (11 existing test files needed
  compile touch-ups for the two now-required fields, no unrelated
  behavior changes). Phase set to `test`.
- 2026-09-14 — feature 027 (LLM error banner — Retry button and durable
  failure log) accepted by user; logged to CHANGELOG. Active feature set
  to 028 (Trainee identity & personas — org-structure fields, next in
  BACKLOG.md table order), phase set to `implement`.
- 2026-09-14 — feature 027 (LLM error banner — Retry button and durable
  failure log) validated: lint/typecheck/build pass; full test suite
  (485/485) re-run 3x, stable; confirmed via `git diff` that `/test`
  touched only test files/docs, no implementation drift. All 4 ACs
  verified by tests + code inspection plus an independent live check —
  bundled `config.ts` standalone with `esbuild` and ran it against a
  scratch copy of the real, in-use `~/.config/outlook-sim/config/`
  directory (15 real personas carried over): two appended failure-log
  entries survived a close/reopen cycle in order, and the real config
  directory was confirmed byte-for-byte unchanged (md5) afterward. Flagged
  one cosmetic, non-blocking nit (a type declaration sitting between two
  import statements in `App.tsx`). No live multi-window Electron GUI
  click-through attempted — no attached display; same non-blocking gap as
  every prior feature. Phase set to `accept`.
- 2026-09-14 — feature 027 (LLM error banner — Retry button and durable
  failure log) tested: added 18 tests (467 → 485, all passing; re-run 3x,
  stable), all AC-traceable by number, across 5 layers — `config.test.ts`
  (+3): failure-log round-trip, ordered multi-source appends, close/reopen
  persistence; `scheduler.test.ts` (+3, plus a log assertion added to an
  existing test): the scheduler's own tick() logs exactly once per real
  failure, a dedicated `attemptUnsolicitedMail` block covers a real
  failure logging, a success logging nothing, and the no-personas no-op
  logging nothing either; `ipc.test.ts` (+6): personaReply/test failure
  logging, and a concrete Retry-mechanics test that calls
  `llm:personaReply` with the same `sentMessageId` twice (fail then
  succeed), proving both the success broadcast and that the failure log
  keeps the first attempt's entry; a new `llm:retryUnsolicitedMail`
  describe block covers both outcomes; `App.test.tsx` (+4): Retry calls
  `llm.personaReply` with the exact original `sentMessageId`, a second
  Retry failure updates the same single `role="alert"` banner rather than
  stacking, a successful Retry clears it, and the unsolicited-mail
  banner's Retry/clear path; `SettingsView.test.tsx` (+4): Retry/Dismiss
  visibility, Retry re-calling `llm.test` with the exact currently-
  displayed settings, a second failure replacing the displayed message,
  and Dismiss clearing the error without touching any form field.
  lint/typecheck/build all pass. Test Notes filled in; phase set to
  `validate`.
- 2026-09-14 — feature 027 (LLM error banner — Retry button and durable
  failure log) implemented: persona-reply failures now carry their
  `sentMessageId` through the `llm:persona-reply-failed` broadcast so
  Retry can re-issue the exact same `llm.personaReply` call; unsolicited-
  mail Retry goes through a new `llm:retryUnsolicitedMail` IPC handler
  (no caller-supplied input exists to replay there, so Retry just
  re-attempts generation via the same `attemptUnsolicitedMail` wrapper the
  scheduler's own tick() now uses). `App.tsx`'s single-slot background-
  failure state widened to a discriminated union so Retry knows which call
  to reissue while keeping the existing non-stacking behavior (AC2).
  Retry clears the banner based on the IPC call's own resolved result
  (`result.ok`), not a broadcast, since `data:messages-changed` doesn't
  fire when a persona legitimately declines to reply. Settings' Test
  Connection reuses its own existing retry-equivalent
  (`handleTestConnection`) and gained a Dismiss button. New durable
  `ConfigStore.appendLlmFailureLog`/`getLlmFailureLog`
  (`config/llm-failure-log.json`) records every failure at the point it
  happens, independent of whether its banner is later shown/dismissed — no
  in-app viewer built, not an AC bullet. `PersonaReplyResult`/
  `GenerateUnsolicitedMailResult` moved from `main/llm/*.ts` to
  `shared/data-types.ts` so the renderer/preload can type them. Verified
  live: a standalone `esbuild`-bundled script confirmed the failure log
  persists across restart and `attemptUnsolicitedMail` logs exactly once
  per real failure (zero for a no-personas no-op); two throwaway RTL smoke
  tests drove the full Retry flow for both the App-level banner (same
  `sentMessageId` replayed, clears on success, second failure updates
  rather than stacks) and Settings' Test Connection (Retry + new Dismiss).
  lint/typecheck/build pass; existing suite unchanged 467/467 (only
  `ipc.test.ts`/`App.test.tsx` needed compile touch-ups for the new
  channel and the two-argument failure callback). Phase set to `test`.
- 2026-09-14 — feature 048 (FileVine notes/files CRUD with Markdown
  content) accepted by user; logged to CHANGELOG. All high-priority
  backlog items (023-026, 047, 048) are now done. Active feature set to
  027 (LLM error banner — Retry button and durable failure log, the first
  remaining medium-priority item), phase set to `implement`.
- 2026-09-14 — feature 048 (FileVine notes/files CRUD with Markdown
  content) validated: lint/typecheck/build pass; full test suite
  (467/467) re-run 3x, stable; confirmed via `git diff` that `/test`
  touched only test files/docs, no implementation drift. All 5 ACs
  verified by tests + code inspection plus fresh independent live checks —
  a throwaway jsdom check fed `renderMarkdown` headings, a list, italic,
  bold, and a link, confirming real DOM elements come back (not raw
  source) and that a raw `<script>` tag is actually stripped, not just
  displayed-as-text; a standalone `esbuild`-bundled `db.ts` script drove
  note create/edit/close-reopen-persist/cascade-delete (including a
  nested child folder's note) against a scratch copy of the real, in-use
  `~/.config/outlook-sim/outlook-sim.db` — all correct, and the real
  on-disk DB confirmed byte-for-byte unchanged (md5) afterward. No live
  multi-window Electron GUI click-through attempted — this session has no
  attached display; same non-blocking gap as every prior feature. Phase
  set to `accept`.
- 2026-09-14 — feature 048 (FileVine notes/files CRUD with Markdown
  content) tested: added 13 tests (454 → 467, all passing; re-run 3x,
  stable), all AC-traceable by number, across 3 layers — `db.test.ts` (+6,
  real `MailDb`): create/edit/delete, folder-scoped listing, close/reopen
  persistence, and a regression test mirroring 047's own cascade-delete
  FK-ordering bug for a folder-with-nested-child's notes; `ipc.test.ts`
  (+1, incl. the exhaustive channel-list update done during `/implement`):
  full CRUD (scoped listing across two folders) through the actual
  registered handlers; `FileVineView.test.tsx` (+6): empty state, create
  (incl. blank-name no-op) and delete, a Markdown-rendering test that
  explicitly asserts the raw `# `/`**` source text does *not* appear
  anywhere (not just that the rendered tags do), a distinct-edit-mode test
  proving the rendered view is hidden while a note is mid-edit, and a
  UI-level regression for the `/implement`-stage `selectFolder()` state-
  reset fix (switching folders shows the new folder's own notes, not the
  previous folder's). lint/typecheck/build all pass. Test Notes filled in;
  phase set to `validate`.
- 2026-09-14 — feature 048 (FileVine notes/files CRUD with Markdown
  content) implemented: new `FileVineNote { id, folderId, name, content }`
  (Markdown source) plus a `filevine_notes` SQLite table and full CRUD on
  `MailDb`, mirroring 047's `filevine_folders` conventions; `047`'s
  `deleteFileVineFolder` cascade now also deletes each deleted folder's
  notes (AC5), same FK-ordering fix pattern as 047 itself. Added `marked` +
  `dompurify` (new deps — no Markdown library existed yet) behind a small
  `renderer/src/markdown.ts` wrapper for sanitized-HTML rendering, the
  app's first `dangerouslySetInnerHTML` use. Extended `FileVineView.tsx`'s
  detail pane with a Notes section: create/edit inline forms (name +
  Markdown-source textarea) following the folder tree's existing
  conventions, a rendered (not raw) view when a note is selected, and a
  structurally distinct edit mode (AC1-3). A first attempt at resetting
  note-selection state via a `useEffect` on folder-change tripped
  `react-hooks/set-state-in-effect`; fixed by moving the reset into an
  explicit `selectFolder()` handler used everywhere `selectedFolderId`
  changes, leaving the effect to only fetch. Verified live: a standalone
  `esbuild`-bundled `db.ts` script drove full note CRUD, close/reopen
  persistence, and cascade-delete (including a nested descendant folder's
  notes) against a real `MailDb`; a throwaway RTL smoke test (written, run,
  deleted) drove the full UI flow including confirming real rendered
  `<h1>`/`<strong>` tags appear, not literal Markdown source. lint/
  typecheck/build pass; existing suite unchanged 454/454 (only
  `ipc.test.ts`'s exhaustive channel-list test needed a content
  touch-up for the 5 new channels). Phase set to `test`.
- 2026-09-14 — feature 047 (FileVine tab — folder structure and client
  association) accepted by user, with one change requested before sign-off:
  the FileVine client dropdown was listing all personas (including Grollo
  Law staff), so a folder could be assigned an employee as its "client".
  Added a structured `isClient` boolean to `Persona` (a "Client" checkbox in
  Settings > Personas), filtered `FileVineView`'s client `<select>` to
  `isClient` personas (preserving an already-assigned persona in the
  dropdown even if later unmarked), and defaulted scenario-pack-loaded
  personas to `isClient: false`. Re-verified lint/typecheck/build/full
  suite (454/454, +3 tests) after the change, outside the normal
  `/test`/`/validate` stages since it was requested at this gate. Logged to
  CHANGELOG. Active feature set to 048 (FileVine notes/files CRUD with
  Markdown content), phase set to `implement`.
- 2026-09-14 — feature 047 (FileVine tab — folder structure and client
  association) validated: lint/typecheck/build pass; full test suite
  (451/451) re-run 3x, stable; confirmed via `git diff` that `/test`
  touched only test files/docs, no implementation drift. All 5 ACs
  verified by tests + code inspection plus a live end-to-end check —
  bundled `db.ts` standalone with `esbuild` and built a 3-level nested
  folder structure with a real persona client association against a
  scratch copy of the real, in-use
  `~/AppData/Roaming/outlook-sim/outlook-sim.db`: nesting, client
  association, and a close/reopen cycle all round-tripped correctly, and
  deleting a mid-tree folder correctly cascaded to its child while leaving
  an unrelated sibling intact; real on-disk DB confirmed byte-for-byte
  unchanged (md5) afterward. No live multi-window Electron GUI
  click-through attempted — this session runs on a real Windows machine
  but, as a background job, has no attached display; same non-blocking
  gap as every prior feature, different underlying reason. Phase set to
  `accept`.
- 2026-09-14 — feature 047 (FileVine tab — folder structure and client
  association) tested: added 21 tests (430 → 451, all passing; re-run 3x,
  stable), all AC-traceable by number, across 4 layers — `db.test.ts` (+7,
  real `MailDb`): create/rename/delete, nesting, a regression test pinning
  the `/implement`-stage cascade-delete FK fix, client associate/change/
  un-associate, and close/reopen persistence; `ipc.test.ts` (+1, incl. the
  exhaustive channel-list update): full CRUD through the actual registered
  handlers; new `FileVineView.test.tsx` (+11, in-memory fake store): empty
  states, create/nest/rename/delete, a DOM-structure test proving real
  nesting (not flat-with-indentation), and client association incl.
  pre-selected existing client and switching between personas; `App.test.tsx`
  (+2, on top of 2 `RibbonBar.test.tsx` tests already added during
  `/implement` for AC1): the FileVine tab actually swapping the
  center/right content area while the mail folder pane stays visible, and
  that selecting a mail folder / switching to Calendar both close it.
  lint/typecheck/build all pass. Test Notes filled in; phase set to
  `validate`.
- 2026-09-14 — feature 047 (FileVine tab — folder structure and client
  association) implemented: new `FileVineFolder` type (nests via
  `parentId`, loosely references a persona as `clientPersonaId`) plus a
  `filevine_folders` SQLite table and full CRUD on `MailDb`, mirroring
  `calendarItems`'s conventions; `db:fileVineFolders:*` IPC channels +
  `window.api.data.fileVineFolders`. New `FileVineView.tsx` (two-pane tree
  + detail UI, always-expanded nested lists, inline create/rename/delete
  following `FolderPane.tsx`'s conventions). `RibbonBar`'s tab row — static/
  disabled since feature 001 — gained a real, clickable "FileVine" tab
  between Home and View; clicking it (or Home) overlays/hides
  `FileVineView` in `App.tsx` in place of the message list/reading pane
  while staying in the Mail module, so the mail folder pane stays visible
  underneath it per spec. Caught and fixed a real bug live before writing
  any tests: cascade-deleting a folder with children threw a `FOREIGN KEY
  constraint failed` (deleted parent before children in insertion order);
  fixed by deleting in reverse pre-order. Verified end-to-end with a
  standalone `esbuild`-bundled `db.ts` script (real `MailDb`) and a
  throwaway RTL smoke test of the full UI flow (written, run, deleted —
  not part of the diff) before finishing. lint/typecheck/build pass;
  existing suite 428 → 430 (2 new RibbonBar tests for the now-interactive
  tab; `RibbonBar.test.tsx`/`ipc.test.ts` needed compile/content
  touch-ups, no unrelated behavior changes). Notes/files CRUD (048) and
  LLM context wiring (049) deliberately out of scope. Phase set to `test`.
- 2026-09-14 — feature 026 (fix: recurring event reminders fire per
  occurrence) accepted by user; logged to CHANGELOG. All four high-priority
  bug fixes (023-026) are now done. Active feature set to 047 (FileVine tab
  — folder structure and client association), phase set to `implement`.
- 2026-09-14 — feature 026 (fix: recurring event reminders fire per
  occurrence) validated: lint/typecheck/build pass; full test suite
  (428/428) re-run 3x, stable; confirmed via `git diff` that `/test`
  touched only test files/docs, no implementation drift. All 4 ACs
  verified by tests + code inspection plus a fresh live end-to-end check —
  bundled `db.ts`/`reminderScheduler.ts` standalone with `esbuild` and ran
  a real `MailDb` against a scratch copy of the real, in-use
  `~/AppData/Roaming/outlook-sim/outlook-sim.db`: a daily recurring event
  fired distinct, correctly-timed reminders on day 1 and day 2 (the actual
  bug — previously impossible), with no double-fire on a re-tick; real
  on-disk DB confirmed byte-for-byte unchanged (md5) afterward. No live
  multi-window Electron GUI click-through attempted (no Xvfb, same
  non-blocking gap as every prior feature). Phase set to `accept`.
- 2026-09-14 — feature 026 (fix: recurring event reminders fire per
  occurrence) tested: added 6 tests (422 → 428, all passing; re-run 3x,
  stable), all AC-traceable by name in `reminderScheduler.test.ts`'s new
  "026: recurring reminders fire per occurrence" block plus one
  `App.test.tsx` test — AC1 (1st/2nd/3rd occurrence each fire distinctly
  across ticks), AC2 (no refire of the same occurrence across repeated
  ticks, while a later occurrence still fires independently), AC3 x2 (a
  deleted occurrence never fires; an occurrence edited to a new start time
  fires at the new time, not the old one — a first draft of this test
  caught its own ambiguity, 6 calls instead of 1, correctly diagnosed as
  multiple long-overdue occurrences firing in one big time jump rather
  than a bug, then re-scoped to isolate just the one occurrence), AC4
  regression (non-recurring items still fire at most once, full
  pre-existing suite unchanged); `App.test.tsx` proves two occurrences of
  the *same* series get independent, independently-dismissible banners
  (the actual UI-facing consequence of the old `CalendarItem`-keyed
  broadcast shape). lint/typecheck/build all pass; phase set to
  `validate`.
- 2026-09-14 — feature 026 (fix: recurring event reminders fire per
  occurrence) implemented: root cause was `CalendarItem.reminderFired`
  being a single boolean on the series' template row, so a recurring
  series' reminder could fire at most once ever. Replaced it with
  `remindersFired: number[]` (per-occurrence `originalStartTime` keys);
  moved `recurrence.ts` to `src/shared/` so the main-process
  `ReminderScheduler` reuses the exact same occurrence-expansion/exception
  logic the renderer's calendar view already had, rather than
  reimplementing it; scheduler now expands each item's occurrences within a
  lookahead window and fires/marks each due-and-unfired one independently.
  New `FiredReminder` broadcast type (keyed per-occurrence, not per-series)
  replaces `CalendarItem` on the `calendar:reminder-fired` channel so
  multiple fired occurrences of one series get independently-dismissible
  banners. `db.ts` migration adds `reminders_fired` and back-fills from any
  pre-026 `reminder_fired` boolean. Live-verified all 4 ACs with a
  standalone script driving a real `MailDb`/`SimClock`/`ReminderScheduler`
  through a daily recurring event across 4 simulated days (distinct fires
  per day, no double-fire, deleted occurrence skipped, edited occurrence
  fires at its new time not the old one). lint/typecheck/build pass;
  existing suite 422/422 (421 baseline + 1 new migration test; rest are
  compile/rename touch-ups, no behavior change to prior features). Phase
  set to `test`.
- 2026-09-14 — feature 025 (fix: attachments persist on the Sent Items
  copy) accepted by user: asked directly whether the underlying bug
  (`BUGS.md` B004) was still observed live; user confirmed no, likely a
  stale report from feature 009's development session. Accepted as
  verified-not-reproducible, backed by the regression tests added in
  `/test`; logged to CHANGELOG. Active feature set to 026 (Fix — recurring
  event reminders fire per occurrence), phase set to `implement`.
- 2026-09-14 — feature 025 (fix: attachments persist on the Sent Items
  copy) validated: lint/typecheck/build pass; full test suite (421/421)
  re-run 3x, stable; confirmed via `git diff` that `/test` touched only test
  files/docs, no implementation drift (unsurprising — `/implement` made no
  source change). All 4 ACs verified by tests + code inspection plus a
  fresh live check (independent of `/implement`'s): bundled `db.ts`
  standalone with `esbuild` and ran the exact `createMessage` call
  `ComposeWindow` makes for Send-with-attachment against a scratch copy of
  the real, in-use `~/AppData/Roaming/outlook-sim/outlook-sim.db` — the
  created Sent Items row came back with its attachment intact, Sent count
  went 4→5 as expected; real on-disk DB confirmed byte-for-byte unchanged
  (md5) afterward. No live multi-window Electron GUI click-through
  attempted (no Xvfb, same non-blocking gap as every prior feature).
  Flagged one open item (not a validation failure): the user hasn't yet
  confirmed whether they still see the original bug live — if so it must
  live outside the traced Node-side path (most likely the real
  contextBridge/IPC boundary), worth a direct check at `/accept`. Phase set
  to `accept`.
- 2026-09-14 — feature 025 (fix: attachments persist on the Sent Items
  copy) tested: since `/implement` found no code defect, added regression
  coverage closing the gap that let B004 go unverified — 7 new tests
  (414 → 421, all passing, re-run 3x stable): `db.test.ts` (+4, real
  `MailDb`, no mocking) covers a `sent`-folder create with attachments
  surviving both an immediate re-fetch and a close/reopen, the
  draft-then-update-to-sent path `ComposeWindow` actually uses, a reply/
  forward-shaped sent message with an attachment, and a regression check
  that editing a draft without touching `attachments` in the patch leaves
  it untouched; `ComposeWindow.test.tsx` (+2) covers attaching a file while
  replying and while forwarding, asserting it reaches `messages.create`
  (previously only fresh-compose was covered); `ReadingPane.test.tsx` (+1)
  covers a `sent`-folder message's attachments actually rendering (no
  prior test had set `folderId: 'sent'` specifically). lint/typecheck/build
  all pass. Test Notes filled in; phase set to `validate`.
- 2026-09-14 — feature 025 (fix: attachments persist on the Sent Items
  copy) implemented: investigated `BUGS.md` B004 across the full data path
  (`ComposeWindow.tsx`'s `persist()` → `db:messages:create`/`update` IPC
  passthroughs → `MailDb.createMessage`/`updateMessage` → `ReadingPane.tsx`
  rendering) and could not reproduce it — every link already correctly
  threads `attachments` through, confirmed via `git log` (unchanged since
  feature 002) and a live standalone `esbuild`-bundled `db.ts` check against
  a real `MailDb` covering all 4 ACs (fresh send, draft-then-send via
  update, reply/forward-shaped sent message with a freshly-added
  attachment, and an unrelated draft resave) — attachments round-tripped
  intact in every case. No source change made; flagged the non-reproduction
  explicitly rather than guessing at a fix. Left regression-test coverage
  of the full path for `/test`, per the loop's normal split. Phase set to
  `test`.
- 2026-09-14 — feature 024 (fix: persona replies quote the prior thread
  chain) accepted by user; logged to CHANGELOG; active feature set to 025
  (Fix — attachments persist on the Sent Items copy), phase set to
  `implement`.
- 2026-09-14 — feature 024 (fix: persona replies quote the prior thread
  chain) validated: lint/typecheck/build pass; full test suite (414/414)
  re-run 3x, stable; confirmed via `git diff` that `/test` touched only test
  files/docs plus `vitest.config.ts`'s `include` list, no implementation
  drift; all 4 ACs verified by tests + code inspection plus a live
  end-to-end check — bundled `db.ts`/`config.ts`/`clock.ts`/`personaReply.ts`
  standalone with `esbuild` and ran `generatePersonaReply` against a scratch
  copy of the real, in-use `~/AppData/Roaming/outlook-sim` data (real law-firm
  training scenario, 15 personas, 27 messages, a real configured Gemini API
  key): a genuine LLM reply came back with the stored body correctly
  containing "\<reply text\>" followed by the exact "On \<date\>, Name
  \<email\> wrote:" header and "\> "-prefixed quoted original, including a
  quoted blank line — matching feature 005's convention byte-for-byte, since
  both paths call the same shared `quoteBody()`; real on-disk DB/config files
  confirmed untouched (only the scratch copy was written to); no live
  multi-window Electron GUI click-through attempted (no Xvfb, same
  non-blocking gap as every prior feature); phase set to `accept`.
- 2026-09-14 — feature 024 (fix: persona replies quote the prior thread
  chain) tested: added a new `src/shared/quoteBody.test.ts` (4 tests) — the
  shared `quoteBody()` extracted in `/implement` had no dedicated test file
  yet; discovered and fixed a real gap while adding it — `vitest.config.ts`'s
  `include` list covered only `src/renderer/**` and `src/main/**`, so
  `src/shared/**` tests were silently never run by `npm test`; added
  `'src/shared/**/*.test.ts'` to `include`. Strengthened `personaReply.test.ts`
  with an exact byte-for-byte comparison against an independently-computed
  `quoteBody(sentMessage)` (AC2, "identical convention not just similar") and
  an explicit AC4-named test for the missing-prior-message guard (no crash,
  no LLM call, no Inbox insert). Full suite 408 → 414, all passing, re-run 3x
  stable; lint/typecheck/build all pass. Test Notes filled in; phase set to
  `validate`.
- 2026-09-14 — feature 024 (fix: persona replies quote the prior thread
  chain) implemented: extracted the trainee's own reply-quoting format
  (feature 005) out of `composeIntent.ts`'s private `quoteBody()` into a new
  shared `src/shared/quoteBody.ts`, used by both `composeIntent.ts`
  (renderer) and `personaReply.ts` (main) — guarantees the two never drift
  apart rather than just documenting a matching convention. Persona replies
  now build their stored body as `text + quoteBody(sentMessage)`; the
  "immediately-preceding message" is exactly `sentMessage` (the trainee's
  message that triggered the reply), which the function's existing early-
  return already guarantees is non-null, so the no-prior-message guard (AC4)
  holds structurally rather than via an added conditional. One existing
  `personaReply.test.ts` assertion needed a compile/content touch-up
  (exact-body match → `toContain` checks) since the body now legitimately
  contains more than just the LLM's text; `composeIntent.test.ts` untouched
  and still passing, confirming the extraction didn't change trainee-side
  behavior. lint/typecheck/build pass, existing suite still 408/408; also
  live-verified the exact quote format with a standalone `tsx` script
  against a real `MailDb`/`SimClock`. phase set to `test`.
- 2026-09-14 — feature 023 (fix: sent mail created as read, not unread)
  accepted by user; logged to CHANGELOG; active feature set to 024 (Fix —
  persona replies quote the prior thread chain), phase set to `implement`.
- 2026-09-14 — feature 023 (fix: sent mail created as read, not unread)
  validated: lint/typecheck/build pass; full test suite (408/408) re-run 3x,
  stable; confirmed via `git diff` that `/test` touched only test files/docs,
  no implementation drift, and that the entire implementation is a 2-line
  change in `ComposeWindow.tsx`; all 4 ACs verified by the test suite plus a
  live scripted check — bundled `db.ts` standalone with `tsx` against a real
  (non-mocked) `MailDb`/SQLite in a fresh temp dir: a real Send-shaped insert
  landed `is_read: 1`, a real inbox-shaped insert (no `isRead` passed, as
  every incoming-mail path does) landed `is_read: 0`, and a "legacy"
  pre-fix-shaped sent message (`isRead: false`) survived a close/reopen
  cycle unchanged, confirming no retroactive migration; no real
  `~/.config/outlook-sim` install exists in this (Windows) environment to
  cross-check against, unlike prior sessions' Linux sandbox — noted, not
  blocking, since the change is renderer-side logic only with no schema
  change; no live multi-window Electron GUI click-through attempted (no
  Xvfb, same non-blocking gap as every prior feature); phase set to `accept`.
- 2026-09-14 — feature 023 (fix: sent mail created as read, not unread)
  tested: added 2 tests (406 → 408, all passing; re-ran full suite 3x,
  stable) and extended 8 existing assertions in place of new scaffolding —
  `ComposeWindow.test.tsx`'s Send/Save & Close/draft-Send/reply/reply-all/
  forward tests now assert the right `isRead` value (AC1/AC2);
  `personaReply.test.ts`/`scheduler.test.ts`/`scenarioMailScheduler.test.ts`
  now assert `isRead: false` on inserted incoming mail (AC3, alongside
  `scenarioPack.test.ts` which already did); two new `db.test.ts` tests prove
  `createMessage` doesn't infer `isRead` from `folderId` and that an existing
  sent message's `isRead: false` survives a close/reopen untouched (AC4, no
  retroactive migration). lint/typecheck/build all still pass; phase set to
  `validate`.
- 2026-09-14 — feature 023 (fix: sent mail created as read, not unread)
  implemented: `ComposeWindow.tsx`'s single `persist()` call site (shared by
  Send/Reply/Reply All/Forward and Save & Close) now sends `isRead: folderId
  === 'sent'` to `messages.create`/`messages.update`; every incoming-mail
  creation path (`personaReply.ts`, unsolicited-mail `scheduler.ts`,
  `scenarioMailScheduler.ts`, `scenarioPack.ts` inbox seeding) never sets
  `isRead` and was confirmed by inspection to be untouched, still defaulting
  to unread via `MailDb.createMessage`. No retroactive migration — only the
  renderer's sent value changed, not `db.ts`'s insert/update SQL or
  defaulting. lint/typecheck/build pass, existing suite still 406/406
  unchanged; phase set to `test`.
- 2026-09-14 — iteration 2 backlog generated: decomposed the revised spec's
  new/changed Core Requirements into 27 new features (023-049) — 4 bug
  fixes (023-026, high priority: sent-mail-read, persona-reply quoting,
  Sent Items attachments, per-occurrence recurring reminders), the FileVine
  module (047/048 high priority for the core folder/client/notes CRUD, 049
  medium for the LLM-context wiring), and the rest of the spec revision's
  scope (Settings/scenario-pack/persona enhancements, ribbon rework, mail
  multi-select/context-menu/pop-out, calendar view/edit split + pop-out,
  clock mini-calendar, Tasks panel, styling pass) at medium/low priority.
  None of the 22 `done` features from iteration 1 were touched or
  invalidated — this iteration only adds to/extends them. `features/BACKLOG.md`
  rewritten to include all 49 entries, ordered by priority. Active feature
  set to 023 (first backlog item by priority), phase set to `implement`.
- 2026-09-14 — retro for iteration 1 closed: all 22 backlog features shipped and accepted. Revised `docs/SPEC.md` with the user (three open `BUGS.md` items folded in as Core Requirements, plus a large set of new/changed requirements gathered interactively — Settings scenario-pack/persona enhancements, ribbon rework incl. Settings-in-File-menu and a new About section, mail multi-select + context menu + pop-out windows, calendar view/edit-mode split + pop-out, simulated-clock mini-calendar, a scoped-in lightweight Tasks panel, an element-level styling pass, and a new "FileVine" case-file/matter panel that explicitly reverses a prior non-goal). Outer iteration bumped to 2, phase set to `spec` per the retro routing rule (spec changed this iteration) — `/spec` (or straight to `/features`) is next.
- 2026-09-12 — feature 020 (calendar recurring events) accepted by user; logged to CHANGELOG; backlog is now fully `done` — no active feature; phase set to `retro`
- 2026-09-12 — feature 020 (calendar recurring events) validated: lint/typecheck/build pass; full test suite (406/406) re-run 3x, stable; confirmed via `git diff` that `/test` touched only test files/docs plus a 7-line type-signature-only fix in `recurrence.ts` (verified the function body is byte-identical, no behavior change); all 4 ACs verified by tests + code inspection plus a live end-to-end check — bundled `db.ts`/`recurrence.ts`/`calendarDates.ts` standalone with `tsx` against a scratch copy of the real, in-use `~/.config/outlook-sim/outlook-sim.db` (5 real calendar items): the `recurrence_exceptions` migration ran cleanly, a weekly recurring item + an instance exception survived a simulated restart byte-for-byte, and occurrence expansion was independently re-checked across all 4 view types (day/workWeek/week/month) — specifically closing the one gap the Test Notes themselves flagged as unit-untested (work-week), which came back correct; real on-disk file confirmed byte-for-byte unchanged (md5) afterward; no live multi-window Electron GUI click-through attempted (no Xvfb, same non-blocking gap as every prior feature); phase set to `accept`
- 2026-09-12 — feature 020 (calendar recurring events) tested: added 33 tests (373 → 406, all passing; re-ran full suite 3x, stable) — new `recurrence.test.ts` (17) covers occurrence expansion (daily/weekly/monthly, DST safety, the monthly-clamping regression itself, exceptions matching by natural start time) and `upsertException`; `CalendarView.test.tsx` (+13) covers the Repeat select, multi-view occurrence display, the recurring 🔁 indicator, and the full "this event vs. the whole series" chooser/edit/delete flows; `db.test.ts` (+3) covers recurrenceRule/recurrenceExceptions defaulting, round-tripping through update, surviving a close/reopen cycle, and the column migration against a simulated pre-020 database. lint/typecheck/build all still pass; phase set to `validate`
- 2026-09-12 — feature 020 (calendar recurring events) implemented: a recurring series stays one `CalendarItem` row (the template); `recurrenceRule` narrowed to `'daily'|'weekly'|'monthly'|null`; new `recurrenceExceptions` field (JSON column + migration) holds per-occurrence overrides/deletions keyed by natural start time. New pure `renderer/src/recurrence.ts` expands a series into occurrences for the visible date range (day/week/month all now render off this), with a monthly-clamping bug (Jan 31 → Feb 28 → wrongly staying at Mar 28 instead of Mar 31) caught and fixed via a standalone script before wiring in. `CalendarItemForm` gained a Repeat select (hidden when editing a single occurrence); clicking a recurring occurrence now asks "this event or the whole series?" before opening the form, so edit/delete scope is unambiguous (AC3) — non-recurring items are unaffected, same UX as before. Deliberately flagged, not fixed: `ReminderScheduler` only fires a recurring event's reminder once (tied to the template row), never per-occurrence — out of 020's ACs but a real cross-feature gap, same category as the attachments/persona-reply issue from 009. Verified the full create/multi-view/instance-edit/series-delete flow with a throwaway RTL script before finishing, then deleted it. lint/typecheck/build pass, existing suite still 373/373 (compile-only fixture touch-ups for the new required field in 4 test files); phase set to `test`
- 2026-09-12 — feature 009 (mail mock attachments) accepted by user; logged to CHANGELOG; only feature 020 (Calendar recurring events) remains in the backlog; active feature set to 020, phase set to `implement`
- 2026-09-12 — feature 009 (mail mock attachments) accept-stage fix: user found live that a persona's LLM reply denied seeing a mock attachment the trainee had sent. Root cause: `personaReply.ts`'s thread-transcript builder (feature 015) never referenced `message.attachments` at all. Fixed by adding an `Attachments: <filenames>` line per message that has any; not a 009-AC failure, but a real cross-feature inconsistency. Added 2 regression tests (371 → 373, stable); lint/typecheck/build all still pass; phase stays `accept`
- 2026-09-12 — feature 009 (mail mock attachments) validated: lint/typecheck/build pass; full test suite (371/371) re-run 3x, stable; confirmed via `git diff` that `/test` touched only test files/docs, no implementation drift; all 4 ACs verified by tests + code inspection plus a live check — attachments confirmed structurally file-I/O-free (grepped all of `src/main`/`src/preload`, found only an opaque JSON column) and confirmed to survive a real restart via a scratch copy of the real, in-use `~/.config/outlook-sim/outlook-sim.db` (added attachments to a real message, closed/reopened `MailDb`, got identical content back); real on-disk DB confirmed byte-for-byte unchanged (md5) afterward; no live multi-window Electron GUI click-through attempted (no Xvfb, same non-blocking gap as every prior feature); phase set to `accept`
- 2026-09-12 — feature 009 (mail mock attachments) tested: added 10 tests (361 → 371, all passing; re-ran full suite 3x, stable) — `ComposeWindow.test.tsx` (+5) covers adding/removing attachment chips, sending them along, draft prefill, and reply deliberately not carrying attachments over; `ReadingPane.test.tsx` (+4) covers attachment rendering, the click-to-toggle placeholder note (with no `messages.update` call as a proxy for "no real file I/O"), and the note resetting on message change; `db.test.ts` (+1) covers attachments surviving a close/reopen cycle. lint/typecheck/build all still pass; phase set to `validate`
- 2026-09-12 — feature 009 (mail mock attachments) implemented: entirely UI — the `MessageAttachment`/`attachments` data model and SQLite persistence already existed from feature 002. `ComposeWindow.tsx` gained an attachments chip-list (add-by-filename form, remove button per chip), following the existing Cc pattern exactly; loaded from an existing draft, but fresh/reply/reply-all/forward all start empty (composeIntent.ts never carried attachments, so continuing that is not a scope expansion). `ReadingPane.tsx` renders attachments as 📎-prefixed buttons; clicking one toggles a "no file content" note via pure React state, with no filesystem/IPC call in the path, so AC4 holds structurally. Verified live that attachments survive a simulated `MailDb` close/reopen. lint/typecheck/build pass, existing suite still 361/361 unchanged; phase set to `test`
- 2026-09-12 — feature 022 (scenario pack save) accepted by user; logged to CHANGELOG; only low-priority features remain in the backlog (009, 020); active feature set to 009 (Mail mock attachments), phase set to `implement`
- 2026-09-12 — feature 022 (scenario pack save) validated: lint/typecheck/build pass; full test suite (361/361) re-run 3x, stable; confirmed via `git diff` that `/test` touched only test files/docs, no implementation drift; all 4 ACs verified by tests + code inspection plus a live end-to-end check — bundled `scenarioPack.ts`/`db.ts`/`config.ts`/`clock.ts` standalone with `tsx` and ran `buildScenarioPack` against a scratch copy of the real, in-use `~/.config/outlook-sim` data (8 inbox messages, 4 calendar items, 15 personas, real live Anthropic/Gemini API keys configured): built-pack counts matched the real store exactly across all three categories, passed `validateScenarioPack` unmodified, round-tripped through an actual save-to-file/reload/apply cycle into a second fresh store with all content preserved, and neither real API key appeared anywhere in the built pack's JSON; real on-disk `outlook-sim.db` confirmed byte-for-byte unchanged (md5) afterward; no live multi-window Electron GUI click-through attempted (no Xvfb, same non-blocking gap as every prior feature); phase set to `accept`
- 2026-09-12 — feature 022 (scenario pack save) tested: added 14 tests (347 → 361, all passing; re-ran full suite 3x, stable) — new `buildScenarioPack` tests cover name/description, persona id-dropping, inbox-only message scoping with correct `offsetMinutes`, calendar item offset/duration math (incl. `endTime: null`), pending scheduled messages surfacing as `timedMessages`, an empty-pack case, and a direct AC4 check that a configured API key never appears in the built pack's JSON; a dedicated round-trip test (build → JSON round trip → validate → apply into a second fresh store) confirms message/calendar item/persona/pending-timed-message all survive exactly (AC3); `SettingsView.test.tsx` gained 4 tests for the Save button's success/canceled/error/error-then-success paths. `scenario:savePack`'s IPC wiring itself (needs real Electron `dialog`) has no unit test, same category as `scenario:pickPack`/`window:openCompose`. lint/typecheck/build all still pass; phase set to `validate`
- 2026-09-12 — feature 022 (scenario pack save) implemented: new `buildScenarioPack` in `main/data/scenarioPack.ts` (inverse of 021's `applyScenarioPack`) snapshots current inbox/calendar/personas/pending-timed-messages into the same `ScenarioPack` schema; new `scenario:savePack` IPC (native save dialog, name derived from chosen filename) + `SaveScenarioPackResult` type + `window.api.scenario.savePack()`; new "Save Scenario Pack…" button in Settings' existing Scenario Pack section. Never reads Settings/API keys (AC4 holds structurally). Verified the full build→validate→apply round trip standalone (message/calendar item/persona/pending timed message all survived exactly) before wiring in the UI. lint/typecheck/build pass, existing suite still 347/347; phase set to `test`
- 2026-09-12 — feature 021 (scenario pack load) accepted by user; logged to CHANGELOG; active feature set to 022 (Scenario pack save), phase set to `implement`
- 2026-09-12 — feature 021 (scenario pack load) validated: lint/typecheck/build pass; full test suite (347/347) re-run 3x, stable; confirmed via `git diff` that `/test` touched only test files/docs, no implementation drift; all 5 ACs verified by tests + code inspection plus a live end-to-end check — bundled `scenarioPack.ts`/`db.ts`/`config.ts`/`clock.ts`/`scenarioMailScheduler.ts` standalone with `esbuild` and ran the full validate→apply→scheduled-delivery chain against a scratch copy of the real, in-use `~/.config/outlook-sim` data (11 messages, 4 calendar items, 15 personas): a bad pack came back with a specific error, applying a good pack replaced all three fully, the timed message stayed pending until the clock started running, then delivered exactly once; real on-disk files confirmed unmodified afterward; no live multi-window Electron GUI click-through attempted (no Xvfb, same non-blocking gap as every prior feature); phase set to `accept`
- 2026-09-12 — feature 021 (scenario pack load) tested: added 42 tests (305 → 347, all passing; re-ran full suite 3x, stable) — new `scenarioPack.test.ts` (26 tests) covers `validateScenarioPack`'s per-field errors/defaults and `applyScenarioPack`'s replace-not-append semantics, persona replacement, and offset-based timestamp math; new `scenarioMailScheduler.test.ts` (7 tests) covers due/not-due/paused/redeliver/multi-item/start-stop plus a real-`SimClock` pause/resume integration test; `ipc.test.ts` (+4) covers `scenario:applyPack`'s confirm/re-confirm handshake against a real DB; `SettingsView.test.tsx` (+5) covers the pick→apply→status flow, a canceled dialog showing nothing, an invalid pack's error reaching the screen verbatim, and the confirm/decline branches. `scenario:pickPack` itself has no unit test (same untestable-Electron-wiring category as `window:openCompose`). lint/typecheck/build all still pass; phase set to `validate`
- 2026-09-12 — feature 021 (scenario pack load) implemented: designed the `ScenarioPack` JSON schema (`shared/data-types.ts`) that 022 will reuse for saving — all timing is relative (`offsetMinutes` from load time), not absolute, since packs are meant to be reusable. New `main/data/scenarioPack.ts` hand-rolls JSON validation (no new dependency) returning a clear per-field error instead of throwing, plus `applyScenarioPack` which resets the mailbox/calendar (reusing 017's `resetMailboxAndCalendar`), replaces personas, seeds inbox/calendar entries at `clock.now() + offsetMinutes`, and persists `timedMessages` for a new `ScenarioMailScheduler` (mirrors the reminder/unsolicited-mail schedulers' shape) to deliver later. New `scenario:pickPack` IPC (main-process file dialog, since the renderer has no fs access) and `scenario:applyPack` (mirrors `session:startFreePlay`'s confirm/re-confirm handshake). New "Scenario Pack" section in Settings. Manually verified the full validate→apply→paused-no-deliver→running-delivers-once chain standalone before automated tests. lint/typecheck/build pass, existing suite still 305/305 (one exhaustive-channel-list fixture touch-up); phase set to `test`
- 2026-09-12 — feature 019 (calendar deadlines, all-day items & reminders) accepted by user; logged to CHANGELOG; active feature set to 021 (Scenario pack load), phase set to `implement`
- 2026-09-12 — feature 019 (calendar deadlines, all-day items & reminders) accept-stage UI fixes: (1) the All-day checkbox was small and not flush-left because it inherited the shared text-input rule's padding/border — fixed with a higher-specificity `input[type='checkbox']` rule giving it an explicit 18px size and no padding/border. (2) toggling All-day (which hides the End field) was visually shifting the All-day checkbox itself, since the form sits below a `flex:1` grid in a column flex layout — shrinking the form's height let the grid grow and pushed the form's top edge (and everything near it) down. Fixed by keeping the End row always mounted and hiding it via a new `visibility:hidden` class instead of unmounting it, so the form's height stays constant regardless of the toggle; updated the one test that checked for DOM removal to check the hidden class instead. lint/typecheck/build pass; full suite 305/305, re-run 3x, stable; phase stays `accept`
- 2026-09-12 — feature 019 (calendar deadlines, all-day items & reminders) validated: lint/typecheck/build pass; full test suite (305/305) re-run 3x, stable; confirmed via `git diff` that `/test` touched only test files/docs, no implementation drift; all 4 ACs verified by tests + code inspection plus a live end-to-end check — bundled `db.ts`/`clock.ts`/`reminderScheduler.ts` standalone with `esbuild` and, against a scratch copy of the real, in-use `~/.config/outlook-sim/outlook-sim.db`: created/edited a deadline, created/deleted an all-day item, and drove a real reminder through paused→no-fire, started→fires-once, ticked-again→no-refire, paused-again-with-a-new-due-item→no-fire; real on-disk DB confirmed byte-for-byte unchanged afterward; no live multi-window Electron GUI click-through attempted (no Xvfb, same non-blocking gap as every prior feature); phase set to `accept`
- 2026-09-12 — feature 019 (calendar deadlines, all-day items & reminders) tested: added 26 tests (279 → 305, all passing; re-ran full suite 3x, stable) — new `reminderScheduler.test.ts` (9 tests) covers fire-once/no-refire/paused-blocks-firing/multi-item-in-one-tick plus a real-`SimClock` pause/resume integration test; `db.test.ts` (+4) covers `reminderFired` defaulting/round-trip/persistence/migration; `ipc.test.ts` (+2) covers `broadcastReminderFired`; `CalendarView.test.tsx` (+13) covers Deadline creation, All-day toggle + exact local-midnight start time, reminder selection, and a full edit/delete/precedence-rule block; `App.test.tsx` (+2) covers the dismissible reminder banner(s). Caught and fixed a test-authoring race (not a product bug) where an early draft opened the create form on the very first render before the simulated-clock effect resolved. lint/typecheck/build all still pass; phase set to `validate`
- 2026-09-11 — feature 019 (calendar deadlines, all-day items & reminders) implemented: added `reminderFired` to `CalendarItem` (new column + migration); generalized 018's create-only form into `CalendarItemForm`, reused for create AND edit/delete — every calendar item is now a clickable button opening it pre-filled; new Type (Event/Deadline) and All-day (swaps Start to a native date input) fields cover AC1/AC2; new Reminder select plus a new `ReminderScheduler` (main process, matches the unsolicited-mail scheduler's real-time-poll-but-simulated-time-check shape) covers AC3, broadcasting `calendar:reminder-fired` to a new dismissible amber banner in `App.tsx`; AC4 holds both because `SimClock.now()` itself doesn't advance while paused and because the scheduler also explicitly checks `running`. Manually verified the scheduler's fire-once/no-refire/paused-blocks-firing logic and the DB migration against a scratch copy of the real DB before automated tests. lint/typecheck/build pass, existing suite still 279/279 (one compile fixture touch-up in `CalendarView.test.tsx`'s `makeItem` helper); phase set to `test`
- 2026-09-11 — feature 018 (calendar views & persistence) accepted by user (including the three accept-round fixes: simulated-clock "today" bug, duplicate ribbon view buttons + inactive-looking tab styling, and hiding the dead "New Meeting" button); logged to CHANGELOG; active feature set to 019 (Calendar deadlines, all-day items & reminders), phase set to `implement`
- 2026-09-11 — feature 018 (calendar views & persistence) third accept-stage UI fix (same round): removed the ribbon's "New Meeting" button entirely (was a disabled placeholder for meeting invites/RSVP, an explicit v1 non-goal per `docs/SPEC.md`) rather than leave a button that can never be wired up until that feature is built; `CALENDAR_ACTIONS` is now just `['New Event']`; updated `RibbonBar.test.tsx` accordingly. lint/typecheck/build pass; full suite 279/279, re-run 3x, stable; phase stays `accept`
- 2026-09-11 — feature 018 (calendar views & persistence) two more accept-stage UI fixes (same live-check round): (1) removed the ribbon's redundant Today/Day/Work Week/Week/Month buttons entirely — they duplicated CalendarView's own view-tab header; New Event/New Meeting stay; updated `RibbonBar.test.tsx` accordingly. (2) `.calendar-view-tab`'s unselected state used `--text-muted` (a leftover from its feature-001 static-mockup days), making real clickable tabs look disabled — changed to `--text` + `cursor: pointer`, matching the `.nav-switcher-item` convention; the active tab's highlight is unchanged. lint/typecheck/build pass; full suite 279/279, re-run 3x, stable; phase stays `accept`
- 2026-09-11 — feature 018 (calendar views & persistence) accept-stage bug fixed: user reported live that the calendar's "today" seemed to use the actual real-world date rather than the simulated clock's date. Root cause: two `Date.now()` call sites (the `today` highlight state's initializer, and the "Today" nav button) used the real wall clock, unlike the initial anchor load which already correctly used `clock.now()`. Fixed by routing both through the simulated clock (`today` is now `useState`/`setToday` kept in sync with `anchorMs`; a new `goToToday()` re-fetches simulated now for the button). Added 2 regression tests using a simulated date far from the real system date; confirmed both fail against the pre-fix code and pass after. lint/typecheck/build all still pass; full suite 278/278 (was 276), re-run 3x, stable; phase stays `accept`
- 2026-09-11 — feature 018 (calendar views & persistence) validated: lint/typecheck/build pass; full test suite (276/276) re-run 3x, stable; confirmed via `git diff` that `/test` touched only test files/docs, no implementation drift; all 4 ACs verified by tests + code inspection plus a live check — bundled `db.ts` standalone with `esbuild` and created a calendar item (using the exact shape `CalendarEventForm` sends) against a scratch copy of the real, in-use `~/.config/outlook-sim/outlook-sim.db` (3 real items already present): survived a close/reopen with identical fields, count correctly went 3→4→3 after cleanup, and the real on-disk file was confirmed byte-for-byte unchanged afterward; no live multi-window Electron GUI click-through attempted (no Xvfb, same non-blocking gap as every prior feature); phase set to `accept`
- 2026-09-11 — feature 018 (calendar views & persistence) tested: added 32 tests (244 → 276, all passing; re-ran full suite 3x, stable) — new `calendarDates.test.ts` (19 tests) covers the day/work-week/week/month range math plus the DST and month-overflow edge cases called out during `/implement`; new `CalendarView.test.tsx` (9 tests) covers AC4 (confirms the component reads through `window.api.data.calendarItems.list()`), AC2 (view-tab switching), and the core AC3 case (an event created via the form appears in Day view and stays visible after switching to Week and Month, plus a negative case for an out-of-range event); `RibbonBar.test.tsx` (+3) and `App.test.tsx` (+1) cover the New Event wiring end-to-end and that the other calendar ribbon buttons stay disabled placeholders. AC1 has no new test (unchanged since 001, already covered). lint/typecheck/build all still pass; phase set to `validate`
- 2026-09-11 — feature 018 (calendar views & persistence) implemented: replaced the feature-001 `CalendarView.tsx` placeholder with a real view over the existing `db:calendarItems:*` IPC from 002; new pure `calendarDates.ts` computes day/work-week/week/month date ranges (month is a fixed 42-day Sunday-start grid to sidestep DST/variable-week-count math) plus prev/next navigation and range labels — manually sanity-checked standalone via esbuild across a DST boundary and a month-end edge case before wiring in. View tabs (already a static mockup since 001) are now wired to real state; items fetched once and bucketed client-side per view, so AC3 ("events visible across views") holds by construction. Ribbon's long-disabled "New Event" placeholder is finally wired to an inline create form (Title/Description/start/end via `datetime-local` inputs; always `itemType:'event'`, no all-day/reminder/recurrence — that's 019/020 scope). Ribbon's Today/Day/Work Week/Week/Month/New Meeting stay disabled placeholders (view-switching lives in CalendarView's own tabs; meeting workflow is an explicit spec non-goal). lint/typecheck/build pass, existing suite still 244/244 unchanged (the empty-state message was deliberately kept identical so no existing assertions needed touching); phase set to `test`
- 2026-09-11 — feature 017 (free-play mode bootstrap) accepted by user; logged to CHANGELOG; active feature set to 018 (Calendar views & persistence), phase set to `implement`
- 2026-09-11 — feature 017 (free-play mode bootstrap) validated: lint/typecheck/build pass; full test suite (244/244) re-run 3x, stable; confirmed via `git diff` that `/test` touched only test files/docs, no implementation drift; all 3 ACs verified by tests + code inspection plus a live check — bundled `db.ts` standalone with `esbuild` and ran `hasMailboxOrCalendarData`/`resetMailboxAndCalendar` against a scratch copy of the real, in-use `~/.config/outlook-sim/outlook-sim.db` (11 real messages, 3 real calendar items, a real custom folder): messages/calendar wiped to empty, all folders including the custom one survived, and the real on-disk file was confirmed byte-for-byte unchanged (md5/mtime) afterward; AC2 confirmed by grepping the full `src/` tree for any scenario-pack dependency (none exists yet, 021/022 still backlog); no live multi-window Electron GUI click-through attempted (no Xvfb, same non-blocking gap as every prior feature); phase set to `accept`
- 2026-09-11 — feature 017 (free-play mode bootstrap) tested: added 15 tests on top of the coverage already written during `/implement` (230 → 244, all passing; re-ran full suite 3x, stable) — `db.test.ts` covers `hasMailboxOrCalendarData()`/`resetMailboxAndCalendar()` including that custom folders survive a reset and the reset persists across close/reopen; `ipc.test.ts` covers the `session:startFreePlay` confirm/re-confirm handshake end-to-end (empty resets without a prompt, non-empty mailbox or calendar-only data is refused and left intact, `confirmed:true` wipes and broadcasts, an unconfirmed call broadcasts nothing); `SettingsView.test.tsx` covers the Session section's `window.confirm` gating in both accept/decline directions; `App.test.tsx` covers the previously-selected message getting cleared after a free-play reset. AC2 (zero scenario pack) has no dedicated test since no scenario-pack concept exists yet to interact with. lint/typecheck/build all still pass; phase set to `validate`
- 2026-09-11 — feature 017 (free-play mode bootstrap) implemented: new `session:startFreePlay` IPC (`window.api.session.startFreePlay`) wraps two new `MailDb` methods, `hasMailboxOrCalendarData()` and `resetMailboxAndCalendar()` (clears `messages` + `calendar_items` only — folders, Settings, personas, identity, system prompt untouched); a confirm/re-confirm handshake (`StartFreePlayResult`) means an already-empty mailbox resets with no prompt, while a non-empty one gets a native `window.confirm` before wiping. New "Session" section in `SettingsView.tsx` with a "Start Free-Play" button; `App.tsx` clears `selectedMessageId` via a new `onFreePlayStarted` callback since the selected message may no longer exist post-reset. Deliberately left untouched: folder structure, the sim clock, and the unsolicited-mail scheduler's due-time state (none are "mailbox/calendar" per the feature's scope); implemented as an empty reset rather than "lightly seeded" to avoid baking in a hardcoded domain the spec explicitly forbids. lint/typecheck/build pass; existing suite still 230/230 (one pre-existing exhaustive-channel-list test updated to include the new IPC channel, no behavior change); phase set to `test`
- 2026-09-11 — feature 008 (mail search) accepted by user; logged to CHANGELOG; active feature set to 017 (Free-play mode bootstrap), phase set to `implement`
- 2026-09-11 — feature 008 (mail search) validated: lint/typecheck/build pass; full test suite (230/230) re-run 3x, stable; confirmed via `git diff` that `/test` touched only test files, no implementation drift; all 4 ACs verified by tests + code inspection — this feature is pure renderer UI with no separate main-process/DB layer to additionally exercise standalone, so the real-component Vitest suite (mocking only `window.api`) is the strongest available check; no live multi-window Electron GUI click-through attempted (no Xvfb, same non-blocking gap as every prior feature); phase set to `accept`
- 2026-09-11 — feature 008 (mail search) tested: added 7 tests on top of the coverage already written during `/implement` (223 → 230, all passing; re-ran full suite 3x, stable) — one test proves all four searched fields (subject/body/sender name/sender email) match case-insensitively; two cover the folder-vs-all-folders scope (including that the unscoped fetch stays lazy until "All folders" is actually picked); one proves live updates without a folder change; one proves clearing restores the folder view; two extra ones cover a distinct no-results empty state and search combining with the existing category filter. lint/typecheck/build all still pass; phase set to `validate`
- 2026-09-11 — feature 008 (mail search) implemented: entirely UI in `MessageListPane.tsx` — a search input filters by case-insensitive substring match against subject/body/sender (name+email), plus a scope select ("This folder"/"All folders"); "all folders" reuses the existing unscoped `messages.list()` call from feature 002 (no new IPC), fetched lazily only while that scope is active. Filter pipeline is messages → search → category filter (existing, unchanged) → rendered rows; clearing the query falls through to the plain folder view for free, and nothing here touches folder selection so results update live without navigating. Search/scope deliberately not reset on folder change (unlike the category filter), matching real Outlook. lint/typecheck/build pass, existing suite still 223/223; phase set to `test`
- 2026-09-11 — feature 007 (mail read/unread, flags & categories) accepted by user (including the read/unread bug fix); logged to CHANGELOG; active feature set to 008 (Mail search), phase set to `implement`
- 2026-09-11 — feature 007 (mail read/unread, flags & categories) accept-stage bug fixed: user reported that clicking "Mark as unread" in the Reading Pane immediately flipped the message back to read while it stayed open. Root cause: the fetch effect re-ran on every `messagesVersion` bump (including the one from the user's own toggle) and unconditionally re-applied the auto-mark-read check. Fixed with a `lastCheckedIdRef` that limits the auto-mark check to the first time a given message id is opened; a first fix attempt (stamping the ref only when a mark occurred) was caught as still-broken by a new regression test before landing the corrected version (stamp on every check, mark-or-not). Added 2 regression tests (221 → 223, stable across 3 runs); lint/typecheck/build all still pass; phase stays `accept`
- 2026-09-11 — feature 007 (mail read/unread, flags & categories) validated: lint/typecheck/build pass; full test suite (221/221) re-run 3x, stable; confirmed via `git diff` that `/test` touched only test files, no implementation drift; all 5 ACs verified by tests + code inspection plus a live check — bundled `db.ts` standalone with `esbuild` and drove a real (non-mocked) `MailDb` through create→mark read/unread→flag→categorize→close/reopen, all correct; cross-checked the user's real `~/.config/outlook-sim/outlook-sim.db` for schema sanity (no regression, though the new UI hasn't been exercised there yet since the app hasn't been relaunched); no live multi-window Electron GUI click-through attempted (no Xvfb, same non-blocking gap as every prior feature); phase set to `accept`
- 2026-09-11 — feature 007 (mail read/unread, flags & categories) tested: added 13 tests on top of the coverage already written during `/implement` (208 → 221, all passing; re-ran full suite 3x, stable) — `ReadingPane.test.tsx` covers auto-mark-read-on-open (and no-op when already read), the read/flag toggle buttons in both directions, and category add (with dedup)/remove; `MessageListPane.test.tsx` covers the per-row flag button (without triggering row-select), the category filter appearing only when needed, correctly narrowing the list, and resetting on folder change; `db.test.ts` covers a populated isRead/isFlagged/categories message surviving a close/reopen cycle (AC5). lint/typecheck/build all still pass; phase set to `validate`
- 2026-09-11 — feature 007 (mail read/unread, flags & categories) implemented: entirely UI — the `isRead`/`isFlagged`/`categories` data model and persistence already existed from feature 002. `ReadingPane.tsx`'s fetch effect now auto-marks a message read on open (fires `messages.update` then relies on the existing `messagesVersion` broadcast loop to refresh); added Mark as read/unread and Flag/Unflag toggle buttons to all three action-row branches; added a categories row (removable pill tags + add-category input, free-form strings, no predefined taxonomy). `MessageListPane.tsx` rows now have a sibling flag-glyph button (not nested, since buttons can't nest) plus an inline category-tag summary, and the header gained a category filter `<select>` (client-side filter of the already-fetched folder list). No `App.tsx` or backend changes needed — the existing `data:messages-changed` broadcast keeps both panes in sync. Fixed a self-inflicted regression along the way (wrapping the folder name in a `<span>` broke `getByText(..., {selector: '.message-list-header'})` assertions, since Testing Library's `getByText` only reads direct text-node children, not full `textContent`); lint/typecheck/build pass, existing suite still 208/208; phase set to `test`
- 2026-09-11 — feature 006 (mail delete & Deleted Items) accepted by user (including the ribbon-Delete fix); logged to CHANGELOG; active feature set to 007 (Mail read/unread, flags & categories), phase set to `implement`
- 2026-09-11 — feature 006 (mail delete & Deleted Items) accept-stage feedback addressed: user reported the ribbon's "Delete" button does nothing; root cause was a pre-existing feature-001 placeholder (disabled, no distinct disabled styling, same pattern as Reply/Reply All/Forward in the ribbon) that predates this feature but became misleading now that Delete actually works elsewhere; user chose to wire it up rather than log it separately or leave it. `RibbonBar.tsx` now maps each action name to an optional handler (`onDelete` alongside the existing `onNewEmail`) instead of special-casing New Email; `App.tsx` enables it via `canDeleteSelected = selectedMessageId && selectedFolderId !== 'deleted'` (disabled in Deleted Items since Delete isn't a Reading Pane action there either) and reuses a new shared `moveMessageToDeleted` helper so both the ribbon and `handleDeleteMessage` go through the same path; added 4 tests (204 → 208, stable across 3 runs); lint/typecheck/build all still pass; phase stays `accept`
- 2026-09-11 — feature 006 (mail delete & Deleted Items) validated: lint/typecheck/build pass; full test suite (204/204) re-run 3x, stable; all 3 ACs verified by tests + code inspection plus a live check — bundled `db.ts` standalone with `esbuild` and drove a real (non-mocked) `MailDb` through delete-from-inbox/sent/drafts, restore, and permanent-delete, all behaving correctly; additionally cross-checked the user's real `~/.config/outlook-sim/outlook-sim.db`, which had already picked up the `previous_folder_id` migration from a real app launch since `/implement`, with all 8 pre-existing real messages intact — strong non-scripted evidence the migration is production-safe; no live multi-window Electron GUI click-through attempted (no Xvfb, same non-blocking gap as every prior feature); phase set to `accept`
- 2026-09-11 — feature 006 (mail delete & Deleted Items) tested: added 11 tests on top of the coverage already written during `/implement` (193 → 204, all passing; re-ran full suite 3x, stable) — `db.test.ts` covers `previousFolderId` defaulting, delete-then-restore round-tripping, permanent deletion from Deleted Items, close/reopen persistence of a deleted message, and the `previous_folder_id` migration path for pre-existing DBs; `ReadingPane.test.tsx` covers Delete appearing (and firing) in both normal folders and Drafts, and Deleted Items showing only Restore/Delete permanently; `App.test.tsx` covers the three handlers calling the right `window.api.data.messages.*` calls with the right arguments and clearing the selection; lint/typecheck/build all still pass; UI-layer persistence-across-a-real-restart remains untested (no Playwright/xvfb driver, same gap as prior features) — DB-layer persistence is covered instead; phase set to `validate`
- 2026-09-11 — feature 006 (mail delete & Deleted Items) implemented: "Delete" is a soft move to the `deleted` folder (reuses the existing generic `db:messages:update` IPC path, no new channels); added `previousFolderId: string | null` to `MailMessage` (new nullable `previous_folder_id` SQLite column + `ALTER TABLE` migration for pre-existing DBs, alongside the existing `cc` migration) so Restore knows the original folder; `ReadingPane.tsx`'s action row now branches three ways — Drafts (Edit draft + Delete), Deleted Items (Restore + Delete permanently, the latter calling the existing real `db:messages:delete`), everything else (Reply/Reply All/Forward + Delete) — with handlers in `App.tsx` clearing the selection afterward; no new UI in `MessageListPane` or the ribbon, consistent with Reply/Forward's existing ReadingPane-only pattern; lint/typecheck/build pass, existing suite still 193/193 (compile-only fixture touch-ups — new `previousFolderId` field / mock props — in 7 test files, no behavior changes there); verified the migration against a scratch copy of the real `~/.config/outlook-sim/outlook-sim.db` (column added, rows intact); phase set to `test`
- 2026-09-11 — feature 016 (LLM unsolicited incoming mail scheduler) accepted by user; logged to CHANGELOG; all high-priority features now done; active feature set to 006 (Mail delete & Deleted Items), phase set to `implement`
- 2026-09-11 — feature 016 (LLM unsolicited incoming mail scheduler) validated: lint/typecheck/build pass; full test suite (193/193) re-run 3x, stable; all 4 ACs verified by tests + a skeptical code-level read of scheduler.ts/index.ts/App.tsx; two non-blocking design notes recorded (the "upcoming calendar items" filter excludes already-overdue-but-still-open deadlines, since CalendarItem has no resolved/completed field yet to distinguish that case; the Subject/body parser has no defense against a model wrapping its response in markdown fences, though it fails safe rather than inserting garbled content); live end-to-end generation check from `/implement` re-confirmed as valid evidence for AC2; live Electron app-lifecycle wiring and real network calls remain flagged, non-blocking gaps; phase set to `accept`
- 2026-09-11 — feature 016 (LLM unsolicited incoming mail scheduler) tested: added 4 tests on top of the 14 already written during `/implement` (189 → 193, all passing; re-ran full suite 3x, stable) — interval-bounds assertion (1-3 simulated hours), persona selection actually varying across multiple configured personas, correspondence scoping (a second persona's mail doesn't leak into the chosen persona's prompt), a concurrency guard test (overlapping ticks don't double-fire), and a real-`SimClock` (not mocked) pause/start/pause integration test; lint/typecheck/build all still pass; live-API and real Electron-lifecycle paths remain flagged, non-blocking limitations — see feature file Test Notes; phase set to `validate`
- 2026-09-11 — feature 016 (LLM unsolicited incoming mail scheduler) implemented: new `src/main/llm/scheduler.ts` with `generateUnsolicitedMail` (picks a random persona, prompts for a Subject/body-formatted new email referencing recent correspondence + upcoming calendar deadlines, parses and inserts into Inbox) and `UnsolicitedMailScheduler` (a real-time 10s poller checking a `ConfigStore`-persisted `nextDueSimTime` against `clock.now()`, only firing while the sim clock is running, randomized 1-3 simulated hours between attempts); wired into `index.ts` alongside the existing clock start/pause lifecycle (AC4), broadcasting through the existing `data:messages-changed` plus a new `llm:unsolicited-mail-failed` channel — generalized 015's error banner in `App.tsx` to handle both sources without duplicating UI; lint/typecheck/build pass, tests 175→189 (14 new: scheduler content-generation + scheduling-logic tests, config.ts scheduler-state round-trip, App.tsx banner test); additionally ran a real end-to-end check against the already-configured real Anthropic key + personas with a seeded calendar deadline — got back a coherent, in-character email correctly referencing that deadline; calendar items have no creation UI yet (018/019 still backlog) so the coherent-deadline-reference behavior is implemented/tested but not yet user-demonstrable from a fresh install without seeding; phase set to `test`
- 2026-09-11 — feature 015 (LLM persona reply generation) accepted by user, who independently confirmed it live in the running app first (sent "please respond" to persona Patricia Sim, got a real in-character reply in Inbox 2 seconds later); logged to CHANGELOG; active feature set to 016 (LLM unsolicited incoming mail scheduler), phase set to `implement`
- 2026-09-11 — feature 015 (LLM persona reply generation) validated: lint/typecheck/build pass; full test suite (175/175) re-run 3x, stable; all 4 ACs verified by tests + code inspection; additionally ran a real live end-to-end sanity check — bundled `personaReply.ts` with the real `MailDb`/`ConfigStore`/`SimClock` (temp-dir-backed, not mocked) and a real invalid OpenAI key, confirming the whole pipeline (persona lookup → thread assembly → real network call → error handling) works correctly with zero Inbox rows and no crash; one non-blocking robustness observation noted (an uncaught hypothetical DB-insert failure would produce an unhandled-rejection warning, not a crash — not one of AC4's stated failure modes); live Electron multi-window verification not attempted (no Xvfb, same non-blocking sandbox gap as prior features); phase set to `accept`
- 2026-09-11 — feature 015 (LLM persona reply generation) tested: added 6 tests on top of the 18 already written during `/implement` (169 → 175, all passing; re-ran full suite 3x, stable) — thread exclusion (unrelated subject stays out of the prompt), correct-persona matching among several configured personas, case-insensitive persona email matching, simulated-vs-wall-clock timestamp independence, a Cc-only persona not also getting a reply (locks in the scope decision), and the Reply flow (not just fresh Send) triggering persona-reply generation; lint/typecheck/build all still pass; live-API and real multi-window Electron paths remain flagged, non-blocking limitations — see feature file Test Notes; phase set to `validate`
- 2026-09-11 — feature 015 (LLM persona reply generation) implemented: new `generatePersonaReply(db, config, clock, sentMessageId)` in `src/main/llm/personaReply.ts`, triggered (fire-and-forget) from `ComposeWindow.tsx`'s Send path via a new `llm:personaReply` IPC channel; matches the sent message's `toEmail` against configured Personas, assembles system prompt + persona fields + a thread history found via normalized-subject/participant matching (no explicit conversation id in the schema), calls the existing `generateText` (014) with instructions to respond with a literal `NO_REPLY` marker when a reply isn't warranted, and inserts into Inbox (persona as From, simulated `clock.now()` timestamp) only on a genuine successful reply decision; failures broadcast a new `llm:persona-reply-failed` event shown as a dismissible banner in `App.tsx` (no such error-surfacing mechanism existed before); lint/typecheck/build pass, tests 151→169 (18 new: personaReply unit tests incl. thread-matching, ipc handler tests, ComposeWindow trigger-wiring tests, App banner test); scope deliberately limited to the primary To persona only (no fan-out to Cc'd personas); phase set to `test`
- 2026-09-11 — feature 014 (LLM client integration) validated: lint/typecheck/build pass; full test suite (151/151) re-run 3x, stable; all 4 ACs verified by tests + code inspection (grepped for provider-literal leakage and for every `window.api.llm.*` call site); additionally ran a real live-network sanity check — bundled `client.ts` standalone with `esbuild` and hit all four real provider APIs (OpenAI/Anthropic/Gemini/xAI) with invalid keys, confirming real 401/400 error responses get parsed into clear messages exactly as the mocked tests assumed, without throwing; success-path text extraction remains unverified against a real 2xx response (no valid API keys in this sandbox) and AC4's real trigger path remains unverified (015/016 don't exist yet) — both flagged, neither blocking; live Electron GUI verification not attempted (no Xvfb, same non-blocking sandbox gap as prior features); phase set to `accept`
- 2026-09-11 — feature 014 (LLM client integration) tested: added 3 tests on top of the already-substantial suite written during `/implement` (148 → 151, all passing; re-ran full suite 3x, stable) — a `client.test.ts` test proving one identical call/result shape across all four providers (AC3), a `SettingsView.test.tsx` test proving no LLM call happens merely from mounting/loading Settings (AC4), and an `ipc.test.ts` test proving registering the IPC handlers alone triggers no `fetch` (AC4); lint/typecheck/build all still pass; AC1's live-API verification and AC4's "no scheduler/persona-reply exists yet to test the real trigger path" remain flagged limitations (no API keys in this sandbox; 015/016 not built yet) — see feature file Test Notes; phase set to `validate`
- 2026-09-11 — feature 014 (LLM client integration) implemented: new provider-agnostic `generateText(settings, input)` in `src/main/llm/client.ts` calling OpenAI/xAI (`/v1/chat/completions`), Anthropic (`/v1/messages`), and Gemini (`generateContent`) directly via `fetch` (no SDKs added), never throwing — always resolving `{ok:true,text}` or `{ok:false,error}`; exposed via two thin IPC wrappers (`llm:generate` reads persisted Settings, `llm:test` takes explicit settings) and `window.api.llm.*`; added a "Test Connection" button to Settings' LLM Provider section as the explicit, user-triggered way to exercise AC1/AC2 end-to-end (015/016, the real triggered callers, don't exist yet, and AC4 forbids any automatic call); lint/typecheck/build pass, tests 131→148 (16 new: client unit tests against mocked `fetch` per provider + error paths, IPC channel tests, SettingsView Test Connection tests); AC1's "successfully call the real APIs" verified only against mocked responses shaped like each documented API (no API keys available in this sandbox) — deferred to the user's manual check at `/accept`; also caught up a backlog of prior-session work that had never been committed (feature 013 simulated office clock, B001 Settings-close bug fix, and the commit/push step added to the dev-loop skill files themselves) in two separate commits before starting 014, per user's explicit choice when asked; a `seed-data/` folder with what looks like sensitive scenario data was deliberately left uncommitted; phase set to `test`
- 2026-09-11 — set up `BUGS.md` as the ad-hoc bug tracker (outside the active-feature loop); backfilled B001 (Settings screen had no way to close) into it
- 2026-09-11 — ad-hoc bug fix (outside the active-feature loop, feature stays 014, phase stays `implement`): Settings screen had no way to close once opened; see `BUGS.md` B001 for details. Tests + typecheck pass.
- 2026-09-11 — feature 013 (simulated office clock) accepted by user; logged to CHANGELOG; active feature set to 014 (LLM client integration), phase set to `implement`
- 2026-09-11 — feature 013 (simulated office clock) validated: lint/typecheck/build pass; full test suite (131/131) re-run 3x, stable; all 5 ACs verified by direct code inspection plus the existing automated coverage (AC3's reminder-firing half reconfirmed genuinely out of scope — no consumer exists anywhere in the app, grepped `reminderMinutesBefore`); cross-checked the real on-disk `~/.config/outlook-sim/config/clock.json` matches the `ClockState` type and reflects a sane paused/60x state from prior manual use, not a wall-clock reset; confirmed the `before-quit` → `simClock.pause()` design decision is wired as claimed; live Electron GUI verification not attempted (no Xvfb in this sandbox, same non-blocking gap as features 001/005), deferred to `/accept`; phase set to `accept`
- 2026-09-10 — feature 013 (simulated office clock) tested: added 21 tests across 4 files (110 → 131, all passing; re-ran full suite 3x to rule out flakiness from the timing-sensitive tests) — `clock.test.ts` uses fake timers for exact anchor-math verification (start/pause/resume/speed-change/restart-persistence), `ipc.test.ts` drives the clock through real IPC handlers, `OfficeClock.test.tsx` covers the UI (exported `computeDisplayTime` for direct testing after an initial flaky DOM-timing approach was abandoned) plus interval setup/teardown via spies, and `ComposeWindow.test.tsx` proves message timestamps come from simulated time by deliberately diverging it from a spied wall-clock; lint/typecheck/build all still pass; AC3's reminder-firing half and the `before-quit` Electron lifecycle hook remain untested (no consumer / no real Electron process available to a unit test, respectively) — flagged for `/validate`; phase set to `validate`
- 2026-09-10 — feature 013 (simulated office clock) implemented: new `SimClock` (`src/main/data/clock.ts`), an anchor-based (sim time + real time + running + speed) JSON-persisted clock exposed via `clock:*` IPC / `window.api.data.clock`; pauses automatically on app quit so restarts resume exactly where they left off rather than drifting through real downtime; new `OfficeClock.tsx` (Start/Pause + speed select + live display, ticking locally) rendered in `RibbonBar`; `ComposeWindow.tsx`'s message timestamps now come from `clock.now()` instead of `Date.now()`; reminder firing has no consumer yet (no reminder mechanism exists anywhere in the app) so that half of AC3 is forward-looking, same pattern as recent features; lint/typecheck/build/tests (110/110) all pass, including compile-fixes to `ipc.test.ts` and `mockApi.ts`; phase set to `test`
- 2026-09-10 — feature 012 (settings: personas (contacts) CRUD) accepted by user; logged to CHANGELOG; active feature set to 013 (simulated office clock), phase set to `implement`
- 2026-09-10 — feature 012 (settings: personas (contacts) CRUD) validated: lint/typecheck/build/tests (110/110) all pass; all 4 ACs verified by tests + code inspection; confirmed via `git diff` that backend/preload/ComposeWindow files are genuinely untouched; cross-checked the real `personas.json` matches its type exactly; directly read `ComposeWindow.tsx:23,128-138` to confirm the pre-existing AC3 wiring; live Electron GUI verification not re-attempted (same sandbox limitation, non-blocking); phase set to `accept`
- 2026-09-10 — feature 012 (settings: personas (contacts) CRUD) tested: added 7 tests in `PersonasSettings.test.tsx` (103 → 110, all passing) covering empty state, list rendering, Add-Persona validation, create (all fields incl. optional extra prompt left blank), edit-in-place, cancel-discards, and delete-persists-remaining-array; AC2's restart-persistence half and AC3 (compose To dropdown) confirmed already covered by pre-existing `config.test.ts`/`ComposeWindow.test.tsx` coverage; lint/typecheck/build all still pass; phase set to `validate`
- 2026-09-10 — feature 012 (settings: personas (contacts) CRUD) implemented: UI-only — persona data model, JSON persistence, and IPC already existed from feature 002, and AC3 (personas selectable in compose To) was already true via `ComposeWindow`'s existing persona fetch from feature 004. New `PersonasSettings.tsx` component (list + inline create/edit/delete form, immediate full-array persist on each action, no confirmation dialog — matching `FolderPane`'s CRUD pattern) rendered as a 4th section in `SettingsView.tsx`; lint/typecheck/build/tests (103/103) all pass; phase set to `test`
- 2026-09-10 — feature 011 (settings: trainee identity & system prompt) accepted by user; logged to CHANGELOG; active feature set to 012 (settings: personas (contacts) CRUD), phase set to `implement`
- 2026-09-10 — feature 011 (settings: trainee identity & system prompt) validated: lint/typecheck/build/tests (103/103) all pass; all 4 ACs verified by tests + code inspection; confirmed via `git diff` that backend/preload/ComposeWindow files are genuinely untouched by this feature; cross-checked the real `identity.json`/`system-prompt.json` match their types exactly; directly read `ComposeWindow.tsx:79-91` to confirm the pre-existing AC2 wiring; live Electron GUI verification not re-attempted (same sandbox limitation, non-blocking); phase set to `accept`
- 2026-09-10 — feature 011 (settings: trainee identity & system prompt) tested: added 7 tests in `SettingsView.test.tsx` (96 → 103, all passing) covering identity prefill/save/independent-Saved-indicator and system-prompt prefill/save/independent-Saved-indicator; hit and fixed a real accessible-name collision between the System Prompt section's `aria-label` and its textarea's `aria-label` (both "System Prompt") by scoping via role instead; AC2 confirmed already covered by pre-existing `ComposeWindow.test.tsx` coverage from feature 004; lint/typecheck/build all still pass; phase set to `validate`
- 2026-09-10 — feature 011 (settings: trainee identity & system prompt) implemented: UI-only — identity/system-prompt data model, JSON persistence, and IPC already existed from feature 002, and AC2 (outgoing mail uses configured identity) was already true via `ComposeWindow`'s existing `persist()` from feature 004. Restructured `SettingsView.tsx` into three sections (LLM Provider, Trainee Identity, System Prompt), each with its own load-on-mount prefill, Save button, and "Saved" indicator; fixed a resulting test ambiguity (three same-named "Save" buttons) by scoping the Provider section's existing tests via its new `region` role; lint/typecheck/build/tests (96/96) all pass; phase set to `test`
- 2026-09-10 — feature 010 (settings: LLM provider, model & API key storage) accepted by user; logged to CHANGELOG; active feature set to 011 (settings: trainee identity & system prompt), phase set to `implement`
- 2026-09-10 — feature 010 (settings: LLM provider, model & API key storage) validated: lint/typecheck/build/tests (96/96) all pass; all 5 ACs verified by tests + code inspection; confirmed `config.ts` untouched by this feature (`git diff` empty) so no persistence/migration risk, and cross-checked the real `~/.config/outlook-sim/config/settings.json` matches the `Settings` shape exactly; live Electron GUI verification not re-attempted (same sandbox limitation documented in feature 005, non-blocking); phase set to `accept`
- 2026-09-10 — feature 010 (settings: LLM provider, model & API key storage) tested: added 9 tests across 2 files (87 → 96, all passing) — `SettingsView.test.tsx` covering the provider list, prefill, model editing, per-provider API key switching/preservation, and full-record Save; `App.test.tsx` covering the Settings nav-button entry/exit wiring; lint/typecheck/build all still pass; AC3's JSON-persistence-across-restarts half and AC5's no-network claim were left to their existing pre-feature coverage (`config.test.ts`, `no-network.test.ts`) rather than re-tested at the UI layer; phase set to `validate`
- 2026-09-10 — feature 010 (settings: LLM provider, model & API key storage) implemented: UI-only — the Settings data model/JSON persistence/IPC already existed from feature 002. Added `SettingsView.tsx` (provider select, free-text model input, per-provider password-masked API key input, explicit Save) and wired it into `App.tsx` via a new "Settings" nav-rail button (not a NavSwitcher tab, since that's deliberately Mail/Calendar-only) that swaps the main content pane; lint/typecheck/build/tests (87/87) all pass; AC4/AC5's "subsequent LLM calls" have no runtime yet (that's feature 014) so this delivers the data-model invariant (`apiKeys[provider]`) and confirms zero network calls, not an actual call-time key selection; phase set to `test`
- 2026-09-10 — feature 005 (mail reply, reply all & forward) accepted by user; logged to CHANGELOG; active feature set to 010 (settings: LLM provider, model & API key storage), phase set to `implement`
- 2026-09-10 — feature 005 (mail reply, reply all & forward) validated: lint/typecheck/build/tests (87/87) all pass; all 5 ACs verified by the test suite plus code inspection (AC2 confirmed against the Cc-based design the user approved in `/implement`); additionally verified the SQLite `cc`-column migration against a scratch copy of the user's actual `~/.config/outlook-sim/outlook-sim.db` (untouched original confirmed via mtime); live Electron GUI verification was attempted but blocked by the sandbox (no Xvfb, `apt-get`/`sudo` both require privileges unavailable here) — flagged as a pre-existing, non-blocking environment gap consistent with features 001/002's history, deferred to the user's own check at `/accept`; phase set to `accept`
- 2026-09-10 — feature 005 (mail reply, reply all & forward) tested: added 26 tests across 5 files (61 → 87, all passing) — a new `composeIntent.test.ts` unit-testing the reply/reply-all/forward prefill+subject-prefix-dedup logic directly, `ComposeWindow`/`ReadingPane`/`App` integration coverage for the UI wiring and mock-send path, and `db.test.ts` coverage for Cc round-tripping plus (most importantly) the `ALTER TABLE` migration path against a simulated pre-existing on-disk DB without the `cc` column; lint/typecheck/build all still pass; live multi-window Electron verification remains deferred to `/validate`; phase set to `validate`
- 2026-09-10 — feature 005 (mail reply, reply all & forward) implemented: added Cc support to the data model (user-approved scope expansion — Reply and Reply All had nothing to differ on with only a single-recipient message model) via a new `cc: MessageRecipient[]` field, SQLite column + migration for existing DBs; reply/reply-all/forward wired from new ReadingPane buttons through compose-window query params to a pure `buildComposeSeed` helper handling recipient/Cc prefill, quoted body, and dedup'd Re:/Fwd: subject prefixing; all three mock-send via the existing compose persist path unchanged; lint/typecheck/build/tests (61/61) all pass, including compile-only fixture touch-ups in 4 existing test files; live Electron verification deferred to `/validate` (no Playwright/xvfb driver exists in this repo); phase set to `test`
- 2026-09-10 — feature 004 (mail compose, mock-send & drafts) accepted by user; logged to CHANGELOG; active feature set to 005 (mail reply, reply all & forward), phase set to `implement`
- 2026-09-10 — feature 004 (mail compose, mock-send & drafts) validated: lint/typecheck/build/tests (61/61) all pass; all 5 ACs verified both by the new automated suite and by the round-1 live `/implement` run against the real app; incidentally corroborated by a real draft the user created themselves in the running app between sessions; phase set to `accept`
- 2026-09-10 — feature 004 (mail compose, mock-send & drafts) tested: added `ComposeWindow.test.tsx` (7 tests) plus new coverage in `RibbonBar`/`ReadingPane`/`MessageListPane`/`ipc` test files (4 more), 61/61 tests pass (up from 48); lint/typecheck/build unaffected; phase set to `validate`
- 2026-09-10 — feature 004 (mail compose, mock-send & drafts) implemented: compose opens in a real separate Electron window (confirmed with user), with a persona-sourced To dropdown, Subject/Body fields, Send→Sent and Save→Drafts (same row moves, no duplication), and an "Edit draft" reopen path from the reading pane; required new main-process work (`src/main/windows.ts`, a `window:openCompose` IPC handler, and a `data:messages-changed` broadcast on message create/update/delete so the main window refreshes when the compose window saves); live-verified end-to-end via a scripted real-Electron run (multi-window IPC can't be tested by Vitest); lint/typecheck/build pass, 48/48 existing tests still pass (kept compiling via mechanical prop/mock syncing), but zero new test coverage exists yet for the feature itself; phase set to `test`
- 2026-09-10 — feature 003 (mail folders, message list & reading pane) accepted by user; logged to CHANGELOG; active feature set to 004 (mail compose, mock-send & drafts), phase set to `implement`
- 2026-09-10 — feature 003 (mail folders, message list & reading pane) validated (round 2): lint/typecheck/build/tests (48/48) all pass; all 5 ACs verified both by the new automated suite and by the round-1 live `/verify` run against the real app and real SQLite DB; phase set to `accept`
- 2026-09-10 — feature 003 (mail folders, message list & reading pane) tested: added `src/renderer/src/test/mockApi.ts` (shared `window.api` mock) plus new test files for `FolderPane`/`MessageListPane`/`ReadingPane` and a rewritten async-aware `App.test.tsx`; 48/48 tests pass (was 23/28); lint/typecheck/build all still pass; phase set to `validate`
- 2026-09-10 — feature 003 (mail folders, message list & reading pane) validated: lint/typecheck/build pass; full test suite **fails** (23/28 — `App.test.tsx`'s 5 tests throw on the new `window.api` calls with no mock in place, and `FolderPane`/`MessageListPane`/`ReadingPane` have zero dedicated tests); all 5 ACs independently confirmed working via a live scripted run of the real Electron app against the real `~/.config/outlook-sim` SQLite DB (screenshots captured during `/verify`) — so this is a test-coverage gap, not a broken feature. Deviating from the standard "failure → back to implement" routing since there's no implementation defect to fix: status set to `testing`, phase set back to `test` directly, with the required test work spelled out in the feature file's Validation Notes.
- 2026-09-10 — feature 003 (mail folders, message list & reading pane) implemented: wired FolderPane/MessageListPane/ReadingPane to the `window.api.data` IPC surface from 002 (folders now real, dynamic, with custom-folder create/rename/delete UI; message list and reading pane fetch live data); no main-process changes needed; typecheck/lint/build all pass; phase set to `test`
- 2026-09-10 — feature 002 (local data layer) accepted by user after confirming the DB/config files exist at `~/.config/outlook-sim/` and cleaning up a stray `~/.config/Electron/outlook-sim.db`+`config/` from an earlier dev run; logged to CHANGELOG; active feature set to 003 (mail folders, message list & reading pane), phase set to `implement`
- 2026-09-10 — feature 002 (local data layer) validated: typecheck/build/tests (28) all pass, all 5 ACs verified against the real `MailDb`/`ConfigStore` classes; full-app launch unverified (same sandbox display limitation as feature 001, not a regression); no lint tooling exists yet (flagged, not blocking); phase set to `accept`
- 2026-09-09 — feature 002 (local data layer) tested: 20 new Vitest tests (db, config, IPC bridge, no-network check) against real temp-dir-backed stores, 28/28 total passing; switched test env default to `node` for `node:sqlite` support; phase set to `validate`
- 2026-09-09 — feature 002 (local data layer) implemented: SQLite (`node:sqlite`) store for folders/messages/calendar items + JSON config store (settings/system prompt/identity/personas), exposed via IPC (`window.api.data.*`); no UI, per scope; phase set to `test`
- 2026-09-09 — feature 001 (app shell) accepted by user after manual launch check; logged to CHANGELOG; active feature set to 002 (local data layer), phase set to `implement`
- 2026-09-09 — feature 001 (app shell) validated: typecheck/build/tests all pass, manual offscreen-Electron launch confirmed all 5 ACs; no lint tooling exists yet (flagged, not blocking); phase set to `accept`
- 2026-09-09 — feature 001 (app shell) tested: set up Vitest + React Testing Library, 7 passing tests covering all shell ACs except Windows-launch and pixel styling; phase set to `validate`
- 2026-09-09 — feature 001 (app shell) implemented: Electron+Vite+React+TS scaffold, classic Outlook 3-pane/ribbon layout with Mail/Calendar switcher; phase set to `test`
- 2026-09-09 — backlog of 22 features created from spec, phase set to `implement`, active feature set to 001
- 2026-09-09 — spec drafted from docs/outlook-trainer-spec-prompt.md, phase set to `features`
- 2026-08-31 — scaffold created, phase set to `spec`
