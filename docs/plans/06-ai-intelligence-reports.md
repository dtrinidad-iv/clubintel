# 06 — AI layer and intelligence reports

**Status:** Proposed

## Goal
An AI layer that is safe to run per tenant, plus the first feature on it: a "commercial intelligence report" that Claude writes from the workspace's own data. It streams into the page and is saved as a draft that a user approves before it's published.

## Decisions
- `src/lib/ai/` (`server-only`):
  - `AiClient` interface (`complete`, `stream`) with `AnthropicClient` (`@anthropic-ai/sdk`) and `FakeAiClient`.
  - `getAiClient()` picks the client from `AI_PROVIDER` (`anthropic` | `fake`; fake when there's no key) and wraps it in `RecordingAiClient` (writes `ai_usage`) and `BudgetedAiClient` (refuses once the workspace's monthly budget is spent).
  - The model comes from `AI_MODEL` (default `claude-opus-5-5`). The Claude API skill is checked for current SDK usage before writing it.
- Prompts are files in `src/lib/ai/prompts/` (system prompt + a builder). Workspace data goes in as clearly delimited JSON, user text is marked untrusted, and other workspaces' data never enters a prompt (it's fetched through the RLS client as the user).
- Structured output: a zod schema (`summary`, `highlights[]`, `risks[]`, `recommended_actions[]`, `clubs_to_watch[]`), validated before saving. Invalid output marks the report failed.
- Streaming: `POST /api/ai/reports` (Route Handler) checks the user, `ai.use`, the budget and a per-workspace rate limit (a Postgres counter table) *before* opening the SSE stream. Events are `delta`, `done` and `error`. On end, the report is saved as `draft`.
- `reports`:
  - tenant-owned, with `status` (`draft` → `approved` | `discarded`), `content` jsonb, `model`, `created_by`, `approved_by`;
  - approving needs `reports.approve` (admin+);
  - AI never triggers actions on its own.
- `ai_usage` (workspace, user, feature, model, tokens in/out, cost_usd) and `workspaces.ai_monthly_budget_usd`. The Settings → AI usage page shows this month vs the budget.
- New permissions: `ai.use` (analyst+), `reports.view` (all), `reports.approve` (admin+).

## Tests
- Vitest:
  - prompt builder (no foreign data, delimiters);
  - output schema;
  - budget wrapper (refuses over budget);
  - SSE encoder;
  - route handler with `FakeAiClient` (no network, enforced by stubbing `fetch`).
- pgTAP: `reports` and `ai_usage` A/B isolation; only admin+ can approve.
- Playwright (fake provider): generate → text streams in → draft saved → admin approves → status Approved.

## Verification
`/verify`, plus `security-auditor` (prompt injection, key exposure), `rls-reviewer` and `code-reviewer`. One manual live call with a real key, run by the user.
