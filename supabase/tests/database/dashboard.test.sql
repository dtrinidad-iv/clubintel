-- Dashboard aggregates: exact numbers for the caller's active workspace and nothing else.
begin;
select plan(19);

-- Setup ----------------------------------------------------------------------

create temp table ids (k text primary key, v uuid) on commit drop;
grant all on ids to authenticated;
create function pg_temp.id(p text) returns uuid language sql as $$ select v from ids where k = p $$;
grant execute on function pg_temp.id(text) to authenticated;

insert into public.leagues (id, name, tier) values ('dash-test', 'Dash Test League', 9);
insert into public.clubs (id, name, short_name, league_id, region, city, stadium, capacity)
values ('00000000-0000-4000-8000-0000000000d1', 'Dash Test Club', 'DTC', 'dash-test', 'wales', 'X', 'X', 1000);
insert into ids values
  ('club', '00000000-0000-4000-8000-0000000000d1'),
  ('owner_a', tests.create_user('dash-owner-a@test.local')),
  ('viewer_a', tests.create_user('dash-viewer-a@test.local')),
  ('owner_b', tests.create_user('dash-owner-b@test.local')),
  ('loner', tests.create_user('dash-loner@test.local'));

-- Workspace A: five open deals (4,500), three wins in the last year (two this quarter), one loss,
-- and a win too old to count.
select tests.authenticate_as(pg_temp.id('owner_a'));
insert into ids values ('ws_a', public.create_workspace('Dash A'));
insert into public.opportunities (club_id, title, partner_name, category, value_gbp, stage, expected_close_date)
select pg_temp.id('club'), t, 'P', 'media', v, s::public.opportunity_stage, (current_date + d)::date
from (values
  ('A fresh lead', 1000, 'lead', null),
  ('A stale proposal', 2000, 'proposal', null),
  ('A quiet qualified', 500, 'qualified', null),
  ('A overdue negotiation', 700, 'negotiation', -1),
  ('A soon lead', 300, 'lead', 10),
  ('A won now', 10000, 'won', 5),
  ('A won last quarter', 4000, 'won', null),
  ('A won at quarter start', 1000, 'won', null),
  ('A lost', 3000, 'lost', null),
  ('A won long ago', 99999, 'won', null)
) as x(t, v, s, d);

-- Workspace B: one win and one open deal.
select tests.authenticate_as(pg_temp.id('owner_b'));
insert into ids values ('ws_b', public.create_workspace('Dash B'));
insert into public.opportunities (club_id, title, partner_name, category, value_gbp, stage, expected_close_date)
values (pg_temp.id('club'), 'B won', 'P', 'media', 50000, 'won', null),
       (pg_temp.id('club'), 'B lead', 'P', 'media', 7000, 'lead', current_date + 3);

-- Backdate with triggers off.
select tests.clear_authentication();
set local session_replication_role = replica;
update public.opportunities set stage_changed_at = now() - interval '31 days' where title = 'A stale proposal';
update public.opportunities set stage_changed_at = now() - interval '29 days' where title = 'A quiet qualified';
update public.opportunities set stage_changed_at = (date_trunc('quarter', now() at time zone 'Europe/London') at time zone 'Europe/London') - interval '1 day'
where title = 'A won last quarter';
-- 30 minutes into the quarter in London time. From April to October that's still the previous
-- day in UTC, so this catches functions that bucket in UTC.
update public.opportunities set stage_changed_at = (date_trunc('quarter', now() at time zone 'Europe/London') at time zone 'Europe/London') + interval '30 minutes'
where title = 'A won at quarter start';
update public.opportunities set stage_changed_at = now() - interval '20 days' where title = 'A lost';
update public.opportunities set stage_changed_at = now() - interval '400 days' where title = 'A won long ago';
set local session_replication_role = origin;

select tests.add_member(pg_temp.id('ws_a'), pg_temp.id('viewer_a'), 'viewer');
update public.profiles set current_workspace_id = pg_temp.id('ws_a') where id = pg_temp.id('viewer_a');
-- A's owner can also see B, so switching workspace must switch the numbers.
select tests.add_member(pg_temp.id('ws_b'), pg_temp.id('owner_a'), 'viewer');

-- KPIs -----------------------------------------------------------------------

select tests.authenticate_as(pg_temp.id('owner_a'));
select results_eq(
  'select open_value, open_count, won_quarter_value, won_quarter_count, won_12m_count, lost_12m_count, avg_won_value, stale_count from public.dashboard_kpis()',
  $$ values (4500::numeric, 5, 11000::numeric, 2, 3, 1, 5000::numeric, 1) $$,
  'A gets exactly its own numbers: stale at 31 days not 29, a win 30 minutes into the London quarter counted, last quarter and long-ago wins left out where they should be'
);

select tests.authenticate_as(pg_temp.id('viewer_a'));
select results_eq(
  'select open_value, won_quarter_value, stale_count from public.dashboard_kpis()',
  $$ values (4500::numeric, 11000::numeric, 1) $$,
  'a viewer gets the same numbers'
);

