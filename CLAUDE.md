# ClubIntel

Commercial intelligence and club management for professional sports clubs. A multi-tenant SaaS: each customer organization is a **workspace**, isolated in Postgres with row level security.

@AGENTS.md

## Stack
- Next.js 16 (App Router, Cache Components + Partial Prefetching on), React 19, TypeScript, Tailwind v4, shadcn/ui (radix-nova, `cn` package), zod 4.
- Supabase: Auth (cookie sessions via `@supabase/ssr`), Postgres with RLS, Mailpit for local email.
- Node 22 (`.nvmrc`, `nvm use`). Vitest 5 needs it.
- Local ports: app **:3020**; Supabase API :55321, DB :55322, Studio :55323, Mailpit :55324. Ports 3000 and 8000 belong to other projects; don't use them or stop what runs there.

## Commands
| What | Command |
|---|---|
| Start local Supabase (colima/Docker running) | `npm run db:start` |
| Dev server | `npm run dev` |
| All checks (what CI runs) | `.claude/skills/verify/verify.sh` (add `all` for e2e) |
| Rebuild the **local** DB from migrations + seed | `supabase db reset < /dev/null` |
| Regenerate DB types after a migration | `npm run db:types` |
| Regenerate the club seed (`supabase/seeds/clubs.sql`) | `node scripts/generate-clubs.mjs` |
| pgTAP / Vitest / hooks / e2e | `npm run test:db` / `npm test` / `npm run test:hooks` / `npm run test:e2e` |
| Redo `docs/screenshots/` from the seeded demo (stop `npm run dev` first; it builds) | `supabase db reset < /dev/null && npm run screenshots` |

- Supabase CLI commands wait on stdin when it isn't a terminal: pass `< /dev/null` (`migration new`, `db reset`, `test db`).
- Demo accounts (password `demo1234`): `owner@`, `admin@`, `analyst@`, `viewer@` and `agency@clubintel.test`. See the README for their workspaces. E2E tests sign up throwaway `e2e-*@test.local` users.
- Never run `supabase db reset --linked`, `db push` or anything against a remote project without the user (hooks enforce this).

## Multi-tenant model (the security boundary)
- **RLS is the boundary.** The app's own workspace filters are convenience. Every table has RLS on and a policy per allowed command `to authenticated`.
- **Permissions, not roles.** Roles `owner > admin > analyst > viewer` map to permission strings in `public.role_permissions()`. Policies call `public.can(workspace_id, '<perm>')`; the app reads `workspace.permissions` from the DAL. To add a permission: `create or replace` `role_permissions` in a new migration, keeping every existing entry.
- **The active workspace is server state** (`profiles.current_workspace_id`), changed only by `switch_workspace()`, which checks membership. `current_workspace()` returns it only while the user is still a member.
- **Never accept a workspace id from the client as proof of access.** Server code takes it from `requireWorkspace()`. Tenant tables get `workspace_id` from a trigger, and it can't change.
- **Members** change only through RPCs with the rank rule: you act on people ranked below you and grant roles below your own. The owner is built in.
- **Shared data** (e.g. the national club database: `leagues`, `clubs`, `club_seasons`) has no `workspace_id`, can be read by `authenticated`, and has no write policies or grants. Its seed is generated (`scripts/`, into `supabase/seeds/clubs.sql`), never hand-edited. Other files in `supabase/seeds/` are hand-written demo data that load after it.
- **Every tenant table** needs a pgTAP test proving workspace A can't read, insert into, update, delete in, or reference workspace B. Recipe: `/tenant-feature`; reference implementation: `opportunities` and `contacts` (plan 04).
- **Tenant rows** use the shared trigger `public.tenant_row_defaults()` (`workspace_id` from the active workspace, `created_by`, timestamps, `workspace_id` immutable). References to other tenant rows are composite foreign keys including `workspace_id` (`unique (workspace_id, id)` on the target), so Postgres refuses cross-workspace links; a member reference points at `memberships (workspace_id, user_id)`.

