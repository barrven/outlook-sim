---
description: "Dev-loop inner stage 4: get the user's sign-off on the active feature"
---

You are running the **accept** stage — the one human gate in the inner loop.
Never auto-approve this yourself, even when running inside `/dev-loop` or
chained from `/implement`.

After the user **accepts**, stop and wait for them to run `/implement` for
the next feature. Do not start the next implement yourself.

1. Read `STATE.md` for the active feature and its feature file, including
   Validation Notes.
2. Present a short summary to the user: what the feature does, how it maps
   to each Acceptance Criterion, and the validation result. Show the actual
   diff or a way to try it if that's cheap to offer.
3. Ask the user to decide, with three real options: accept / request changes
   / reject. Use the AskUserQuestion tool for this so it's an explicit gate,
   not something inferable from silence.
4. Record the user's response verbatim (or a faithful summary) in the
   feature file's "Acceptance Log".
5. Branch on the decision:
   - **Accept:** `status: done`. Append an entry to `docs/CHANGELOG.md`.
     Update `features/BACKLOG.md`. Look at the backlog: if another
     `backlog`-status feature remains, set it as **Active feature** in
     `STATE.md` and **Phase** to `implement`. If none remain, clear **Active
     feature** and set **Phase** to `retro`.
   - **Request changes:** `status: implementing`, **Phase** back to
     `implement`, with the requested changes written into Implementation
     Notes.
   - **Reject:** ask the user whether to drop the feature entirely or send it
     back to `/features` for rethinking; act accordingly (`status: blocked`
     or remove it from the backlog per their answer).
6. Append a `STATE.md` History line.
7. Commit and push:
   - `git status` / `git diff` to see what this stage touched (`STATE.md`,
     the feature file, `docs/CHANGELOG.md`, `features/BACKLOG.md`, and any
     other files changed while reaching this decision).
   - Stage those paths specifically — never a blind `git add -A`.
   - Commit with an imperative one-liner naming the feature: `Accept NNN:
     <title>.` / `Request changes on NNN: <title>.` / `Reject NNN: <title>.`
   - If `git commit` fails on missing `user.name`/`user.email`, stop and ask
     rather than inventing an identity.
   - If `origin` exists, `git push origin master`. If the push fails, report
     it and continue — don't force-push or rewrite history to work around it.
8. Hand off from the decision — do not infer the next step from silence:
   - **Accept, more backlog remains:** tell the user the feature is accepted
     and to run `/implement` when ready for the next one. Stop. Do not start
     implementing the next feature.
   - **Accept, backlog empty:** tell the user `/retro` is next. Stop. Do not
     run retro.
   - **Request changes:** do not wait for the user to re-run `/implement`.
     Read `.claude/commands/implement.md` and follow it exactly (it will
     chain test and validate back to accept). Narrate that you are
     re-entering implement with the requested changes.
   - **Reject:** tell the user what you did with the feature and what's next
     per their answer. Stop unless they sent it back to `/features` and
     asked you to keep going.
