# 07 — Automated alerts

**Status:** Done
**Commits:** `5485062` (db), `e4d0d33` (web), `c5505e8` (tests), `ea904a2` (claude)

## Goal
Rules a workspace sets once that produce alerts automatically: deals that have gone stale, close dates that have passed, and attendance drops at watched clubs. Alerts arrive in an in-app inbox with an unread badge. Checks run daily on their own, and admins can run them on demand.

Out of scope: email or push delivery, alerts from AI reports, per-user rule subscriptions, and snoozing.

## Decisions
- **Scheduling:** pg_cron inside Postgres (your choice). A migration schedules `evaluate_all_alerts()` daily at 06:00 UTC. There is no HTTP endpoint, no `CRON_SECRET`, and no new use of the service-role key. The hosted project gets pg_cron from the same migration, and runs show in `cron.job_run_details`.
- **Rules have typed columns, not jsonb:** `type` plus `days`, `club_id` and `drop_pct`, with a check constraint per type, so the database refuses bad parameters:
  - `stale_opportunity`: an open deal with no stage change in `days` (1–365).
  - `close_date_passed`: an open deal more than `days` (0–90) past its expected close date.
  - `attendance_drop`: a watched club whose latest-season average attendance fell by at least `drop_pct`% (1–90) from the season before.

  At most 50 rules per workspace.
- **Alerts:**
  - **Written by the database:** only by the evaluation functions; users can't insert or edit them.
  - **Deduplication:** each alert has a `dedup_key` that is unique per workspace, so evaluation is idempotent (`on conflict do nothing`). The key includes the thing that changed: the stage date, the close date, or the season. A deal that goes stale again after moving stage alerts again.
  - **No stored URLs:** alerts hold `opportunity_id` and `club_id` rather than a URL, and the app builds the link.
- **Read state is per person** (`alert_reads`). One member marking an alert read doesn't hide it from the others, and the badge counts your own unread alerts.
- **Permissions:** `alerts.view` (everyone) and `alerts.manage` (owner, admin: create, toggle and delete rules, and "Run checks now").
- **Exact deal links:** the opportunities list gains an `id` filter (`/opportunities?id=…`). Alerts link to the exact deal, and so do the dashboard's upcoming close dates, which closes the plan 05 follow-up.
- **Who can run evaluation:**
  - **Cron (as postgres):** `evaluate_all_alerts()`, internal, with no grant.
  - **Users:** `run_alert_checks()`, for the caller's active workspace only, needing `alerts.manage`, and rate-limited to once a minute per workspace.

## Database (`supabase/migrations/`)
New migration `alerts`:
- **Permissions:** `role_permissions`, replaced keeping every entry, plus `alerts.view` (all roles) and `alerts.manage` (owner, admin).
- **`alert_rule_type` enum.**
- **`alert_rules`** (tenant-owned, `tenant_row_defaults`):
  - columns: `id`, `workspace_id`, `type`, `days`, `club_id`, `drop_pct`, `enabled`, `created_by`, `created_at`, `updated_at`, `last_run_at`;
  - per-type check constraint;
  - `unique (workspace_id, id)`;
  - RLS: select with `alerts.view`, and insert, update and delete with `alerts.manage`;
  - column grants on `type`, `days`, `club_id`, `drop_pct` and `enabled`;
  - a trigger that caps a workspace at 50 rules.
- **`alerts`:**
  - columns: `id`, `workspace_id`, `rule_id` (composite FK, set null on delete), `type`, `title`, `body`, `opportunity_id` (composite FK, set null), `club_id`, `dedup_key`, `created_at`;
  - `unique (workspace_id, dedup_key)`;
  - RLS: select with `alerts.view`;
  - grants: select only.
- **`alert_reads`:**
  - columns: `alert_id`, `user_id`, `read_at`, with the primary key on both ids;
  - RLS: select your own rows in workspaces you can view;
  - no grants beyond select, because writes go through the functions below.
- **Functions:**
  - `evaluate_rules(ws)` (definer, internal): runs every enabled rule in the workspace, inserts new alerts, stamps `last_run_at` and returns the count inserted.
  - `evaluate_all_alerts()` (definer, internal): every workspace, for the cron.
  - `run_alert_checks()` (definer, `authenticated`): the active workspace, `alerts.manage`, once a minute (`P0001` otherwise). Returns the count.
  - `mark_alert_read(p_alert)` and `mark_all_alerts_read()` (definer, `authenticated`): your own read rows, for alerts you can view.
  - `unread_alert_count()` (invoker, `authenticated`): your unread alerts in the active workspace.
- **pg_cron:** `create extension if not exists pg_cron`, then `cron.schedule('evaluate-alerts', '0 6 * * *', 'select public.evaluate_all_alerts()')`.
- **Seed** `supabase/seeds/demo-rules.sql` (named to load after the pipeline seed): three rules for Northbridge (stale after 30 days, close date passed, and an attendance drop of 5% at Ashmarket Town, whose fictional attendance fell 5.9%), evaluated once so the inbox has alerts after a reset.

## App (`src/`)
- `src/lib/alerts.ts` (`server-only`): `listAlerts(workspaceId)` (newest first, with my read state), `unreadAlertCount()` and `listRules(workspaceId)`.
- `src/lib/alert-actions.ts`: `saveRule`, `toggleRule`, `deleteRule` and `runChecks` (`checkPermission("alerts.manage")`), plus `markRead` and `markAllRead` (`alerts.view`). Each checks the user, parses with zod and calls `refresh()`.
- `src/lib/validation.ts`: `alertRuleSchema` (a discriminated union on `type`), and the opportunity filters gain `id`.
- **Pages:**
  - `/alerts`: the inbox. Unread alerts come first and are marked; each alert has a link to the deal or club. There are Mark read and Mark all read buttons, and for managers "Run checks now" and "Manage rules". The page has empty and error states.
  - `/alerts/rules`: the rules list with toggle and delete, and a "New rule" dialog whose fields change with the type (days, club, drop %). Viewers can read the rules but not change them.
