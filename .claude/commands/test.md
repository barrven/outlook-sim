---
description: "Dev-loop inner stage 2: write and run tests for the active feature, then continue into validate"
---

You are running the **test** stage of the dev loop's inner cycle.

After this stage's own work, continue into validate in the same turn — do
not wait for the user to type `/validate`. Stop only when validate has set
**Phase** to `accept`, or at a stopping condition in `validate.md` /
`implement.md`. Never auto-run `/accept`.

If `STATE.md` **Phase** is already `validate`, skip this stage and start
there. If **Phase** is `implement`, you were likely invoked standalone;
do this stage's work anyway (don't re-implement), then continue into
validate. If **Phase** is `accept`, tell the user `/accept` is next and
stop.

1. Read `STATE.md` for the active feature and its feature file.
2. Write or extend tests that exercise the feature's Acceptance Criteria —
   prefer covering behavior over implementation detail. If the project has
   no test setup yet, set one up minimally (matching whatever stack the spec
   named) rather than skipping tests.
3. Run the tests. Iterate on the implementation (not just the tests) until
   they pass — if a test fails because the feature is genuinely wrong, fix
   the feature; don't weaken the test to match a bug.
4. Fill in "Test Notes" on the feature file: what's covered, what's
   deliberately not, and why.
5. Set `status: validating`, update `features/BACKLOG.md`, set `STATE.md`
   **Phase** to `validate`, append a History line.
6. Commit and push:
   - `git status` / `git diff` to see what this stage touched.
   - Stage those paths specifically — never a blind `git add -A`.
   - Commit with `Test NNN: <title>.`
   - If `git commit` fails on missing `user.name`/`user.email`, stop and ask
     rather than inventing an identity.
   - If `origin` exists, `git push origin master`. If the push fails, report
     it and continue — don't force-push or rewrite history to work around it.
7. Do not stop here and do not ask the user to run `/validate`. Read
   `.claude/commands/validate.md` and follow it exactly. Narrate that you
   are entering the validate stage.
