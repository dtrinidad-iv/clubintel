-- Commercial opportunities and contacts: the first tenant-owned tables.
--
-- Rules for every tenant table (the reference for later ones):
--   * workspace_id comes from the caller's active workspace (trigger), never from the client,
--     and can't change afterwards.
--   * References to other tenant rows are composite foreign keys that include workspace_id,
--     so Postgres itself refuses a link into another workspace.
--   * RLS checks permissions with can(); grants are explicit (plan 09).

create type public.opportunity_category as enum ('sponsorship', 'hospitality', 'media', 'partnership', 'other');
create type public.opportunity_stage as enum ('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost');

-- ---------------------------------------------------------------------------
-- Permissions (every existing entry kept)
-- ---------------------------------------------------------------------------

create or replace function public.role_permissions(r public.workspace_role)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case r
    when 'owner' then array[
      'workspace.manage', 'members.view', 'members.manage',
      'opportunities.view', 'opportunities.write', 'opportunities.delete',
      'contacts.view', 'contacts.write', 'contacts.delete']
    when 'admin' then array[
      'workspace.manage', 'members.view', 'members.manage',
      'opportunities.view', 'opportunities.write', 'opportunities.delete',
      'contacts.view', 'contacts.write', 'contacts.delete']
    when 'analyst' then array[
      'members.view',
      'opportunities.view', 'opportunities.write',
      'contacts.view', 'contacts.write']
    when 'viewer' then array[
      'members.view',
      'opportunities.view',
      'contacts.view']
  end;
$$;

-- ---------------------------------------------------------------------------
-- Shared trigger for tenant rows
-- ---------------------------------------------------------------------------

-- Runs as the caller (security invoker): current_workspace_id() only returns a workspace the
-- caller is still a member of. Trigger functions need no execute grant.
create function public.tenant_row_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.workspace_id := public.current_workspace_id();
    if new.workspace_id is null then
      raise exception 'Choose a workspace first' using errcode = 'P0001';
    end if;
    new.created_by := (select auth.uid());
    new.created_at := now();
  else
    if new.workspace_id is distinct from old.workspace_id then
      raise exception 'Records can''t move between workspaces' using errcode = '42501';
    end if;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Contacts
-- ---------------------------------------------------------------------------

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  -- The default only makes the column optional for clients; the trigger decides the value.
  workspace_id uuid not null default public.current_workspace_id() references public.workspaces (id) on delete cascade,
  club_id uuid references public.clubs (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  -- No ? & # % , ; in emails: the UI turns them into mailto: links, which would carry extra headers.
  email text check (email is null or (char_length(email) <= 254 and email ~ '^[^@\s?&#%,;]+@[^@\s?&#%,;]+\.[^@\s?&#%,;]+$')),
  role_title text check (char_length(role_title) <= 120),
  -- Digits and the usual separators only: the UI turns phones into tel: links.
  phone text check (phone ~ '^\+?[0-9 ().-]{3,40}$'),
  notes text check (char_length(notes) <= 2000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Target for same-workspace foreign keys from other tenant tables.
  unique (workspace_id, id)
);

create index contacts_workspace_name_idx on public.contacts (workspace_id, name);
create index contacts_workspace_club_idx on public.contacts (workspace_id, club_id);
create index contacts_name_trgm_idx on public.contacts using gin (name extensions.gin_trgm_ops);

create trigger contacts_defaults before insert or update on public.contacts
  for each row execute function public.tenant_row_defaults();

-- ---------------------------------------------------------------------------
-- Opportunities
-- ---------------------------------------------------------------------------

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  -- The default only makes the column optional for clients; the trigger decides the value.
  workspace_id uuid not null default public.current_workspace_id() references public.workspaces (id) on delete cascade,
  club_id uuid not null references public.clubs (id) on delete restrict,
  contact_id uuid,
  owner_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  partner_name text not null check (char_length(btrim(partner_name)) between 1 and 120),
  category public.opportunity_category not null,
  value_gbp numeric(12, 2) not null default 0 check (value_gbp >= 0),
  stage public.opportunity_stage not null default 'lead',
  expected_close_date date,
  notes text check (char_length(notes) <= 2000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  stage_changed_at timestamptz not null default now(),
  -- One column to search, so the app filters with a single escaped ilike.
  search_text text generated always as (title || ' ' || partner_name) stored,
  -- The contact must be in the same workspace, and the owner a member of it. Deleting the
  -- contact or removing the member clears just that column.
  foreign key (workspace_id, contact_id) references public.contacts (workspace_id, id) on delete set null (contact_id),
  foreign key (workspace_id, owner_id) references public.memberships (workspace_id, user_id) on delete set null (owner_id)
);

create index opportunities_workspace_stage_idx on public.opportunities (workspace_id, stage);
create index opportunities_workspace_club_idx on public.opportunities (workspace_id, club_id);
create index opportunities_workspace_owner_idx on public.opportunities (workspace_id, owner_id);
create index opportunities_workspace_contact_idx on public.opportunities (workspace_id, contact_id);
create index opportunities_search_idx on public.opportunities using gin (search_text extensions.gin_trgm_ops);

create trigger opportunities_defaults before insert or update on public.opportunities
  for each row execute function public.tenant_row_defaults();

create function public.stamp_stage_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    new.stage_changed_at := now();
  else
    new.stage_changed_at := old.stage_changed_at;
  end if;
  return new;
end;
$$;

create trigger opportunities_stage_changed before insert or update on public.opportunities
  for each row execute function public.stamp_stage_change();

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table public.contacts enable row level security;
alter table public.opportunities enable row level security;

create policy "members with contacts.view read contacts" on public.contacts
  for select to authenticated using (public.can(workspace_id, 'contacts.view'));
create policy "members with contacts.write add contacts" on public.contacts
  for insert to authenticated with check (public.can(workspace_id, 'contacts.write'));
create policy "members with contacts.write edit contacts" on public.contacts
  for update to authenticated
  using (public.can(workspace_id, 'contacts.write'))
  with check (public.can(workspace_id, 'contacts.write'));
create policy "members with contacts.delete delete contacts" on public.contacts
  for delete to authenticated using (public.can(workspace_id, 'contacts.delete'));

create policy "members with opportunities.view read opportunities" on public.opportunities
  for select to authenticated using (public.can(workspace_id, 'opportunities.view'));
create policy "members with opportunities.write add opportunities" on public.opportunities
  for insert to authenticated with check (public.can(workspace_id, 'opportunities.write'));
create policy "members with opportunities.write edit opportunities" on public.opportunities
  for update to authenticated
  using (public.can(workspace_id, 'opportunities.write'))
  with check (public.can(workspace_id, 'opportunities.write'));
create policy "members with opportunities.delete delete opportunities" on public.opportunities
  for delete to authenticated using (public.can(workspace_id, 'opportunities.delete'));

-- RLS picks the rows. Insert and update are granted only on the columns people edit: id,
-- workspace_id, created_by and the timestamps are the database's (an id chosen by the client
-- would also let it probe whether another workspace's row exists, via a duplicate-key error).
grant select, delete on public.contacts, public.opportunities to authenticated;
grant insert (club_id, name, email, role_title, phone, notes),
      update (club_id, name, email, role_title, phone, notes)
  on public.contacts to authenticated;
grant insert (club_id, contact_id, owner_id, title, partner_name, category, value_gbp, stage, expected_close_date, notes),
      update (club_id, contact_id, owner_id, title, partner_name, category, value_gbp, stage, expected_close_date, notes)
  on public.opportunities to authenticated;
