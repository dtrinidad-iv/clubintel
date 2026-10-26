-- Workspaces, memberships and permissions: workspace A can't see or change workspace B.
begin;
select plan(34);

-- Setup: owner A of workspace A (with an admin, analyst and viewer), owner B of workspace B.
create temp table ids (k text primary key, v uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values
  ('owner_a', tests.create_user('owner-a@test.local')),
  ('admin_a', tests.create_user('admin-a@test.local')),
  ('analyst_a', tests.create_user('analyst-a@test.local')),
  ('viewer_a', tests.create_user('viewer-a@test.local')),
  ('owner_b', tests.create_user('owner-b@test.local')),
  ('outsider', tests.create_user('outsider@test.local'));
create function pg_temp.id(p text) returns uuid language sql as $$ select v from ids where k = p $$;
-- New functions aren't executable by default (deny by default, plan 09), even in pg_temp.
grant execute on function pg_temp.id(text) to authenticated;

select tests.authenticate_as(pg_temp.id('owner_a'));
insert into ids values ('ws_a', public.create_workspace('Workspace A'));
select tests.authenticate_as(pg_temp.id('owner_b'));
insert into ids values ('ws_b', public.create_workspace('Workspace B'));
select tests.clear_authentication();
select tests.add_member(pg_temp.id('ws_a'), pg_temp.id('admin_a'), 'admin');
select tests.add_member(pg_temp.id('ws_a'), pg_temp.id('analyst_a'), 'analyst');
select tests.add_member(pg_temp.id('ws_a'), pg_temp.id('viewer_a'), 'viewer');

-- create_workspace makes you the owner and switches to it
select tests.authenticate_as(pg_temp.id('owner_a'));
select is((select role from public.current_workspace()), 'owner'::public.workspace_role, 'creator is the owner');
select is((select id from public.current_workspace()), pg_temp.id('ws_a'), 'creator is switched to the new workspace');

-- Isolation: A sees only A
select is((select count(*)::int from public.workspaces), 1, 'owner A sees exactly one workspace');
select is((select count(*)::int from public.workspaces where id = pg_temp.id('ws_b')), 0, 'owner A cannot see workspace B');
select is((select count(*)::int from public.memberships where workspace_id = pg_temp.id('ws_b')), 0, 'owner A cannot see B memberships');
select throws_ok(format('select public.switch_workspace(%L)', pg_temp.id('ws_b')), '42501', null, 'owner A cannot switch to workspace B');
select throws_ok(format('select * from public.workspace_members(%L)', pg_temp.id('ws_b')), '42501', null, 'owner A cannot list B members');
select throws_ok(format('select public.add_member_by_email(%L, %L, %L)', pg_temp.id('ws_b'), 'outsider@test.local', 'viewer'), '42501', null, 'owner A cannot add members to B');
update public.workspaces set name = 'Hacked' where id = pg_temp.id('ws_b');
select tests.clear_authentication();
select is((select name from public.workspaces where id = pg_temp.id('ws_b')), 'Workspace B', 'owner A cannot rename workspace B');

-- Direct writes are refused; RPCs are the only way in
select tests.authenticate_as(pg_temp.id('owner_a'));
select throws_ok(format('insert into public.memberships values (%L, %L, %L)', pg_temp.id('ws_b'), pg_temp.id('owner_a'), 'owner'), '42501', null, 'cannot insert a membership directly');
select throws_ok(format('insert into public.workspaces (name) values (%L)', 'Direct'), '42501', null, 'cannot insert a workspace directly');
select throws_ok(format('update public.profiles set current_workspace_id = %L', pg_temp.id('ws_b')), '42501', null, 'cannot set current_workspace_id directly');
select lives_ok($$ update public.profiles set full_name = 'Renamed' $$, 'can update own full_name');

-- Switching and current_workspace
select tests.authenticate_as(pg_temp.id('outsider'));
select is((select count(*)::int from public.current_workspace()), 0, 'outsider has no current workspace');
select is(public.my_permissions(pg_temp.id('ws_a')), '{}'::text[], 'outsider has no permissions in A');

-- can() matrix
select tests.authenticate_as(pg_temp.id('owner_a'));
select ok(public.can(pg_temp.id('ws_a'), 'members.manage'), 'owner can manage members');
select tests.authenticate_as(pg_temp.id('admin_a'));
select ok(public.can(pg_temp.id('ws_a'), 'members.manage'), 'admin can manage members');
select tests.authenticate_as(pg_temp.id('analyst_a'));
select ok(not public.can(pg_temp.id('ws_a'), 'members.manage'), 'analyst cannot manage members');
select ok(public.can(pg_temp.id('ws_a'), 'members.view'), 'analyst can view members');
select tests.authenticate_as(pg_temp.id('viewer_a'));
select ok(not public.can(pg_temp.id('ws_a'), 'workspace.manage'), 'viewer cannot manage the workspace');
update public.workspaces set name = 'Viewer rename' where id = pg_temp.id('ws_a');
select is((select name from public.workspaces where id = pg_temp.id('ws_a')), 'Workspace A', 'viewer cannot rename the workspace');

-- Rank rules
select throws_ok(format('select public.set_member_role(%L, %L, %L)', pg_temp.id('ws_a'), pg_temp.id('analyst_a'), 'viewer'), '42501', null, 'viewer cannot change roles');
select tests.authenticate_as(pg_temp.id('admin_a'));
select lives_ok(format('select public.set_member_role(%L, %L, %L)', pg_temp.id('ws_a'), pg_temp.id('analyst_a'), 'viewer'), 'admin can demote an analyst');
select throws_ok(format('select public.set_member_role(%L, %L, %L)', pg_temp.id('ws_a'), pg_temp.id('analyst_a'), 'admin'), '42501', null, 'admin cannot grant admin');
select throws_ok(format('select public.set_member_role(%L, %L, %L)', pg_temp.id('ws_a'), pg_temp.id('owner_a'), 'viewer'), '42501', null, 'admin cannot change the owner');
select throws_ok(format('select public.remove_member(%L, %L)', pg_temp.id('ws_a'), pg_temp.id('owner_a')), '42501', null, 'admin cannot remove the owner');
select throws_ok(format('select public.set_member_role(%L, %L, %L)', pg_temp.id('ws_a'), pg_temp.id('admin_a'), 'viewer'), '42501', null, 'nobody changes their own role');
select tests.authenticate_as(pg_temp.id('owner_a'));
select throws_ok(format('select public.add_member_by_email(%L, %L, %L)', pg_temp.id('ws_a'), 'outsider@test.local', 'owner'), '42501', null, 'nobody grants owner');
-- An account whose email isn't confirmed is treated as no account.
select tests.clear_authentication();
update auth.users set email_confirmed_at = null where email = 'outsider@test.local';
select tests.authenticate_as(pg_temp.id('owner_a'));
select throws_ok(format('select public.add_member_by_email(%L, %L, %L)', pg_temp.id('ws_a'), 'outsider@test.local', 'admin'), 'P0002', 'No account uses that email', 'an unconfirmed account can''t be added');
select tests.clear_authentication();
update auth.users set email_confirmed_at = now() where email = 'outsider@test.local';
select tests.authenticate_as(pg_temp.id('owner_a'));
select lives_ok(format('select public.add_member_by_email(%L, %L, %L)', pg_temp.id('ws_a'), 'OUTSIDER@test.local', 'admin'), 'owner adds an admin by email (case-insensitive)');

-- Removal ends access at once
select tests.authenticate_as(pg_temp.id('viewer_a'));
select lives_ok(format('select public.switch_workspace(%L)', pg_temp.id('ws_a')), 'viewer switches to A');
select tests.authenticate_as(pg_temp.id('owner_a'));
select lives_ok(format('select public.remove_member(%L, %L)', pg_temp.id('ws_a'), pg_temp.id('viewer_a')), 'owner removes the viewer');
select tests.authenticate_as(pg_temp.id('viewer_a'));
select is((select count(*)::int from public.current_workspace()), 0, 'removed viewer has no current workspace');
select is((select count(*)::int from public.workspaces), 0, 'removed viewer sees no workspaces');

select * from finish();
rollback;
