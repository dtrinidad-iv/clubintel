-- Demo alert rules for Northbridge, evaluated once so the inbox has alerts after a reset.
-- Hand-written and fictional; named to load after demo-pipeline.sql (seeds load alphabetically). The rules are added as the demo
-- admin, through the same RLS and grants as the app.

select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-4222-8222-222222222222', 'role', 'authenticated')::text, false);
set role authenticated;

insert into public.alert_rules (type, days) values ('stale_opportunity', 30), ('close_date_passed', 0);
insert into public.alert_rules (type, club_id, drop_pct)
select 'attendance_drop', id, 5 from public.clubs where name = 'Ashmarket Town';

reset role;
select set_config('request.jwt.claims', null, false);

select public.evaluate_rules('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
