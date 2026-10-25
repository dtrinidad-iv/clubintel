---
name: ship-plan
description: Commit and push a finished, approved plan - verify, commit by area, mark the plan Done with commit hashes. Use only when the user approves the result ("ship it", "commit and push").
disable-model-invocation: true
argument-hint: "[plan number, e.g. 03]"
---

# Ship a plan

Plan: $ARGUMENTS. If no number is given, use the plan marked WIP in `docs/plans/README.md`.

## Steps
1. **Check scope.** Run `git status --short` and `git diff --stat`. Every changed file should belong to this plan. If something unrelated is there, stop and ask. Never sweep it into a commit.
2. **Verify.** Run `.claude/skills/verify/verify.sh all`. If anything fails, stop and report. Never commit red.
3. **Docs check.** For each line, decide whether this plan triggers it, and update the doc in the same commit as the change it describes:
   - New env key → `.env.example`, with a comment.
   - New or changed convention, command, port or rule → `CLAUDE.md`.
   - Setup, run steps or a user-visible feature → `README.md`.
   - New page or visible feature, or a change that makes a screenshot out of date → `docs/screenshots/` and the README "Screenshots" section.
   - New `.claude/` skill, agent, hook or MCP server → the tooling section of `CLAUDE.md`.
   - Follow-ups found but not done → the plan's "Follow-ups" section.

   Report which docs you updated, or "no doc changes needed".
4. **Commit by area**, in this order, skipping areas with no changes. Use `type(scope): summary`, a short paragraph on what and why, and the attribution line from the system reminder:
   - `supabase/migrations`, `supabase/seed.sql` → `feat(db): …`
   - `src/` (without tests), `.env.example`, `README.md`, screenshots → `feat(web): …`
   - `supabase/tests`, `src/**/*.test.ts`, `e2e/`, `tests/` → `test: …`
   - `.claude/`, `CLAUDE.md`, `.mcp.json` → `chore(claude): …`
5. **Mark the plan Done.** Under the title in `docs/plans/NN-*.md`:
   ```
   **Status:** Done
   **Commits:** `<hash>` (db), `<hash>` (web), `<hash>` (tests)
   ```
   Replace any existing Commits line, and set the row in `docs/plans/README.md` to Done. Commit: `docs: mark <plan> plan done`.
6. **Push** with `GIT_TERMINAL_PROMPT=0 git push` (a hook asks the user first). If there's no remote yet, or the push fails on auth, report it. Don't change remotes or credentials.
7. **Report** the commit hashes and messages, and confirm `git status` is clean.

## Never
- Commit `.env*` files other than `.env.example`, or `.claude/settings.local.json`.
- Use `--no-verify`, force-push, or amend commits that are already pushed.
