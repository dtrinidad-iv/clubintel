# 03 — National club database

**Status:** Proposed

## Goal
A shared, searchable database of clubs across fictional national leagues. It's reference data every workspace reads, alongside the tenant-owned data. Each club has a profile page with attendance history.

## Decisions
- **Shared data, not tenant data.** `leagues`, `clubs` and `club_seasons` have no `workspace_id`. Any signed-in user can select them. There are no write policies, so only migrations and seed (service role) write them. `rls-reviewer` confirms nothing tenant-owned joins in unscoped.
- All names are fictional: ~40 clubs in 4 tiers ("Demo Premier Division" … "Demo League Two") across regions (England North/South/Midlands, Scotland, Wales, Northern Ireland, Ireland), with 5 seasons of attendance, capacity and league position.
- **Search on the server**: `searchParams` (`q`, `league`, `region`, `tier`, `page`) → a Supabase query with `ilike` and a `pg_trgm` index on the name.
- **REST**: `GET /api/v1/clubs` and `GET /api/v1/clubs/{id}`. They need a session, return JSON with pagination meta, and are described in the README as the integration surface for external tools.

## Database
Migration with the tables, indexes and read policies. Seed in `supabase/seed.sql`, from a generator script, `scripts/generate-clubs.mjs`, so the data is reproducible.

## App
- `/clubs`: filters, a responsive table (cards on mobile), and pagination.
- `/clubs/[id]`: club details, an attendance vs capacity chart (shadcn chart on Recharts), and a league position trend.
- "Clubs" added to the sidebar nav.

## Tests
- pgTAP: authenticated users can read; anon can't; nobody can insert, update or delete as authenticated.
- Vitest: search param parsing (zod).
- Playwright: filter by league → URL updates → results narrow → open a profile.

## Verification
`/verify`, plus `ui-reviewer` at 375/768/1280.
