# 02 — Claude Code tooling

**Status:** WIP

## Goal
Make the repo's working rules executable. `CLAUDE.md` records the conventions. Skills turn the routines (planning, verifying, shipping, adding a tenant feature, writing a migration) into one command each. Read-only subagents review every change, and hooks block the mistakes that hurt most in a Supabase app.

## Decisions
- **`CLAUDE.md`** covers:
  - stack and commands;
  - the multi-tenant model and RLS rules (`can()`, no workspace id from the client, an A/B test per tenant table);
  - Next 16 specifics (`proxy.ts`, Cache Components, the DAL);
  - AI-layer and alerts rules (filled in by plans 06–07);
  - the workflow rules: plans per file, plan first for more than 3 files, commit format, docs in the same commit.

  `AGENTS.md` (written by `next dev`) is kept and imported.
- **Skills** (`.claude/skills/`):
  - `/plan-task`: write `docs/plans/NN-*.md` (Proposed) and stop.
  - `/verify` (`verify.sh [db|web|e2e|all]`): lint, tsc, vitest, `supabase test db`, build, Playwright. It prints `ALL PASSED` or `FAILED: <steps>`.
  - `/ship-plan` (`disable-model-invocation: true`, only the user starts it): commit by area, plan → Done with hashes, push.
  - `/new-migration`: `supabase migration new`, a template with RLS on and `security definer` + `search_path = ''` rules.
  - `/tenant-feature`: the recipe for a tenant-owned table, which is a migration, RLS with `can()`, a pgTAP A/B test, DAL queries, Server Actions with zod, a page, and nav.
- **Subagents** (`.claude/agents/`, read-only):
  - `code-reviewer`;
  - `security-auditor` (auth, secrets, Server Action authorization, XSS, SSRF on integrations);
  - `rls-reviewer` (can workspace A read, write or infer B's data: policies, `security definer` functions, views without `security_invoker`, RPC parameters);
  - `ui-reviewer` (Playwright MCP, runs on Sonnet: responsive at 375/768/1280, empty and error states, a11y basics).
- **Hooks** (`.claude/hooks/*.mjs`, Node, no dependencies):
  - `guard-bash`: deny `supabase db reset --linked`, `supabase projects delete`, force-push, and SQL `DROP`/`TRUNCATE` via psql; ask before `supabase db push`/`link`, `git push`, `gh repo create|edit`, `vercel`.
  - `guard-files`: deny edits to committed migrations (checked with `git ls-files`), any `.env*` except `.env.example`, a service-role/secret key in `src/` client code (`'use client'` files or `NEXT_PUBLIC_*SECRET*`/`*SERVICE_ROLE*`).
  - `post-edit`: `tsc --noEmit` on TS edits, with output given back to Claude.
  - `session-start`: prints WIP/Proposed plans and whether Supabase is running.
- **Hook tests** in `tests/hooks.test.mjs` (`node --test`) so the guards are proven, not assumed.
- **`.mcp.json`**: `playwright` (headless, isolated) and `next-devtools` (if available for Next 16) for docs and runtime errors.
- `settings.json` allowlists the verify script and the read-only git and supabase commands.

## Verification
`node --test tests/hooks.test.mjs`. Each hook is tried live once: an edit to a committed migration is refused, and `supabase db reset --linked` is refused. `/verify` passes.

## Commits after approval
`chore(claude): CLAUDE.md, skills, subagents, hooks and MCP`, `test: hook guards`, then this plan → Done.
