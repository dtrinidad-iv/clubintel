-- AI reports, AI usage, budgets and platform limits.
--
-- Who writes what:
--   * Reports and usage are written only by the server, through security definer functions
--     granted to service_role alone. The route handler checks the user with the DAL first and
--     passes the user and workspace ids, which the functions check again. Users can't forge a
--     report's content or its cost, because they can't call these functions.
--   * People review reports (review_report) and read their budget (ai_budget_status) as
--     themselves, under can().
-- Money:
--   * start_report reserves the most one report may cost before any AI call, and
--     settle_ai_usage replaces it, once, with the real cost (capped), or with the server's
--     cautious estimate for a stopped call. A call that never settles (crashed) keeps the
--     reservation, so spend is never under-counted.
--   * A workspace's budget is capped by the operator's ai_limits row, which tenants can't change,
--     and there are per-workspace, per-user and platform-wide limits.

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
      'contacts.view', 'contacts.write', 'contacts.delete',
      'ai.use', 'reports.view', 'reports.approve']
    when 'admin' then array[
      'workspace.manage', 'members.view', 'members.manage',
      'opportunities.view', 'opportunities.write', 'opportunities.delete',
      'contacts.view', 'contacts.write', 'contacts.delete',
      'ai.use', 'reports.view', 'reports.approve']
    when 'analyst' then array[
      'members.view',
      'opportunities.view', 'opportunities.write',
      'contacts.view', 'contacts.write',
      'ai.use', 'reports.view']
    when 'viewer' then array[
      'members.view',
      'opportunities.view',
      'contacts.view',
      'reports.view']
  end;
$$;

-- ---------------------------------------------------------------------------
-- Operator limits (one row; changed by the operator in SQL, never by tenants)
-- ---------------------------------------------------------------------------

create table public.ai_limits (
  id boolean primary key default true check (id),
  -- The most any workspace may spend in a month, whatever its own budget says.
  max_workspace_budget_usd numeric(10, 2) not null default 50 check (max_workspace_budget_usd >= 0),
  -- Held against the budget from start until the real cost is known: the most one report may
  -- be charged, so an unsettled report is never under-counted. 16k output tokens on Opus 5.5,
  -- even with a refusal fallback, stays under it; raise both for a pricier AI_MODEL.
  report_reserve_usd numeric(10, 2) not null default 2.00 check (report_reserve_usd >= 0),
  -- The real cost is capped at this.
  max_report_cost_usd numeric(10, 2) not null default 2.00 check (max_report_cost_usd >= 0),
  reports_per_workspace_hour int not null default 10 check (reports_per_workspace_hour >= 0),
  reports_per_user_day int not null default 20 check (reports_per_user_day >= 0),
  -- All workspaces together, per London day: a backstop for the deployment's API key.
  platform_daily_usd numeric(10, 2) not null default 50 check (platform_daily_usd >= 0)
);
insert into public.ai_limits default values;
alter table public.ai_limits enable row level security;

-- ---------------------------------------------------------------------------
-- Budget
-- ---------------------------------------------------------------------------

-- In US dollars, as Anthropic bills. The existing "managers rename their workspace" policy
-- (workspace.manage) covers updates. The effective budget is the lower of this and the
-- operator's max_workspace_budget_usd.
alter table public.workspaces
  add column ai_monthly_budget_usd numeric(10, 2) not null default 25
  check (ai_monthly_budget_usd between 0 and 10000);
grant update (ai_monthly_budget_usd) on public.workspaces to authenticated;

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

create type public.report_status as enum ('generating', 'draft', 'failed', 'approved', 'discarded');

-- Written only by the functions below (no tenant trigger: the service role has no active
-- workspace). workspace_id and created_by come from the ids the server checked.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  focus text check (char_length(focus) <= 300),
  status public.report_status not null default 'generating',
  content jsonb check (content is null or octet_length(content::text) <= 100000),
  model text check (char_length(model) <= 80),
  error text check (char_length(error) <= 300),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  unique (workspace_id, id)
);

create index reports_workspace_created_idx on public.reports (workspace_id, created_at desc);
create index reports_creator_created_idx on public.reports (created_by, created_at desc);

-- ---------------------------------------------------------------------------
-- AI usage: one row per report, reserved at start and settled once
-- ---------------------------------------------------------------------------

