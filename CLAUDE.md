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

- Supabase CLI commands wait on stdin when it isn't a terminal: pass `< /dev/null` (`migration new`, `db reset`, `test db`).
- Demo accounts (password `demo1234`): `owner@`, `admin@`, `analyst@`, `viewer@` and `agency@clubintel.test`. See the README for their workspaces. E2E tests sign up throwaway `e2e-*@test.local` users.
- Never run `supabase db reset --linked`, `db push` or anything against a remote project without the user (hooks enforce this).

## Multi-tenant model (the security boundary)
- **RLS is the boundary.** The app's own workspace filters are convenience. Every table has RLS on and a policy per allowed command `to authenticated`.
- **Permissions, not roles.** Roles `owner > admin > analyst > viewer` map to permission strings in `public.role_permissions()`. Policies call `public.can(workspace_id, '<perm>')`; the app reads `workspace.permissions` from the DAL. To add a permission: `create or replace` `role_permissions` in a new migration, keeping every existing entry.
- **The active workspace is server state** (`profiles.current_workspace_id`), changed only by `switch_workspace()`, which checks membership. `current_workspace()` returns it only while the user is still a member.
- **Never accept a workspace id from the client as proof of access.** Server code takes it from `requireWorkspace()`. Tenant tables get `workspace_id` from a trigger, and it can't change.
- **Members** change only through RPCs with the rank rule: you act on people ranked below you and grant roles below your own. The owner is built in.
- **Shared data** (e.g. the national club database: `leagues`, `clubs`, `club_seasons`) has no `workspace_id`, can be read by `authenticated`, and has no write policies or grants. Its seed is generated (`scripts/`, into `supabase/seeds/`), never hand-edited.
- **Every tenant table** needs a pgTAP test proving workspace A can't read, insert into, update, delete in, or reference workspace B. Recipe: `/tenant-feature`.

## Database conventions
- Migrations only, via `/new-migration`. Never edit a committed migration (a hook blocks it); add a new one.
- `security definer` only when needed, always with `set search_path = ''` and fully qualified names. Revoke `execute` from `public, anon`.
- Views use `security_invoker = true`. Aggregates run as invoker so RLS filters them.
- Postgres errors meant for users use `raise exception … using errcode` with `42501` (denied), `P0001` (rule), `P0002` (not found) or `23505` (duplicate). `dbError()` shows only those.
- Test helpers: `supabase/tests/database/000-setup-tests-hooks.sql` (`tests.create_user`, `tests.authenticate_as`, `tests.add_member`).

## Next.js conventions
- This Next.js has breaking changes from older versions: read `node_modules/next/dist/docs/` before using an API. Middleware is `src/proxy.ts`. After a mutation, call `refresh()` from `next/cache` (a redirect to the current URL doesn't re-render the layout).
- **Cache Components:** anything that reads the request (the Supabase client, `cookies()`, `searchParams`, `params`) renders inside `<Suspense>`. The `(app)` layout's boundary only covers full page loads, so each page renders its static header and wraps its data in its own `<Suspense>` (see `clubs/page.tsx`); otherwise client navigations block and dev logs "uncached data … outside `<Suspense>`". `createClient()` calls `connection()`. Nothing random or time-based renders in the static shell.
- **Data Access Layer** (`src/lib/dal.ts`, `server-only`): `getUser`, `requireUser`, `requireWorkspace`, `requirePermission`. Every page, Server Action and Route Handler starts there. `proxy.ts` only does optimistic redirects.
- **Route Handlers** (`src/app/api/v1/`) start with `getUser()` and return `401` JSON rather than redirecting; parse query strings with the same zod schemas as the pages.
- **Server Actions** live in `"use server"` files. They check the user or permission first, parse with the shared zod schema in `src/lib/validation.ts`, and return `ActionState` (`src/lib/action-state.ts`, with `values` so forms keep input). Then they `refresh()` or `redirect()`.
- Supabase queries on the server use `createClient()` from `src/lib/supabase/server.ts` (as the user, under RLS). Typed with `database.types.ts`; regenerate after migrations.
- UI: shadcn/ui components first (`npx shadcn@4.22.1 add <name>`). Pages use `PageHeader`, show empty, loading and error states, and show controls according to `workspace.permissions`. Layouts work at 390px.
- Validation in zod 4: trim before checking a format (`z.string().trim().pipe(z.email())`).

## Workflow rules
- **Plan first** for anything touching more than 3 files, then wait for approval. Plans live in `docs/plans/NN-task-name.md` (template in `/plan-task`), with Status Proposed → WIP (on approval) → Done (with commit hashes). Keep the index `docs/plans/README.md` in sync. In plan mode, an approved plan is saved there as the next `NN` with Status WIP before any code.
- Build in small steps; checks green before moving on. `/verify` before saying anything is done; `/verify all` before shipping.
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
