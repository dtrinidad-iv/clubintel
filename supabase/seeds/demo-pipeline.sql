-- Demo contacts and opportunities. Hand-written; loads after the generated clubs.sql.
-- It acts as the demo users, so rows go through the same triggers and RLS as the app:
-- workspace_id comes from each user's active workspace. All names are fictional.

create or replace function pg_temp.act_as(p_user uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, false);
$$;

create or replace function pg_temp.club(p_name text)
returns uuid
language sql
as $$
  select id from public.clubs where name = p_name;
$$;

-- New functions aren't executable by default (plan 09), not even in pg_temp.
grant execute on function pg_temp.club(text) to authenticated;

-- Northbridge Athletic Commercial, as its owner -----------------------------

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
set role authenticated;

insert into public.contacts (club_id, name, email, role_title, phone, notes) values
  (pg_temp.club('Northbridge Athletic'), 'Priya Lomax', 'priya.lomax@northbridge.example', 'Head of Partnerships', '+44 20 7946 0101', 'Owns the shirt and stadium naming deals.'),
  (pg_temp.club('Northbridge Athletic'), 'Tomas Reyburn', 'tomas.reyburn@northbridge.example', 'Hospitality Manager', '+44 20 7946 0102', null),
  (pg_temp.club('Kestrelby United'), 'Hannah Okafor', 'h.okafor@kestrelby.example', 'Commercial Director', null, 'Met at the regional sponsorship forum.'),
  (pg_temp.club('Glenmarrow Thistle'), 'Calum Brodie', 'calum@glenmarrow.example', 'Media Rights Lead', '+44 131 496 0200', null),
  (null, 'Marta Ilves', 'marta@brightlane-energy.example', 'Brand Manager, Brightlane Energy', null, 'Partner side: wants northern clubs with family audiences.'),
  (null, 'Owen Castell', 'owen.castell@harbourline.example', 'Sponsorship Lead, Harbourline Ferries', '+44 29 2018 0300', null);

insert into public.opportunities (club_id, contact_id, owner_id, title, partner_name, category, value_gbp, stage, expected_close_date, notes)
select pg_temp.club(o.club), c.id, o.owner::uuid, o.title, o.partner, o.category::public.opportunity_category,
       o.value, o.stage::public.opportunity_stage, o.close::date, o.notes
from (values
  ('Northbridge Athletic', 'Priya Lomax', '11111111-1111-4111-8111-111111111111', 'Front-of-shirt sponsorship 2027-29', 'Brightlane Energy', 'sponsorship', 1850000, 'negotiation', '2026-12-15', 'Three-year term, break clause after year two.'),
  ('Northbridge Athletic', 'Tomas Reyburn', '22222222-2222-4222-8222-222222222222', 'Ironside Park executive boxes', 'Calderbrook Legal', 'hospitality', 96000, 'proposal', '2026-11-30', null),
  ('Northbridge Athletic', 'Priya Lomax', '33333333-3333-4333-8333-333333333333', 'Training kit partner', 'Fellstride Outdoor', 'partnership', 240000, 'qualified', '2027-02-01', null),
  ('Northbridge Athletic', null, '33333333-3333-4333-8333-333333333333', 'Matchday programme advertising', 'Quayside Motors', 'media', 18500, 'lead', null, null),
  ('Kestrelby United', 'Hannah Okafor', '11111111-1111-4111-8111-111111111111', 'Stadium naming rights', 'Harbourline Ferries', 'sponsorship', 3200000, 'qualified', '2027-06-30', 'Board approval needed on their side.'),
  ('Kestrelby United', 'Hannah Okafor', '22222222-2222-4222-8222-222222222222', 'Away-end hospitality refit', 'Mossgate Catering', 'hospitality', 42000, 'lost', '2026-09-01', 'Went with an in-house option.'),
  ('Glenmarrow Thistle', 'Calum Brodie', '33333333-3333-4333-8333-333333333333', 'Highlights streaming rights', 'Northlight Media', 'media', 310000, 'won', '2026-08-20', null),
  ('Glenmarrow Thistle', null, '22222222-2222-4222-8222-222222222222', 'Community trust partnership', 'Brightlane Energy', 'partnership', 55000, 'proposal', '2026-12-01', null),
  ('Wrenfield Albion', null, '11111111-1111-4111-8111-111111111111', 'Sleeve sponsorship', 'Harbourline Ferries', 'sponsorship', 720000, 'lead', '2027-03-31', null),
  ('Caerwen City', 'Owen Castell', '33333333-3333-4333-8333-333333333333', 'Welsh-language broadcast package', 'Harbourline Ferries', 'media', 130000, 'negotiation', '2026-11-15', null),
  ('Llanferrow Town', null, null, 'Youth academy partner', 'Fellstride Outdoor', 'partnership', 35000, 'lead', null, 'Unassigned: needs an owner.'),
  ('Pontyrhew Athletic', null, '22222222-2222-4222-8222-222222222222', 'Matchday hospitality packages', 'Calderbrook Legal', 'hospitality', 24000, 'won', '2026-07-10', null)
) as o(club, contact, owner, title, partner, category, value, stage, close, notes)
left join public.contacts c on c.name = o.contact;

