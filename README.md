# ClubIntel

Commercial intelligence and club management for professional sports clubs. It's a multi-tenant SaaS built with **Next.js 16, React 19, TypeScript, Supabase (Postgres + Auth + RLS), Tailwind CSS v4 and shadcn/ui**.

> A demo product. All clubs, people and organizations in the seed data are fictional.

## Features

- **Multi-tenant workspaces.** Each customer organization is a workspace, and users can belong to several and switch between them. Isolation is enforced in Postgres with row level security, not just in the UI.
- **Roles and permissions.** Owner, admin, analyst and viewer map to permissions in one SQL function (`public.can()`), which policies and server code both use. You can only manage members ranked below you.
- **Auth.** Email + password sign-up, sign-in and password reset through Supabase Auth, with sessions in cookies (`@supabase/ssr`).
- **National club database.** A shared, searchable directory of 42 fictional clubs across five leagues and four tiers, with five seasons of attendance, capacity and league position. Filters live in the URL; each club has a profile with attendance and league position charts. It's reference data every workspace reads, so it has no workspace and no write access from the app.
- **REST API.** `GET /api/v1/clubs` and `GET /api/v1/clubs/{id}` for external tools (see [API](#api)).
- **Responsive app shell.** The sidebar collapses on desktop and becomes a sheet on mobile, with a workspace switcher and account menu.

Planned work, one plan file per feature, is in [`docs/plans/`](docs/plans/README.md).

## Run it locally

Requirements: Node 22 (`.nvmrc`), Docker (or colima), and the [Supabase CLI](https://supabase.com/docs/guides/local-development).

```bash
npm install
npm run db:start                 # local Supabase on ports 55321-55329
cp .env.example .env.local       # then fill NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from `supabase status`
npm run dev                      # http://localhost:3020
```

The database is created from `supabase/migrations/` and filled from `supabase/seed.sql` (accounts and workspaces) and `supabase/seeds/*.sql`. `npm run db:reset` rebuilds the **local** database from scratch.

The club data in `supabase/seeds/clubs.sql` is generated: change `scripts/generate-clubs.mjs` and run `node scripts/generate-clubs.mjs`. The script is deterministic, so the same clubs and ids come out every time.

### Demo accounts

Every demo account's password is `demo1234`.

| Email | Role |
|---|---|
| `owner@clubintel.test` | Owner of *Northbridge Athletic Commercial*, admin of *Demo Sports Agency* |
| `admin@clubintel.test` | Admin of *Northbridge Athletic Commercial* |
| `analyst@clubintel.test` | Analyst of *Northbridge Athletic Commercial* |
| `viewer@clubintel.test` | Viewer of *Northbridge Athletic Commercial* |
| `agency@clubintel.test` | Owner of *Demo Sports Agency* |

Emails sent locally (password reset, confirmation) appear in Mailpit at http://127.0.0.1:55324.

## Checks

| Command | What it runs |
|---|---|
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm test` | Vitest unit tests |
| `npm run test:db` | pgTAP tests in `supabase/tests/`, covering RLS isolation between workspaces and the permission matrix |
| `npm run build` | Production build |
| `npm run test:e2e` | Playwright end-to-end tests (desktop + mobile) against the production build |
| `npm run test:hooks` | Tests for the Claude Code hooks |
| `.claude/skills/verify/verify.sh [all]` | All of the above, as CI runs them |

## API

Both endpoints need a signed-in session (the Supabase auth cookie) and answer `401` without one. They return JSON.

| Endpoint | Returns |
|---|---|
| `GET /api/v1/clubs` | `{ data: Club[], meta: { page, pageSize, total, totalPages } }`, 20 clubs a page, ordered by tier and league position |
| `GET /api/v1/clubs/{id}` | `{ data: Club }` with `league` and every season in `seasons`, or `404` |

Query parameters for the list, all optional: `q` (part of the club name), `league` (a league id such as `league-one`), `region` (`england-north`, `england-midlands`, `england-south`, `scotland`, `wales`, `northern-ireland`, `ireland`), `tier` (1–4) and `page`. Invalid values are ignored rather than rejected. Seasons are numbered by their starting year: `2025` is 2025/26.

## Project layout

```
src/proxy.ts                 refreshes the session cookie; optimistic redirects only
src/lib/dal.ts               Data Access Layer: current user, workspace and permissions
src/lib/supabase/            server and browser clients, generated database types
src/lib/workspace-actions.ts Server Actions for workspaces and members
src/lib/clubs.ts             queries for the shared club database
src/app/api/v1/              REST endpoints
src/app/(auth)/              sign in, sign up, password reset
src/app/(app)/               the signed-in app (sidebar layout)
supabase/migrations/         schema, functions and RLS policies
supabase/seeds/              generated seed data (clubs)
supabase/tests/database/     pgTAP tests
scripts/                     data generators
e2e/                         Playwright tests
docs/plans/                  one plan file per feature
```

## Built with Claude Code

This repo is developed with [Claude Code](https://claude.com/claude-code), using project rules and tooling that are checked in:

- [`CLAUDE.md`](CLAUDE.md): the tenancy, database, Next.js and workflow rules Claude follows.
- [`.claude/skills/`](.claude/skills): `/plan-task`, `/verify`, `/ship-plan`, `/new-migration` and `/tenant-feature`.
- [`.claude/agents/`](.claude/agents): read-only reviewers for code, security, RLS and UI.
- [`.claude/hooks/`](.claude/hooks): guards that block force-pushes, remote database resets, edits to committed migrations and secrets in code. They're tested in `tests/hooks.test.mjs`.
- [`docs/plans/`](docs/plans/README.md): one plan per feature, from proposal to the commits that shipped it.
