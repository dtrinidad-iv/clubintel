-- Contacts: workspace A can't read, write or reference workspace B's rows, and each role gets
-- exactly its permissions. Every refusal sits next to the allowed case.
begin;
select plan(23);

-- Setup ----------------------------------------------------------------------

create temp table ids (k text primary key, v uuid) on commit drop;
grant all on ids to authenticated;
create function pg_temp.id(p text) returns uuid language sql as $$ select v from ids where k = p $$;
grant execute on function pg_temp.id(text) to authenticated;

insert into public.leagues (id, name, tier) values ('contact-test', 'Contact Test League', 9);
insert into public.clubs (id, name, short_name, league_id, region, city, stadium, capacity)
values ('00000000-0000-4000-8000-0000000000c2', 'Contact Test Club', 'CTC', 'contact-test', 'wales', 'X', 'X', 1000);
insert into ids values
  ('club', '00000000-0000-4000-8000-0000000000c2'),
  ('owner_a', tests.create_user('contact-owner-a@test.local')),
  ('analyst_a', tests.create_user('contact-analyst-a@test.local')),
  ('viewer_a', tests.create_user('contact-viewer-a@test.local')),
  ('owner_b', tests.create_user('contact-owner-b@test.local'));

select tests.authenticate_as(pg_temp.id('owner_a'));
insert into ids values ('ws_a', public.create_workspace('Contacts A'));
select tests.authenticate_as(pg_temp.id('owner_b'));
insert into ids values ('ws_b', public.create_workspace('Contacts B'));
with c as (insert into public.contacts (name, email) values ('B person', 'b@b.example') returning id)
insert into ids select 'contact_b', id from c;

select tests.clear_authentication();
select tests.add_member(pg_temp.id('ws_a'), pg_temp.id('analyst_a'), 'analyst');
select tests.add_member(pg_temp.id('ws_a'), pg_temp.id('viewer_a'), 'viewer');
update public.profiles set current_workspace_id = pg_temp.id('ws_a')
where id in (pg_temp.id('analyst_a'), pg_temp.id('viewer_a'));

-- Analyst: create, read, edit; not delete ----------------------------------

select tests.authenticate_as(pg_temp.id('analyst_a'));
select lives_ok(
  format($$ insert into public.contacts (club_id, name, email, role_title) values (%L, 'A person', 'a@a.example', 'Buyer') $$, pg_temp.id('club')),
  'analyst adds a contact'
);
insert into ids select 'contact_a', id from public.contacts where name = 'A person';
select is((select workspace_id from public.contacts where id = pg_temp.id('contact_a')), pg_temp.id('ws_a'), 'it lands in the active workspace');
select lives_ok(format($$ update public.contacts set phone = '0100' where id = %L $$, pg_temp.id('contact_a')), 'analyst edits it');
select is((select phone from public.contacts where id = pg_temp.id('contact_a')), '0100', 'the edit took effect');
delete from public.contacts where id = pg_temp.id('contact_a');
select is((select count(*)::int from public.contacts where id = pg_temp.id('contact_a')), 1, 'analyst cannot delete (no contacts.delete)');
select throws_ok($$ insert into public.contacts (name, email) values ('Bad', 'not-an-email') $$, '23514', null, 'the database refuses a malformed email');
select throws_ok($$ insert into public.contacts (name, email) values ('Bad', 'a@b.co?subject=Pay') $$, '23514', null, 'and an email that would add mailto: headers');
select throws_ok($$ insert into public.contacts (name, phone) values ('Bad', '123;ext=evil') $$, '23514', null, 'and a phone that is not a number');

-- Isolation --------------------------------------------------------------------

select is((select count(*)::int from public.contacts where id = pg_temp.id('contact_b')), 0, 'A cannot see B''s contact');
update public.contacts set name = 'Hijacked' where id = pg_temp.id('contact_b');
select throws_ok(
  format($$ insert into public.contacts (workspace_id, name) values (%L, 'Forged') $$, pg_temp.id('ws_b')),
  '42501', null, 'an insert naming B''s workspace is refused'
);
select throws_ok(
  format($$ insert into public.contacts (id, name) values (%L, 'Probe') $$, pg_temp.id('contact_b')),
  '42501', null, 'cannot choose an id, so B''s ids cannot be probed'
);
select throws_ok(
  format($$ update public.contacts set id = %L where id = %L $$, pg_temp.id('contact_b'), pg_temp.id('contact_a')),
  '42501', null, 'cannot change an id'
);
select throws_ok(
  format($$ update public.contacts set workspace_id = %L where id = %L $$, pg_temp.id('ws_b'), pg_temp.id('contact_a')),
  '42501', null, 'cannot move a contact to B'
);

-- Viewer reads only ------------------------------------------------------------

select tests.authenticate_as(pg_temp.id('viewer_a'));
select is((select count(*)::int from public.contacts where id = pg_temp.id('contact_a')), 1, 'viewer reads A''s contact');
select throws_ok($$ insert into public.contacts (name) values ('V') $$, '42501', null, 'viewer cannot add');
update public.contacts set name = 'Viewer edit' where id = pg_temp.id('contact_a');
delete from public.contacts where id = pg_temp.id('contact_a');

-- Owner deletes; a deleted contact only unlinks its opportunities ----------------

select tests.authenticate_as(pg_temp.id('owner_a'));
with o as (
  insert into public.opportunities (club_id, contact_id, title, partner_name, category)
  values (pg_temp.id('club'), pg_temp.id('contact_a'), 'Linked deal', 'X', 'media') returning id
)
insert into ids select 'opp_a', id from o;
delete from public.contacts where id = pg_temp.id('contact_b');
select lives_ok(format($$ delete from public.contacts where id = %L $$, pg_temp.id('contact_a')), 'owner deletes the contact');
select is((select count(*)::int from public.contacts where id = pg_temp.id('contact_a')), 0, 'and it is gone');
select is((select count(*)::int from public.opportunities where id = pg_temp.id('opp_a')), 1, 'its opportunity stays');
select is((select contact_id from public.opportunities where id = pg_temp.id('opp_a')), null, 'with the contact cleared');

-- Read back as postgres --------------------------------------------------------

select tests.clear_authentication();
select is((select name from public.contacts where id = pg_temp.id('contact_b')), 'B person', 'A''s update did not reach B');
select is((select count(*)::int from public.contacts where id = pg_temp.id('contact_b')), 1, 'A''s delete did not reach B');
select is((select count(*)::int from public.contacts where name = 'Viewer edit'), 0, 'viewer''s update changed nothing');
select is(
  (select workspace_id from public.opportunities where id = pg_temp.id('opp_a')), pg_temp.id('ws_a'),
  'the unlinked opportunity is still in A'
);

select * from finish();
rollback;