create table public.ai_usage (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  report_id uuid unique,
  feature text not null check (feature in ('report')),
  model text not null check (model ~ '^[a-z0-9.-]{1,80}$'),
  input_tokens int not null default 0 check (input_tokens >= 0),
  output_tokens int not null default 0 check (output_tokens >= 0),
  cache_read_tokens int not null default 0 check (cache_read_tokens >= 0),
  cache_write_tokens int not null default 0 check (cache_write_tokens >= 0),
  cost_usd numeric(12, 6) not null check (cost_usd >= 0),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  foreign key (workspace_id, report_id) references public.reports (workspace_id, id) on delete set null (report_id)
);

create index ai_usage_workspace_created_idx on public.ai_usage (workspace_id, created_at desc);
create index ai_usage_created_idx on public.ai_usage (created_at);

-- ---------------------------------------------------------------------------
-- Access: people read through RLS; only the functions write
-- ---------------------------------------------------------------------------

alter table public.reports enable row level security;
alter table public.ai_usage enable row level security;

create policy "members with reports.view read reports" on public.reports
  for select to authenticated using (public.can(workspace_id, 'reports.view'));
create policy "managers read AI usage" on public.ai_usage
  for select to authenticated using (public.can(workspace_id, 'workspace.manage'));

grant select on public.reports, public.ai_usage to authenticated;

-- ---------------------------------------------------------------------------
-- Internal helpers (no grants)
-- ---------------------------------------------------------------------------

-- Whether a given user (not the caller) holds a permission in a workspace.
create function public.user_can(ws uuid, p_user uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.workspace_id = ws and m.user_id = p_user and perm = any (public.role_permissions(m.role))
  );
$$;

-- Spend this calendar month (London time), reservations included.
create function public.ai_spend_this_month(ws uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(u.cost_usd), 0)
  from public.ai_usage u
  where u.workspace_id = ws
    and u.created_at >= date_trunc('month', now() at time zone 'Europe/London') at time zone 'Europe/London';
$$;

-- The budget that applies: the workspace's own, capped by the operator.
create function public.ai_effective_budget(ws uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select least(w.ai_monthly_budget_usd, l.max_workspace_budget_usd)
  from public.workspaces w, public.ai_limits l
  where w.id = ws;
$$;

-- ---------------------------------------------------------------------------
-- Server functions (service_role only)
-- ---------------------------------------------------------------------------

-- Opens a report for a user in a workspace, if every limit allows, and reserves its cost.
create function public.start_report(p_user uuid, p_workspace uuid, p_focus text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  lim public.ai_limits;
  new_id uuid;
begin
  if not public.user_can(p_workspace, p_user, 'ai.use') then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if char_length(p_focus) > 300 then
    raise exception 'Keep the focus under 300 characters.' using errcode = 'P0001';
  end if;

  -- One start at a time across the platform (the limits row is the lock), so concurrent
  -- requests in any workspace see each other's reservations.
  select * into lim from public.ai_limits for update;

  -- Reports left generating for 15 minutes never finished: mark them failed (their
  -- reservations stay, so they still count against the budget).
  update public.reports
  set status = 'failed', error = 'Timed out before it finished.', updated_at = now()
  where workspace_id = p_workspace and status = 'generating' and created_at < now() - interval '15 minutes';

  if public.ai_spend_this_month(p_workspace) + lim.report_reserve_usd > public.ai_effective_budget(p_workspace) then
    raise exception 'This month''s AI budget is used up.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.reports r
      where r.workspace_id = p_workspace and r.created_at > now() - interval '1 hour') >= lim.reports_per_workspace_hour then
    raise exception 'Too many reports this hour. Try again later.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.reports r
      where r.created_by = p_user and r.created_at > now() - interval '1 day') >= lim.reports_per_user_day then
    raise exception 'You''ve reached today''s report limit. Try again tomorrow.' using errcode = 'P0001';
  end if;
  if (select coalesce(sum(u.cost_usd), 0) from public.ai_usage u
      where u.created_at >= date_trunc('day', now() at time zone 'Europe/London') at time zone 'Europe/London')
     + lim.report_reserve_usd > lim.platform_daily_usd then
    raise exception 'AI reports are paused for today. Try again tomorrow.' using errcode = 'P0001';
  end if;

  insert into public.reports (workspace_id, title, focus, created_by)
  values (p_workspace, 'Commercial intelligence report', nullif(btrim(p_focus), ''), p_user)
  returning id into new_id;

  insert into public.ai_usage (workspace_id, user_id, report_id, feature, model, cost_usd)
  values (p_workspace, p_user, new_id, 'report', 'reserved', lim.report_reserve_usd);
  return new_id;
