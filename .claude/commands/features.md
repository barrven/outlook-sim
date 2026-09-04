---
description: "Dev-loop stage 2: decompose the spec into a feature backlog"
---

You are running the **features** stage of the dev loop.

1. Read `STATE.md` and `docs/SPEC.md`. Refuse to proceed with a placeholder
   spec — tell the user to run `/spec` first.
2. Decompose the Core Requirements into small, independently shippable
   features. Each one should be implementable, testable, and acceptable on
   its own — if a requirement is too big for one inner-loop pass, split it.
3. For every new feature: copy `features/template.md` to
   `features/NNN-slug.md` (zero-padded, next free ID), fill in Description
   and Acceptance Criteria (derived from the spec's requirements, concrete
   enough for `/validate` to check mechanically where possible).
4. Do not duplicate or silently drop existing backlog entries that are still
   `backlog`/`implementing`/etc. — only add new ones, and only touch a `done`
   entry if the spec revision actually invalidates it (flag that to the user
   explicitly, don't just edit it quietly).
5. Rewrite `features/BACKLOG.md`'s table to reflect the current full set,
   ordered by priority.
6. Update `STATE.md`: set **Active feature** to the first `backlog`-status
   feature by priority, set **Phase** to `implement`, append a History line.
7. Report the backlog to the user (table form) and name the active feature.
   Don't start implementing — that's `/implement`'s job.
