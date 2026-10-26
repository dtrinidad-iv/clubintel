-- Alerts: each rule fires on matching data and not otherwise, evaluation is idempotent, only
-- managers change rules or run checks, read state is per person, and workspaces stay apart.
begin;
select plan(72);

-- Setup ----------------------------------------------------------------------

create temp table ids (k text primary key, v uuid) on commit drop;
grant all on ids to authenticated;
create function pg_temp.id(p text) returns uuid language sql as $$ select v from ids where k = p $$;
grant execute on function pg_temp.id(text) to authenticated;
create function pg_temp.alert_count(p_ws uuid, p_like text) returns int language sql as $$
  select count(*)::int from public.alerts where workspace_id = p_ws and title like p_like
$$;
grant execute on function pg_temp.alert_count(uuid, text) to authenticated;

insert into public.leagues (id, name, tier) values ('alert-test', 'Alert Test League', 9);
insert into public.clubs (id, name, short_name, league_id, region, city, stadium, capacity) values
  ('00000000-0000-4000-8000-0000000000f1', 'Alert Club Down Eleven', 'AC1', 'alert-test', 'wales', 'X', 'X', 20000),
  ('00000000-0000-4000-8000-0000000000f2', 'Alert Club Down Nine', 'AC2', 'alert-test', 'wales', 'X', 'X', 20000);
insert into public.club_seasons (club_id, season, league_id, league_position, avg_attendance, capacity) values
  ('00000000-0000-4000-8000-0000000000f1', 2030, 'alert-test', 1, 10000, 20000),
  ('00000000-0000-4000-8000-0000000000f1', 2031, 'alert-test', 1, 8900, 20000),
  ('00000000-0000-4000-8000-0000000000f2', 2030, 'alert-test', 2, 10000, 20000),
  ('00000000-0000-4000-8000-0000000000f2', 2031, 'alert-test', 2, 9100, 20000);

insert into ids values
  ('club_11', '00000000-0000-4000-8000-0000000000f1'),
  ('club_9', '00000000-0000-4000-8000-0000000000f2'),
  ('owner_a', tests.create_user('al-owner-a@test.local')),
  ('admin_a', tests.create_user('al-admin-a@test.local')),
  ('analyst_a', tests.create_user('al-analyst-a@test.local')),
  ('viewer_a', tests.create_user('al-viewer-a@test.local')),
  ('owner_b', tests.create_user('al-owner-b@test.local'));

select tests.authenticate_as(pg_temp.id('owner_a'));
insert into ids values ('ws_a', public.create_workspace('Alerts A'));
insert into public.opportunities (club_id, title, partner_name, category, value_gbp, stage, expected_close_date)
select pg_temp.id('club_11'), t, 'P', 'media', 1000, s::public.opportunity_stage, (current_date + d)::date
from (values
  ('A stale 31', 'lead', null),
  ('A quiet 29', 'qualified', null),
  ('A won old', 'won', null),
  ('A late 3', 'negotiation', -3)
) as x(t, s, d);

select tests.authenticate_as(pg_temp.id('owner_b'));
insert into ids values ('ws_b', public.create_workspace('Alerts B'));
insert into public.opportunities (club_id, title, partner_name, category, value_gbp)
values (pg_temp.id('club_11'), 'B stale 31', 'P', 'media', 1000);

select tests.clear_authentication();
set local session_replication_role = replica;
update public.opportunities set stage_changed_at = now() - interval '31 days' where title in ('A stale 31', 'B stale 31');
update public.opportunities set stage_changed_at = now() - interval '29 days' where title = 'A quiet 29';
update public.opportunities set stage_changed_at = now() - interval '100 days' where title = 'A won old';
set local session_replication_role = origin;

