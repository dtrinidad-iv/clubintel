-- Opportunities: workspace A can't read, write or reference workspace B's rows, and each role
-- gets exactly its permissions. Every refusal sits next to the allowed case, because a missing
-- grant would raise 42501 too.
begin;
select plan(35);

-- Setup ----------------------------------------------------------------------

create temp table ids (k text primary key, v uuid) on commit drop;
grant all on ids to authenticated;
create function pg_temp.id(p text) returns uuid language sql as $$ select v from ids where k = p $$;
grant execute on function pg_temp.id(text) to authenticated;

insert into public.leagues (id, name, tier) values ('opp-test', 'Opp Test League', 9);
insert into public.clubs (id, name, short_name, league_id, region, city, stadium, capacity)
values ('00000000-0000-4000-8000-0000000000c1', 'Opp Test Club', 'OTC', 'opp-test', 'wales', 'X', 'X', 1000);
insert into ids values
  ('club', '00000000-0000-4000-8000-0000000000c1'),
  ('owner_a', tests.create_user('opp-owner-a@test.local')),
  ('admin_a', tests.create_user('opp-admin-a@test.local')),
  ('analyst_a', tests.create_user('opp-analyst-a@test.local')),
  ('viewer_a', tests.create_user('opp-viewer-a@test.local')),
  ('owner_b', tests.create_user('opp-owner-b@test.local')),
  ('loner', tests.create_user('opp-loner@test.local'));

select tests.authenticate_as(pg_temp.id('owner_a'));
insert into ids values ('ws_a', public.create_workspace('Opp A'));
select tests.authenticate_as(pg_temp.id('owner_b'));
insert into ids values ('ws_b', public.create_workspace('Opp B'));
with c as (insert into public.contacts (name) values ('B contact') returning id)
insert into ids select 'contact_b', id from c;
with o as (
  insert into public.opportunities (club_id, contact_id, title, partner_name, category, value_gbp)
  values (pg_temp.id('club'), pg_temp.id('contact_b'), 'B deal', 'B partner', 'media', 1000) returning id
)
insert into ids select 'opp_b', id from o;

select tests.clear_authentication();
select tests.add_member(pg_temp.id('ws_a'), pg_temp.id('admin_a'), 'admin');
select tests.add_member(pg_temp.id('ws_a'), pg_temp.id('analyst_a'), 'analyst');
select tests.add_member(pg_temp.id('ws_a'), pg_temp.id('viewer_a'), 'viewer');
update public.profiles set current_workspace_id = pg_temp.id('ws_a')
where id in (pg_temp.id('admin_a'), pg_temp.id('analyst_a'), pg_temp.id('viewer_a'));

-- Analyst: create, read, edit; not delete ----------------------------------

select tests.authenticate_as(pg_temp.id('analyst_a'));
select lives_ok(
  format($$ insert into public.opportunities (club_id, owner_id, title, partner_name, category, value_gbp)
            values (%L, %L, 'A deal', 'A partner', 'sponsorship', 5000) $$, pg_temp.id('club'), pg_temp.id('analyst_a')),
  'analyst creates an opportunity'
);
insert into ids select 'opp_a', id from public.opportunities where title = 'A deal';
select is((select workspace_id from public.opportunities where id = pg_temp.id('opp_a')), pg_temp.id('ws_a'), 'it lands in the active workspace');
select is((select created_by from public.opportunities where id = pg_temp.id('opp_a')), pg_temp.id('analyst_a'), 'created_by is the caller');
select is((select stage::text from public.opportunities where id = pg_temp.id('opp_a')), 'lead', 'new opportunities start as leads');

select lives_ok(format($$ update public.opportunities set stage = 'proposal' where id = %L $$, pg_temp.id('opp_a')), 'analyst moves it to proposal');
select is((select stage::text from public.opportunities where id = pg_temp.id('opp_a')), 'proposal', 'the stage changed');

delete from public.opportunities where id = pg_temp.id('opp_a');
select is((select count(*)::int from public.opportunities where id = pg_temp.id('opp_a')), 1, 'analyst cannot delete (no opportunities.delete)');

-- Isolation: A never touches B -----------------------------------------------

select is((select count(*)::int from public.opportunities where id = pg_temp.id('opp_b')), 0, 'A cannot see B''s opportunity');
select is((select count(*)::int from public.contacts where id = pg_temp.id('contact_b')), 0, 'A cannot see B''s contact');
update public.opportunities set title = 'Hijacked' where id = pg_temp.id('opp_b');

