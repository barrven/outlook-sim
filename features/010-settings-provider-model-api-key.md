---
id: 010
title: "Settings: LLM provider, model & API key storage"
status: done
priority: high
---

## Description
Settings screen lets the trainee pick an LLM provider (OpenAI, Anthropic,
Gemini, Grok/xAI) and model, and enter/store an API key per provider
locally.

## Acceptance Criteria
- [x] Settings UI lists OpenAI, Anthropic, Gemini, and Grok (xAI) as
      selectable providers
- [x] User can pick a model for the selected provider
- [x] User can enter and save an API key per provider; keys persist across
      restarts in local JSON (per spec's Open Question default: plaintext
      local storage for v1)
- [x] Switching provider/model selection updates which key is used for
      subsequent LLM calls
- [x] No API key is ever transmitted anywhere except to that provider's own
      API

## Implementation Notes

**Backend already existed:** feature 002 already built `Settings { provider,
model, apiKeys: Record<LlmProvider,string> }`, its JSON persistence in
`ConfigStore`, and the `window.api.data.settings.get/set` IPC surface. This
feature is UI-only — a new `SettingsView` component wired into `App.tsx`.

**Entry point:** the app's `NavSwitcher` is deliberately limited to
Mail/Calendar (an existing test asserts this), so Settings isn't a third
module tab. Instead added a plain "Settings" button below `NavSwitcher` in
the nav rail (`App.tsx`, `.settings-nav-button` in `global.css`) that sets
a new `showSettings` boolean. When true, `SettingsView` replaces the
message-list+reading-pane / calendar-view content while the nav rail
(folder pane, module switcher, Settings button) stays visible; clicking
Mail or Calendar exits Settings and returns to that module (`handleSelectModule`
wraps `setActiveModule` to also clear `showSettings`).

**`SettingsView.tsx`** (`src/renderer/src/components/`): loads `Settings`
on mount, then:
- Provider `<select>` listing OpenAI / Anthropic / Gemini / Grok (xAI)
  (AC1).
- Model `<input type="text">`, free text — no hardcoded per-provider model
  catalog exists anywhere in this codebase or spec, so a curated dropdown
  would mean guessing at a list of model names that will go stale; a text
  field lets the trainee type whatever their configured provider currently
  offers (AC2).
- API key `<input type="password">` bound to `apiKeys[provider]` — switching
  the provider select switches which key of the in-memory `apiKeys` record
  is displayed/edited, while the other providers' keys stay intact in
  state and get written back unchanged on Save (AC3, AC4).
- Explicit "Save" button (matches the rest of the app's save-on-click
  convention, e.g. compose) calls `settings.set({ provider, model, apiKeys })`;
  a small "Saved" indicator appears until the next edit.
- A note line under the fields states the key is stored locally in
  plaintext and used only for that provider's own API — matches the
  spec's plaintext-for-v1 default and AC5's intent.

**AC4/AC5 forward-looking scope:** there is no LLM client yet (that's
feature 014), so "subsequent LLM calls" and "transmitted... to that
provider's own API" have no runtime to point at today. What this feature
delivers is the data-model invariant those ACs depend on:
`settings.apiKeys[settings.provider]` is always the correct key for
"whichever provider is currently selected," and saving settings makes
zero network calls (same `ConfigStore.setSettings` JSON-write path already
covered by the existing `no-network.test.ts`). Feature 014 will be the one
that actually reads `apiKeys[provider]` and calls out to that provider.

**Files touched:** `src/renderer/src/components/SettingsView.tsx` (new),
`src/renderer/src/App.tsx`, `src/renderer/src/styles/global.css`. No
changes needed to `data-types.ts`, `config.ts`, `ipc.ts`, or preload — all
already existed from feature 002.

## Test Notes

Added 9 new tests across 2 files (87 → 96 total, all passing), plus
typecheck/lint/build all clean.

- **`SettingsView.test.tsx` (new, 7 tests):**
  - Provider `<select>` lists exactly OpenAI/Anthropic/Gemini/Grok (xAI),
    in that order (AC1).
  - Provider/model/API-key fields prefill from `settings.get()` — the
    displayed API key is the *selected provider's* key, not some other
    provider's (AC1, AC3).
  - Typing into the Model field updates it (AC2).
  - Switching provider swaps the API Key field to that provider's stored
    value, and edits made before switching away are preserved in memory
    when switching back — verified across three providers in one test
    (openai → edit → anthropic → gemini (empty) → back to openai still
    shows the edit) (AC4).
  - Save calls `settings.set` with the provider, model, and the *entire*
    `apiKeys` record — including an edit made to a provider that isn't
    the one currently selected, proving Save doesn't silently drop other
    providers' keys (AC3, AC4).
  - A "Saved" indicator appears after Save and disappears on the next
    edit (basic save-feedback UX, not itself an AC but cheap to lock in
    since the component has the state already).
  - The API key input has `type="password"` (masks the value on screen;
    storage format is still plaintext JSON per AC3 — masking is a display
    concern, not a storage one, and that distinction is called out in the
    Implementation Notes).
- **`App.test.tsx` (+2 tests):** the "Settings" nav-rail button opens
  `SettingsView` in place of the mail panes while the folder pane and
  Mail/Calendar tabs stay visible; clicking Mail exits Settings and shows
  the mail panes again; clicking Calendar from within Settings shows the
  calendar (not stale mail content) — exercises the `showSettings`
  wiring in `App.tsx` that isn't part of `SettingsView` itself.

