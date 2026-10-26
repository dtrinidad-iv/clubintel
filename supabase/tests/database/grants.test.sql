-- Privileges across the whole public schema: deny by default, grant explicitly. These checks
-- read the catalog, so every future table, view, sequence and function is covered too.
begin;
select plan(19);
-- regprocedure text drops the schema only for schemas on the path; pin it so the allowlist reads the same everywhere.
set local search_path = public, extensions;

-- Tables and views -----------------------------------------------------------

select is(
  array(
    select c.relname::text from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm', 'p', 'f')
      and (has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN')
           or has_any_column_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, REFERENCES'))
    order by 1
  ),
  '{}'::text[],
  'anon has no privileges on any table or view'
);

select is(
  array(
    select c.relname::text from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm', 'p', 'f')
      and (has_table_privilege('authenticated', c.oid, 'TRUNCATE, REFERENCES, TRIGGER, MAINTAIN')
           or has_any_column_privilege('authenticated', c.oid, 'REFERENCES'))
    order by 1
  ),
  '{}'::text[],
  'authenticated has no TRUNCATE, REFERENCES, TRIGGER or MAINTAIN anywhere'
);

select is(
  array(
    select c.relname::text from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
      and not c.relrowsecurity
      and (has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
           or has_any_column_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE'))
    order by 1
  ),
  '{}'::text[],
  'every table authenticated can touch has RLS on'
);

-- Materialized views and foreign tables can't have RLS: whatever they hold, every workspace would see.
select is(
  array(
    select c.relname::text from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('m', 'f')
      and (has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
           or has_any_column_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE'))
    order by 1
  ),
  '{}'::text[],
  'authenticated can touch no materialized view or foreign table'
);

select is(
  array(
    select c.relname::text from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'v'
      and has_any_column_privilege('authenticated', c.oid, 'SELECT')
      and not exists (
        select 1 from pg_options_to_table(c.reloptions) o
        where o.option_name = 'security_invoker' and lower(o.option_value) in ('true', 'on', 'yes', '1')
      )
    order by 1
  ),
  '{}'::text[],
  'every view authenticated can read runs as the caller'
);

select is(
  array(
    select c.relname::text from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'S'
      and (has_sequence_privilege('anon', c.oid, 'USAGE, SELECT, UPDATE')
           or has_sequence_privilege('authenticated', c.oid, 'USAGE, SELECT, UPDATE'))
    order by 1
  ),
  '{}'::text[],
  'no sequence is usable by anon or authenticated'
);

-- Functions ------------------------------------------------------------------

select is(
  array(
    select p.oid::regprocedure::text from pg_proc p
    where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'EXECUTE')
    order by 1
  ),
  '{}'::text[],
  'anon can execute no function'
);

-- A null ACL means the built-in default, which includes EXECUTE for PUBLIC.
select is(
  array(
    select p.oid::regprocedure::text from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and (p.proacl is null or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0))
    order by 1
  ),
  '{}'::text[],
  'no function is granted to PUBLIC'
);

select is(
  array(
    select p.oid::regprocedure::text from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prosecdef
      and not coalesce('search_path=""' = any (p.proconfig), false)
    order by 1
  ),
  '{}'::text[],
  'every security definer function pins an empty search_path'
);

-- What the app calls. A new function joins this list in the migration that grants it.
select is(
  array(
    select p.oid::regprocedure::text from pg_proc p
    where p.pronamespace = 'public'::regnamespace and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    order by p.oid::regprocedure::text collate "C"
  ),
  array[
    'add_member_by_email(uuid,text,workspace_role)',
    'ai_budget_status()',
    'can(uuid,text)',
    'create_workspace(text)',
    'current_workspace()',
    'current_workspace_id()',
    'dashboard_kpis(uuid)',
    'dashboard_pipeline_by_stage(uuid)',
    'dashboard_upcoming(uuid)',
    'dashboard_value_by_tier(uuid)',
    'dashboard_won_by_month(uuid)',
    'is_member(uuid)',
    'mark_alert_read(uuid)',
    'mark_all_alerts_read()',
    'my_permissions(uuid)',
    'my_role(uuid)',
    'national_attendance_by_tier()',
    'remove_member(uuid,uuid)',
    'review_report(uuid,report_status)',
    'role_permissions(workspace_role)',
    'role_rank(workspace_role)',
    'run_alert_checks()',
    'set_member_role(uuid,uuid,workspace_role)',
    'switch_workspace(uuid)',
    'unread_alert_count()',
    'workspace_members(uuid)'
  ],
  'authenticated executes exactly the allowlisted functions'
);

-- pg_cron (plan 07): its schema stays closed to API roles, so nobody can read jobs or schedule.
select ok(
  not has_schema_privilege('anon', 'cron', 'USAGE') and not has_schema_privilege('authenticated', 'cron', 'USAGE'),
  'anon and authenticated have no access to the cron schema'
);

-- What only the server (service_role) may run: the AI report writes (plan 06).
select is(
  array(
    select p.oid::regprocedure::text from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
    order by p.oid::regprocedure::text collate "C"
  ),
  array[
    'fail_report(uuid,uuid,text,text)',
    'finish_report(uuid,uuid,jsonb,text)',
    'settle_ai_usage(uuid,uuid,text,integer,integer,integer,integer,numeric)',
    'start_report(uuid,uuid,text)'
  ],
  'service_role alone executes exactly the server functions'
);

-- Defaults for objects created later -----------------------------------------

create table public.zz_grants_probe (id int);
create sequence public.zz_grants_probe_seq;
create function public.zz_grants_probe_fn() returns int language sql as $$ select 1 $$;

select ok(
  not has_table_privilege('anon', 'public.zz_grants_probe', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN')
  and not has_table_privilege('authenticated', 'public.zz_grants_probe', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN'),
  'a new table starts with no access'
);
select ok(
  not has_sequence_privilege('anon', 'public.zz_grants_probe_seq', 'USAGE, SELECT, UPDATE')
  and not has_sequence_privilege('authenticated', 'public.zz_grants_probe_seq', 'USAGE, SELECT, UPDATE'),
  'a new sequence starts with no access'
);
select ok(
  not has_function_privilege('anon', 'public.zz_grants_probe_fn()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.zz_grants_probe_fn()', 'EXECUTE'),
  'a new function starts not executable'
);

-- Behaviour: the dropped privileges are refused, the kept ones still work ------

create temp table ids (k text primary key, v uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values ('user', tests.create_user('grants@test.local'));
select tests.authenticate_as((select v from ids where k = 'user'));
insert into ids values ('ws', public.create_workspace('Grants WS'));

select throws_ok($$ truncate public.memberships cascade $$, '42501', null, 'authenticated cannot truncate memberships');
select lives_ok(
  format($$ update public.workspaces set name = 'Renamed' where id = %L $$, (select v from ids where k = 'ws')),
  'the owner can still run a rename'
);
select is((select name from public.workspaces where id = (select v from ids where k = 'ws')), 'Renamed', 'and the rename took effect');
select is((select count(*)::int from public.profiles where id = (select v from ids where k = 'user')), 1, 'users still read their own profile');

select * from finish();
rollback;