select tests.add_member(pg_temp.id('ws_a'), pg_temp.id('admin_a'), 'admin');
select tests.add_member(pg_temp.id('ws_a'), pg_temp.id('analyst_a'), 'analyst');
select tests.add_member(pg_temp.id('ws_a'), pg_temp.id('viewer_a'), 'viewer');
update public.profiles set current_workspace_id = pg_temp.id('ws_a')
where id in (pg_temp.id('admin_a'), pg_temp.id('analyst_a'), pg_temp.id('viewer_a'));

-- Permissions ------------------------------------------------------------------

select results_eq(
  $$ select r::text, 'alerts.view' = any (public.role_permissions(r)), 'alerts.manage' = any (public.role_permissions(r))
     from unnest(enum_range(null::public.workspace_role)) r order by 1 $$,
  $$ values ('admin', true, true), ('analyst', true, false), ('owner', true, true), ('viewer', true, false) $$,
  'everyone views alerts; owners and admins manage them'
);
select is(
  array(select r::text from unnest(enum_range(null::public.workspace_role)) r
        where 'alerts.view' = any (public.role_permissions(r)) and not 'opportunities.view' = any (public.role_permissions(r))),
  '{}'::text[],
  'alerts.view implies opportunities.view (alert text quotes deals)'
);

-- Rules ------------------------------------------------------------------------------

select tests.authenticate_as(pg_temp.id('viewer_a'));
select throws_ok($$ insert into public.alert_rules (type, days) values ('stale_opportunity', 30) $$, '42501', null, 'a viewer cannot add a rule');
select tests.authenticate_as(pg_temp.id('analyst_a'));
select throws_ok($$ insert into public.alert_rules (type, days) values ('stale_opportunity', 30) $$, '42501', null, 'nor can an analyst');

select tests.authenticate_as(pg_temp.id('admin_a'));
select lives_ok($$
  insert into public.alert_rules (type, days) values ('stale_opportunity', 30), ('close_date_passed', 0), ('close_date_passed', 5)
$$, 'an admin adds stale and close-date rules');
select lives_ok(format($$
  insert into public.alert_rules (type, club_id, drop_pct) values ('attendance_drop', %L, 10), ('attendance_drop', %L, 10)
$$, pg_temp.id('club_11'), pg_temp.id('club_9')), 'and attendance rules for two clubs');
select lives_ok($$ insert into public.alert_rules (type, days, enabled) values ('stale_opportunity', 1, false) $$, 'and a disabled rule');
select is((select workspace_id from public.alert_rules limit 1), pg_temp.id('ws_a'), 'rules land in the active workspace');

select throws_ok(format($$ insert into public.alert_rules (type, days, club_id) values ('stale_opportunity', 30, %L) $$, pg_temp.id('club_11')), '23514', null, 'a stale rule takes no club');
select throws_ok($$ insert into public.alert_rules (type, drop_pct) values ('attendance_drop', 10) $$, '23514', null, 'an attendance rule needs a club');
select throws_ok($$ insert into public.alert_rules (type, days) values ('stale_opportunity', 400) $$, '23514', null, 'days stay within range');
select throws_ok(format($$ insert into public.alert_rules (workspace_id, type, days) values (%L, 'stale_opportunity', 30) $$, pg_temp.id('ws_b')), '42501', null, 'a rule cannot name another workspace');
select throws_ok(format($$ update public.alert_rules set workspace_id = %L $$, pg_temp.id('ws_b')), '42501', null, 'or be moved to one');

-- Evaluation ---------------------------------------------------------------------------

