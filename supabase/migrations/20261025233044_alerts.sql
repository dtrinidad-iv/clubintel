-- Automated alerts: rules a workspace sets once, alerts the database writes when they match,
-- and per-person read state. Checks run daily through pg_cron (as postgres, no HTTP endpoint)
-- and on demand for managers.
--
--   * Rules are tenant rows people edit (column grants, RLS on alerts.manage).
--   * Alerts are written only by the evaluation functions. dedup_key makes evaluation
--     idempotent: it names the deal or club and what changed (stage date, close date, season),
--     not the rule, so two similar rules raise one alert, and a deal that goes stale again
--     alerts again.
--   * Alerts reference the deal or club by id; the app builds the link.

-- ---------------------------------------------------------------------------
-- Permissions (every existing entry kept)
-- ---------------------------------------------------------------------------

-- alerts.view implies opportunities.view: alert text quotes deal titles and partners.
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
      'ai.use', 'reports.view', 'reports.approve',
      'alerts.view', 'alerts.manage']
    when 'admin' then array[
      'workspace.manage', 'members.view', 'members.manage',
      'opportunities.view', 'opportunities.write', 'opportunities.delete',
      'contacts.view', 'contacts.write', 'contacts.delete',
      'ai.use', 'reports.view', 'reports.approve',
      'alerts.view', 'alerts.manage']
    when 'analyst' then array[
      'members.view',
      'opportunities.view', 'opportunities.write',
      'contacts.view', 'contacts.write',
      'ai.use', 'reports.view',
      'alerts.view']
    when 'viewer' then array[
      'members.view',
      'opportunities.view',
      'contacts.view',
      'reports.view',
      'alerts.view']
  end;
$$;

-- ---------------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------------

create type public.alert_rule_type as enum ('stale_opportunity', 'close_date_passed', 'attendance_drop');

create table public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  -- The default only makes the column optional for clients; the trigger decides the value.
  workspace_id uuid not null default public.current_workspace_id() references public.workspaces (id) on delete cascade,
  type public.alert_rule_type not null,
  days int,
  club_id uuid references public.clubs (id) on delete cascade,
  drop_pct int,
  enabled boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_run_at timestamptz,
  unique (workspace_id, id),
  -- Each type takes exactly its own parameters.
  check (
    case type
      when 'stale_opportunity' then days between 1 and 365 and club_id is null and drop_pct is null
      when 'close_date_passed' then days between 0 and 90 and club_id is null and drop_pct is null
      when 'attendance_drop' then club_id is not null and drop_pct between 1 and 90 and days is null
    end
  )
);

create index alert_rules_workspace_idx on public.alert_rules (workspace_id, created_at);

create trigger alert_rules_defaults before insert or update on public.alert_rules
  for each row execute function public.tenant_row_defaults();

-- At most 50 rules per workspace. Runs after the defaults trigger has set the workspace, and
-- takes a per-workspace advisory lock so concurrent inserts can't both slip under the cap.
create function public.limit_alert_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('alert_rules:' || new.workspace_id::text, 0));
  if (select count(*) from public.alert_rules r where r.workspace_id = new.workspace_id) >= 50 then
    raise exception 'A workspace can have at most 50 alert rules.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger alert_rules_limit before insert on public.alert_rules
  for each row execute function public.limit_alert_rules();

-- ---------------------------------------------------------------------------
-- Alerts and read state
-- ---------------------------------------------------------------------------

-- Composite target so alerts can point at a deal in the same workspace only.
alter table public.opportunities add constraint opportunities_workspace_id_id_key unique (workspace_id, id);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  rule_id uuid,
  type public.alert_rule_type not null,
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) <= 500),
  opportunity_id uuid,
  club_id uuid references public.clubs (id) on delete set null,
  dedup_key text not null check (char_length(dedup_key) <= 200),
  created_at timestamptz not null default now(),
  unique (workspace_id, dedup_key),
  foreign key (workspace_id, rule_id) references public.alert_rules (workspace_id, id) on delete set null (rule_id),
  foreign key (workspace_id, opportunity_id) references public.opportunities (workspace_id, id) on delete cascade
);

create index alerts_workspace_created_idx on public.alerts (workspace_id, created_at desc);

create table public.alert_reads (
  alert_id uuid not null references public.alerts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (alert_id, user_id)
);

create index alert_reads_user_idx on public.alert_reads (user_id);

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table public.alert_rules enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_reads enable row level security;

create policy "members with alerts.view read rules" on public.alert_rules
  for select to authenticated using (public.can(workspace_id, 'alerts.view'));
create policy "managers add rules" on public.alert_rules
  for insert to authenticated with check (public.can(workspace_id, 'alerts.manage'));
