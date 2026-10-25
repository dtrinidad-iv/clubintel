# 06 — AI layer and intelligence reports

**Status:** Done
**Commits:** `1d5cf98` (db), `3343a40` (web), `1a176a3` (tests), `5109656` (claude)

## Goal
An AI layer that is safe to run per tenant, and its first feature: a commercial intelligence report that Claude writes from the active workspace's own data. The report streams into the page section by section and is saved as a draft. An admin approves or discards it. AI never acts on its own.

Out of scope:
- chat;
- tools or agents;
- scheduled reports (plan 07);
- exports;
- editing a report's text.

## Decisions
- **SDK:** `@anthropic-ai/sdk` (approved). It provides streaming, zod-validated structured output (`zodOutputFormat`), typed errors and retries.
- **Model:**
  - `AI_MODEL` sets it, defaulting to `claude-opus-5-5` ($4 / $20 per million input / output tokens).
  - Effort is `medium` (the model's default, set explicitly), and adaptive thinking is on (it can't be turned off on Opus 5.5).
  - `max_tokens` is 16,000. That caps output cost at about $0.32 a report; a typical report costs 5–15 cents.
  - **Refusal fallback:** server-side refusal fallback is on (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`). A declined request is retried on the fallback model, and cost is priced by the model that answered (`response.model`). A final `refusal` marks the report failed.
- **Providers** (`AI_PROVIDER`):
  - `anthropic` needs `ANTHROPIC_API_KEY`.
  - `fake` streams a fixed sample report without network; e2e tests and local dev use it.
  - **Unset:** `anthropic` when a key is set. Otherwise AI is **off**: the generate button is hidden and the route answers 503. Production never falls back to fake output silently.
  - Fake reports are labelled "Sample output".
- **Prompt and data:**
  - **System prompt:** `src/lib/ai/prompts/report.ts`, in a fixed file.
  - **Data:** the workspace's own data goes in as one delimited JSON block (`<workspace_data>…</workspace_data>`), fetched through the user's RLS client for the active workspace only. It contains the dashboard aggregates, the top 25 open deals by value (title, partner, club, stage, value, close date, days since the last stage change, notes cut to 300 characters) and national context for the clubs in the pipeline.
  - **Left out on purpose:** contacts' emails and phone numbers, owner names, and other workspaces.
  - **Untrusted text:** deal notes, titles and the user's optional "focus" (up to 300 characters) are marked as data, never instructions.
  - Prompt caching is off: the system prompt is below the minimum cacheable size, and every request's data differs.
- **Structured output:** a zod schema (`summary`, `highlights[]`, `risks[]`, `recommended_actions[]` with priority, `clubs_to_watch[]`), sent as `output_config.format`. The final text is validated again before saving, and invalid output marks the report failed.
- **Live sections:** the route forwards the raw JSON text deltas. The client parses the half-written JSON with a small tolerant parser (`src/lib/ai/partial-json.ts`, unit-tested), so the summary types out and the lists grow as they arrive.
- **Route:** `POST /api/ai/reports` returns Server-Sent Events. Before opening the stream, it checks:
  - the user (401) and the active workspace (409);
  - `ai.use` (403);
  - same-origin `Origin` and a JSON content type (403), because Route Handlers get no CSRF check from Next;
  - the body schema (400);
  - then `start_report()` in Postgres, which applies the budget and the rate limit (429).

  Events are `start` (report id), `delta` (text), `reset` (a fallback model took over; its text replaces what came before), `done` and `error` (a message that is safe to show). If the client disconnects, the Claude stream is aborted and the report is marked failed. Navigating within the app doesn't abort it.
- **The server writes, as the service role** (changed after review; you chose this over a per-report token):
  - `SUPABASE_SECRET_KEY` (server-only) backs `createServiceClient()`, the app's only service-role client.
  - The route checks the user with the DAL first. It then passes the user and workspace ids it checked to `start_report`, `finish_report`, `fail_report` and `settle_ai_usage`. Only `service_role` may execute those functions, and they check the ids again.
  - Users can't call them, so they can't forge a report's content or its cost.
  - Reads stay on the user's RLS client.
- **Money lives in Postgres:**
  - **Budget:** the workspace's own budget (default $25, set by owners and admins in Settings) is capped by the operator's `ai_limits.max_workspace_budget_usd` (default $50). Tenants can't change the cap.
  - **Reservation:** each start reserves the most one report may cost (`report_reserve_usd` = `max_report_cost_usd` = $2). `settle_ai_usage` replaces it once, bound to the report's workspace: with the real cost when the call completed, or with a cautious estimate when it was stopped (the input, the text streamed, plus 8k tokens of thinking). A crashed call keeps the reservation, so spend is never under-counted. Starts are serialised on the `ai_limits` row, so concurrent starts in any workspace see each other's reservations.
  - **Limits:** 10 reports per workspace per hour, 20 per user per day, and $50 a day across all workspaces. All are in `ai_limits`, which the operator changes in SQL.
  - **Stale reports:** a report left `generating` for 15 minutes is marked failed by the next start, and its reservation stays.
- **Mixed-workspace data:** the dashboard functions take an optional workspace (they are recreated with `ws uuid default null`), so the report reads exactly the workspace it was started for, even if the active workspace changes in another tab.
- **Reports and permissions:**
  - **Status:** `report_status` is `generating → draft | failed`, then `draft → approved | discarded`.
  - **New permissions:** `ai.use` (owner, admin, analyst), `reports.view` (everyone) and `reports.approve` (owner, admin).
  - **Usage page:** the Settings → AI usage section (spend vs budget, recent calls) needs `workspace.manage`.

## Database (`supabase/migrations/`)
New migration `ai_reports`:
- **Permissions:** `role_permissions`, replaced keeping every entry, plus `ai.use`, `reports.view` and `reports.approve`.
- **Budget column:** `workspaces.ai_monthly_budget_usd numeric(10,2) not null default 25 check (between 0 and 10000)`, plus `grant update (ai_monthly_budget_usd)`. The existing "managers rename their workspace" policy (`workspace.manage`) covers it.
- **`report_status` enum.**
- **`reports` table** (tenant-owned):
  - columns: `id`, `workspace_id` (default `current_workspace_id()`, set by `tenant_row_defaults`), `title`, `focus`, `status`, `content jsonb`, `model`, `error`, `created_by`, `created_at`, `updated_at`, `reviewed_by`, `reviewed_at`;
  - checks: content size and focus length;
  - `unique (workspace_id, id)`;
  - index `(workspace_id, created_at desc)`;
  - RLS: select with `reports.view`;
  - grants: select only. Every write goes through the functions below.
- **`ai_usage` table:**
  - columns: `id` (identity), `workspace_id`, `user_id`, `report_id` (composite FK to `reports`), `feature`, `model`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`, `cost_usd` (all ≥ 0), `created_at`;
  - RLS: select with `workspace.manage`;
  - grants: select only.
- **`ai_limits`:** one row of operator limits, with RLS on and no grants.
- **`reports`:** no tenant trigger. The service role has no active workspace, so `workspace_id` and `created_by` come from the ids the server checked. There is an extra index on `(created_by, created_at)` for the per-user limit.
- **`ai_usage`:** one row per report (`report_id unique`), reserved at start and given a `settled_at` when settled. The model name is checked.
- **Server functions** (`security definer`, `set search_path = ''`, execute granted to `service_role` only):
  - `start_report(p_user, p_workspace, p_focus) returns uuid`: `ai.use` for that user in that workspace, the budget, every limit, stale-report expiry, then the insert and the reservation.
  - `finish_report(p_id, p_workspace, p_content, p_model)` and `fail_report(p_id, p_workspace, p_error, p_model)`: only while the report is `generating`, and only in the named workspace.
  - `settle_ai_usage(p_report, p_workspace, p_model, tokens…, p_cost)`: once per report, in the named workspace, with the cost capped.
- **People's functions** (granted to `authenticated`):
  - `review_report(p_id, p_decision)`: `reports.approve` in the report's workspace, drafts only. A report the caller can't see answers the same as one that doesn't exist.
  - `ai_budget_status()`: spend, effective budget, the workspace's own budget and the platform cap, for `ai.use`.
  - `dashboard_*(ws uuid default null)`: as in plan 05, plus an optional workspace. They still run as the caller under RLS.
- **Internal helpers** (no grant): `user_can(ws, user, perm)`, `ai_spend_this_month(ws)` and `ai_effective_budget(ws)`.

## App (`src/`)
- `src/lib/ai/` (`server-only`):
  - `client.ts`: an `AiClient` interface (`streamStructured` → text deltas plus a final result with the parsed output, model, usage and stop reason), with `AnthropicAiClient` and `FakeAiClient`. `getAiClient()` returns `null` when AI is off.
  - `pricing.ts`: per-model prices, with unknown models at the highest known rate.
  - `prompts/report.ts`: the system prompt and `buildReportPrompt(data, focus)`.
  - `report-schema.ts` (shared with the client): the zod schema.
  - `report-data.ts`: gathers the prompt data through the RLS client.
- `src/lib/ai/partial-json.ts` (client-safe): `parsePartialJson(text)`.
- `src/lib/sse.ts`: `encodeSse(event, data)` and a client-side `readSse(response)`.
- **Route:** `src/app/api/ai/reports/route.ts` (POST).
- **Server Actions:** `src/lib/report-actions.ts`, with `reviewReport(id, decision)` (`checkPermission("reports.approve")`) and `setAiBudget` (`workspace.manage`).
- **Pages:**
  - `/reports`: the list, with status badges, who made each report and when, and a "New report" panel for `ai.use` (an optional focus, then Generate, the live view and links).
  - `/reports/[id]`: the full report, with Approve and Discard for approvers.
  - Each page has its own `<Suspense>`, `error.tsx` and `not-found`.
  - The sidebar gets a "Reports" item.
- **Settings:** an "AI usage" card for `workspace.manage`, showing this month's spend against the budget, a budget form and the last 10 calls.
- **Env:** `.env.example` gains `SUPABASE_SECRET_KEY`, `AI_PROVIDER`, `ANTHROPIC_API_KEY` and `AI_MODEL`, with comments. The Playwright web server runs with `AI_PROVIDER=fake`, and reads the local secret key from `supabase status`, so it never lives in a file.

## Tests
- **pgTAP** (`reports.test.sql`):
  - A/B isolation for `reports` and `ai_usage`;
  - direct inserts and updates refused;
  - `start_report` needs `ai.use` and refuses when over budget or over the rate limit;
  - only the creator finishes or fails a report, and only while it's `generating`;
  - usage is recorded against the report's workspace and refuses negative values or another user's report;
  - only admin+ review, and only drafts;
  - viewers read reports, while usage is visible to `workspace.manage` only;
  - grants allowlist updated.
- **Vitest:**
  - partial-JSON parser;
  - report schema;
  - prompt builder (data delimited, untrusted text marked, the data block holds only what's passed in);
  - pricing;
  - SSE encoder and reader;
  - the route handler with `FakeAiClient` and the DAL and Supabase mocked: a stubbed `fetch` throws on any network call, and the handler is checked for 401, 403 (permission and origin), 429 and the success event order.
- **Playwright** (fake provider):
  - an analyst generates a report, the sections fill in, and a draft is saved;
  - a viewer sees it with no Approve button;
  - an admin approves it and it shows Approved;
  - an analyst can't see the AI usage card;
  - the owner changes the budget.

## Verification
`/verify all`, then the reviewers: `security-auditor` (prompt injection, key exposure, CSRF, cost abuse), `rls-reviewer`, `code-reviewer` and `ui-reviewer`. One live call with a real key, run by the user (`AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY` in `.env.local`).

Flows:
1. As `analyst@`, open Reports, choose New report, enter the focus "hospitality" and choose Generate. The sections fill in, then a draft appears in the list.
2. As `viewer@`, open the report. The content is readable, and there are no Approve or Discard buttons.
3. As `admin@`, choose Approve. The status is Approved, with the reviewer and time.
4. As `owner@`, open Settings → AI usage. Spend shows against the budget (in US dollars, as Anthropic bills). Set the budget to $0 and try to generate: the page says the budget is used up.

## Commits after approval
`feat(db): reports, AI usage and budget`, `feat(web): AI layer and intelligence reports`, `test: reports, AI layer and flows`, `chore(claude): …` if conventions change, then this plan → Done.

## Notes
- **Demo data:** `supabase/seeds/demo-reports.sql` adds two fictional Northbridge reports (one approved, one draft), written through `start_report`, `finish_report` and `review_report` as the demo analyst and admin. The viewer and cross-workspace e2e tests use them.
- **Live test (2026-10-26):** one real report on Opus 5.5, with the focus "hospitality", took about 60 seconds. It used 4,836 tokens in and 2,568 out, and was settled at $0.071. The content was grounded in the workspace's deals. It noticed leftover e2e data and that most open deals showed "0 days since stage change", so `demo-pipeline.sql` now backdates every open Northbridge deal: 6–27 days, with only the two leads past 30.
- **E2E and the rate limit:** generating runs in a freshly signed-up workspace each time, so repeated runs never reach the 10-per-hour limit in the demo workspace.
- **Local AI:** `.env.local` needs `AI_PROVIDER=fake` (now in `.env.example`) for the Generate button to appear locally. Without it, and without a key, AI is off.
- **Reviews:**
  - **Before the redesign:** all four reviews ran. Security and code review found that real reports recorded $0 (the SDK drops its snapshot when a stream ends), that tenants set their own cost ceiling, that concurrent starts and aborts under-counted spend, and that users could call the report functions directly to forge usage or drafts. The code review also found that the SDK's structured-output parser threw on cut-off and fallback responses. The redesign above fixes all of these.
  - **SDK fixes:** the client now tracks usage from stream events, sends a plain JSON schema with no SDK parser, keeps only the text after the last fallback block, prices each model's part separately, and recognises the SDK's abort error. `anthropic-client.test.ts` runs the real client against recorded event streams.
  - **Smaller fixes:**
    - a failed save now fails the report rather than leaving it generating;
    - `maxDuration = 300` on the route;
    - the focus is kept after an error (a submit handler, not a form action);
    - navigating within the app doesn't abort a report;
    - no fixed element ids;
    - the partial-JSON parser handles escaped backslashes;
    - the origin is checked against `SITE_URL` when set, with no `x-forwarded-host` trust;
    - requests over 4 KB are refused;
    - `/reports` fits at 390px;
    - Settings has a Suspense boundary (the dev "uncached data" error);
    - the layout no longer nests two `<main>` landmarks.
- **Second review round** (security and RLS re-checked the redesign; nothing critical, high or medium was left in the RLS review):
  - **Stopped reports:** they now settle to an estimate rather than keeping the full reservation. Starting and stopping reports on purpose from throwaway accounts would otherwise fill the platform's daily limit and pause AI for everyone.
  - **Locking:** starts lock the `ai_limits` row, not just the workspace, so the per-user and platform limits can't be raced across workspaces.
  - **Reservation:** it now equals the per-report cap.
  - **Workspace binding:** the server's finish, fail and settle calls name the workspace.
  - **Model names:** unknown names are recorded as "unknown" instead of failing to settle.
  - **Request size:** the 4 KB cap holds without a `Content-Length` header.
  - **Lint rule:** ESLint (`no-restricted-imports`) allows only the report route to import the service-role client.
- **Next's route announcer** (`#__next-route-announcer__`) also has `role="alert"`, so e2e tests scope alert locators to `main`.

## Follow-ups
- **Platform limit:** throwaway accounts can still spend toward the platform's daily limit (at an estimated ~$0.20 a stopped report). Before an open launch, consider an account-age or confirmed-email gate for AI, a per-workspace share of the platform limit, and an operator alert near the limit.
- **Concurrency:** the budget and limit checks are serialised by a row lock, which pgTAP can't exercise concurrently. Load-test it in plan 08.
- **Prompt data:** deal notes (cut to 300 characters) and partner names go to Anthropic. Note this in the privacy policy, or make notes opt-in, before real customers use it.
- **Draft attribution:** the detail page says "Written by Claude" and names the requester in the header. If people start editing drafts, record who changed what.
- **Hosted setup (plan 08):** set `SUPABASE_SECRET_KEY` and the AI env keys in each environment, and review `ai_limits` for production.
