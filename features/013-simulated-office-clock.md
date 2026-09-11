---
id: 013
title: Simulated office clock
status: done
priority: high
---

## Description
A simulated clock with start/pause/speed controls drives message timestamps
and reminder firing, decoupled from wall-clock time, so multi-day scenarios
can run in one sitting.

## Acceptance Criteria
- [x] UI exposes clock controls: start, pause, and a speed multiplier
- [x] Current simulated time is visible somewhere in the shell
- [x] New message timestamps and reminder firing use simulated time, not
      system wall-clock time (message timestamps: yes; reminder firing has
      no consumer to wire yet — see Validation Notes)
- [x] Pausing the clock freezes simulated time; resuming continues from
      where it left off
- [x] Simulated time persists across restarts (does not reset to
      wall-clock time on relaunch)

## Implementation Notes

**New backend piece (unlike 010-012, this one was genuinely new): `SimClock`**
(`src/main/data/clock.ts`), mirroring `ConfigStore`'s JSON-file pattern —
persists `config/clock.json`: `{ anchorSimTime, anchorRealTime, running,
speed }`. Rather than storing a constantly-updating "current time," it
stores an anchor point (the simulated time and real time at the last
start/pause/speed-change boundary) and computes the live value on demand:
`running ? anchorSimTime + (Date.now() - anchorRealTime) * speed :
anchorSimTime`. This is the standard approach for a variable-rate clock —
no background timer/interval needed in the main process, and it composes
correctly for pause (snapshot the computed value into `anchorSimTime`,
stop) and resume/speed-change (re-anchor `anchorRealTime = Date.now()`,
keep accumulating from the frozen `anchorSimTime`) — this directly
satisfies AC4 ("pausing freezes; resuming continues from where it left
off") by construction, not by special-casing.

First run seeds `anchorSimTime`/`anchorRealTime` to `Date.now()` with
`running: false` (paused by default — the trainee explicitly starts it)
and `speed: 1`. Exposed via `clock:get/now/start/pause/setSpeed` IPC
(`ipc.ts`, `registerDataIpcHandlers` now takes a third `SimClock` param)
and `window.api.data.clock.*` (preload).

**Design decision on app-quit behavior (not literally specified by the
ACs, but necessary to implement AC5 sensibly):** `main/index.ts` calls
`simClock.pause()` on Electron's `before-quit` event. Without this, a
clock left running when the app closes would silently accumulate real
downtime at the configured speed and jump forward by however long the app
was shut when reopened — which reads as "resetting to something other
than where it left off" and arguably drifts back toward wall-clock time
at 1x, the opposite of the spec's "decoupled from wall-clock time" goal.
Pausing on quit guarantees relaunching always resumes at the exact
simulated moment the app was closed, matching AC4's "continues from where
it left off" in spirit even across a restart. Tradeoff: an unclean
shutdown (force-kill, crash) skips this handler, so `running: true` could
persist and cause one real-downtime jump on next launch — accepted as a
known edge case rather than engineering around ungraceful termination.

**UI:** new `OfficeClock.tsx` component (self-contained: fetches
`clock.get()` on mount, ticks its own displayed time once per second
locally while running via `setInterval` — computed the same anchor
formula as the backend, so no per-second IPC polling — rather than
storing time as literal React state (AC1, AC2). A single Start/Pause
toggle button and a speed `<select>` (1x/2x/5x/10x/30x/60x) call the
corresponding IPC methods and adopt the returned `ClockState`. Rendered
inside `RibbonBar`'s top strip (AC2's "visible somewhere in the shell" —
this is the one place already visible regardless of which module or
Settings is showing). Split the ribbon-tabs row into an inner
`role="tablist"` wrapper (just the File/Home/... tabs) plus the clock as
a sibling, rather than nesting the clock inside the tablist — a
`role="tablist"` should only contain tab elements; the previous single
`aria-label="Ribbon tabs"` name is preserved on the (now inner) tablist
element so existing tests/assertions are unaffected.

**Message timestamps (AC3, first half):** `ComposeWindow.tsx`'s
`persist()` now fetches `clock.now()` alongside `identity.get()` (both
awaited via `Promise.all`, matching the function's existing async style)
and uses it as the message `timestamp` instead of `Date.now()`. This is
the only place in the app that stamps a message with "now" — folder/
persona ID generation (`generateFolderId`, `generatePersonaId`,
`db.ts`'s `generateId`) also call `Date.now()` but only as an entropy
source for a unique ID string, not as a semantic timestamp, so those were
intentionally left alone.

**AC3, second half ("reminder firing... use simulated time"): not
wired — no reminder-firing mechanism exists anywhere in the app yet.**
`CalendarItem.reminderMinutesBefore` is stored (feature 002) but nothing
computes or fires reminders — the Calendar module is still a static stub
(`CalendarView.tsx` renders "No calendar items to show." unconditionally;
features 018/019 haven't been built). There's no consumer to wire
simulated time into yet, the same "no runtime to point at" situation as
several ACs in features 010-012. When reminder firing is eventually
built, it should read `clock.now()`/`clock.get()` the same way
`ComposeWindow` does now.

**Files touched:** `src/main/data/clock.ts` (new), `src/main/data/ipc.ts`,
`src/main/data/ipc.test.ts` (compile fix: pass a real `SimClock` + extend
the channel-list assertion), `src/main/index.ts`,
`src/preload/index.ts`, `src/preload/index.d.ts`, `src/shared/data-types.ts`
(new `ClockState`), `src/renderer/src/components/OfficeClock.tsx` (new),
`src/renderer/src/components/RibbonBar.tsx`,
`src/renderer/src/ComposeWindow.tsx`, `src/renderer/src/styles/global.css`,
`src/renderer/src/test/mockApi.ts` (compile fix: default clock mock so
every existing test that renders `RibbonBar`/`App` doesn't hit an
undefined `window.api.data.clock`).

## Test Notes

Added 21 new tests across 4 files (110 → 131 total, all passing), plus
typecheck/lint/build all clean. Ran the full suite 3 extra times to check
for flakiness from the timing-sensitive tests (fake timers, spied
`Date.now`, real `setInterval`) — stable every time.

- **`src/main/data/clock.test.ts` (new, 10 tests):** the core of this
  feature's correctness, using `vi.useFakeTimers()`/`vi.setSystemTime()`
  for exact, deterministic control over elapsed time. Covers: default
  seed (paused, anchored to "now", 1x) (AC1); paused clock never advances
  no matter how much real time passes; running clock advances by
  `elapsed × speed`, including a speed change mid-run; **pause freezes
  exactly at the computed instant, and resuming continues from precisely
  that value even after more real time passes while paused** (AC4, the
  most direct test of this AC's literal wording); start-when-already
  -running and pause-when-already-paused are no-ops (don't silently
  re-anchor and lose/duplicate elapsed time); speed changes mid-run don't
  cause a visible jump (rebase math is continuous); and — matching the
  `db.test.ts`/`config.test.ts` restart-persistence pattern — a fresh
  `SimClock` pointed at the same directory sees the exact prior state,
  including simulating a large amount of real time passing while
  "closed" and confirming the reopened clock does *not* silently
  fast-forward through that gap (AC5, and validates the `before-quit`
  auto-pause design decision's premise: state on disk is exactly what a
  relaunch should show).
- **`src/main/data/ipc.test.ts` (+1 test, plus updated the channel-list
  assertion):** drives `clock:get/start/setSpeed/now/pause` through the
  actual registered IPC handlers end-to-end (not just unit-testing
  `SimClock` in isolation), confirming the wiring in `ipc.ts` is correct.
- **`src/renderer/src/components/OfficeClock.test.tsx` (new, 9 tests):**
  shows current time + Start button while paused (AC1, AC2); clicking
  Start/Pause calls the right IPC method and flips the button label;
  changing the speed `<select>` calls `setSpeed` with the chosen
  multiplier; the six speed options render correctly; a ticking
  `setInterval(…, 1000)` is created while running and torn down on pause
  (verified by spying on `window.setInterval`/`clearInterval` rather than
  asserting exact displayed clock strings under fake timers — an earlier
  attempt at the latter was flaky because the component's async initial
  load and the interval setup happen across an unpredictable number of
  microtask hops, and pinning that down became more about React's effect
  scheduling than the feature's actual logic); and — to still get precise
  coverage of the time-advancement math without that flakiness — exported
  `computeDisplayTime` (previously module-private) and unit-tested it
  directly with a spied `Date.now`, mirroring `composeIntent.ts`'s
  already-established pattern of extracting pure logic for direct testing
  rather than only testing it indirectly through the DOM.
- **`src/renderer/src/ComposeWindow.test.tsx` (+1 test):** sends a
  message with `Date.now()` spied to one date and `clock.now()` mocked to
  a *different* date two years later, and asserts the persisted
  `timestamp` matches the simulated time, not the (deliberately
  divergent) wall-clock mock — directly proves AC3's first half rather
  than just proving *a* timestamp was set.
- **Compile-only touch-ups:** `mockApi.ts` needed a default `clock` mock
  (every existing `RibbonBar`/`App` test renders `OfficeClock` now, which
  calls `window.api.data.clock.get()` on mount).

**AC3, second half (reminder firing) — deliberately not covered:** no
reminder-firing mechanism exists anywhere in the app to test against
(same "no consumer yet" situation documented in Implementation Notes).

**Deliberately not covered otherwise:**
- The `before-quit` → `simClock.pause()` wiring in `main/index.ts` isn't
  unit-tested — it's a one-line Electron lifecycle hook with no
  meaningful logic of its own (`SimClock.pause()` itself is thoroughly
  tested above); the risk is entirely in whether Electron's `app` object
  fires the event, which isn't something a unit test can exercise without
  a real Electron process. Flagged for live verification at `/validate`
  like the multi-window IPC gaps in earlier features.
- No test asserts the exact 1-second real-world cadence of the UI tick
  (i.e. that it's not, say, 900ms or 1100ms) — `setInterval(fn, 1000)` is
  asserted literally via the spy, which is the meaningful guarantee; the
  browser/Node timer's own precision isn't this feature's concern.

## Validation Notes

**Tooling:** `lint` (eslint .) — clean. `typecheck` (tsc, both configs) —
clean. `build` (tsc + electron-vite build) — succeeds, all three bundles
(main/preload/renderer) emit without error. `test` (vitest run) — 131/131
passing; re-ran 2 additional times (3 total) to double-check the
timing-sensitive tests (`clock.test.ts`'s fake timers, `OfficeClock.test.tsx`'s
spied `Date.now`/interval spies) for flakiness — stable every run.

**AC1 (UI exposes start, pause, speed multiplier) — PASS.** Verified by
direct inspection of `OfficeClock.tsx`: a single toggle button
(Start/Pause, label driven by `state.running`) and a `<select>` with the
six speed options (1/2/5/10/30/60x), each calling `clock.start()` /
`clock.pause()` / `clock.setSpeed()` and adopting the returned state.
Covered by 9 tests in `OfficeClock.test.tsx`.

**AC2 (current simulated time visible in the shell) — PASS.** `OfficeClock`
renders `computeDisplayTime(state)` as a locale time string and is mounted
as a sibling of the ribbon tablist in `RibbonBar.tsx:28` (confirmed by
grep), so it's on-screen regardless of Mail/Calendar/Settings selection.

**AC3 (message timestamps + reminder firing use simulated time) — PARTIAL
PASS, as scoped.** First half confirmed by direct inspection:
`ComposeWindow.tsx:80` fetches `clock.now()` alongside `identity.get()` and
uses it as the persisted message `timestamp` (not `Date.now()`); directly
tested in `ComposeWindow.test.tsx` by diverging a spied `Date.now()` from a
mocked `clock.now()` and asserting the persisted timestamp follows the
clock. Second half (reminder firing) confirmed still out of scope: grepped
the renderer tree for `reminderMinutesBefore` — it's stored on
`CalendarItem` (feature 002) but has zero readers; `CalendarView.tsx`
unconditionally renders "No calendar items to show." There is genuinely no
reminder mechanism anywhere in the app to wire simulated time into yet.
Not treating this as a failure — same "no consumer yet" pattern as several
ACs across features 010-012 — but flagging again for whoever builds
reminder firing (018/019) to point at `clock.now()`.

**AC4 (pause freezes, resume continues from where it left off) — PASS.**
`SimClock.pause()` (`clock.ts:51-59`) snapshots `computeNow()` into
`anchorSimTime` and clears `running`; `start()` re-anchors
`anchorRealTime = Date.now()` without touching `anchorSimTime`, so resumed
time continues exactly from the frozen value. Directly tested in
`clock.test.ts` with fake timers, including the case where real time
continues to pass *while paused* between pause and resume — confirmed no
drift is picked up.

**AC5 (simulated time persists across restarts, doesn't reset to
wall-clock) — PASS.** `SimClock`'s constructor only seeds the JSON file if
it doesn't already exist (`clock.ts:15-18`); a fresh instance pointed at
the same directory reads the prior anchor state as-is. Tested in
`clock.test.ts` by simulating a large real-time gap "while closed" and
confirming the reopened clock doesn't fast-forward through it. Also
cross-checked the real on-disk `~/.config/outlook-sim/config/clock.json`
— its 4 fields match the `ClockState` type exactly, and it reflects a
paused clock at 60x from a prior manual run, not a reset to wall-clock
time.

**Design decision sanity check (before-quit → pause):** confirmed
`main/index.ts:25-26` registers `app.on('before-quit', () => simClock.pause())`.
This isn't literally required by the ACs but is the only sane way to
satisfy AC5's spirit (avoid silently fast-forwarding through real
downtime) — reasoning holds up on inspection, not just as an implementation
note claim.

**Gap, non-blocking:** no Xvfb/X server available in this sandbox (same
documented limitation since features 001/005), so the live Electron GUI —
actually clicking Start/Pause, watching the ribbon clock tick, and doing a
real app-quit/relaunch cycle — was not exercised interactively this round.
Substituted with (a) full mechanical test coverage of the underlying logic
and (b) direct inspection of the real on-disk config file left by a prior
manual run, which is consistent with correct behavior. Deferred to the
user's own check at `/accept`, consistent with how this gap has been
handled in every prior feature.

All 5 ACs pass (AC3 passes to the extent anything in the app currently
consumes simulated time — the reminder half is forward-looking, not a
defect). No implementation changes needed.

## Acceptance Log

2026-09-11 — User accepted via `/accept` after reviewing the AC-by-AC
summary and validation results (lint/typecheck/build clean, 131/131 tests
stable across 3 runs, AC3's reminder-firing half confirmed genuinely
out-of-scope). Decision: **Accept**.
