---
description: "Dev-loop stage 1: establish or revise the product spec"
---

You are running the **spec** stage of the dev loop (`spec > features > loop(implement > test > validate > accept) > retro`).

1. Read `STATE.md` and `docs/SPEC.md` first.
2. If `docs/SPEC.md` has no real content yet (fresh scaffold): interview the user
   conversationally to fill in Vision, Users, Core Requirements, Non-goals,
   and Constraints. Ask only what you can't reasonably infer or default —
   don't interrogate over things a reasonable default settles. Note anything
   still unresolved under Open Questions rather than guessing at it.
3. If `docs/SPEC.md` already has content (a later loop iteration): this is a
   revision, not a first draft. Summarize what you believe changed since the
   last iteration (informed by `docs/CHANGELOG.md` and any retro notes at the
   bottom of the spec) and confirm the revision with the user before writing.
4. Write the result back to `docs/SPEC.md`, keeping the "Changelog of spec
   revisions" section append-only.
5. Update `STATE.md`: bump the outer iteration if this is a fresh loop,
   set **Phase** to `features`, append a one-line History entry.
6. Tell the user the spec is set and that `/features` is next — don't run it
   yourself unless the user says to keep going.
