-- AI reports and usage: only the server writes them, workspaces are isolated, money is reserved
-- and settled once, and every limit holds.
begin;
select plan(62);

-- Setup ----------------------------------------------------------------------

create temp table ids (k text primary key, v uuid) on commit drop;
grant all on ids to authenticated, service_role;
create function pg_temp.id(p text) returns uuid language sql as $$ select v from ids where k = p $$;
grant execute on function pg_temp.id(text) to authenticated, service_role;

insert into public.leagues (id, name, tier) values ('rep-test', 'Rep Test League', 9);
insert into public.clubs (id, name, short_name, league_id, region, city, stadium, capacity)
values ('00000000-0000-4000-8000-0000000000e1', 'Rep Test Club', 'RTC', 'rep-test', 'wales', 'X', 'X', 1000);

insert into ids values
  ('owner_a', tests.create_user('rep-owner-a@test.local')),
  ('admin_a', tests.create_user('rep-admin-a@test.local')),
  ('analyst_a', tests.create_user('rep-analyst-a@test.local')),
  ('viewer_a', tests.create_user('rep-viewer-a@test.local')),
  ('owner_b', tests.create_user('rep-owner-b@test.local'));

select tests.authenticate_as(pg_temp.id('owner_a'));
insert into ids values ('ws_a', public.create_workspace('Reports A'));
select tests.authenticate_as(pg_temp.id('owner_b'));
insert into ids values ('ws_b', public.create_workspace('Reports B'));
insert into public.opportunities (club_id, title, partner_name, category, value_gbp)
values ('00000000-0000-4000-8000-0000000000e1', 'B deal', 'P', 'media', 7000);

select tests.clear_authentication();
select tests.add_member(pg_temp.id('ws_a'), pg_temp.id('admin_a'), 'admin');
select tests.add_member(pg_temp.id('ws_a'), pg_temp.id('analyst_a'), 'analyst');
select tests.add_member(pg_temp.id('ws_a'), pg_temp.id('viewer_a'), 'viewer');
-- A's owner is also an analyst in B.
select tests.add_member(pg_temp.id('ws_b'), pg_temp.id('owner_a'), 'analyst');
update public.profiles set current_workspace_id = pg_temp.id('ws_a')
where id in (pg_temp.id('admin_a'), pg_temp.id('analyst_a'), pg_temp.id('viewer_a'), pg_temp.id('owner_a'));
insert into ids values ('report_b', public.start_report(pg_temp.id('owner_b'), pg_temp.id('ws_b'), null));

-- Permissions ------------------------------------------------------------------

select results_eq(
  $$ select r::text, 'ai.use' = any (public.role_permissions(r)), 'reports.view' = any (public.role_permissions(r)), 'reports.approve' = any (public.role_permissions(r))
     from unnest(enum_range(null::public.workspace_role)) r order by r $$,
  $$ values ('admin', true, true, true), ('analyst', true, true, false), ('owner', true, true, true), ('viewer', false, true, false) $$,
  'ai.use for analyst and up, reports.view for everyone, reports.approve for admin and up'
);

-- Only the server writes ----------------------------------------------------------

select tests.authenticate_as(pg_temp.id('analyst_a'));
select throws_ok(format($$ select public.start_report(%L, %L, null) $$, pg_temp.id('analyst_a'), pg_temp.id('ws_a')), '42501', null, 'a user cannot call start_report');
select throws_ok(format($$ select public.finish_report(%L, gen_random_uuid(), '{}', 'm') $$, pg_temp.id('report_b')), '42501', null, 'or finish_report');
select throws_ok(format($$ select public.fail_report(%L, gen_random_uuid(), 'x', 'm') $$, pg_temp.id('report_b')), '42501', null, 'or fail_report');
select throws_ok(format($$ select public.settle_ai_usage(%L, gen_random_uuid(), 'm', 0, 0, 0, 0, 0) $$, pg_temp.id('report_b')), '42501', null, 'or settle_ai_usage');
select throws_ok($$ select public.user_can(gen_random_uuid(), gen_random_uuid(), 'ai.use') $$, '42501', null, 'internal helpers are not callable: user_can');
select throws_ok($$ select public.ai_spend_this_month(gen_random_uuid()) $$, '42501', null, 'ai_spend_this_month');
select throws_ok($$ select public.ai_effective_budget(gen_random_uuid()) $$, '42501', null, 'ai_effective_budget');
select throws_ok($$ insert into public.reports (workspace_id, title) values (gen_random_uuid(), 'Forged') $$, '42501', null, 'reports cannot be inserted directly');
select throws_ok($$ update public.reports set status = 'approved' $$, '42501', null, 'or updated directly');
select throws_ok(
  format($$ insert into public.ai_usage (workspace_id, feature, model, cost_usd) values (%L, 'report', 'x', 0) $$, pg_temp.id('ws_a')),
  '42501', null, 'usage cannot be inserted directly'
);
select throws_ok($$ delete from public.ai_usage $$, '42501', null, 'or deleted');
select throws_ok($$ select * from public.ai_limits $$, '42501', null, 'operator limits are not readable');

