-- National club database: shared reference data. Signed-in users read it; nobody writes it
-- through the API, and anon can't touch it.
begin;
select plan(31);

-- Setup (as postgres): one league, one club and a season, plus a user with no workspace.
insert into public.leagues (id, name, tier) values ('test-league', 'Test League', 9);
insert into public.clubs (id, name, short_name, league_id, region, city, stadium, capacity)
values ('00000000-0000-4000-8000-00000000c1b0', 'Test Club', 'TST', 'test-league', 'wales', 'Testtown', 'Test Park', 1000);
insert into public.club_seasons (club_id, season, league_id, league_position, avg_attendance, capacity) values
  ('00000000-0000-4000-8000-00000000c1b0', 2024, 'test-league', 2, 600, 1000),
  ('00000000-0000-4000-8000-00000000c1b0', 2025, 'test-league', 1, 800, 1000);

create temp table ids (k text primary key, v uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values ('user', tests.create_user('clubs-reader@test.local'));

-- Structure: RLS on every table, and the view runs as the caller
select ok((select relrowsecurity from pg_class where oid = 'public.leagues'::regclass), 'RLS is on for leagues');
select ok((select relrowsecurity from pg_class where oid = 'public.clubs'::regclass), 'RLS is on for clubs');
select ok((select relrowsecurity from pg_class where oid = 'public.club_seasons'::regclass), 'RLS is on for club_seasons');
select ok(
  (select 'security_invoker=true' = any (reloptions) from pg_class where oid = 'public.club_directory'::regclass),
  'club_directory runs as the caller'
);
select hasnt_column('public', 'clubs', 'workspace_id', 'clubs are shared, not tenant data');

-- Any signed-in user reads, even without a workspace
select tests.authenticate_as((select v from ids where k = 'user'));
select is((select count(*)::int from public.leagues where id = 'test-league'), 1, 'signed-in user reads leagues');
select is((select name from public.clubs where short_name = 'TST'), 'Test Club', 'signed-in user reads clubs');
select is((select count(*)::int from public.club_seasons where league_id = 'test-league'), 2, 'signed-in user reads club seasons');
select is(
  (select avg_attendance from public.club_directory where name = 'Test Club'), 800,
  'the directory shows the newest season, not an earlier one'
);
select is((select count(*)::int from public.clubs where name ilike '%est clu%'), 1, 'name search matches a substring');

-- ...but writes nothing
select throws_ok($$ insert into public.leagues (id, name, tier) values ('x', 'X', 1) $$, '42501', null, 'cannot insert a league');
select throws_ok(
  $$ insert into public.clubs (name, short_name, league_id, region, city, stadium, capacity)
     values ('Fake', 'FK', 'test-league', 'wales', 'X', 'X', 1) $$,
  '42501', null, 'cannot insert a club'
);
select throws_ok($$ update public.clubs set capacity = 1 $$, '42501', null, 'cannot update clubs');
select throws_ok($$ delete from public.clubs $$, '42501', null, 'cannot delete clubs');
select throws_ok(
  $$ insert into public.club_seasons values ('00000000-0000-4000-8000-00000000c1b0', 2024, 'test-league', 2, 1, 1) $$,
  '42501', null, 'cannot insert a season'
);
select throws_ok($$ update public.club_seasons set avg_attendance = 1 $$, '42501', null, 'cannot update seasons');
select throws_ok($$ delete from public.leagues $$, '42501', null, 'cannot delete leagues');
select throws_ok($$ update public.leagues set name = 'X' $$, '42501', null, 'cannot update leagues');
select throws_ok($$ delete from public.club_seasons $$, '42501', null, 'cannot delete seasons');
-- TRUNCATE skips RLS, so the privilege itself must be gone.
select throws_ok($$ truncate public.clubs cascade $$, '42501', null, 'cannot truncate clubs');
select throws_ok($$ truncate public.club_seasons $$, '42501', null, 'cannot truncate seasons');

-- Anon reads nothing
select tests.clear_authentication();
set local role anon;
select throws_ok($$ select * from public.clubs $$, '42501', null, 'anon cannot read clubs');
select throws_ok($$ select * from public.club_directory $$, '42501', null, 'anon cannot read the directory');
select throws_ok($$ select * from public.club_seasons $$, '42501', null, 'anon cannot read seasons');
select throws_ok($$ select * from public.leagues $$, '42501', null, 'anon cannot read leagues');
reset role;

-- Exact privileges: read-only for authenticated, nothing for anon
select table_privs_are('public', 'leagues', 'authenticated', array['SELECT'], 'authenticated only selects leagues');
select table_privs_are('public', 'clubs', 'authenticated', array['SELECT'], 'authenticated only selects clubs');
select table_privs_are('public', 'club_seasons', 'authenticated', array['SELECT'], 'authenticated only selects seasons');
select table_privs_are('public', 'club_directory', 'authenticated', array['SELECT'], 'authenticated only selects the directory');
select table_privs_are('public', 'clubs', 'anon', array[]::text[], 'anon has no privileges on clubs');

select is((select capacity from public.clubs where short_name = 'TST'), 1000, 'nothing was changed');

select * from finish();
rollback;
