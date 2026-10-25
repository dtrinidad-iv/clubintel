# 07 — Automated alerts

**Status:** Proposed

## Goal
Rules a workspace sets once that produce alerts automatically: stale deals, missed close dates, and attendance drops at watched clubs. They're delivered to an in-app inbox.

## Decisions
- `alert_rules` (tenant-owned):
  - `type` enum (`stale_opportunity`, `close_date_passed`, `attendance_drop`), `params` jsonb (e.g. `{ "days": 30 }`, `{ "club_id": …, "drop_pct": 10 }`), `enabled`.
  - `alerts.manage` permission (admin+).
- `alerts` (tenant-owned): `rule_id`, `title`, `body`, `link`, a `dedup_key` that's unique per workspace, `read_at`.
- `evaluate_alerts(ws uuid default null)` is a SQL function. It's idempotent (`on conflict (workspace_id, dedup_key) do nothing`).
  - Called by the cron with the service role, it runs every workspace.
  - Called by a user ("Run checks now", `alerts.manage`), it runs only their current workspace and ignores the argument.
- Scheduling: `GET /api/cron/alerts` checks `Authorization: Bearer $CRON_SECRET` (constant-time compare) and calls `evaluate_alerts` with a server-only service-role client. `vercel.json` sets a daily cron. The service-role key is used in that one file only, and a hook guards against it leaking into client code.
- UI: an alerts inbox (unread first, mark read, mark all read), an unread badge in the sidebar, and a rules page to create, toggle and delete rules.

## Tests
- pgTAP:
  - each rule type fires on matching seed data and not otherwise;
  - running twice creates no duplicates;
  - A/B isolation for rules and alerts;
  - a user call can't evaluate another workspace.
- Vitest: cron route refuses a missing or wrong secret.
- Playwright: create a stale-deal rule → Run checks now → alert appears with a badge → mark read.

## Verification
`/verify`, plus `rls-reviewer`, `security-auditor` and `ui-reviewer`.
