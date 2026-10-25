---
name: new-migration
description: Create a new Supabase migration with the project's safety rules (RLS on, policies per command, security definer hygiene, grants), apply it locally and regenerate types. Use for any schema, function or policy change.
argument-hint: "[short_snake_case_name]"
---

# New migration

Name: $ARGUMENTS

Committed migrations are never edited (a hook blocks it). Every schema change is a new file.

## Steps
1. Create the file. The CLI waits on stdin when it isn't a terminal, so feed it nothing:
   ```bash
   supabase migration new $ARGUMENTS < /dev/null
   ```
2. Write the SQL using the rules below.
3. Apply it and reseed locally: `supabase db reset < /dev/null`. That only touches the local stack; never use `--linked`.
4. Regenerate types: `npm run db:types`, and fix any TypeScript errors.
5. Add or extend pgTAP tests in `supabase/tests/database/`, then run `supabase test db < /dev/null`. `grants.test.sql` checks the whole catalog: a missing grant shows up as "permission denied" in your tests, an extra one as a failure there.
6. Ask the `rls-reviewer` agent to review the migration.

## Rules
- **Every table** gets `alter table … enable row level security` in the same migration, and explicit policies `to authenticated` for each command it allows. No policy means no access, which is the right default for commands nobody needs.
- **Grants are explicit.** New tables and sequences in `public`, and new functions in any schema, start with no access for `anon` or `authenticated` (deny by default, plan 09). Grant what the app needs in the same migration:
  - tables: `grant select, delete on public.<t> to authenticated;` plus column grants for writes, `grant insert (<cols>), update (<cols>) …`, listing only the columns people edit (never `id`, `workspace_id`, `created_by` or timestamps). RLS decides which rows; leave out commands nobody uses;
  - functions that run as the caller (called by the app, a policy, a column default or check constraint, or a `security invoker` trigger): `grant execute on function public.<f>(<args>) to authenticated;`, then add it to the allowlist in `supabase/tests/database/grants.test.sql`;
  - Auth hooks (custom access token, before user created) grant execute to `supabase_auth_admin` only, plus whatever it reads (that role doesn't bypass RLS: grant and add a policy `to supabase_auth_admin`);
  - never grant TRUNCATE, REFERENCES, TRIGGER or MAINTAIN, never grant anything to `anon`, and never expose a materialized view or foreign table to `authenticated` (they have no RLS).
- **Ids** are `uuid` or `generated always as identity`, not `serial`: sequences aren't granted to API roles. **Extensions** go `with schema extensions`, never `public`.
- **Tenant-owned tables** have `workspace_id uuid not null references public.workspaces (id) on delete cascade`, set by a `before insert` trigger from `public.current_workspace_id()`, and refuse changes to it on update. Put `workspace_id` first in composite indexes.
- **Policies check permissions**, never role names:
  - `using (public.can(workspace_id, '<thing>.view'))` for select;
  - `with check (public.can(workspace_id, '<thing>.write'))` for insert and update;
  - `using (public.can(workspace_id, '<thing>.delete'))` for delete.
- **New permissions** go in `public.role_permissions` via `create or replace`, keeping every existing entry. Decide which roles get each one and say so in the plan.
- **Foreign keys to tenant tables** must stay inside the workspace. A trigger checks the referenced row has the same `workspace_id` (and a referenced user is a member), so nobody can link to another workspace's row by id.
- **Functions:**
  - prefer `security invoker` (the default), so RLS applies;
  - use `security definer` only when a function must read past RLS, and then always `set search_path = ''`, fully qualify every name, and check `auth.uid()` or `can()` inside;
  - grant `execute` to `authenticated` only for what runs as the caller (see Grants). A trigger function itself, and helpers called only from other `security definer` functions, get no grant; but anything a `security invoker` trigger calls does. (An explicit `revoke execute … from public, anon` is redundant now, but harmless.)
- **Views** use `with (security_invoker = true)`, written exactly like that.
- **Never** `drop` or `truncate` data in a migration without the user's explicit OK in the plan.