-- Only the editable columns are granted: no workspace_id, and no id (a chosen id would let
-- A probe whether B's row exists through a duplicate-key error).
select throws_ok(
  format($$ insert into public.opportunities (workspace_id, club_id, title, partner_name, category)
            values (%L, %L, 'Forged', 'X', 'other') $$, pg_temp.id('ws_b'), pg_temp.id('club')),
  '42501', null, 'an insert naming B''s workspace is refused'
);
select throws_ok(
  format($$ insert into public.opportunities (id, club_id, title, partner_name, category)
            values (%L, %L, 'Probe', 'X', 'other') $$, pg_temp.id('opp_b'), pg_temp.id('club')),
  '42501', null, 'cannot choose an id, so B''s ids cannot be probed'
);
select throws_ok(
  format($$ update public.opportunities set id = %L where id = %L $$, pg_temp.id('opp_b'), pg_temp.id('opp_a')),
  '42501', null, 'cannot change an id'
);
select lives_ok(
  format($$ insert into public.opportunities (club_id, title, partner_name, category) values (%L, 'Spare', 'X', 'other') $$, pg_temp.id('club')),
  'a normal insert still works'
);

select throws_ok(
  format($$ insert into public.opportunities (club_id, contact_id, title, partner_name, category)
            values (%L, %L, 'Bad link', 'X', 'other') $$, pg_temp.id('club'), pg_temp.id('contact_b')),
  '23503', null, 'cannot link B''s contact to a new opportunity'
);
select throws_ok(
  format($$ update public.opportunities set contact_id = %L where id = %L $$, pg_temp.id('contact_b'), pg_temp.id('opp_a')),
  '23503', null, 'cannot link B''s contact to an existing opportunity'
);
select throws_ok(
  format($$ insert into public.opportunities (club_id, owner_id, title, partner_name, category)
            values (%L, %L, 'Bad owner', 'X', 'other') $$, pg_temp.id('club'), pg_temp.id('owner_b')),
  '23503', null, 'cannot make a non-member the owner'
);
select throws_ok(
  format($$ update public.opportunities set workspace_id = %L where id = %L $$, pg_temp.id('ws_b'), pg_temp.id('opp_a')),
  '42501', null, 'cannot move an opportunity to B'
);
select lives_ok(
  format($$ update public.opportunities set owner_id = %L where id = %L $$, pg_temp.id('admin_a'), pg_temp.id('opp_a')),
  'can make another A member the owner'
);

-- Admin deletes, also not in B ------------------------------------------------

select tests.authenticate_as(pg_temp.id('admin_a'));
delete from public.opportunities where id = pg_temp.id('opp_b');
select lives_ok(format($$ delete from public.opportunities where title = 'Spare' $$), 'admin deletes in A');
select is((select count(*)::int from public.opportunities where title = 'Spare'), 0, 'and it is gone');

-- Viewer reads only -------------------------------------------------------------

select tests.authenticate_as(pg_temp.id('viewer_a'));
select is((select count(*)::int from public.opportunities where id = pg_temp.id('opp_a')), 1, 'viewer reads A''s opportunity');
select throws_ok(
  format($$ insert into public.opportunities (club_id, title, partner_name, category) values (%L, 'V', 'X', 'other') $$, pg_temp.id('club')),
  '42501', null, 'viewer cannot create'
);
update public.opportunities set title = 'Viewer edit' where id = pg_temp.id('opp_a');
delete from public.opportunities where id = pg_temp.id('opp_a');

-- No active workspace -----------------------------------------------------------

select tests.authenticate_as(pg_temp.id('loner'));
select throws_ok(
  format($$ insert into public.opportunities (club_id, title, partner_name, category) values (%L, 'L', 'X', 'other') $$, pg_temp.id('club')),
  'P0001', 'Choose a workspace first', 'a user with no workspace cannot create'
);
select is((select count(*)::int from public.opportunities), 0, 'and sees none');

-- Read back as postgres: refused writes changed nothing --------------------------

select tests.clear_authentication();
select is((select title from public.opportunities where id = pg_temp.id('opp_b')), 'B deal', 'A''s update did not reach B');
select is((select count(*)::int from public.opportunities where id = pg_temp.id('opp_b')), 1, 'A''s delete did not reach B');
select is((select title from public.opportunities where id = pg_temp.id('opp_a')), 'A deal', 'viewer''s update changed nothing');
select is((select count(*)::int from public.opportunities where id = pg_temp.id('opp_a')), 1, 'viewer''s delete changed nothing');
select is((select contact_id from public.opportunities where id = pg_temp.id('opp_a')), null, 'the refused contact link left nothing behind');

-- Stage timestamps ------------------------------------------------------------

-- Backdate with triggers off, so the checks below can tell old from new.
set local session_replication_role = replica;
update public.opportunities set stage_changed_at = '2020-01-01' where id = pg_temp.id('opp_a');
set local session_replication_role = origin;
update public.opportunities set title = 'A deal', stage_changed_at = '2030-01-01' where id = pg_temp.id('opp_a');
select is((select stage_changed_at from public.opportunities where id = pg_temp.id('opp_a')), '2020-01-01'::timestamptz, 'a non-stage update keeps stage_changed_at, even if it is sent');
update public.opportunities set stage = 'won' where id = pg_temp.id('opp_a');
select is((select stage_changed_at from public.opportunities where id = pg_temp.id('opp_a')), now(), 'a stage change stamps stage_changed_at');

-- Removing a member clears their ownership and ends their access ----------------

select tests.authenticate_as(pg_temp.id('owner_a'));
select lives_ok(format('select public.remove_member(%L, %L)', pg_temp.id('ws_a'), pg_temp.id('admin_a')), 'owner removes the admin');
select tests.clear_authentication();
select is((select owner_id from public.opportunities where id = pg_temp.id('opp_a')), null, 'their opportunities lose the owner, not the row');
select tests.authenticate_as(pg_temp.id('admin_a'));
select is((select count(*)::int from public.opportunities), 0, 'the removed admin sees none');
select throws_ok(
  format($$ insert into public.opportunities (club_id, title, partner_name, category) values (%L, 'Late', 'X', 'other') $$, pg_temp.id('club')),
  'P0001', null, 'and can no longer create in A'
);

select * from finish();
rollback;