create policy "managers edit rules" on public.alert_rules
  for update to authenticated
  using (public.can(workspace_id, 'alerts.manage'))
  with check (public.can(workspace_id, 'alerts.manage'));
create policy "managers delete rules" on public.alert_rules
  for delete to authenticated using (public.can(workspace_id, 'alerts.manage'));

create policy "members with alerts.view read alerts" on public.alerts
  for select to authenticated using (public.can(workspace_id, 'alerts.view'));

-- Your own rows, for alerts you can still see (alerts' RLS applies inside the subquery).
create policy "people read their own read state" on public.alert_reads
  for select to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.alerts a where a.id = alert_id));

grant select, delete on public.alert_rules to authenticated;
grant insert (type, days, club_id, drop_pct, enabled), update (type, days, club_id, drop_pct, enabled)
  on public.alert_rules to authenticated;
grant select on public.alerts, public.alert_reads to authenticated;

-- ---------------------------------------------------------------------------
-- Evaluation
-- ---------------------------------------------------------------------------

-- When checks last ran per workspace, for the once-a-minute limit. Written only by
-- evaluate_rules; deleting and re-adding rules doesn't reset it. RLS on, no grants.
create table public.alert_runs (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  last_run_at timestamptz not null
);
alter table public.alert_runs enable row level security;

