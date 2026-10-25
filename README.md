# ClubIntel

Commercial intelligence and club management for professional sports clubs. It's a multi-tenant SaaS built with **Next.js 16, React 19, TypeScript, Supabase (Postgres + Auth + RLS), Tailwind CSS v4 and shadcn/ui**.

> A demo product. All clubs, people and organizations in the seed data are fictional.

## Features

- **Multi-tenant workspaces.** Each customer organization is a workspace, and users can belong to several and switch between them. Isolation is enforced in Postgres with row level security, not just in the UI.
- **Roles and permissions.** Owner, admin, analyst and viewer map to permissions in one SQL function (`public.can()`), which policies and server code both use. You can only manage members ranked below you.
- **Auth.** Email + password sign-up, sign-in and password reset through Supabase Auth, with sessions in cookies (`@supabase/ssr`).
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

The database is created from `supabase/migrations/` and filled from `supabase/seed.sql`. `npm run db:reset` rebuilds the **local** database from scratch.

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

## Project layout

```
src/proxy.ts                 refreshes the session cookie; optimistic redirects only
src/lib/dal.ts               Data Access Layer: current user, workspace and permissions
src/lib/supabase/            server and browser clients, generated database types
src/lib/workspace-actions.ts Server Actions for workspaces and members
src/app/(auth)/              sign in, sign up, password reset
src/app/(app)/               the signed-in app (sidebar layout)
supabase/migrations/         schema, functions and RLS policies
supabase/tests/database/     pgTAP tests
e2e/                         Playwright tests
docs/plans/                  one plan file per feature
```