select tests.authenticate_as(pg_temp.id('owner_b'));
select results_eq(
  'select open_value, open_count, won_quarter_value, won_12m_count, lost_12m_count, avg_won_value, stale_count from public.dashboard_kpis()',
  $$ values (7000::numeric, 1, 50000::numeric, 1, 0, 50000::numeric, 0) $$,
  'B gets only its own numbers'
);

select tests.authenticate_as(pg_temp.id('owner_a'));
select public.switch_workspace(pg_temp.id('ws_b'));
select is((select open_value from public.dashboard_kpis()), 7000::numeric, 'switching to B switches the numbers');
select public.switch_workspace(pg_temp.id('ws_a'));

select tests.authenticate_as(pg_temp.id('loner'));
select results_eq(
  'select open_value, open_count, won_quarter_value, won_12m_count, avg_won_value, stale_count from public.dashboard_kpis()',
  $$ values (0::numeric, 0, 0::numeric, 0, null::numeric, 0) $$,
  'someone with no workspace gets zeros'
);
select is((select count(*)::int from public.dashboard_upcoming()), 0, 'and no upcoming deals');

-- Series ---------------------------------------------------------------------

select tests.authenticate_as(pg_temp.id('owner_a'));
select results_eq(
  'select stage::text, value, deals from public.dashboard_pipeline_by_stage()',
  $$ values ('lead', 1300::numeric, 2), ('qualified', 500::numeric, 1), ('proposal', 2000::numeric, 1), ('negotiation', 700::numeric, 1) $$,
  'open value by stage, in stage order'
);

select is((select count(*)::int from public.dashboard_won_by_month()), 12, 'won by month has 12 months');
select is(
  (select value from public.dashboard_won_by_month() order by month desc limit 1),
  -- The quarter-start win lands in this month only in a quarter's first month.
  case when date_trunc('month', now() at time zone 'Europe/London') = date_trunc('quarter', now() at time zone 'Europe/London')
       then 11000 else 10000 end::numeric,
  'this month holds this month''s wins, bucketed in London time'
);
select is(
  (select value from public.dashboard_won_by_month()
   where month = (date_trunc('quarter', now() at time zone 'Europe/London'))::date),
  case when date_trunc('month', now() at time zone 'Europe/London') = date_trunc('quarter', now() at time zone 'Europe/London')
       then 11000 else 1000 end::numeric,
  'the quarter-start win is in the quarter''s first month, not the month before'
);
select is((select sum(value) from public.dashboard_won_by_month()), 15000::numeric, 'the year holds the recent wins and not the old one');

select is(
  (select value from public.dashboard_value_by_tier() where tier = 9),
  4500::numeric,
  'open value lands on the club''s league tier'
);
select is(
  (select count(*)::int from public.dashboard_value_by_tier()),
  (select count(distinct tier)::int from public.leagues),
  'every tier is listed, empty ones as zero'
);

select results_eq(
  'select title, overdue from public.dashboard_upcoming()',
  $$ values ('A overdue negotiation', true), ('A soon lead', false) $$,
  'upcoming: open deals with a close date, overdue first; won deals left out'
);

select tests.authenticate_as(pg_temp.id('owner_b'));
select results_eq(
  'select title from public.dashboard_upcoming()',
  $$ values ('B lead') $$,
  'B''s upcoming list has only B''s deals'
);

-- A removed member whose profile still points at A gets nothing --------------

select tests.authenticate_as(pg_temp.id('owner_a'));
select public.remove_member(pg_temp.id('ws_a'), pg_temp.id('viewer_a'));
select tests.authenticate_as(pg_temp.id('viewer_a'));
select results_eq(
  'select open_value, open_count, won_quarter_value, stale_count from public.dashboard_kpis()',
  $$ values (0::numeric, 0, 0::numeric, 0) $$,
  'a removed member gets zeros, though their profile still names the workspace'
);
select is((select count(*)::int from public.dashboard_upcoming()), 0, 'and no upcoming deals');

-- RLS must keep applying inside them: a security definer version would skip it.
select is(
  array(select p.proname::text from pg_proc p
        where p.pronamespace = 'public'::regnamespace
          and (p.proname like 'dashboard\_%' or p.proname = 'national_attendance_by_tier')
          and p.prosecdef
        order by 1),
  '{}'::text[],
  'every dashboard function runs as the caller'
);

-- National context -----------------------------------------------------------

select results_eq(
  'select season, tier, clubs, avg_attendance, avg_capacity from public.national_attendance_by_tier()',
  $$ select s.season, l.tier, count(*)::int, round(avg(s.avg_attendance))::int, round(avg(s.capacity))::int
     from public.club_seasons s join public.leagues l on l.id = s.league_id
     where s.season = (select max(season) from public.club_seasons)
     group by 1, 2 order by 2 $$,
  'national figures match a direct aggregate of the latest season'
);

select * from finish();
rollback;