select tests.authenticate_as(pg_temp.id('viewer_a'));
select throws_ok($$ select public.run_alert_checks() $$, '42501', null, 'a viewer cannot run checks');
select tests.authenticate_as(pg_temp.id('analyst_a'));
select throws_ok($$ select public.run_alert_checks() $$, '42501', null, 'nor can an analyst');
select tests.authenticate_as(pg_temp.id('admin_a'));
select is(public.run_alert_checks(), 3, 'an admin runs checks: three new alerts');
select is(pg_temp.alert_count(pg_temp.id('ws_a'), 'No movement on A stale 31'), 1, 'a deal idle for 31 days is stale at 30');
select is(pg_temp.alert_count(pg_temp.id('ws_a'), 'No movement on A quiet 29'), 0, 'one idle for 29 days is not, and the disabled 1-day rule did nothing');
select is(pg_temp.alert_count(pg_temp.id('ws_a'), '%A won old'), 0, 'won deals are never stale');
select is(pg_temp.alert_count(pg_temp.id('ws_a'), 'Close date passed: A late 3'), 1, '3 days late fires with no grace, once (the 5-day grace rule doesn''t)');
select is(pg_temp.alert_count(pg_temp.id('ws_a'), 'Attendance down at Alert Club Down Eleven'), 1, 'an 11% drop fires at 10%');
select is(pg_temp.alert_count(pg_temp.id('ws_a'), 'Attendance down at Alert Club Down Nine'), 0, 'a 9% drop does not');
select is(pg_temp.alert_count(pg_temp.id('ws_a'), '%B stale 31'), 0, 'B''s deals never reach A''s alerts');
select is(
  (select opportunity_id from public.alerts where title = 'No movement on A stale 31'),
  (select id from public.opportunities where title = 'A stale 31'),
  'the alert points at the deal'
);

select throws_ok($$ select public.run_alert_checks() $$, 'P0001', 'Checks ran less than a minute ago. Try again shortly.', 'checks run at most once a minute');

-- A second, identical rule doesn't duplicate alerts.
insert into public.alert_rules (type, days) values ('stale_opportunity', 30);

select tests.clear_authentication();
update public.alert_runs set last_run_at = now() - interval '2 minutes';
select tests.authenticate_as(pg_temp.id('admin_a'));
select is(public.run_alert_checks(), 0, 'running again adds nothing (idempotent), even with a second stale rule');
select is(pg_temp.alert_count(pg_temp.id('ws_a'), 'No movement on A stale 31'), 1, 'still one alert for that deal');

-- The deal moves on, then goes quiet again: a new alert.
select tests.clear_authentication();
update public.opportunities set stage = 'qualified' where title = 'A stale 31';
set local session_replication_role = replica;
update public.opportunities set stage_changed_at = now() - interval '40 days' where title = 'A stale 31';
set local session_replication_role = origin;
update public.alert_runs set last_run_at = now() - interval '2 minutes';
select tests.authenticate_as(pg_temp.id('admin_a'));
select is(public.run_alert_checks(), 1, 'a deal that goes stale again alerts again');

-- No direct writes ---------------------------------------------------------------------------

select throws_ok(format($$ insert into public.alerts (workspace_id, type, title, body, dedup_key) values (%L, 'stale_opportunity', 'x', 'x', 'x') $$, pg_temp.id('ws_a')), '42501', null, 'alerts cannot be inserted directly');
select throws_ok($$ update public.alerts set title = 'Forged' $$, '42501', null, 'or edited');
select throws_ok(format($$ insert into public.alert_reads (alert_id, user_id) select id, %L from public.alerts limit 1 $$, pg_temp.id('admin_a')), '42501', null, 'read state cannot be written directly');
select throws_ok($$ select public.evaluate_rules(gen_random_uuid()) $$, '42501', null, 'internal evaluation is not callable');
select throws_ok($$ select public.evaluate_all_alerts() $$, '42501', null, 'nor is the all-workspaces run');

-- Read state is per person ------------------------------------------------------------------

select tests.authenticate_as(pg_temp.id('viewer_a'));
select is(public.unread_alert_count(), 4, 'a viewer starts with four unread');
select lives_ok(format($$ select public.mark_alert_read(%L) $$, (select id from public.alerts where title = 'Close date passed: A late 3')), 'and marks one read');
select is(public.unread_alert_count(), 3, 'three left');
select tests.authenticate_as(pg_temp.id('admin_a'));
select is(public.unread_alert_count(), 4, 'the admin still has four: read state is per person');
select is((select count(*)::int from public.alert_reads), 0, 'and can''t see the viewer''s read state');
select is(public.mark_all_alerts_read(), 4, 'mark all read covers the admin''s four');
select is(public.unread_alert_count(), 0, 'none left');

