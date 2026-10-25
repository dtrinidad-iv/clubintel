# 08 — CI, screenshots and deploy docs

**Status:** Proposed

## Goal
Make the repo easy to judge in five minutes: green CI, screenshots of each feature, a clear README with setup and deploy steps, and a section on how it was built with Claude Code.

## Decisions
- `.github/workflows/ci.yml` runs on push to `main` and on PRs. Its steps mirror `verify.sh`:
  - `npm ci`, lint, tsc, vitest, hook tests;
  - `supabase/setup-cli` → `supabase start` → `supabase test db`;
  - `next build`;
  - Playwright against the build.

  It uses `AI_PROVIDER=fake` and no secrets.
- Screenshots in `docs/screenshots/`: landing, dashboard, clubs, club profile, opportunities kanban, AI report, alerts, and members settings. They're taken with the Playwright MCP from seed data at 1280×800 light, plus one mobile shot at 390×844.
- README:
  - what it is, the feature list and the stack;
  - architecture (tenancy + RLS diagram, AI layer);
  - local setup (colima, `supabase start`, env from `supabase status`, `npm run dev`) and the demo accounts;
  - an env table;
  - deploying to Supabase cloud (`supabase link`, `db push`) + Vercel (env vars, cron);
  - "How this was built with Claude Code" (plans, skills, subagents, hooks, CI, with links into `.claude/`).
- Before any public push: check the files and git history for anything that shouldn't be public (real names, private notes, secrets).

## Verification
CI passes on GitHub. `/verify` passes locally. The README links resolve.