end;
$$;

-- The server names the workspace too, so a wrong id can't write into another workspace.
create function public.finish_report(p_id uuid, p_workspace uuid, p_content jsonb, p_model text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.reports
  set status = 'draft', content = p_content, model = p_model, updated_at = now()
  where id = p_id and workspace_id = p_workspace and status = 'generating';
  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.fail_report(p_id uuid, p_workspace uuid, p_error text, p_model text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.reports
  set status = 'failed', error = left(p_error, 300), model = p_model, updated_at = now()
  where id = p_id and workspace_id = p_workspace and status = 'generating';
  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Replaces a report's reservation with what it really cost, once. The cost is capped at the
-- operator's max_report_cost_usd.
create function public.settle_ai_usage(
  p_report uuid,
  p_workspace uuid,
  p_model text,
  p_input int,
  p_output int,
  p_cache_read int,
  p_cache_write int,
  p_cost numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_cost < 0 then
    raise exception 'Cost can''t be negative' using errcode = '22023';
  end if;
  update public.ai_usage u
  set model = p_model, input_tokens = p_input, output_tokens = p_output,
      cache_read_tokens = p_cache_read, cache_write_tokens = p_cache_write,
      cost_usd = least(p_cost, (select l.max_report_cost_usd from public.ai_limits l)),
      settled_at = now()
  where u.report_id = p_report and u.workspace_id = p_workspace and u.settled_at is null;
  if not found then
    raise exception 'Nothing to settle for this report' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- People's functions
-- ---------------------------------------------------------------------------

-- Approve or discard a draft. Needs reports.approve in the report's workspace.
create function public.review_report(p_id uuid, p_decision public.report_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
  current_status public.report_status;
begin
  if p_decision not in ('approved', 'discarded') then
    raise exception 'Choose approve or discard' using errcode = 'P0001';
  end if;

  select r.workspace_id, r.status into ws, current_status from public.reports r where r.id = p_id for update;
  -- A report someone can't see answers the same as one that doesn't exist.
  if ws is null or not public.can(ws, 'reports.view') then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
  if not public.can(ws, 'reports.approve') then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if current_status <> 'draft' then
    raise exception 'Only drafts can be reviewed' using errcode = 'P0001';
  end if;

  update public.reports
  set status = p_decision, reviewed_by = (select auth.uid()), reviewed_at = now(), updated_at = now()
  where id = p_id;
end;
$$;

-- This month's spend and the budgets for the active workspace, for members who can use AI.
create function public.ai_budget_status()
returns table (spent_usd numeric, budget_usd numeric, workspace_budget_usd numeric, platform_cap_usd numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select public.ai_spend_this_month(w.id), public.ai_effective_budget(w.id), w.ai_monthly_budget_usd, l.max_workspace_budget_usd
  from public.workspaces w, public.ai_limits l
  where w.id = public.current_workspace_id()
    and public.can(w.id, 'ai.use');
$$;

-- ---------------------------------------------------------------------------
-- Dashboard aggregates for a named workspace
-- ---------------------------------------------------------------------------

-- The report reads the dashboard numbers for the workspace it opened in, not whichever is
-- active by the time the query runs. Same bodies as plan 05 plus an optional workspace, which
-- defaults to the active one. They still run as the caller, so RLS limits a named workspace to
-- one the caller can see.

drop function public.dashboard_kpis();
drop function public.dashboard_pipeline_by_stage();
drop function public.dashboard_won_by_month();
drop function public.dashboard_value_by_tier();
drop function public.dashboard_upcoming();

create function public.dashboard_kpis(ws uuid default null)
returns table (
  open_value numeric,
  open_count int,
  won_quarter_value numeric,
  won_quarter_count int,
  won_12m_count int,
  lost_12m_count int,
  avg_won_value numeric,
  stale_count int
)
language sql
stable
set search_path = ''
as $$
  with bounds as (
    select
      date_trunc('quarter', now() at time zone 'Europe/London') at time zone 'Europe/London' as quarter_start,
      (date_trunc('month', now() at time zone 'Europe/London') - interval '11 months') at time zone 'Europe/London' as year_ago,
      now() - interval '30 days' as stale_before
  )
  select
    coalesce(sum(o.value_gbp) filter (where o.stage in ('lead', 'qualified', 'proposal', 'negotiation')), 0),
    (count(*) filter (where o.stage in ('lead', 'qualified', 'proposal', 'negotiation')))::int,
    coalesce(sum(o.value_gbp) filter (where o.stage = 'won' and o.stage_changed_at >= b.quarter_start), 0),
    (count(*) filter (where o.stage = 'won' and o.stage_changed_at >= b.quarter_start))::int,
    (count(*) filter (where o.stage = 'won' and o.stage_changed_at >= b.year_ago))::int,
    (count(*) filter (where o.stage = 'lost' and o.stage_changed_at >= b.year_ago))::int,
    round(avg(o.value_gbp) filter (where o.stage = 'won' and o.stage_changed_at >= b.year_ago), 2),
    (count(*) filter (where o.stage in ('lead', 'qualified', 'proposal', 'negotiation') and o.stage_changed_at < b.stale_before))::int
  from public.opportunities o, bounds b
  where o.workspace_id = coalesce(ws, (select public.current_workspace_id()));
$$;

create function public.dashboard_pipeline_by_stage(ws uuid default null)
returns table (stage public.opportunity_stage, value numeric, deals int)
language sql
stable
set search_path = ''
as $$
  select s.stage, coalesce(sum(o.value_gbp), 0), count(o.id)::int
  from unnest(array['lead', 'qualified', 'proposal', 'negotiation']::public.opportunity_stage[]) as s (stage)
  left join public.opportunities o
    on o.stage = s.stage and o.workspace_id = coalesce(ws, (select public.current_workspace_id()))
  group by s.stage
  order by s.stage;
$$;

create function public.dashboard_won_by_month(ws uuid default null)
returns table (month date, value numeric, deals int)
language sql
stable
set search_path = ''
as $$
  with months as (
    select m::date as month
    from generate_series(
      date_trunc('month', now() at time zone 'Europe/London') - interval '11 months',
      date_trunc('month', now() at time zone 'Europe/London'),
      interval '1 month'
    ) as m
  )
  select m.month, coalesce(sum(o.value_gbp), 0), count(o.id)::int
  from months m
  left join public.opportunities o
    on o.workspace_id = coalesce(ws, (select public.current_workspace_id()))
    and o.stage = 'won'
    and date_trunc('month', o.stage_changed_at at time zone 'Europe/London')::date = m.month
  group by m.month
  order by m.month;
$$;

create function public.dashboard_value_by_tier(ws uuid default null)
returns table (tier smallint, value numeric, deals int)
language sql
stable
set search_path = ''
as $$
  select l.tier, coalesce(sum(o.value_gbp), 0), count(o.id)::int
  from public.leagues l
  left join public.clubs c on c.league_id = l.id
  left join public.opportunities o
    on o.club_id = c.id
    and o.workspace_id = coalesce(ws, (select public.current_workspace_id()))
    and o.stage in ('lead', 'qualified', 'proposal', 'negotiation')
  group by l.tier
  order by l.tier;
$$;

create function public.dashboard_upcoming(ws uuid default null)
returns table (
  id uuid,
  title text,
  club_name text,
  stage public.opportunity_stage,
  value_gbp numeric,
  expected_close_date date,
  overdue boolean
)
language sql
stable
set search_path = ''
as $$
  select o.id, o.title, c.name, o.stage, o.value_gbp, o.expected_close_date,
         o.expected_close_date < (now() at time zone 'Europe/London')::date
  from public.opportunities o
  join public.clubs c on c.id = o.club_id
  where o.workspace_id = coalesce(ws, (select public.current_workspace_id()))
    and o.stage in ('lead', 'qualified', 'proposal', 'negotiation')
    and o.expected_close_date is not null
  order by o.expected_close_date, o.title
  limit 6;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant execute on function
  public.start_report(uuid, uuid, text),
  public.finish_report(uuid, uuid, jsonb, text),
  public.fail_report(uuid, uuid, text, text),
  public.settle_ai_usage(uuid, uuid, text, int, int, int, int, numeric)
to service_role;

grant execute on function
  public.review_report(uuid, public.report_status),
  public.ai_budget_status(),
  public.dashboard_kpis(uuid),
  public.dashboard_pipeline_by_stage(uuid),
  public.dashboard_won_by_month(uuid),
  public.dashboard_value_by_tier(uuid),
  public.dashboard_upcoming(uuid)
to authenticated;