-- Isolation -------------------------------------------------------------------------------------

select tests.clear_authentication();
insert into ids select 'alert_a', id from public.alerts where workspace_id = pg_temp.id('ws_a') limit 1;
select tests.authenticate_as(pg_temp.id('owner_b'));
select is((select count(*)::int from public.alerts where workspace_id = pg_temp.id('ws_a')), 0, 'B cannot see A''s alerts');
select is((select count(*)::int from public.alert_rules where workspace_id = pg_temp.id('ws_a')), 0, 'or A''s rules');
delete from public.alert_rules where workspace_id = pg_temp.id('ws_a');
update public.alert_rules set enabled = false where workspace_id = pg_temp.id('ws_a');
select throws_ok(format($$ select public.mark_alert_read(%L) $$, pg_temp.id('alert_a')), 'P0002', null, 'or mark one of A''s alerts read');
insert into public.alert_rules (type, days) values ('stale_opportunity', 30);
select is(public.run_alert_checks(), 1, 'B''s checks find B''s stale deal');
select is(public.mark_all_alerts_read(), 1, 'B''s mark-all covers only B''s alert');
select is(public.unread_alert_count(), 0, 'and B''s count never includes A''s');
select tests.clear_authentication();
select is((select count(*)::int from public.alert_rules where workspace_id = pg_temp.id('ws_a')), 7, 'A''s rules survived B''s delete');
select is((select count(*)::int from public.alert_rules where workspace_id = pg_temp.id('ws_a') and not enabled), 1, 'and B''s update (only the seeded disabled rule is off)');
select is((select count(*)::int from public.alert_reads where user_id = pg_temp.id('owner_b') and alert_id = pg_temp.id('alert_a')), 0, 'B left no read state on A''s alert');
select is(pg_temp.alert_count(pg_temp.id('ws_b'), 'No movement on B stale 31'), 1, 'and B''s alert is in B');

-- Managers toggle; others can't -----------------------------------------------------------------

select tests.authenticate_as(pg_temp.id('analyst_a'));
update public.alert_rules set enabled = false where type = 'close_date_passed';
select tests.authenticate_as(pg_temp.id('admin_a'));
select is((select count(*)::int from public.alert_rules where type = 'close_date_passed' and enabled), 2, 'an analyst cannot turn rules off');
update public.alert_rules set enabled = false where type = 'close_date_passed' and days = 5;
select is((select count(*)::int from public.alert_rules where type = 'close_date_passed' and enabled), 1, 'an admin can');
select tests.authenticate_as(pg_temp.id('analyst_a'));
delete from public.alert_rules;
select tests.authenticate_as(pg_temp.id('viewer_a'));
delete from public.alert_rules;
update public.alert_rules set enabled = false;
select tests.authenticate_as(pg_temp.id('admin_a'));
select is((select count(*)::int from public.alert_rules), 7, 'analysts and viewers cannot delete rules');
select is((select count(*)::int from public.alert_rules where enabled), 5, 'and a viewer cannot turn them off');

-- At most 50 rules ---------------------------------------------------------------------------------

insert into public.alert_rules (type, days) select 'stale_opportunity', 30 from generate_series(1, 43);
select throws_ok($$ insert into public.alert_rules (type, days) values ('stale_opportunity', 30) $$, 'P0001', 'A workspace can have at most 50 alert rules.', 'the 51st rule is refused');

-- A removed member loses access --------------------------------------------------------------------