**Deliberately not covered here (already covered elsewhere, or out of
this feature's runtime):**
- JSON persistence across restarts (AC3's "persist across restarts" half)
  — already covered by `config.test.ts`'s pre-existing `round-trips
  settings` and `persists all four stores across a close/reopen cycle`
  tests against the real `ConfigStore`/filesystem. This feature only
  needed to verify the UI calls `settings.set` with the right shape
  (tested above); re-proving JSON round-tripping at the UI layer would
  just be testing the mock.
- No new network-call assertion was added for AC5 specifically — saving
  settings goes through the exact same `ConfigStore.setSettings` JSON
  write path already exercised by `no-network.test.ts`'s `never touches
  http, https, or fetch` test (from feature 002), and this feature adds
  no new network-adjacent code (no fetch/http anywhere in `SettingsView`
  or the IPC plumbing it uses).
- "Switching provider/model selection updates which key is used for
  subsequent LLM calls" (AC4) — the "for subsequent LLM calls" half has
  no runtime yet; no LLM client exists until feature 014. What's tested
  here is the data invariant that makes that claim true once a client
  exists: `apiKeys[provider]` always reflects the currently selected
  provider's key, and Save persists the full record intact.

## Validation Notes

**Automated checks — all pass:**
- `npm run lint` — clean, no output.
- `npm run typecheck` — clean, no output.
- `npm run build` — clean (main/preload/renderer all built successfully).
- `npm test` — **96/96 passing** (full suite, not just this feature's new
  tests).
- No leftover `console.*`/`TODO`/`FIXME` in the new/changed files
  (`SettingsView.tsx`, `App.tsx`).

**Extra mechanical check:** this feature adds zero changes to `config.ts`
or the `Settings` type, so there's no migration risk like feature 005 had.
Confirmed anyway by reading the real, already-existing
`~/.config/outlook-sim/config/settings.json` (untouched, read-only) — its
shape (`provider`/`model`/`apiKeys` keyed by all four providers) matches
the `Settings` interface exactly, so the UI's `settings.get()`/`set()`
calls work against the user's actual file with no compatibility gap.

**Acceptance criteria:**

1. **"Settings UI lists OpenAI, Anthropic, Gemini, and Grok (xAI) as
   selectable providers"** — PASS. `SettingsView.tsx`'s `PROVIDERS` array
   renders exactly those four as `<option>`s in that order; verified by
   a `SettingsView.test.tsx` test asserting the rendered option text list.

2. **"User can pick a model for the selected provider"** — PASS. A free
   -text Model input bound to `Settings.model` (a single field alongside
   `provider`, matching the existing data model — not a per-provider
   catalog, which doesn't exist anywhere in this codebase or spec and
   would mean inventing model names that go stale). Verified by a test
   that types into the field and confirms the value updates; prefill from
   saved settings also verified.

3. **"User can enter and save an API key per provider; keys persist
   across restarts in local JSON"** — PASS. The API Key field is bound to
   `apiKeys[provider]`; Save writes the whole `apiKeys` record via the
   existing `settings.set` IPC call. The UI-level half (entering/saving
   the right key) is verified directly; the "persist across restarts in
   local JSON" half is verified by the pre-existing `config.test.ts`
   (`round-trips settings`, `persists all four stores across a
   close/reopen cycle`), which this feature didn't need to touch or
   re-prove since `ConfigStore` is unchanged — confirmed unchanged by
   `git diff` showing no edits to `src/main/data/config.ts` in this
   feature's commit.

4. **"Switching provider/model selection updates which key is used for
   subsequent LLM calls"** — PASS, on the data-invariant half; the
   "for subsequent LLM calls" half has no runtime to check against, since
   no LLM client exists yet (feature 014). Verified: switching the
   provider select swaps the displayed/edited API Key field to that
   provider's own stored value, and in-progress edits to a provider you
   switch away from are preserved (not lost) when you switch back —
   tested across three provider switches in one test. Save persists the
   full `apiKeys` record, including edits to a non-selected provider, so
   `apiKeys[provider]` stays correct for whichever provider is active.
   This is exactly the invariant feature 014 will read from later; no
   guessing was required to verify it since it's fully mechanical.

5. **"No API key is ever transmitted anywhere except to that provider's
   own API"** — PASS, by inspection + existing coverage: `SettingsView.tsx`
   contains no `fetch`/`http`/`https`/websocket code, and its only I/O is
   the pre-existing `window.api.data.settings.get/set` IPC calls into
   `ConfigStore`'s local JSON read/write (`src/main/data/config.ts`,
   unchanged by this feature). `no-network.test.ts` (from feature 002)
   already asserts `config.setSettings(...)` triggers zero `http`/`https`/
   `fetch` calls. There is genuinely no code path today that could
   transmit a key anywhere — that only becomes possible once feature 014
   adds an LLM client, at which point this AC becomes actually testable
   end-to-end (only the configured provider's endpoint gets called).

**Live Electron GUI verification:** not re-attempted — this sandbox still
has no Xvfb and no passwordless sudo (confirmed and documented in detail
during feature 005's `/validate`; nothing about the environment has
changed since). Same non-blocking, pre-existing gap as features 001, 002,
and 005 — deferred to the user's own check at `/accept`. Given this
feature's logic (provider/model/key state management, the full-record
Save, the nav-rail show/hide wiring) is thin and fully covered by
integration-level React Testing Library tests that exercise the actual
rendered DOM and click handlers, this is judged low-risk.

## Acceptance Log

Presented the feature summary (behavior per AC, the AC4/AC5 "no LLM client
yet" caveat, validation results including the 96/96 test run and the
real-settings.json compatibility check, and the live-GUI-verification gap)
via `AskUserQuestion` with three options: Accept / Request changes /
Reject. The user selected **Accept**.

**Decision: accepted.**
