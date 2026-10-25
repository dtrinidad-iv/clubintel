-- Foundation: workspaces (the tenant), memberships, roles and permissions.
--
-- Rules this migration sets up for every later table:
--   * A workspace is a tenant. A user reaches its data only through a membership.
--   * Policies and server code check permissions with public.can(ws, perm), never role names.
--   * The active workspace is server-side state (profiles.current_workspace_id), changed only
--     by switch_workspace(), which checks membership. It is never proof of access on its own.
--   * Every security definer function pins search_path = '' and qualifies every name.

create type public.workspace_role as enum ('owner', 'admin', 'analyst', 'viewer');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  current_workspace_id uuid references public.workspaces (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.memberships (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index memberships_user_id_idx on public.memberships (user_id);
-- Exactly one built-in owner per workspace.
create unique index memberships_one_owner_idx on public.memberships (workspace_id) where role = 'owner';

-- ---------------------------------------------------------------------------
-- Roles and permissions
-- ---------------------------------------------------------------------------

create function public.role_rank(r public.workspace_role)
returns int
language sql
immutable
set search_path = ''
as $$
  select case r when 'owner' then 4 when 'admin' then 3 when 'analyst' then 2 when 'viewer' then 1 end;
$$;

-- The one place roles map to permissions. Later migrations add permissions with
-- `create or replace` (keep every existing entry).
create function public.role_permissions(r public.workspace_role)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case r
    when 'owner'   then array['workspace.manage', 'members.view', 'members.manage']
    when 'admin'   then array['workspace.manage', 'members.view', 'members.manage']
    when 'analyst' then array['members.view']
    when 'viewer'  then array['members.view']
  end;
$$;

-- Role of the calling user in a workspace, or null when they are not a member.
create function public.my_role(ws uuid)
returns public.workspace_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.memberships m
  where m.workspace_id = ws and m.user_id = (select auth.uid());
$$;

create function public.is_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.my_role(ws) is not null;
$$;

create function public.can(ws uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(perm = any (public.role_permissions(public.my_role(ws))), false);
$$;

create function public.my_permissions(ws uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.role_permissions(public.my_role(ws)), '{}'::text[]);
$$;

-- ---------------------------------------------------------------------------
-- Current workspace
-- ---------------------------------------------------------------------------

-- The caller's active workspace, only while they are still a member of it.
create function public.current_workspace()
returns table (id uuid, name text, role public.workspace_role)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, w.name, m.role
  from public.profiles p
  join public.memberships m on m.workspace_id = p.current_workspace_id and m.user_id = p.id
  join public.workspaces w on w.id = m.workspace_id
  where p.id = (select auth.uid());
$$;

create function public.current_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.current_workspace();
$$;

create function public.switch_workspace(ws uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_member(ws) then
    raise exception 'Not a member of this workspace' using errcode = '42501';
  end if;
  update public.profiles set current_workspace_id = ws where id = (select auth.uid());
end;
$$;

create function public.create_workspace(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ws uuid;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if (select count(*) from public.memberships where user_id = uid and role = 'owner') >= 10 then
    raise exception 'You can own at most 10 workspaces' using errcode = 'P0001';
  end if;

  insert into public.workspaces (name, created_by) values (btrim(p_name), uid) returning id into ws;
  insert into public.memberships (workspace_id, user_id, role) values (ws, uid, 'owner');
  update public.profiles set current_workspace_id = ws where id = uid;
  return ws;
end;
$$;

-- ---------------------------------------------------------------------------
-- Members
-- Rank rule: you act only on members ranked below you, and only grant roles
-- below your own. The owner is never granted, changed or removed.
-- ---------------------------------------------------------------------------

create function public.workspace_members(ws uuid)
returns table (user_id uuid, full_name text, email text, role public.workspace_role, joined_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can(ws, 'members.view') then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  return query
    select m.user_id, p.full_name, u.email::text, m.role, m.created_at
    from public.memberships m
    join auth.users u on u.id = m.user_id
    left join public.profiles p on p.id = m.user_id
    where m.workspace_id = ws
    order by public.role_rank(m.role) desc, p.full_name;
end;
$$;

create function public.assert_can_assign(ws uuid, p_role public.workspace_role)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can(ws, 'members.manage') then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if p_role = 'owner' or public.role_rank(p_role) >= public.role_rank(public.my_role(ws)) then
    raise exception 'You can only grant roles below your own' using errcode = '42501';
  end if;
end;
$$;

create function public.assert_can_manage_member(ws uuid, p_user uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target public.workspace_role;
begin
  if not public.can(ws, 'members.manage') then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if p_user = (select auth.uid()) then
    raise exception 'You cannot change your own membership' using errcode = '42501';
  end if;
  select role into target from public.memberships where workspace_id = ws and user_id = p_user;
  if target is null then
    raise exception 'Not a member of this workspace' using errcode = 'P0002';
  end if;
  if public.role_rank(target) >= public.role_rank(public.my_role(ws)) then
    raise exception 'You can only manage members ranked below you' using errcode = '42501';
  end if;
end;
$$;

-- Adds an existing account. Only callers with members.manage get past the first check,
-- so whether an email has an account is never revealed to anyone else.
create function public.add_member_by_email(ws uuid, p_email text, p_role public.workspace_role)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  perform public.assert_can_assign(ws, p_role);

  select id into target from auth.users where lower(email) = lower(btrim(p_email));
  if target is null then
    raise exception 'No account uses that email' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.memberships where workspace_id = ws and user_id = target) then
    raise exception 'Already a member' using errcode = '23505';
  end if;

  insert into public.memberships (workspace_id, user_id, role) values (ws, target, p_role);
  return target;
end;
$$;

create function public.set_member_role(ws uuid, p_user uuid, p_role public.workspace_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_can_manage_member(ws, p_user);
  perform public.assert_can_assign(ws, p_role);
  update public.memberships set role = p_role where workspace_id = ws and user_id = p_user;
end;
$$;

create function public.remove_member(ws uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_can_manage_member(ws, p_user);
  delete from public.memberships where workspace_id = ws and user_id = p_user;
  update public.profiles set current_workspace_id = null
  where id = p_user and current_workspace_id = ws;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles are created with the account
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;

create policy "members read their workspaces" on public.workspaces
  for select to authenticated using (public.is_member(id));
create policy "managers rename their workspace" on public.workspaces
  for update to authenticated
  using (public.can(id, 'workspace.manage'))
  with check (public.can(id, 'workspace.manage'));

create policy "users read their own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "users update their own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "members read memberships of their workspaces" on public.memberships
  for select to authenticated using (public.is_member(workspace_id));

-- Writes go through the functions above; table privileges are narrowed to match.
revoke all on public.workspaces, public.profiles, public.memberships from anon;
revoke insert, update, delete on public.workspaces, public.profiles, public.memberships from authenticated;
grant update (name) on public.workspaces to authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Functions: signed-in users only. Internal helpers are not callable at all.
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.role_rank(public.workspace_role),
  public.role_permissions(public.workspace_role),
  public.my_role(uuid),
  public.is_member(uuid),
  public.can(uuid, text),
  public.my_permissions(uuid),
  public.current_workspace(),
  public.current_workspace_id(),
  public.switch_workspace(uuid),
  public.create_workspace(text),
  public.workspace_members(uuid),
  public.add_member_by_email(uuid, text, public.workspace_role),
  public.set_member_role(uuid, uuid, public.workspace_role),
  public.remove_member(uuid, uuid)
to authenticated;
revoke execute on function public.handle_new_user() from authenticated;

-- New functions created later in this schema are not executable by anon by default.
alter default privileges in schema public revoke execute on functions from public, anon;