-- A year of closed deals for the dashboard, and an open one that's overdue. Close dates are
-- relative, so the demo stays current.
insert into public.opportunities (club_id, owner_id, title, partner_name, category, value_gbp, stage, expected_close_date)
select pg_temp.club(o.club), o.owner::uuid, o.title, o.partner, o.category::public.opportunity_category,
       o.value, o.stage::public.opportunity_stage, (current_date + o.close_in)::date
from (values
  ('Northbridge Athletic', '11111111-1111-4111-8111-111111111111', 'Kit supplier extension', 'Fellstride Outdoor', 'sponsorship', 145000, 'won', -330),
  ('Kestrelby United', '22222222-2222-4222-8222-222222222222', 'Concourse naming', 'Quayside Motors', 'sponsorship', 90000, 'lost', -240),
  ('Northbridge Athletic', '33333333-3333-4333-8333-333333333333', 'Stadium LED boards', 'Quayside Motors', 'media', 82000, 'won', -270),
  ('Wrenfield Albion', '11111111-1111-4111-8111-111111111111', 'Family stand partner', 'Brightlane Energy', 'partnership', 120000, 'won', -210),
  ('Glenmarrow Thistle', '33333333-3333-4333-8333-333333333333', 'Club podcast sponsorship', 'Northlight Media', 'media', 26000, 'won', -150),
  ('Caerwen City', '22222222-2222-4222-8222-222222222222', 'Esports partnership', 'Northlight Media', 'partnership', 40000, 'lost', -90),
  ('Northbridge Athletic', '22222222-2222-4222-8222-222222222222', 'Winter fixtures hospitality', 'Calderbrook Legal', 'hospitality', 58000, 'won', 0),
  ('Kestrelby United', '33333333-3333-4333-8333-333333333333', 'Fan app sponsorship', 'Harbourline Ferries', 'media', 64000, 'negotiation', -5)
) as o(club, owner, title, partner, category, value, stage, close_in);

reset role;

-- Backdate when deals reached their stage (triggers off, as postgres), spreading the closed
-- deals over the year and leaving two leads stale. "Winter fixtures hospitality" stays at now,
-- so there's always a win this quarter.
set session_replication_role = replica;
update public.opportunities o set stage_changed_at = now() - b.ago
from (values
  ('Kit supplier extension', interval '330 days'),
  ('Concourse naming', interval '240 days'),
  ('Stadium LED boards', interval '270 days'),
  ('Family stand partner', interval '210 days'),
  ('Club podcast sponsorship', interval '150 days'),
  ('Esports partnership', interval '90 days'),
  ('Matchday hospitality packages', interval '110 days'),
  ('Highlights streaming rights', interval '65 days'),
  ('Away-end hospitality refit', interval '55 days'),
  ('Matchday programme advertising', interval '45 days'),
  ('Youth academy partner', interval '40 days'),
  ('Fan app sponsorship', interval '12 days')
) as b(title, ago)
where o.title = b.title and o.workspace_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set session_replication_role = origin;

-- Demo Sports Agency, as its owner -----------------------------------------

select pg_temp.act_as('55555555-5555-4555-8555-555555555555');
set role authenticated;

insert into public.contacts (club_id, name, email, role_title) values
  (pg_temp.club('Saltcombe Vale Rovers'), 'Ines Varga', 'ines@saltcombe.example', 'Head of Commercial');

insert into public.opportunities (club_id, contact_id, owner_id, title, partner_name, category, value_gbp, stage, expected_close_date)
select pg_temp.club('Saltcombe Vale Rovers'), (select id from public.contacts where name = 'Ines Varga'),
       '55555555-5555-4555-8555-555555555555', 'Agency retainer: sponsor search', 'Saltcombe Vale Rovers', 'partnership', 60000, 'proposal', '2026-12-20';

reset role;
select set_config('request.jwt.claims', null, false);
