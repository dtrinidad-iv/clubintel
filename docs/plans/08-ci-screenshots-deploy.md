# 08 — CI, screenshots and deploy docs

**Status:** Done
**Commits:** `a0a86b1` (db), `2cfad86` (ci), `2688dcf` (docs), `16a287c` (tests), `7d8db52` (claude)

## Goal
Make the repo easy to judge in five minutes:
- CI that runs every check on each push;
- screenshots of each feature, made by a script so they can be redone;
- a README that explains the features, the architecture, local setup and how it was built with Claude Code;
- step-by-step deploy docs for Supabase cloud and Vercel, including everything earlier plans left for the hosted setup.

Out of scope: actually deploying (it needs the user's accounts, and the hooks keep remote commands with the user), a staging environment, and preview deployments.

## Decisions
- **CI** (`.github/workflows/ci.yml`) runs on pushes to `main` and on PRs, in one job that mirrors `verify.sh all`:
  1. `actions/setup-node` with `.nvmrc` and the npm cache, then `npm ci`.
  2. `supabase/setup-cli` pinned to the local CLI version (2.122.0), then `npm run db:start`.
  3. Write `.env.local` from `supabase status -o json`: the URL, publishable key, `SUPABASE_SECRET_KEY` and `AI_PROVIDER=fake`. These are the local stack's well-known keys, not secrets.
  4. Lint, typecheck, Vitest, hook tests, `supabase test db`, `next build`.
  5. Playwright (Chromium only, `npx playwright install --with-deps chromium`) against the build. In CI it writes the `github` and HTML reporters, and the report and traces are uploaded on failure.

  CI needs no repository secrets. A concurrency group cancels superseded runs.
- **Screenshots come from a script, not by hand:** `npm run screenshots` runs a Playwright project (`screenshots`, `@screenshots` tests, left out of the normal run) against the seeded demo. It writes `docs/screenshots/*.png` at 1280×800 in light mode, plus one 390×844 mobile shot. The pages:
  - landing;
  - dashboard;
  - clubs and a club profile;
  - the opportunities board;
  - an AI report (seeded, so no API call);
  - alerts;
  - members settings;
  - the mobile dashboard.

  A `prefers-reduced-motion` context and fixed waits on loaded content keep the shots stable.
- **README rewrite:**
  - what it is, the features and the stack;
  - **screenshots;**
  - **architecture:** a Mermaid diagram of tenancy and RLS, the AI layer and scheduling;
  - local setup and the demo accounts;
  - an env table;
  - checks and CI;
  - a link to the deploy docs;
  - "How this was built with Claude Code": plans, skills, subagents, hooks and CI, with links into `.claude/`.

  Mermaid renders on GitHub, so the diagram stays plain text in the repo.
- **Deploy docs** (`docs/deploy.md`):
  - **Supabase cloud:**
    - Postgres 17 (plan 09 revokes MAINTAIN).
    - "Automatically expose new tables" off, to match `auto_expose_new_tables = false`.
    - `supabase link`, then `supabase db push`. The migrations enable pg_cron and schedule the jobs.
    - Auth site URL and redirect URLs.
    - Loading the national club data (plan 03 follow-up): `supabase db push --include-seed` for a public demo, which also creates the demo accounts with a known password, or `psql -f supabase/seeds/clubs.sql` for clubs only.
    - Reviewing `ai_limits` (plan 06).
  - **Vercel:**
    - env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SITE_URL`, and the AI keys;
    - the region near the database;
    - `maxDuration` for the report route.
  - **After deploying:** a checklist of a smoke test, `cron.job_run_details` and a grants check (`supabase test db --linked` is off-limits, so the doc gives read-only SQL to run instead).
- **AI limits concurrency (plan 06 follow-up):** a one-off check runs parallel `start_report` calls against the local stack and confirms that reservations never exceed the budget and that the limits hold. The result goes in the notes. It isn't in CI, because it's timing-dependent.
- **Public repo check:** the repo is already public. Before this plan's push, search the files and the full git history for secrets (`sb_secret_`, `sk-ant-`, private keys, `.env` files) and real personal data. Report the result, and if anything turns up, stop and ask before acting.
- **Reviews:**
  - **Code review:**
    - `supabase db url` doesn't exist in CLI 2.122.0; the guide now uses the SQL editor, or `psql` with an exported URL.
    - `npm run screenshots` now builds first and never reuses a running server.
    - The mobile screenshot filters to visible elements, because pages from `newContext()` skip the fixture.
    - CI writes the HTML report, so the failure upload has something in it.
  - **Security audit:** nothing critical or high, and it independently confirmed the public repo is clean. Fixed:
    - **Confirmed emails:** `add_member_by_email` matches confirmed emails only (new migration `member_confirmed_email`). Someone can no longer pre-register a colleague's address and be added in their place. pgTAP covers it.
    - **Auth settings in the guide:** keep "Confirm email" on, never `supabase config push` the local auth settings, require a password length of at least 8, turn on leaked-password protection, and allow only the `/auth/confirm**` redirect URL.
    - **Secrets:** production secrets for Production only; Previews get a staging project or no secrets.
    - **Public demos:** their own project, `AI_PROVIDER=fake` or low limits, and an expectation of being reset.
    - **Grant checks:** the guide's checks now cover partitioned tables, sequences, materialized views and functions executable by `anon`.
    - **CI:** actions are pinned to commit SHAs (checkout v7.0.1, setup-node v7.1.0, setup-cli v3.0.1, upload-artifact v7.0.2; each input checked against its `action.yml`), and checkout has `persist-credentials: false`.
- **Landing copy:** "Weekly commercial briefings" becomes on-demand briefings, which is what plan 06 built.

## Files
- **New:**
  - `.github/workflows/ci.yml`;
  - `e2e/screenshots.spec.ts`;
  - `docs/screenshots/*.png`;
  - `docs/deploy.md`.
- **Changed:**
  - `playwright.config.ts`: a `screenshots` project, left out of the default projects;
  - `package.json`: a `screenshots` script;
  - `README.md`;
  - `CLAUDE.md`: commands, CI, the screenshots rule;
  - `.claude/skills/verify/verify.sh`: the comment already points at CI, so it only needs checking;
  - `src/app/page.tsx`: the landing copy.

## Verification
- `/verify all` passes locally, and CI passes on GitHub after the push.
- The screenshots have been looked at, and the README links resolve (checked with a script).
- Reviewers: `code-reviewer` for the workflow and scripts, and `security-auditor` for CI permissions, secret handling and the public repo check.

## Commits after approval
- `fix(db): add members by confirmed email only` (from the security review);
- `ci: GitHub Actions running every check`;
- `docs: README, screenshots and deploy guide`;
- `chore(claude): …` (CLAUDE.md);
- `fix(web): landing copy`;
- then this plan → Done.

## Notes
- **Public repo check:** clean.
  - **Secret patterns:** two matches in the git history, both test fixtures in `tests/hooks.test.mjs`. One is a fake Anthropic key (the alphabet in order). The other is a fragment that is a prefix of Supabase's published default local secret key (the security re-check confirmed this). Neither works against a real service.
  - **Files:** no `.env` files other than `.env.example`, no key files, and no `settings.local.json` ever committed.
  - **Personal data:** the only author is the GitHub noreply address, and no personal email or home path appears anywhere.
- **AI limits concurrency (plan 06 follow-up):** I ran 8 parallel `start_report` calls against a budget with room for 3 reservations ($0.23 spent, $2.00 each, budget $6.30). Exactly 3 started, and spend ended at $6.23. The lock on `ai_limits` serialises starts as intended.
- **Streaming duplicates in e2e:** while a page streams in, React briefly keeps a hidden copy of a Suspense boundary's content (`<div hidden id="S:1">`) next to the copy on screen. `getByTestId` matches hidden elements, so strict lookups sometimes found two. The new mobile alerts test failed this way in 4 of 8 runs, and earlier plans' rare duplicate-element failures were the same thing. Specs now import `test` from `e2e/fixtures.ts`, whose page-level `getByTestId` matches visible elements only; the mobile test then passed 10 of 10.
- **`openSidebar` bug, exposed by the fixture:** the helper decided whether to open the mobile sheet by checking, without waiting, whether the workspace switcher was hidden. On desktop, right after sign-in, the sidebar is still streaming in, so it clicked the toggle and collapsed the desktop sidebar. Tests passed anyway, because the old lookup read hidden text. It now decides by viewport width.
- **Screenshots:** all nine are generated by `npm run screenshots` against a fresh `supabase db reset`. I checked each one.
- **Deploy guide queries:** the read-only grant checks in `docs/deploy.md` were run against the local stack, and they return what the guide says to expect.
- **Landing copy:** "Weekly briefings" is now on-demand briefings, matching plan 06.

## Follow-ups
- **Dependabot for `github-actions`:** it would keep the pinned SHAs current. It opens PRs on the public repo, so turn it on deliberately.
- **CI on GitHub:** the workflow has only run as local pieces (the env writer and every check). Its first real run happens with this plan's push.
