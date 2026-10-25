-- Dashboard aggregates.
--
-- Every function runs as the caller (security invoker), so RLS still decides which rows count,
-- and each counts only the active workspace: there's no workspace argument to change.
-- current_workspace_id() is wrapped in a subquery so it's evaluated once, not per row.
-- Dates follow the clubs' time zone, Europe/London.

-- The date filters below look up deals by stage and when they reached it. This index covers
-- the old (workspace_id, stage) one too.
create index opportunities_workspace_stage_changed_idx on public.opportunities (workspace_id, stage, stage_changed_at);
drop index public.opportunities_workspace_stage_idx;

-- Headline numbers. Won and lost deals count from when they reached that stage
-- (stage_changed_at). "The last 12 months" is the won-by-month chart's window, this month and
-- the 11 before it, so the tiles and the chart agree. An aggregate with no group by always returns one row, zeros when empty.
create function public.dashboard_kpis()
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
  where o.workspace_id = (select public.current_workspace_id());
$$;

-- Open value per stage, every open stage present.
create function public.dashboard_pipeline_by_stage()
returns table (stage public.opportunity_stage, value numeric, deals int)
language sql
stable
set search_path = ''
as $$
  select s.stage, coalesce(sum(o.value_gbp), 0), count(o.id)::int
  from unnest(array['lead', 'qualified', 'proposal', 'negotiation']::public.opportunity_stage[]) as s (stage)
  left join public.opportunities o
    on o.stage = s.stage and o.workspace_id = (select public.current_workspace_id())
  group by s.stage
  order by s.stage;
$$;

-- Won value per month for the last 12 months, this one included, oldest first.
create function public.dashboard_won_by_month()
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
    on o.workspace_id = (select public.current_workspace_id())
    and o.stage = 'won'
    and date_trunc('month', o.stage_changed_at at time zone 'Europe/London')::date = m.month
  group by m.month
  order by m.month;
$$;

-- Open value by the tier of each club's current league, every tier present.
create function public.dashboard_value_by_tier()
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
    and o.workspace_id = (select public.current_workspace_id())
    and o.stage in ('lead', 'qualified', 'proposal', 'negotiation')
  group by l.tier
  order by l.tier;
$$;

-- The next open deals by expected close date; overdue ones sort first by their date.
create function public.dashboard_upcoming()
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
  where o.workspace_id = (select public.current_workspace_id())
    and o.stage in ('lead', 'qualified', 'proposal', 'negotiation')
    and o.expected_close_date is not null
  order by o.expected_close_date, o.title
  limit 6;
$$;

-- National context from shared data: the latest season, averaged per club by league tier.
create function public.national_attendance_by_tier()
returns table (season smallint, tier smallint, clubs int, avg_attendance int, avg_capacity int)
language sql
stable
set search_path = ''
as $$
  select s.season, l.tier, count(*)::int, round(avg(s.avg_attendance))::int, round(avg(s.capacity))::int
  from public.club_seasons s
  join public.leagues l on l.id = s.league_id
  where s.season = (select max(season) from public.club_seasons)
  group by s.season, l.tier
  order by l.tier;
$$;

grant execute on function
  public.dashboard_kpis(),
  public.dashboard_pipeline_by_stage(),
  public.dashboard_won_by_month(),
  public.dashboard_value_by_tier(),
  public.dashboard_upcoming(),
  public.national_attendance_by_tier()
to authenticated;
