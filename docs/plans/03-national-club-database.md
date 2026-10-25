# 03 — National club database

**Status:** Done
**Commits:** `0972c92` (db), `740b739` (web), `da48ecc` (tests), `fb761c8` (claude)

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

## Notes from the build
- **Leagues:** five leagues in four tiers. Tier 4 is split into *Demo League Two North* and *South*, so filtering by tier differs from filtering by league. That makes 42 clubs and 210 club-seasons (2021/22 to 2025/26). League ids are slugs (`league-one`), so filter URLs are readable.
- **Search** runs on a `club_directory` view (`security_invoker = true`): each club with its league and latest season, so one query does the filters, the count and the ordering (tier, league, position). Name search is `ilike` with `%`, `_` and `\` escaped, using the `pg_trgm` index.
- **Seed:** the generator writes `supabase/seeds/clubs.sql`, a separate file rather than part of `seed.sql`, and `config.toml` now loads `./seeds/*.sql` after `seed.sql`. Generated data never mixes with the hand-written accounts.
- **URL parsing:** `parseClubSearch` drops invalid values instead of failing, so stale or hand-edited links (and API calls) still return results. The API documents this.
- **Instant navigation:** each page renders its static parts (header, back link) and wraps its data in its own `<Suspense>`. Without that, Next 16 flags the route for blocking client navigations, because the `(app)` layout's boundary only covers full page loads. Recorded in `CLAUDE.md`.
- **Charts:** both are single-axis. Attendance (bars) and capacity (dashed line) are both head counts, and they differ by mark type, not just color. The position axis is reversed so 1st is at the top. Animations are off, and a season table gives the same numbers as text.
- **API access:** the API needs only a session (`getUser()`), not a workspace, because RLS lets any signed-in user read shared data. The pages need a workspace only because they live in the app shell.
- **Not-found status:** `/clubs/[id]` calls `notFound()` inside its Suspense boundary, so a missing club returns 200 with `noindex` rather than 404. That's the cost of an instant navigation; the API returns a real 404.
- **Reviews:** `code-reviewer`, `security-auditor`, `rls-reviewer` and `ui-reviewer` all ran. Fixed from them:
  - **API paging:** past the last page, the API now reports the real total.
  - **Filters:** quick changes no longer overwrite each other (`useOptimistic`), and typed text carries over into select changes.
  - **Query parsing:** repeated params resolve the same on the page and in the API.
  - **League size:** "Nth of M" uses the league of that season.
  - **Search:** `*` is stripped from search terms.
  - **API errors:** returned as JSON.
  - **Filter options:** tiers come from the data, and an unknown league id is ignored.
  - **Layout:** fixed horizontal scroll at 768px (`min-w-0` on the app layout's inset and main), and the disabled pager button no longer wraps.
  - **pgTAP:** now covers the newest season, TRUNCATE and the exact privilege lists.
- **Dependency:** `recharts`, through the shadcn `chart` component, as the plan said.

## Follow-ups
- `/dashboard` reads data outside a page-level `<Suspense>` and logs the same "uncached data" error (from plan 01). Fix it the way the clubs pages do.
- Hydration mismatch in the sidebar at mobile widths: the server renders the desktop sidebar and the client renders the sheet (`useIsMobile`). From plan 01.
- **Foundation grants (from `rls-reviewer`, plan 01, fix before plan 04):**
  - `authenticated` still has TRUNCATE, REFERENCES and TRIGGER on `workspaces`, `profiles` and `memberships`. TRUNCATE skips RLS. PostgREST can't issue it today, but it should go: `revoke all`, then grant back only what's used.
  - Default privileges in `public` still give new tables every privilege for anon and authenticated, so every new table must start with `revoke all … from anon, authenticated`.
  - `alter default privileges in schema public revoke execute on functions from public, anon` has no effect, because it can't remove the global default. New functions are executable by PUBLIC until revoked one by one.

  Fix all three in a new migration, with a pgTAP check that anon can execute no function in `public`.
- **Plan 04, from `rls-reviewer`:** tenant tables can reference `clubs` freely, since the data is shared. Use `on delete restrict`, and never put tenant columns in `club_directory`.
- **Rate limiting:** add a per-user limit on `/api/v1/*` when the shared rate limiter lands.
- The club seed only runs locally. A hosted project needs it loaded once by a migration or a one-off script (plan 08, deploy docs).