- **Sidebar:** an "Alerts" item showing the unread count. The `(app)` sidebar reads the count, so `refresh()` after marking read updates it.
- `proxy.ts`: `/alerts` added to the app paths.
- `docs/plans/05-intelligence-dashboard.md`: the exact-link follow-up marked fixed.

## Tests
- **pgTAP** (`alerts.test.sql`):
  - each rule type fires on matching data and not otherwise, at the boundaries: 29 vs 31 days, the close-date grace period, and a 9% vs 11% drop;
  - disabled rules don't fire;
  - running twice creates no duplicates, and a deal that goes stale again alerts again;
  - A/B isolation for rules, alerts and reads;
  - the permission matrix (viewers can't manage rules or run checks);
  - `run_alert_checks` only touches the active workspace and is rate-limited;
  - read state is per person, `mark_all_alerts_read` works, and `unread_alert_count` is correct;
  - the parameter checks and the 50-rule cap;
  - the cron job exists and `evaluate_all_alerts` covers every workspace;
  - internal functions aren't executable; grants allowlist updated.
- **Vitest:** `alertRuleSchema` (per type) and the opportunity `id` filter.
- **Playwright:**
  - In a new workspace, the owner adds a deal with yesterday's close date and a "close date passed" rule, then runs checks. The alert appears and the badge shows 1; Mark read clears it, and the link opens that exact deal.
  - In Northbridge, a viewer sees the seeded alerts, has no Run checks or rule controls, and marks one read. An admin still sees it as unread.

## Verification
`/verify all`, then `code-reviewer`, `security-auditor`, `rls-reviewer` and `ui-reviewer` (390, 768, 1280).

Flows:
1. As `viewer@`, open Alerts. Seeded alerts are listed, unread first, and the sidebar badge shows the count. Mark one read: the badge goes down by one.
2. As `admin@`, the same alert is still unread. Open Manage rules and turn off the stale rule.
3. As `admin@`, choose Run checks now: "No new alerts". Choosing it again within a minute is refused politely.
4. As `owner@`, add an attendance-drop rule for a club. Run checks: an alert links to the club's page.

## Commits after approval
`feat(db): alert rules, alerts and daily checks`, `feat(web): alerts inbox and rules`, `test: alerts`, `chore(claude): …` if conventions change, then this plan → Done.

## Notes
- **Deduplication:** `dedup_key` names the deal or club and what changed, not the rule, so two similar rules raise one alert. The pgTAP tests caught the first version, which included the rule id.
- **Seed name:** the seed is `demo-rules.sql` because seeds load alphabetically, and `demo-alerts.sql` ran before the pipeline existed.
- **Select bug from plan 04, fixed:** `SelectField` lost its value after a failed submit. React resets the form after an action, and Radix's Select follows that reset back to the value it mounted with. The opportunity dialog's Club and Stage reset this way, and so did the alert rule type, which also hid the club error. `SelectField` now remounts keyed on the submitted value, like `Field`. There are e2e regression checks in `opportunities.spec.ts` and `alerts.spec.ts`.
- **Reviews (code, security, RLS):** none found anything critical, and none found a cross-workspace path. Fixed:
  - **Isolated daily run:** each workspace runs in its own subtransaction, so one failure logs a warning and the rest still run.
  - **Combined rules:** rules of a type are combined before the deal join, with the loosest threshold winning. Duplicate rules no longer multiply the work.
  - **Advisory locks:** "Run checks now" and the 50-rule cap take advisory locks instead of row locks on `workspaces`. A row lock would have held up every insert in the workspace, because foreign-key checks lock that row.
  - **Rate limit:** the once-a-minute limit lives in `alert_runs`, so deleting and re-adding rules doesn't reset it.
  - **Attendance arithmetic:** `nullif` prevents division by zero.
  - **"1 day" vs "1 days":** alert text says "1 day".
  - **Deal deletion:** deleting a deal deletes its alerts, so deal text doesn't outlive the deal.
  - **Purges:** the daily run purges alerts older than 180 days, and a second cron job purges the cron log.
  - **pg_cron schema:** pg_cron goes `with schema pg_catalog`, and `grants.test.sql` checks that API roles can't use the `cron` schema.
  - **Read state:** a removed member no longer sees their old read rows.
  - **Permission coupling:** a test pins that `alerts.view` implies `opportunities.view`, because alert text quotes deals.
  - **Empty number fields:** they are now "Enter a number of days" instead of quietly becoming 0, which had made a cleared grace period save as 0.
  - **Inbox:** it lists every unread alert, so it agrees with the badge.
  - **Tests:**
    - The cross-workspace `mark_alert_read` test passed a workspace id instead of an alert id; it now uses a real one.
    - New cases: the close-date edges (due today, 1 day late, 5 vs 6 days with 5 days' grace), removed members, B's update and mark-all on A, and the analyst and viewer rows of the matrix.
    - The e2e date is computed in London time.
- **UI review:** nothing high or medium. Fixed:
  - After "Mark read" (whose button disappears), focus moves to the inbox's status line.
  - Rule buttons have short accessible names, such as "Turn off: A deal goes quiet, 30 days".
  - The delete dialog no longer has a doubled full stop.
  - "Turn off" and "Turn on" have the same width.

  A crash the reviewer saw once came from my database reset during the review and didn't recur.
- **Plan 05 follow-up fixed:** the dashboard's upcoming list links to `/opportunities?id=…`. Changing any filter leaves the single-deal view.

## Follow-ups
