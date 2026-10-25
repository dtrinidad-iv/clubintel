---
name: verify
description: Run every check before saying a task is done - ESLint, tsc, Vitest, hook tests, pgTAP (RLS) and next build, plus Playwright with "all". Use before reporting any change as finished, and before committing.
argument-hint: "[quick|all|web|db|e2e|hooks]"
allowed-tools: Bash(.claude/skills/verify/verify.sh *), Bash(.claude/skills/verify/verify.sh)
---

# Verify

Run from the repo root:

```bash
.claude/skills/verify/verify.sh $ARGUMENTS
```

- `quick` (the default): lint, typecheck, Vitest, hook tests, pgTAP and build. Use it while working.
- `all`: also Playwright e2e on desktop and mobile. Run it before a plan is shipped, and whenever pages, Server Actions or auth change.
- `web`, `db`, `e2e`, `hooks` run a single group.
- The script switches to the Node version in `.nvmrc` through nvm. pgTAP and e2e need the local Supabase stack (`npm run db:start`). E2E runs the production build, so the build step must run first: `all` does that for you.
- CI (`.github/workflows/ci.yml`) runs the same steps. Change both together.
- It ends with `ALL PASSED (<target>)` or `FAILED: <steps>` and exits non-zero on failure.

## Reporting
- Report the real result: which steps ran, test counts, and any failure with its output.
- Never say "done" after a failed or skipped step. Fix it and run again, or tell the user exactly what fails and why.
- If e2e fails, open `test-results/*/error-context.md` before guessing: it holds the page snapshot at the moment of failure.
