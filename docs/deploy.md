# Deploying ClubIntel

The database runs on Supabase cloud and the app on Vercel. Everything below is done by a person with access to both accounts: Claude Code's hooks deliberately keep remote commands (`supabase link`, `supabase db push`, `vercel`) behind a confirmation.

## 1. Supabase project

1. **Create a project** on Postgres **17**. The migrations revoke Postgres 17's `MAINTAIN` privilege, so the project must run 17 or newer.
2. **Turn off "Automatically expose new tables"** (Project Settings → Data API). The migrations assume new tables start with no grants (`auto_expose_new_tables = false` in `supabase/config.toml`); every table and function is granted explicitly.
3. **Link and push the schema** from your machine:

   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

   This applies every migration in `supabase/migrations/`, including the pg_cron extension and its two jobs: daily alert checks at 06:00 UTC, and a purge of the cron log.
4. **Load the national club data.** It's shared reference data that the app expects. There are two ways:
   - **A public demo:** `supabase db push --include-seed` loads every seed. That includes the demo accounts, all with the password `demo1234`, so only do this for a demo that is meant to be open:
     - give the demo its own Supabase project, never a real deployment's;
     - expect anyone to sign in as the demo owner, change data or the password, so plan to reset it;
     - run it with `AI_PROVIDER=fake`, or very low `ai_limits`, so visitors can't spend real money.
   - **A real deployment:** load the clubs only. The simplest way is to paste `supabase/seeds/clubs.sql` into the SQL editor. With `psql`, copy the connection string from the dashboard (Connect → Session pooler) into an environment variable, so the password stays out of your shell history:

     ```bash
     read -rs DATABASE_URL && export DATABASE_URL   # paste, then Enter
     psql "$DATABASE_URL" -f supabase/seeds/clubs.sql
     ```

      Run it once: it's plain inserts, so a second run fails on the existing ids and changes nothing.
5. **Auth settings:**
   - **Site URL** (Authentication → URL Configuration): your app's URL, e.g. `https://clubintel.example`.
   - **Redirect URLs:** just the confirmation callback, `https://clubintel.example/auth/confirm**`. Sign-up and password reset both return through it, with a `?next=` query (hence the trailing `**`).
   - **Keep "Confirm email" on** (Authentication → Sign In / Providers → Email). Members are added by email, and only confirmed accounts can be added, so confirmation is what proves someone owns the address. Local development turns it off in `supabase/config.toml`: never push the local auth settings to the hosted project (`supabase config push`).
   - **Passwords:** a minimum length of at least 8 (the app asks for 8), and leaked-password protection on.
   - **SMTP:** configure a provider so confirmation and reset emails are delivered. The built-in one is rate-limited.
6. **Review the AI limits.** They're one row, changed in SQL; tenants can't change it. Defaults:

   | Column | Default | Meaning |
   |---|---|---|
   | `max_workspace_budget_usd` | 50 | The most any workspace may spend a month, whatever its own budget says |
   | `report_reserve_usd` | 2.00 | Held against the budget from start until the real cost is known |
   | `max_report_cost_usd` | 2.00 | The most one report is charged |
   | `reports_per_workspace_hour` | 10 | |
   | `reports_per_user_day` | 20 | |
   | `platform_daily_usd` | 50 | All workspaces together, per London day |

   ```sql
   update public.ai_limits set platform_daily_usd = 100, max_workspace_budget_usd = 100;
   ```

   If you set `AI_MODEL` to a pricier model than Opus 5.5, raise `report_reserve_usd` and `max_report_cost_usd` together.

## 2. Vercel project

1. **Import the repository.** The framework is detected as Next.js, and the build command is `next build`.
2. **Set the region** near the Supabase project. Every request queries the database, so distance adds latency to each page.
3. **Environment variables.** Set the secrets for **Production only**. Preview deployments build any branch, so a Preview with the production `SUPABASE_SECRET_KEY` could read every workspace. For Previews, either point them at a separate staging Supabase project with its own keys and `AI_PROVIDER=fake`, or don't enable them. Keep Vercel's protection for pull requests from forks on.

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → Publishable key |
   | `SUPABASE_SECRET_KEY` | Project Settings → API Keys → Secret key. **Server-only**: it bypasses RLS, and the app uses it only for AI report writes |
   | `SITE_URL` | `https://clubintel.example`. Used in email links and as the AI route's allowed origin |
   | `AI_PROVIDER` | `anthropic`, or leave unset to turn AI off |
   | `ANTHROPIC_API_KEY` | Your Claude API key. **Server-only** |
   | `AI_MODEL` | Optional; defaults to `claude-opus-5-5` |

   Never give a secret a `NEXT_PUBLIC_` prefix; the project's hooks also block that.
4. **Function duration:** `/api/ai/reports` sets `maxDuration = 300`, because a report with adaptive thinking can take a few minutes. Your Vercel plan must allow it; on a plan with a lower limit, long reports are cut off and marked failed (their reserved cost stays charged).
5. **Deploy.**

## 3. After deploying

1. **Smoke test:** sign up, create a workspace, and add an opportunity. The dashboard should show it.
2. **AI:** as an analyst or above, generate one report (a few cents). Then check Settings → AI usage as the owner: the report should show a real cost, not the $2.00 reservation.
3. **Alerts:** add a "close date passes" rule, give a deal a past close date, and choose Run checks now.
4. **Cron:** the day after deploying, in the SQL editor:

   ```sql
   select jobname, status, start_time, return_message
   from cron.job_run_details join cron.job using (jobid)
   order by start_time desc limit 5;
   ```

5. **Grants:** the pgTAP suite isn't run against hosted projects, so check the essentials by hand in the SQL editor (read-only):

   ```sql
   -- Every table in public has RLS on (expect no rows).
   select relname from pg_class
   where relnamespace = 'public'::regnamespace and relkind in ('r', 'p') and not relrowsecurity;

   -- anon can't read or write any table, view or sequence in public (expect no rows).
   select relname from pg_class
   where relnamespace = 'public'::regnamespace
     and ((relkind in ('r', 'p', 'v', 'm', 'f') and has_table_privilege('anon', oid, 'SELECT, INSERT, UPDATE, DELETE'))
       or (relkind = 'S' and has_sequence_privilege('anon', oid, 'USAGE, SELECT, UPDATE')));

   -- anon can't run any function in public (expect no rows).
   select oid::regprocedure from pg_proc
   where pronamespace = 'public'::regnamespace and has_function_privilege('anon', oid, 'EXECUTE');

   -- Only the server may run the report writers (expect four rows, all false for authenticated).
   select p.proname, has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated
   from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('start_report', 'finish_report', 'fail_report', 'settle_ai_usage');

   -- API roles can't use pg_cron (expect false, false).
   select has_schema_privilege('anon', 'cron', 'USAGE'), has_schema_privilege('authenticated', 'cron', 'USAGE');
   ```

## Updating

New migrations go out with `supabase db push`. They're never edited once committed (a hook enforces this), so pushes only ever add. The app deploys on every push to `main` once Vercel is connected; CI runs the full suite on the same push.