-- Starting: the server, for a user allowed to ---------------------------------------

select tests.clear_authentication();
set local role service_role;
select throws_ok(format($$ select public.start_report(%L, %L, null) $$, pg_temp.id('viewer_a'), pg_temp.id('ws_a')), '42501', null, 'not for a viewer (no ai.use)');
select throws_ok(format($$ select public.start_report(%L, %L, null) $$, pg_temp.id('owner_b'), pg_temp.id('ws_a')), '42501', null, 'not for someone outside the workspace');
select throws_ok(format($$ select public.start_report(%L, %L, %L) $$, pg_temp.id('analyst_a'), pg_temp.id('ws_a'), repeat('x', 301)), 'P0001', null, 'not with a focus over 300 characters');
select lives_ok(format($$ insert into ids values ('r1', public.start_report(%L, %L, '  hospitality  ')) $$, pg_temp.id('analyst_a'), pg_temp.id('ws_a')), 'the server starts a report for an analyst');
reset role;

select results_eq(
  format('select workspace_id, created_by, status::text, focus from public.reports where id = %L', pg_temp.id('r1')),
  format('values (%L::uuid, %L::uuid, %L, %L)', pg_temp.id('ws_a'), pg_temp.id('analyst_a'), 'generating', 'hospitality'),
  'it is generating in that workspace, made by that user, with the focus trimmed'
);
select results_eq(
  format('select workspace_id, user_id, model, cost_usd, settled_at is null from public.ai_usage where report_id = %L', pg_temp.id('r1')),
  format('values (%L::uuid, %L::uuid, %L, 2.00::numeric, true)', pg_temp.id('ws_a'), pg_temp.id('analyst_a'), 'reserved'),
  'and its worst-case cost is reserved'
);

-- Finishing and settling ------------------------------------------------------------

set local role service_role;
select lives_ok(format($$ select public.settle_ai_usage(%L, pg_temp.id('ws_a'), 'claude-opus-5-5', 1000, 500, 0, 0, 0.12) $$, pg_temp.id('r1')), 'the server settles the real cost');
select throws_ok(format($$ select public.settle_ai_usage(%L, pg_temp.id('ws_a'), 'claude-opus-5-5', 0, 0, 0, 0, 0) $$, pg_temp.id('r1')), 'P0002', null, 'only once');
select lives_ok(format($$ select public.finish_report(%L, pg_temp.id('ws_a'), '{"summary": "Healthy"}', 'claude-opus-5-5') $$, pg_temp.id('r1')), 'and saves the draft');
select throws_ok(format($$ select public.finish_report(%L, pg_temp.id('ws_a'), '{"summary": "Rewritten"}', 'm') $$, pg_temp.id('r1')), 'P0002', null, 'a finished report cannot be rewritten');
select throws_ok(format($$ select public.fail_report(%L, pg_temp.id('ws_a'), 'x') $$, pg_temp.id('r1')), 'P0002', null, 'or failed');

