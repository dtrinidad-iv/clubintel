# 05 — Intelligence dashboard

**Status:** Done
**Commits:** `69b35a1` (db), `4e5c0d0` (web), `c2a06bf` (tests), `97f2edd` (claude)

## Goal
Replace the placeholder `/dashboard` with commercial intelligence for the active workspace: headline numbers, pipeline charts and upcoming close dates, plus national context from the club database. Every number is aggregated in Postgres, so it counts all of the workspace's deals, not the 500 rows the opportunities page shows (plan 04 follow-up).

Out of scope: date-range filters, per-owner breakdowns, exports, and anything AI (plan 06) or alert-driven (plan 07).

## Decisions
- **Aggregation in SQL**, as invoker functions (`language sql stable`, `set search_path = ''`). RLS applies inside them. They count only the active workspace (`current_workspace_id()`), so they take no workspace argument the client could change. One function per chart keeps the generated types exact, instead of one loosely typed `dashboard_series()`.
- **Definitions** (all dates in Europe/London, the clubs' time zone):
  - **Open pipeline:** the summed value and count of deals in lead, qualified, proposal or negotiation.
  - **Won this quarter:** deals in `won` whose `stage_changed_at` falls in the current calendar quarter. `stage_changed_at` is when a deal last changed stage (plan 04), so for a won deal it's when it was won.
  - **Win rate:** won ÷ (won + lost), counting deals closed in the last 12 months. "The last 12 months" always means the won-by-month chart's window, this month and the 11 before it. It shows "–" when nothing has closed.
  - **Average deal size:** the average value of deals won in the last 12 months.
  - **Stale:** open deals with no stage change in 30 days.
- **Charts:**
  - **Open pipeline by stage:** a bar chart with all four open stages, zero-filled.
  - **Won value by month:** a line chart over the last 12 months including this one, zero-filled.
  - **Open value by league tier:** a bar chart, using the tier of the club's current league.
  - **National attendance vs capacity by tier:** the latest season in `club_seasons`, drawn like the club page's chart (attendance bars, dashed capacity line, one axis).
  - The charts are single-series, so the existing `--chart-2` token is enough and no categorical palette is needed.
  - Each chart is `role="img"` with a label, plus a visually hidden table of the same numbers.
- **Upcoming close dates:** the next six open deals by expected close date. Overdue ones are listed first and marked "Overdue" in text, not only colour. "Today" comes from SQL, in London time.
- **Layout:**
  - KPI tiles: 1 column on a phone, 2 at `sm`, 3 at `lg`, all 5 in a row at `xl`.
  - Charts: 1 column, then 2 at `lg`.
  - Each section has its own `<Suspense>` with a skeleton, under a static `PageHeader`, which also fixes the plan 03 follow-up about the dashboard's missing Suspense.
  - `dashboard/error.tsx` uses `RouteError`.
- **Permissions:** the pipeline sections need `opportunities.view`. Every role has it today, but the page checks rather than assumes. The national section only needs a signed-in user.
- **Empty workspace:** the KPIs show zeros. The pipeline charts show an empty state, with "Add an opportunity" for members who can write.
- **Demo data:** `supabase/seeds/demo-pipeline.sql` gains won and lost deals spread over the past year, plus two stale deals. Their `stage_changed_at` is set relative to `now()` (backdated with triggers off, as the pgTAP tests do), so the demo always looks current. Agency data and the rows plan 04's tests rely on stay as they are.
- No new dependency: recharts and the shadcn chart are already in from plan 03.

## Database (`supabase/migrations/`)
New migration `dashboard`. Every function is `security invoker`, `stable` and `set search_path = ''`, with `grant execute … to authenticated`. Each is added to the allowlist in `grants.test.sql`.
- `dashboard_kpis()` returns one row: `open_value`, `open_count`, `won_quarter_value`, `won_quarter_count`, `won_12m_count`, `lost_12m_count`, `avg_won_value`, `stale_count`.
- `dashboard_pipeline_by_stage()` → `(stage, value, deals)`, the four open stages in enum order.
- `dashboard_won_by_month()` → `(month date, value, deals)`, 12 rows, oldest first.
- `dashboard_value_by_tier()` → `(tier, value, deals)` for every tier in `leagues`.
- `dashboard_upcoming()` → `(id, title, partner_name, club_id, club_name, stage, value_gbp, expected_close_date, overdue)`, up to six rows.
- `national_attendance_by_tier()` → `(season, tier, clubs, avg_attendance, avg_capacity)`, reading shared data only.
- An index on `opportunities (workspace_id, stage, stage_changed_at)` for the date filters.

No new tables or permissions.

## App (`src/`)
- `src/lib/dashboard.ts` (`server-only`): one typed loader per section, calling the RPCs through `createClient()`.
- `src/app/(app)/dashboard/page.tsx` has a static header and the sections `Kpis`, `PipelineCharts`, `Upcoming` and `National`, each in its own `<Suspense>`. `error.tsx` sits beside it.
- `src/components/dashboard/`:
  - `dashboard-sections.tsx` (server): the KPI tiles, each chart card with its sr-only data table, the upcoming list, empty states and skeletons;
  - `dashboard-charts.tsx` (client, recharts via `ChartContainer`).
- `src/lib/format.ts` gains `formatMonth("2026-10-01")` → "Oct 26" (UTC, so the server and client agree) and `formatPercent`.

## Tests
- **pgTAP** (`dashboard.test.sql`):
  - Two workspaces with known deals; each caller gets exact sums for its own workspace only, and switching workspace switches the numbers.
  - A user with no workspace gets zeros.
  - The quarter boundary: a deal won last quarter is out of "this quarter" but in the 12-month figures.
  - Stale: 31 days counts, 29 doesn't.
  - Months and tiers are zero-filled.
  - Overdue is flagged, and won or lost deals are excluded from upcoming.
  - The national figures match a direct aggregate.
- **Vitest:** `formatMonth` and `formatPercent`.
- **Playwright:**
  - A new user's empty workspace shows zero KPIs and the empty state. Adding a won £12,345 deal shows "£12,345" as won this quarter, with a win rate of 100%.
  - The demo owner sees all five tiles and the charts.
  - On a phone, the tiles stack (`@mobile`).

## Verification
`/verify all`, then `code-reviewer`, `security-auditor`, `rls-reviewer` and `ui-reviewer` at 390, 768 and 1280.

Flows:
1. Sign in as `owner@` (Northbridge). The dashboard shows five tiles with non-zero values, four charts, and an upcoming list that includes an overdue deal.
2. Switch to Demo Sports Agency. The numbers drop to that workspace's single proposal deal.
3. Sign in as `viewer@`. The same dashboard appears, with no write buttons in the empty states.
4. Sign up a new user and create a workspace. The KPIs show zeros and the charts show empty states; the national chart still shows data.
5. On the opportunities page, move a deal to Won, then go back to the dashboard. "Won this quarter" has gone up by the deal's value.

## Commits after approval
`feat(db): dashboard aggregates`, `feat(web): intelligence dashboard`, `test: dashboard aggregates and flows`, then this plan → Done.

## Notes
- The new `(workspace_id, stage, stage_changed_at)` index replaces plan 04's `(workspace_id, stage)` index, which it covers.
- **Plan 03 follow-ups, both fixed:**
  - **Dashboard Suspense:** the dashboard now has a Suspense boundary per section.
  - **Sidebar hydration at mobile widths:** `SidebarProvider` hydrates in the static shell and switches to mobile at once. The sidebar itself streams in later and hydrated as the mobile sheet, against server HTML for the desktop sidebar. `Sidebar` (`src/components/ui/sidebar.tsx`) now always renders the desktop sidebar, which CSS hides below `md`, and adds the sheet on mobile. While the sheet is open, the hidden desktop copy renders empty, so its contents exist once, apart from the sheet's closing animation.
- **Page header:** the static header is now "Dashboard", with no per-user welcome. The user's name needs the session, which the static shell can't read.
- **Hidden routes in e2e tests:** Next keeps visited routes in the DOM, hidden. The dashboard's screen-reader tables and chart labels then matched broad locators in `clubs.spec.ts` (`tbody tr`, `getByLabel("League")`). Those locators now go by role and are scoped to the visible table.

- **Reviews:**
  - **Code, security, RLS and UI:** no critical, high or medium findings that weren't fixed.
  - **Fixed after review:**
    - **12-month window:** win rate and average deal size now use the won-by-month chart's window.
    - **Tests:** a pgTAP case pins Europe/London (a win 30 minutes into the quarter); a test proves a removed member gets zeros; another checks that the functions stay `security invoker`. The `@mobile` e2e test fails on any hydration error. Without the sidebar fix it fails, and with it it passes.
    - **Smaller fixes:** the seed's backdating is scoped to Northbridge. `dashboard_upcoming` no longer returns columns the page doesn't show. Upcoming links cut their search text to `SEARCH_MAX`. On tablet, the fifth KPI tile spans the row. Charts show a focus ring.

## Follow-ups
- ~~**Upcoming links:** they search the opportunities list by title, so a short title can match other deals too.~~ Fixed in plan 07: they link to `/opportunities?id=…`.
- **Skip link:** the sidebar comes after the page content in the DOM, so keyboard users reach the navigation last on every page. Add a "Skip to navigation"/"Skip to content" link in the `(app)` layout.
- **No-access message:** without `opportunities.view`, the pipeline sections render nothing, with no message. No role lacks it today. Add a note if one ever does.
- **Chart colours:** every chart is one grey series. Tier 2's small value (£35k) is hard to see next to tier 1's £6.4m; the tooltip and the screen-reader table still show it.
