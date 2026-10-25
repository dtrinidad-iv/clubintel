-- Test helpers, installed before the other test files run (this file isn't rolled back).
-- They live in a `tests` schema that only exists in local and CI databases.
create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

-- Creates an account (the auth trigger adds its profile) and returns its id.
create or replace function tests.create_user(p_email text, p_name text default 'Test User')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', p_email, '', now(),
          jsonb_build_object('full_name', p_name), now(), now());
  return uid;
end;
$$;

-- Runs the rest of the transaction as that user, the way PostgREST does.
create or replace function tests.authenticate_as(p_user uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function tests.clear_authentication()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);
end;
$$;

-- Adds a membership directly, bypassing the RPC rules (setup only).
create or replace function tests.add_member(p_ws uuid, p_user uuid, p_role public.workspace_role)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.memberships (workspace_id, user_id, role) values (p_ws, p_user, p_role);
$$;

grant execute on all functions in schema tests to authenticated, anon;

select plan(1);
select ok(true, 'test helpers installed');
select * from finish();
