-- Deny by default: new tables and sequences in public, and new functions in any schema (when
-- created by postgres), start with no access for anon or authenticated. Every migration grants
-- exactly what it needs from here on, and supabase/tests/database/grants.test.sql checks the
-- whole catalog. Needs Postgres 17 (MAINTAIN).
--
-- Privileges only: no tables, data or policies change, and the app keeps every grant it uses.

-- 1. Foundation tables: select and the column updates stay. TRUNCATE skips RLS, MAINTAIN
--    (Postgres 17) allows LOCK TABLE on tables every workspace shares, and nothing needs
--    REFERENCES or TRIGGER.
revoke truncate, references, trigger, maintain on public.workspaces, public.profiles, public.memberships from authenticated;
-- The foundation migration relied on the platform's auto-expose default for select. Grant it
-- explicitly, so access is the same whatever `auto_expose_new_tables` is set to.
grant select on public.workspaces, public.profiles, public.memberships to authenticated;

-- 2. Internal helpers, called only from the security definer member RPCs, which run as the
--    function owner (postgres). They picked up an execute grant from the old schema default.
revoke execute on function
  public.assert_can_assign(uuid, public.workspace_role),
  public.assert_can_manage_member(uuid, uuid)
from authenticated;

-- 3. New tables and sequences: no access until granted.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;

-- 4. New functions: not executable until granted. The global entry removes the built-in
--    EXECUTE to PUBLIC, which a schema-level entry can't; the schema entry removes the explicit
--    grant to authenticated.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