select throws_ok(format($$ select public.settle_ai_usage(%L, %L, 'm', 0, 0, 0, 0, 0) $$, pg_temp.id('report_b'), pg_temp.id('ws_a')), 'P0002', null, 'the server can''t settle a report under the wrong workspace');
select throws_ok(format($$ select public.finish_report(%L, %L, '{}', 'm') $$, pg_temp.id('report_b'), pg_temp.id('ws_a')), 'P0002', null, 'or finish one');
insert into ids values ('r2', public.start_report(pg_temp.id('analyst_a'), pg_temp.id('ws_a'), null));
select lives_ok(format($$ select public.fail_report(%L, pg_temp.id('ws_a'), 'Stopped before it finished.') $$, pg_temp.id('r2')), 'a stopped report is marked failed');
insert into ids values ('r3', public.start_report(pg_temp.id('analyst_a'), pg_temp.id('ws_a'), null));
select throws_ok(format($$ select public.settle_ai_usage(%L, pg_temp.id('ws_a'), 'm', 0, 0, 0, 0, -1) $$, pg_temp.id('r3')), '22023', null, 'a negative cost is refused');
select throws_ok(format($$ select public.settle_ai_usage(%L, pg_temp.id('ws_a'), 'Bad Model!', 0, 0, 0, 0, 0) $$, pg_temp.id('r3')), '23514', null, 'a malformed model name is refused');
select lives_ok(format($$ select public.settle_ai_usage(%L, pg_temp.id('ws_a'), 'claude-opus-5-5', 0, 0, 0, 0, 999999) $$, pg_temp.id('r3')), 'a huge cost is accepted…');
reset role;
select is((select cost_usd from public.ai_usage where report_id = pg_temp.id('r3')), 2.00::numeric, '…but capped at the most one report may cost');
select is((select status::text from public.reports where id = pg_temp.id('r2')), 'failed', 'the stopped report is failed');
select is((select cost_usd from public.ai_usage where report_id = pg_temp.id('r2')), 2.00::numeric, 'and its unsettled reservation still counts');

-- Reading ------------------------------------------------------------------------------

select tests.authenticate_as(pg_temp.id('viewer_a'));
select is((select count(*)::int from public.reports where workspace_id = pg_temp.id('ws_a')), 3, 'a viewer reads A''s reports');
select is((select count(*)::int from public.reports where id = pg_temp.id('report_b')), 0, 'but not B''s');
select is((select count(*)::int from public.ai_usage), 0, 'a viewer cannot read usage');
select is((select count(*)::int from public.ai_budget_status()), 0, 'or the budget status');

select tests.authenticate_as(pg_temp.id('admin_a'));
select is((select count(*)::int from public.ai_usage), 3, 'an admin reads A''s usage, and only A''s');
select tests.authenticate_as(pg_temp.id('owner_b'));
select is((select count(*)::int from public.ai_usage where workspace_id = pg_temp.id('ws_a')), 0, 'B''s owner cannot read A''s usage');
select is((select count(*)::int from public.reports where workspace_id = pg_temp.id('ws_a')), 0, 'or A''s reports');

-- Reviewing ------------------------------------------------------------------------------

select tests.authenticate_as(pg_temp.id('analyst_a'));
select throws_ok(format($$ select public.review_report(%L, 'approved') $$, pg_temp.id('r1')), '42501', null, 'an analyst cannot approve');
select tests.authenticate_as(pg_temp.id('owner_b'));
select throws_ok(format($$ select public.review_report(%L, 'approved') $$, pg_temp.id('r1')), 'P0002', null, 'another workspace cannot review it (and can''t tell it exists)');
select tests.authenticate_as(pg_temp.id('admin_a'));
select lives_ok(format($$ select public.review_report(%L, 'approved') $$, pg_temp.id('r1')), 'an admin approves the draft');
select results_eq(
  format('select status::text, reviewed_by from public.reports where id = %L', pg_temp.id('r1')),
  format('values (%L, %L::uuid)', 'approved', pg_temp.id('admin_a')),
  'it is approved, by the admin'
);
select throws_ok(format($$ select public.review_report(%L, 'discarded') $$, pg_temp.id('r1')), 'P0001', null, 'only drafts can be reviewed');

-- Budgets -----------------------------------------------------------------------------------

select tests.authenticate_as(pg_temp.id('analyst_a'));
update public.workspaces set ai_monthly_budget_usd = 1000 where id = pg_temp.id('ws_a');
select tests.authenticate_as(pg_temp.id('owner_b'));
update public.workspaces set ai_monthly_budget_usd = 1000 where id = pg_temp.id('ws_a');
select tests.authenticate_as(pg_temp.id('owner_a'));
select is((select ai_monthly_budget_usd from public.workspaces where id = pg_temp.id('ws_a')), 25::numeric, 'neither an analyst nor another workspace can change A''s budget');

update public.workspaces set ai_monthly_budget_usd = 10000 where id = pg_temp.id('ws_a');
select results_eq(
  'select spent_usd, budget_usd, workspace_budget_usd, platform_cap_usd from public.ai_budget_status()',
  $$ values (4.12::numeric, 50::numeric, 10000::numeric, 50::numeric) $$,
  'an owner''s own budget is capped by the operator''s limit; spend includes the reservation'
);

