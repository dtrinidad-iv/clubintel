# 05 — Intelligence dashboard

**Status:** Proposed

## Goal
A commercial intelligence dashboard for the current workspace, combined with national context from the club database.

## Decisions
- KPI tiles: open pipeline value, won this quarter, win rate (won ÷ closed), stale opportunities (no stage change in 30 days), and average deal size.
- Charts:
  - pipeline value by stage (bar);
  - won value by month (line, 12 months);
  - value by league tier (bar);
  - national attendance vs capacity by tier (from `club_seasons`);
  - upcoming close dates (list).
- Aggregation in SQL: `dashboard_kpis()` and `dashboard_series()` RPCs, run as **invoker**, so RLS still applies and only the current workspace's rows count. One round trip per section, each section streamed in its own `<Suspense>`.
- The responsive grid is 1 column on mobile, 2 on tablet and 4 KPI + 2 chart columns on desktop. The chart palette is checked in light mode for contrast.

## Tests
- pgTAP: the KPI function returns only the caller's workspace numbers (seed two workspaces with known values and assert exact sums).
- Playwright: add a won opportunity → "won this quarter" goes up by its value.

## Verification
`/verify`, plus `ui-reviewer` at 375/768/1280.
