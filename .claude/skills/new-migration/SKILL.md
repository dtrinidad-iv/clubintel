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
5. Add or extend pgTAP tests in `supabase/tests/database/`, then run `supabase test db < /dev/null`.
6. Ask the `rls-reviewer` agent to review the migration.

## Rules
- **Every table** gets `alter table … enable row level security` in the same migration, and explicit policies `to authenticated` for each command it allows. No policy means no access, which is the right default for commands nobody needs.
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
  - `revoke execute … from public, anon` and grant to `authenticated` only what the app calls.
- **Views** use `with (security_invoker = true)`.
- **Never** `drop` or `truncate` data in a migration without the user's explicit OK in the plan.