-- Spent 4.12; a new report reserves 2.00, so a budget of 6.00 has no room.
update public.workspaces set ai_monthly_budget_usd = 6 where id = pg_temp.id('ws_a');
select tests.clear_authentication();
set local role service_role;
select throws_ok(format($$ select public.start_report(%L, %L, null) $$, pg_temp.id('analyst_a'), pg_temp.id('ws_a')), 'P0001', 'This month''s AI budget is used up.', 'no report without room for its reservation');
reset role;
update public.workspaces set ai_monthly_budget_usd = 25 where id = pg_temp.id('ws_a');

-- Limits ------------------------------------------------------------------------------------

update public.ai_limits set reports_per_workspace_hour = 3;
set local role service_role;
select throws_ok(format($$ select public.start_report(%L, %L, null) $$, pg_temp.id('admin_a'), pg_temp.id('ws_a')), 'P0001', 'Too many reports this hour. Try again later.', 'the workspace''s hourly limit holds');
reset role;

update public.ai_limits set reports_per_workspace_hour = 100, reports_per_user_day = 3;
set local role service_role;
select throws_ok(format($$ select public.start_report(%L, %L, null) $$, pg_temp.id('analyst_a'), pg_temp.id('ws_a')), 'P0001', 'You''ve reached today''s report limit. Try again tomorrow.', 'a user''s daily limit holds');
select lives_ok(format($$ insert into ids values ('r4', public.start_report(%L, %L, null)) $$, pg_temp.id('admin_a'), pg_temp.id('ws_a')), 'while someone else in the workspace can still start one');
reset role;

update public.ai_limits set reports_per_user_day = 100, platform_daily_usd = 10;
set local role service_role;
select throws_ok(format($$ select public.start_report(%L, %L, null) $$, pg_temp.id('admin_a'), pg_temp.id('ws_a')), 'P0001', 'AI reports are paused for today. Try again tomorrow.', 'the platform''s daily limit holds');
reset role;
update public.ai_limits set platform_daily_usd = 50;

-- A report left generating for over 15 minutes is failed by the next start.
update public.reports set created_at = now() - interval '16 minutes' where id = pg_temp.id('r4');
set local role service_role;
select public.start_report(pg_temp.id('admin_a'), pg_temp.id('ws_a'), null);
reset role;
select results_eq(
  format('select status::text, error from public.reports where id = %L', pg_temp.id('r4')),
  $$ values ('failed', 'Timed out before it finished.') $$,
  'a stale generating report is marked failed'
);

-- A removed member can't start one.
select tests.authenticate_as(pg_temp.id('owner_a'));
select public.remove_member(pg_temp.id('ws_a'), pg_temp.id('analyst_a'));
select tests.clear_authentication();
update public.ai_limits set reports_per_user_day = 100;
set local role service_role;
select throws_ok(format($$ select public.start_report(%L, %L, null) $$, pg_temp.id('analyst_a'), pg_temp.id('ws_a')), '42501', null, 'a removed member cannot start a report');
reset role;

-- Dashboard aggregates for a named workspace ---------------------------------------------

select tests.authenticate_as(pg_temp.id('owner_a'));
select is((select open_value from public.dashboard_kpis(pg_temp.id('ws_b'))), 7000::numeric, 'a member of B gets B''s numbers by naming it, whatever is active');
select is((select open_value from public.dashboard_kpis()), 0::numeric, 'and the active workspace''s without it');
select tests.authenticate_as(pg_temp.id('viewer_a'));
select is((select open_value from public.dashboard_kpis(pg_temp.id('ws_b'))), 0::numeric, 'naming a workspace you''re not in gets nothing (RLS)');
select is((select count(*)::int from public.dashboard_upcoming(pg_temp.id('ws_b'))), 0, 'nothing upcoming either');

select is((select sum(value) from public.dashboard_pipeline_by_stage(pg_temp.id('ws_b'))), 0::numeric, 'or pipeline by stage');
select is((select sum(value) from public.dashboard_won_by_month(pg_temp.id('ws_b'))), 0::numeric, 'or wins by month');
select is((select sum(value) from public.dashboard_value_by_tier(pg_temp.id('ws_b'))), 0::numeric, 'or value by tier');

-- The budget status follows the active workspace.
select tests.authenticate_as(pg_temp.id('owner_a'));
select public.switch_workspace(pg_temp.id('ws_b'));
select is((select spent_usd from public.ai_budget_status()), 2.00::numeric, 'after switching, the budget status is B''s');

select * from finish();
rollback;
