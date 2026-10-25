# 01 — Foundation: auth, workspaces, RLS and app shell

**Status:** Done
**Commits:** `94f90c5` (scaffold), `83901f0` (db), `b56a698` (web), `32a353a` (tests)

## Goal
Lay down the multi-tenant base every later feature builds on. Covers Next.js 16 + Tailwind + shadcn/ui, a local Supabase stack, email/password auth, **workspaces** (the tenant) with memberships and roles, permission checks in SQL, RLS on every table, and a responsive app shell with a workspace switcher.

Out of scope: email invitations (members are added by the email of an existing account), billing, dark mode toggle, social login.

## Decisions
- **The tenant is a workspace.** That's a customer organization: a club's commercial team, a league body or an agency. A user can belong to many and switches between them.
- **The active workspace lives on the server** (`profiles.current_workspace_id`), set only by the `switch_workspace()` RPC, which checks membership. `current_workspace()` returns it only while the user is still a member. The client never sends a workspace id as proof of access. RLS re-checks membership on every row.
- **Permissions, not role names.** Fixed roles `owner > admin > analyst > viewer` map to permission strings in one SQL function (`role_permissions`). Policies and server code call `can(workspace_id, perm)`. The UI asks `my_permissions()` instead of keeping a copy of the map, so there's one source of truth.
- **Member changes go through RPCs** (`add_member_by_email`, `set_member_role`, `remove_member`) with a rank rule: you can only act on someone ranked below you and only grant a role below your own. The owner is built in, can't be changed or removed, and is never granted.
- **Supabase SSR** (`@supabase/ssr`). `src/proxy.ts` (Next 16's name for middleware) refreshes the session cookie and does an optimistic redirect only. Real checks happen in the Data Access Layer (`src/lib/dal.ts`, `server-only`), which every page, Server Action and Route Handler calls.
- **Cache Components stays on** (the Next 16 default). Session reads sit inside `<Suspense>`, following the Next docs' "Authentication with Cache Components" guide.
- **Local Supabase on the 5532x ports** (`supabase/config.toml`), so it can run next to another local stack. Next.js runs on **:3020**.
- **Dependencies:** `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `server-only`, shadcn/ui (radix, lucide-react, class-variance-authority, tailwind-merge, clsx), `vitest`, `@playwright/test`.

## Database (`supabase/migrations/…_foundation.sql`)
- `workspace_role` enum: `owner`, `admin`, `analyst`, `viewer`.
- `profiles` (id → `auth.users`, `full_name`, `current_workspace_id`), filled by a trigger on `auth.users` insert.
- `workspaces` (id, `name` 1–80 chars, `created_by`, `created_at`).
- `memberships` (`workspace_id`, `user_id`, `role`, primary key on both).
- Functions (`security definer`, `search_path = ''`):
  - `is_member(ws)`, `role_rank(role)`, `role_permissions(role)`, `can(ws, perm)`, `my_permissions(ws)`;
  - `current_workspace()` (id, name, role);
  - `create_workspace(name)` (makes you owner and switches to it), `switch_workspace(ws)`;
  - `add_member_by_email(ws, email, role)`, `set_member_role(ws, user, role)`, `remove_member(ws, user)`;
  - `workspace_members(ws)` (members with name and email, members only).
- Permissions defined now: `workspace.manage`, `members.view`, `members.manage`. Later plans add theirs with `create or replace` in a new migration.
- RLS:
  - `profiles`: a user reads and updates only their own row, can't set `current_workspace_id` directly (column privilege), and can read co-members' names.
  - `workspaces`: select for members, update with `workspace.manage`, no direct insert or delete.
  - `memberships`: select for members, no direct writes.

## App (`src/`)
- `lib/supabase/{server,client,proxy}.ts`, `proxy.ts`, `lib/dal.ts` (`getUser`, `requireUser`, `requireWorkspace`, `requirePermission`), `lib/validation.ts` (zod schemas).
- Public: `/` (product landing), `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/confirm` (email OTP verify Route Handler).
- `/onboarding`: create your first workspace.
- `(app)` layout with the shadcn `Sidebar`:
  - collapsible to icons on desktop, a sheet on mobile;
  - header: app name and the workspace switcher;
  - navigation: Dashboard, Settings (later plans add Clubs, Opportunities, Reports, Alerts);
  - footer: account menu (name, email, sign out).
- `/dashboard` (placeholder until plan 05).
- `/settings`: rename the workspace and manage members (list, add by email, change role, remove), with buttons shown according to `my_permissions`.

## Seed (`supabase/seed.sql`)
- Demo users (password `demo1234`):
  - `owner@clubintel.test`: owner of both workspaces;
  - `admin@`, `analyst@` and `viewer@` in "Northbridge Athletic Commercial";
  - `agency@`: owner of "Demo Sports Agency" only.
- Two workspaces, so isolation is visible in the UI.

## Tests
- pgTAP (`supabase/tests/database/`):
  - `000-setup-tests-hooks.sql`: helpers for creating users and acting as one;
  - `foundation.test.sql`:
    - workspace A's member can't see B's workspace or memberships;
    - `switch_workspace` to a non-member workspace raises;
    - `current_workspace` returns null after removal;
    - the rank rules (an admin can't touch an admin or owner, nobody can grant owner, a viewer can't manage);
    - a profile can't set `current_workspace_id` directly;
    - `can()` matrix per role.
- Vitest (`src/**/*.test.ts`): zod schemas.
- Playwright (`e2e/foundation.spec.ts`):
  - sign up → onboarding → dashboard;
  - owner switches workspace and sees the other workspace's name and members;
  - a viewer doesn't see member management controls.

## Verification
- `npm run lint`, `npx tsc --noEmit`, `npm test` (vitest), `supabase test db`, `npm run build`, `npx playwright test`.
- Flows:
  1. Sign up as a new user → land on onboarding → create "Test FC" → dashboard shows "Test FC" in the switcher.
  2. Log in as `owner@` → switch to "Demo Sports Agency" → settings shows only that workspace's members.
  3. Log in as `viewer@` → settings shows members with no add, role or remove controls.
  4. Log in as `admin@` → can change `analyst@` to viewer, can't change `owner@`.

## Commits after approval
`chore: scaffold Next.js 16 app`, `feat(db): workspaces, memberships, permissions and RLS`, `feat(web): auth, onboarding, app shell and workspace settings`, `test: pgTAP, vitest and Playwright foundation`, then this plan → Done.

## Follow-ups
- Email invitations for people without an account (members are added by the email of an existing account for now).
- The vertical `Separator` from shadcn rendered misaligned in the header, so it's replaced by a plain divider. Revisit when shadcn updates.