-- Runs every enabled rule in one workspace and inserts the alerts that are new. Rules of a type
-- are combined first (the loosest threshold wins, per club for attendance), so duplicate rules
-- don't multiply the work. Internal (no grant): called by evaluate_all_alerts (cron) and
-- run_alert_checks (managers).
create function public.evaluate_rules(ws uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Europe/London')::date;
  inserted int := 0;
  n int;
begin
  -- Deals with no stage change for the rule's number of days.
  insert into public.alerts (workspace_id, rule_id, type, title, body, opportunity_id, club_id, dedup_key)
  select ws, r.rule_id, 'stale_opportunity',
         left('No movement on ' || o.title, 200),
         left(format('%s, with %s at %s, has been at %s for %s.',
                     o.title, o.partner_name, c.name, initcap(o.stage::text),
                     public.plural_days(extract(day from now() - o.stage_changed_at)::int)), 500),
         o.id, o.club_id,
         'stale:' || o.id || ':' || to_char(o.stage_changed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS')
  from (
    select min(ar.days) as days, (array_agg(ar.id order by ar.days, ar.id))[1] as rule_id
    from public.alert_rules ar
    where ar.workspace_id = ws and ar.enabled and ar.type = 'stale_opportunity'
    having count(*) > 0
  ) r
  join public.opportunities o on o.workspace_id = ws
  join public.clubs c on c.id = o.club_id
  where o.stage in ('lead', 'qualified', 'proposal', 'negotiation')
    and o.stage_changed_at < now() - make_interval(days => r.days)
  on conflict (workspace_id, dedup_key) do nothing;
  get diagnostics n = row_count;
  inserted := inserted + n;

  -- Open deals past their expected close date by more than the rule's grace days.
  insert into public.alerts (workspace_id, rule_id, type, title, body, opportunity_id, club_id, dedup_key)
  select ws, r.rule_id, 'close_date_passed',
         left('Close date passed: ' || o.title, 200),
         left(format('Expected to close on %s (%s ago) and still at %s.',
                     to_char(o.expected_close_date, 'FMDD Mon YYYY'), public.plural_days(today - o.expected_close_date),
                     initcap(o.stage::text)), 500),
         o.id, o.club_id,
         'close:' || o.id || ':' || o.expected_close_date
  from (
    select min(ar.days) as days, (array_agg(ar.id order by ar.days, ar.id))[1] as rule_id
    from public.alert_rules ar
    where ar.workspace_id = ws and ar.enabled and ar.type = 'close_date_passed'
    having count(*) > 0
  ) r
  join public.opportunities o on o.workspace_id = ws
  where o.stage in ('lead', 'qualified', 'proposal', 'negotiation')
    and o.expected_close_date < today - r.days
  on conflict (workspace_id, dedup_key) do nothing;
  get diagnostics n = row_count;
  inserted := inserted + n;

  -- A watched club whose latest season's attendance fell by the rule's percentage or more.
  insert into public.alerts (workspace_id, rule_id, type, title, body, opportunity_id, club_id, dedup_key)
  select ws, r.rule_id, 'attendance_drop',
         left('Attendance down at ' || c.name, 200),
         left(format('Average home attendance fell %s%% to %s in %s/%s, from %s the season before.',
                     round(d.pct, 1),
                     to_char(latest.avg_attendance, 'FM999,999,999'),
                     latest.season, lpad(((latest.season + 1) % 100)::text, 2, '0'),
                     to_char(prev.avg_attendance, 'FM999,999,999')), 500),
         null, c.id,
         'attendance:' || c.id || ':' || latest.season
  from (
    select ar.club_id, min(ar.drop_pct) as drop_pct, (array_agg(ar.id order by ar.drop_pct, ar.id))[1] as rule_id
    from public.alert_rules ar
    where ar.workspace_id = ws and ar.enabled and ar.type = 'attendance_drop'
    group by ar.club_id
  ) r
  join public.clubs c on c.id = r.club_id
  cross join lateral (
    select s.season, s.avg_attendance from public.club_seasons s where s.club_id = c.id order by s.season desc limit 1
  ) latest
  cross join lateral (
    select s.avg_attendance from public.club_seasons s where s.club_id = c.id and s.season < latest.season order by s.season desc limit 1
  ) prev
  -- nullif: a season with no recorded attendance gives null, never a division by zero.
  cross join lateral (
    select (prev.avg_attendance - latest.avg_attendance) * 100.0 / nullif(prev.avg_attendance, 0) as pct
  ) d
  where d.pct >= r.drop_pct
  on conflict (workspace_id, dedup_key) do nothing;
  get diagnostics n = row_count;
  inserted := inserted + n;

  update public.alert_rules set last_run_at = now() where workspace_id = ws and enabled;
  insert into public.alert_runs (workspace_id, last_run_at) values (ws, now())
  on conflict (workspace_id) do update set last_run_at = excluded.last_run_at;
  return inserted;
end;
$$;

-- "1 day", "3 days". Internal.
create function public.plural_days(n int)
returns text
language sql
immutable
set search_path = ''
as $$
  select n || case when n = 1 then ' day' else ' days' end;
$$;

-- Every workspace with an enabled rule, for the daily cron (as postgres). Each workspace runs in
-- its own subtransaction: one failing logs a warning and the rest still run. Also purges old
-- alerts and the cron log. Internal.
create function public.evaluate_all_alerts()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
  total int := 0;
begin
  for ws in select distinct r.workspace_id from public.alert_rules r where r.enabled loop
    begin
      total := total + public.evaluate_rules(ws);
    exception when others then
      raise warning 'Alert checks failed for workspace %: %', ws, sqlerrm;
    end;
  end loop;
  delete from public.alerts where created_at < now() - interval '180 days';
  return total;
end;
$$;

-- "Run checks now", for managers, in their active workspace only, at most once a minute.
create function public.run_alert_checks()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid := public.current_workspace_id();
begin
  if ws is null or not public.can(ws, 'alerts.manage') then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  -- One run at a time per workspace. An advisory lock, not a row lock on workspaces, so other
  -- writes in the workspace (which check its key) aren't held up.
  perform pg_advisory_xact_lock(hashtextextended('alert_checks:' || ws::text, 0));
  if exists (select 1 from public.alert_runs r where r.workspace_id = ws and r.last_run_at > now() - interval '1 minute') then
    raise exception 'Checks ran less than a minute ago. Try again shortly.' using errcode = 'P0001';
  end if;
  return public.evaluate_rules(ws);
end;
$$;

-- ---------------------------------------------------------------------------
-- Read state
-- ---------------------------------------------------------------------------

create function public.mark_alert_read(p_alert uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.alerts a where a.id = p_alert and public.can(a.workspace_id, 'alerts.view')) then
    raise exception 'Alert not found' using errcode = 'P0002';
  end if;
  insert into public.alert_reads (alert_id, user_id) values (p_alert, (select auth.uid()))
  on conflict do nothing;
end;
$$;

create function public.mark_all_alerts_read()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid := public.current_workspace_id();
  n int;
begin
  if ws is null or not public.can(ws, 'alerts.view') then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  insert into public.alert_reads (alert_id, user_id)
  select a.id, (select auth.uid()) from public.alerts a where a.workspace_id = ws
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Your unread alerts in the active workspace. Runs as the caller: RLS limits both tables.
create function public.unread_alert_count()
returns int
language sql
stable
set search_path = ''
as $$
  select count(*)::int
  from public.alerts a
  where a.workspace_id = (select public.current_workspace_id())
    and not exists (select 1 from public.alert_reads r where r.alert_id = a.id and r.user_id = (select auth.uid()));
$$;

grant execute on function
  public.run_alert_checks(),
  public.mark_alert_read(uuid),
  public.mark_all_alerts_read(),
  public.unread_alert_count()
to authenticated;

-- ---------------------------------------------------------------------------
-- Daily schedule
-- ---------------------------------------------------------------------------

-- pg_cron lives in pg_catalog on Supabase (it creates its own cron schema, which API roles
-- can't use; grants.test.sql checks that).
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('evaluate-alerts', '0 6 * * *', 'select public.evaluate_all_alerts()');
select cron.schedule('purge-cron-log', '30 6 * * *', $$delete from cron.job_run_details where end_time < now() - interval '30 days'$$);