## Database conventions
- Migrations only, via `/new-migration`. Never edit a committed migration (a hook blocks it); add a new one.
- **Deny by default** (plan 09). New tables and sequences in `public`, and new functions in *any* schema (including `pg_temp` helpers in tests), get no privileges for `anon` or `authenticated`. Each migration grants what it needs: `select`/`delete` on the table and `insert`/`update` on the editable columns only (never `id`, `workspace_id`, `created_by`, timestamps) to `authenticated` (RLS picks the rows), and `grant execute on function … to authenticated` for anything that runs as the caller (the app, a policy, a column default or check, an invoker trigger). Never TRUNCATE/REFERENCES/TRIGGER/MAINTAIN, never `anon`, no materialized views or foreign tables readable by `authenticated` (no RLS). `supabase/tests/database/grants.test.sql` checks the whole catalog and keeps an allowlist of callable functions. `auto_expose_new_tables = false` in `config.toml`; the hosted project must match.
- Create schema objects only through migrations, never in Studio: Studio runs as `supabase_admin`, whose defaults still grant `anon` everything. Extensions go `with schema extensions`. Ids are `uuid` or `generated … as identity`, never `serial` (sequences aren't granted).
- `security definer` only when needed, always with `set search_path = ''` and fully qualified names.
- Scheduled work runs in Postgres with pg_cron (`cron.schedule` in a migration, as postgres), calling an internal function with no grants (plan 07: `evaluate_all_alerts`). No HTTP cron endpoints or cron secrets.
- Seeds in `supabase/seeds/` load alphabetically: name a seed so it sorts after the seeds it depends on.
- Views use `security_invoker = true`. Aggregates run as invoker so RLS filters them. Dashboard-style functions (`dashboard_*`, plan 05) take no workspace argument: they count `(select public.current_workspace_id())`, so the client has nothing to change.
- Postgres errors meant for users use `raise exception … using errcode` with `42501` (denied), `P0001` (rule), `P0002` (not found) or `23505` (duplicate). `dbError()` shows only those.
- Test helpers: `supabase/tests/database/000-setup-tests-hooks.sql` (`tests.create_user`, `tests.authenticate_as`, `tests.add_member`).

## Next.js conventions
- This Next.js has breaking changes from older versions: read `node_modules/next/dist/docs/` before using an API. Middleware is `src/proxy.ts`. After a mutation, call `refresh()` from `next/cache` (a redirect to the current URL doesn't re-render the layout).
- **Cache Components:** anything that reads the request (the Supabase client, `cookies()`, `searchParams`, `params`) renders inside `<Suspense>`. The `(app)` layout's boundary only covers full page loads, so each page renders its static header and wraps its data in its own `<Suspense>` (see `clubs/page.tsx`); otherwise client navigations block and dev logs "uncached data … outside `<Suspense>`". `createClient()` calls `connection()`. Nothing random or time-based renders in the static shell.
- **Data Access Layer** (`src/lib/dal.ts`, `server-only`): `getUser`, `requireUser`, `requireWorkspace`, `requirePermission`. Every page, Server Action and Route Handler starts there. `proxy.ts` only does optimistic redirects, and only for page loads (GET/HEAD): a Server Action is a POST to the page's path, and a proxy redirect would reach the client as an unreadable response; the action's DAL call redirects instead.
- **Route Handlers** (`src/app/api/v1/`) start with `getUser()` and return `401` JSON rather than redirecting; parse query strings with the same zod schemas as the pages. A Route Handler that changes data or spends money (POST etc.) also checks the `Origin` is same-site and requires a JSON body: Next's CSRF protection covers Server Actions only (see `src/lib/ai/report-stream.ts`).
- **Server Actions** live in `"use server"` files. They check the user or permission first (write actions use `checkPermission()` and return `NO_PERMISSION` instead of throwing), parse with the shared zod schema in `src/lib/validation.ts`, and return `ActionState` (`src/lib/action-state.ts`, with `values` so forms keep input). Then they `refresh()` or `redirect()`.
- Supabase queries on the server use `createClient()` from `src/lib/supabase/server.ts` (as the user, under RLS). Typed with `database.types.ts`; regenerate after migrations.
- Forms use `Field`, `SelectField` and `TextareaField` from `src/components/auth/form-parts.tsx`; after a failed submit they show what was sent (they remount keyed on `state.values`, because React resets the form and Radix's Select follows the reset). Element ids must be unique per instance (`useId()`), not derived from field names: Next keeps visited routes mounted but hidden, so a sign-in form's `#email` can still be in the page. Dialogs opened from a button or menu use `useDialogState` (keeps the item through the exit animation, fresh form per open, focus back to the opener); dialog forms use `noValidate` (errors come from zod, inline) and close with `useCloseOnSuccess`. The same hidden routes stay in the DOM for E2E tests: locate by role (hidden routes drop out), or scope to the visible table or dialog, not by bare CSS or `getByLabel`. Specs import `test`/`expect` from `e2e/fixtures.ts`, whose `page.getByTestId` matches visible elements only: while a page streams in, React briefly keeps a hidden copy of a Suspense boundary's content (`<div hidden id="S:…">`). So `toHaveCount(0)` on a test id means "not visible"; pages from `browser.newContext()` skip the fixture.
- UI: shadcn/ui components first (`npx shadcn@4.22.1 add <name>`). Pages use `PageHeader`, show empty, loading and error states, and show controls according to `workspace.permissions`. Layouts work at 390px.
- Validation in zod 4: trim before checking a format (`z.string().trim().pipe(z.email())`).

## AI layer (`src/lib/ai/`, plan 06)
- One door: `getAiClient()` returns an `AiClient` (`AnthropicAiClient` or `FakeAiClient`) or `null` when AI is off. `AI_PROVIDER=fake` streams a fixed sample with no network; it is what e2e and local work use. Production never falls back to fake output. `ANTHROPIC_API_KEY` is server-only.
- Prompts live in `src/lib/ai/prompts/`. Workspace data goes in one delimited block built from the user's RLS client for the active workspace; text people typed is marked as data, never instructions. Leave out what the task doesn't need (contact details, people's names).
- Output is structured (a zod schema, sent as the output format) and validated again before saving. AI writes drafts; people approve. AI never triggers actions.
- **AI writes go through the service role**, the app's one use of it: `createServiceClient()` (`src/lib/supabase/admin.ts`, `SUPABASE_SECRET_KEY`, server-only). The route checks the user with the DAL first and passes the ids it checked to functions only `service_role` may execute (`start_report`, `finish_report`, `fail_report`, `settle_ai_usage`), which check them again. Users can't call them, so they can't forge a report's content or its cost. Reads stay on the user's RLS client. `grants.test.sql` pins the service-role-only list, and ESLint (`no-restricted-imports`) lets only the report route import `@/lib/supabase/admin`.
- **Money is enforced in Postgres.** `start_report` checks the permission, the budget (the workspace's, capped by the operator's `ai_limits` row, which tenants can't change), and the workspace, per-user and platform limits. It reserves the most one report may cost. `settle_ai_usage` replaces the reservation once, bound to the workspace: with the real cost (capped), or a cautious estimate for a stopped call. A crashed call keeps its reservation.
- Unit tests run the route with `FakeAiClient` and a `fetch` that throws, and `AnthropicAiClient` against recorded SSE responses through a stubbed `fetch` (usage after the stream ends, `max_tokens`, refusal fallback, abort). No test reaches the network. Use the `claude-api` skill before changing SDK calls.

## Workflow rules
- **Plan first** for anything touching more than 3 files, then wait for approval. Plans live in `docs/plans/NN-task-name.md` (template in `/plan-task`), with Status Proposed → WIP (on approval) → Done (with commit hashes). Keep the index `docs/plans/README.md` in sync. In plan mode, an approved plan is saved there as the next `NN` with Status WIP before any code.
- Build in small steps; checks green before moving on. `/verify` before saying anything is done; `/verify all` before shipping. CI (`.github/workflows/ci.yml`) runs the same steps on every push and PR, with no secrets; a new check goes in both `verify.sh` and the workflow.
- A page or visible change that makes a screenshot out of date: rerun `npm run screenshots` (add a shot to `e2e/screenshots.spec.ts` for a new page) and commit the images with the change. Deploy steps and hosted settings live in `docs/deploy.md`; a migration that needs one updates it.
- Before reporting a change done, run the reviewers that fit, in parallel: `code-reviewer`, `security-auditor` and `rls-reviewer` always (RLS when SQL or queries changed), plus `ui-reviewer` when pages changed.
- Docs change in the same commit as the code they describe: `.env.example` (new keys, with a comment), `CLAUDE.md` (conventions, commands, tooling), `README.md` (setup, features, screenshots).
- Commits: `type(scope): summary`, e.g. `feat(db): …`, `feat(web): …`, `test: …`, `chore(claude): …`, `docs: …`. Commit only when the user approves; `/ship-plan NN` does it.
- Ask before adding a dependency, and say why it's needed.
- Demo data is fictional: no real clubs, leagues, sponsors or people.

## Claude Code tooling (`.claude/`, `.mcp.json`)
- **Skills:**
  - `/plan-task`: write a plan and stop for approval.
  - `/verify`: lint, typecheck, Vitest, hook tests, pgTAP and build; `all` adds Playwright.
  - `/ship-plan`: commit by area, mark the plan Done, push. Only the user starts it.
  - `/new-migration`: migration rules and steps.
  - `/tenant-feature`: the recipe for a workspace-owned feature.
- **Subagents** (read-only):
  - `code-reviewer`: correctness and conventions.
  - `security-auditor`: auth, secrets, injection, AI safety.
  - `rls-reviewer`: cross-workspace access, with read-only SQL against the local DB.
  - `ui-reviewer`: Playwright MCP, on Sonnet, quick mode unless asked for a "full sweep".
- **Hooks** (`.claude/hooks/*.mjs`, tested by `tests/hooks.test.mjs`):
  - `guard-bash` denies force-push, remote DB resets, deleting migrations, hand-run DROP/TRUNCATE and `git reset --hard`. It asks before `git push`, `supabase db push`/`link`, `gh repo` changes and `vercel`.
  - `guard-files` denies secret keys in any file, edits to committed migrations, edits to `.env*` other than `.env.example`, server secrets in `"use client"` files, and `NEXT_PUBLIC_*SECRET*`.
  - `post-edit` type-checks after TypeScript edits.
  - `session-start` lists open plans and whether Supabase is running.
- **MCP:** `playwright` (headless browser for UI review and screenshots, output in `.playwright-mcp/`), `next-devtools` (errors, routes and logs from the running dev server, plus version-matched docs).
