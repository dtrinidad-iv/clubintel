-- National club database: leagues, clubs and their season history.
--
-- Shared reference data, not tenant data: no workspace_id. Any signed-in user can read it.
-- There are no write policies or grants, so only migrations and the seed (as postgres) write it.

create extension if not exists pg_trgm with schema extensions;

create type public.club_region as enum (
  'england-north', 'england-midlands', 'england-south', 'scotland', 'wales', 'northern-ireland', 'ireland'
);

create table public.leagues (
  id text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  name text not null unique check (char_length(name) between 1 and 80),
  tier smallint not null check (tier between 1 and 10)
);

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 80),
  short_name text not null check (char_length(short_name) between 1 and 12),
  league_id text not null references public.leagues (id),
  region public.club_region not null,
  city text not null check (char_length(city) between 1 and 80),
  stadium text not null check (char_length(stadium) between 1 and 80),
  capacity int not null check (capacity > 0),
  founded smallint check (founded between 1850 and 2100)
);

create index clubs_league_id_idx on public.clubs (league_id);
create index clubs_region_idx on public.clubs (region);
-- Substring search on the name (ilike '%…%') uses this index.
create index clubs_name_trgm_idx on public.clubs using gin (name extensions.gin_trgm_ops);

-- One row per club per season. season is the starting year: 2025 is the 2025/26 season.
create table public.club_seasons (
  club_id uuid not null references public.clubs (id) on delete cascade,
  season smallint not null check (season between 1900 and 2100),
  league_id text not null references public.leagues (id),
  league_position smallint not null check (league_position between 1 and 40),
  avg_attendance int not null check (avg_attendance >= 0),
  capacity int not null check (capacity > 0),
  primary key (club_id, season),
  unique (league_id, season, league_position)
);

-- Each club with its league and latest season, for search and listing. Runs as the caller.
create view public.club_directory with (security_invoker = true) as
select
  c.id, c.name, c.short_name, c.region, c.city, c.stadium, c.capacity, c.founded,
  l.id as league_id, l.name as league_name, l.tier,
  s.season as latest_season, s.league_position, s.avg_attendance
from public.clubs c
join public.leagues l on l.id = c.league_id
left join lateral (
  select cs.season, cs.league_position, cs.avg_attendance
  from public.club_seasons cs
  where cs.club_id = c.id
  order by cs.season desc
  limit 1
) s on true;

-- ---------------------------------------------------------------------------
-- Access: read-only for signed-in users, nothing for anon
-- ---------------------------------------------------------------------------

alter table public.leagues enable row level security;
alter table public.clubs enable row level security;
alter table public.club_seasons enable row level security;

create policy "signed-in users read leagues" on public.leagues for select to authenticated using (true);
create policy "signed-in users read clubs" on public.clubs for select to authenticated using (true);
create policy "signed-in users read club seasons" on public.club_seasons for select to authenticated using (true);

revoke all on public.leagues, public.clubs, public.club_seasons, public.club_directory from anon, authenticated;
grant select on public.leagues, public.clubs, public.club_seasons, public.club_directory to authenticated;
