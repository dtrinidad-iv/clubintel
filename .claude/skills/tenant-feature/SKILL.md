---
name: tenant-feature
description: Step-by-step recipe for a tenant-owned (workspace-scoped) feature across Supabase and Next.js - migration with RLS, pgTAP isolation tests, DAL queries, Server Actions, pages. Use when building any table or resource that belongs to a workspace (opportunities, contacts, reports, alerts, ...).
argument-hint: "[feature, e.g. contacts]"
---

# Add a tenant-owned feature

Feature: $ARGUMENTS

It touches more than 3 files, so run `/plan-task` first and wait for approval. Workspaces and members (plan 01) are the reference for RLS and permissions. The first tenant feature you build becomes the reference for the rest: follow its shape.

## Database
Use `/new-migration`; its rules apply.
1. **Table** with `id uuid primary key default gen_random_uuid()`, `workspace_id` (set by trigger, immutable), `created_by uuid references auth.users on delete set null`, `created_at`, `updated_at`. Add check constraints for lengths and ranges: the database is the last line of validation.
2. **Triggers:** set `workspace_id` from `current_workspace_id()` on insert, refusing when it's null; refuse a change to `workspace_id`; keep `updated_at` current; and check that same-workspace references point inside the workspace.
3. **Permissions:** add `<thing>.view`, `.write` and `.delete` to `role_permissions` (keep all existing ones). Default grants: everyone views, analyst and up write, admin and up delete, unless the plan says otherwise.
4. **Policies:** one per command using `can()`. Enable RLS.
5. **Grants:** `grant select, insert, update, delete on public.<things> to authenticated;` (nothing is granted by default; RLS decides which rows). Any function the app or a policy calls also needs `grant execute … to authenticated` and a line in the allowlist in `grants.test.sql`.

## Tests (pgTAP, `supabase/tests/database/<things>.test.sql`)
Use the helpers from `000-setup-tests-hooks.sql`: `tests.create_user`, `tests.authenticate_as`, `tests.add_member`, `tests.clear_authentication`.
- **Isolation (required).** A member of workspace A:
  - sees none of B's rows;
  - can't update or delete B's rows (0 rows affected, and B's data unchanged when read back as `postgres`);
  - can't insert into B, even by sending B's `workspace_id`: the trigger overwrites or refuses it;
  - can't reference B's rows by id.
- **Permission matrix:** viewer, analyst, admin and owner × select, insert, update, delete.
- **A positive case next to every negative one.** A missing grant raises 42501 too, so "A can't insert into B" would pass for the wrong reason. For each command, a `lives_ok` (and a read-back) proves the allowed role really can, before the `throws_ok … '42501'` proves the others can't.
- **Prove the tests bite.** Temporarily loosen a policy to `using (true)`, run the tests and see them fail, then restore it. Mention it in the report.

## App
1. **DAL** (`src/lib/<things>.ts`, `import "server-only"`): queries through `createClient()` (as the user, so RLS applies). Filter by the workspace from `requireWorkspace()` for clarity, but never rely on that filter for security.
2. **Schemas** in `src/lib/validation.ts` (or `src/lib/<things>-schema.ts`), shared by the form and the action.
3. **Server Actions** (`"use server"`): `requirePermission("<thing>.write")` first, parse with zod, write, return `ActionState` (`dbError` for Postgres errors), then `refresh()`. Never accept `workspace_id` from the form.
4. **Pages** under `src/app/(app)/<things>/`:
   - Server Components that call the DAL;
   - empty, not-found (`notFound()`, also for another workspace's id) and error states;
   - buttons shown according to `workspace.permissions`.
5. **Navigation:** add an item in `src/components/app/nav-main.tsx`.
6. **Types:** `npm run db:types` after the migration.

## Finish
- Playwright flow in `e2e/<things>.spec.ts`: create as an analyst; a viewer sees no write controls.
- `/verify all`, then the reviewers in parallel: `code-reviewer`, `security-auditor`, `rls-reviewer`, and `ui-reviewer` for the new pages.