select tests.authenticate_as(pg_temp.id('owner_a'));
select public.remove_member(pg_temp.id('ws_a'), pg_temp.id('viewer_a'));
select tests.authenticate_as(pg_temp.id('viewer_a'));
select is((select count(*)::int from public.alerts) + (select count(*)::int from public.alert_rules), 0, 'a removed member sees no alerts or rules');
select is((select count(*)::int from public.alert_reads), 0, 'or their old read state');
select throws_ok($$ select public.mark_all_alerts_read() $$, '42501', null, 'cannot mark all read');
select throws_ok(format($$ select public.mark_alert_read(%L) $$, pg_temp.id('alert_a')), 'P0002', null, 'or one');
select is(public.unread_alert_count(), 0, 'and counts nothing');

-- The daily run -------------------------------------------------------------------------------------

select tests.clear_authentication();
select is((select schedule from cron.job where jobname = 'evaluate-alerts'), '0 6 * * *', 'the daily cron job is scheduled');
set local session_replication_role = replica;
update public.opportunities set stage_changed_at = now() - interval '35 days' where title in ('A quiet 29', 'B stale 31');
set local session_replication_role = origin;
select is(public.evaluate_all_alerts(), 2, 'the daily run covers every workspace');

-- The once-a-minute limit survives deleting and re-adding rules -------------------------------------

select tests.authenticate_as(pg_temp.id('owner_b'));
delete from public.alert_rules;
insert into public.alert_rules (type, days) values ('close_date_passed', 0);
select throws_ok($$ select public.run_alert_checks() $$, 'P0001', null, 'deleting and re-adding rules doesn''t reset the once-a-minute limit');

-- Close-date edges (in B, one rule at a time) ----------------------------------------------------

insert into public.opportunities (club_id, title, partner_name, category, value_gbp, expected_close_date)
select pg_temp.id('club_11'), t, 'P', 'media', 1000, (now() at time zone 'Europe/London')::date - d
from (values ('B due today', 0), ('B one late', 1), ('B five late', 5), ('B six late', 6)) as x(t, d);
select tests.clear_authentication();
update public.alert_runs set last_run_at = now() - interval '2 minutes';
select tests.authenticate_as(pg_temp.id('owner_b'));
select is(public.run_alert_checks(), 3, 'with no grace, everything past its date fires…');
select is(pg_temp.alert_count(pg_temp.id('ws_b'), 'Close date passed: B due today'), 0, '…but not a deal due today');
select is((select body from public.alerts where title = 'Close date passed: B one late'), 'Expected to close on ' || to_char((now() at time zone 'Europe/London')::date - 1, 'FMDD Mon YYYY') || ' (1 day ago) and still at Lead.', 'and one day reads "1 day"');

select tests.clear_authentication();
delete from public.alerts where workspace_id = pg_temp.id('ws_b') and type = 'close_date_passed';
update public.alert_runs set last_run_at = now() - interval '2 minutes';
select tests.authenticate_as(pg_temp.id('owner_b'));
update public.alert_rules set days = 5 where type = 'close_date_passed';
select is(public.run_alert_checks(), 1, 'with 5 days of grace, one deal fires…');
select is(pg_temp.alert_count(pg_temp.id('ws_b'), 'Close date passed: B six late'), 1, '…6 days late');
select is(pg_temp.alert_count(pg_temp.id('ws_b'), 'Close date passed: B five late'), 0, 'and 5 days late does not');

-- Deleting a deal removes its alerts; old alerts are purged -----------------------------------------

select tests.clear_authentication();
delete from public.opportunities where title = 'B six late';
select is(pg_temp.alert_count(pg_temp.id('ws_b'), 'Close date passed: B six late'), 0, 'a deleted deal takes its alerts with it');
update public.alerts set created_at = now() - interval '181 days' where title = 'No movement on B stale 31';
select public.evaluate_all_alerts();
select is(pg_temp.alert_count(pg_temp.id('ws_b'), 'No movement on B stale 31'), 0, 'the daily run purges alerts older than 180 days');
select ok(exists (select 1 from cron.job where jobname = 'purge-cron-log'), 'and the cron log is purged on a schedule');

select * from finish();
rollback;
