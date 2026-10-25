# 09 — Harden grants: deny by default

**Status:** Done
**Commits:** `b6a004b` (db), `0df418b` (tests), `a95c25f` (claude)

## Goal
Close the three privilege gaps `rls-reviewer` found in the foundation migration (plan 01) during plan 03, before plan 04 adds the first tenant tables. Afterwards, new tables and functions in `public` start with no access for `anon` or `authenticated`, and every migration grants exactly what it needs. Build this **before plan 04**.

Out of scope: RLS policies (unchanged), Supabase-managed schemas (`auth`, `storage`, `graphql`, `extensions`), and default privileges owned by `supabase_admin`. Our migrations run as `postgres`, so those don't apply to our objects.

## What's wrong today
Checked against the local database (`pg_class.relacl`, `pg_default_acl`):

1. **Extra privileges on tenant tables.** `authenticated` has `rDxtm` on `workspaces`, `profiles` and `memberships`: select, plus TRUNCATE, REFERENCES and TRIGGER. The foundation migration revoked only insert, update and delete. TRUNCATE ignores RLS. PostgREST can't issue it today, but anything that runs SQL as `authenticated` could empty every workspace's rows.
2. **New tables get every privilege.** The `postgres` default privileges in `public` give `anon` and `authenticated` `arwdDxtm` on every new table, and `rwU` on sequences. Plan 03's tables avoided this only because that migration revoked by hand.
3. **New functions are executable by everyone.** The foundation migration's `alter default privileges in schema public revoke execute on functions from public, anon` can't remove the global built-in default (EXECUTE to PUBLIC). The schema-level entry also explicitly grants `authenticated=X`. Existing functions are safe only because of a one-time `revoke … on all functions`.

## Decisions
- **Deny by default, then grant explicitly.** The alternative, keeping the defaults and revoking in every migration, is the pattern that already failed once. With deny-by-default, a forgotten grant fails loudly ("permission denied" in tests). A forgotten revoke fails silently.
- **Functions too.** New functions aren't executable by `public`, `anon` or `authenticated` until granted. That matches the existing rule "grant to `authenticated` only what the app calls". Helpers used inside policies, like `can()`, must be granted to `authenticated` explicitly. Trigger functions need no grant, because trigger firing doesn't check EXECUTE.
- **Keep what's used today.** `authenticated` keeps `select` on the three foundation tables plus the existing column updates `workspaces.name` and `profiles.full_name`. No app behaviour changes.
- **Sequences** get the same default (no access). Tables use uuids, so nothing depends on sequence grants.
- **Tests enumerate the catalog** instead of naming tables, so every future table and function is covered automatically.

## Database (`supabase/migrations/`)
One new migration, `harden_grants`. It changes privileges only, with no tables, data or policies:

```sql
-- 1. Tenant tables: select stays; truncate, references and trigger go.
revoke truncate, references, trigger on public.workspaces, public.profiles, public.memberships from authenticated;

-- 2. New tables and sequences in public: no access until granted.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;

-- 3. New functions: not executable until granted. The global entry removes the built-in PUBLIC
--    grant; the schema entry removes the explicit authenticated grant.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
```

Before writing the migration I'll confirm in the local database that `postgres` may alter its own default privileges, both globally and in `public`, and that no existing `public` function loses a grant the app uses.

## App (`src/`)
No changes.

## Tests
New `supabase/tests/database/grants.test.sql`:
- **No table or view in `public` gives `anon` any privilege.** Checks `has_table_privilege` for all seven privileges over every relation in `pg_class`.
- **No table in `public` gives `authenticated` TRUNCATE, REFERENCES or TRIGGER.**
- **No function in `public` is executable by `anon`**, and none has an ACL that grants PUBLIC.
- **Every function `authenticated` can execute is on an allowlist**: today's 14 granted functions. A new function has to be added deliberately, in the same migration that grants it.
- **The defaults hold.** Inside the test transaction, as `postgres`, create a throwaway table, sequence and function in `public`, then assert `anon` and `authenticated` have no privileges on any of them. It's rolled back.
- **Behaviour is unchanged.** As `authenticated`, `truncate public.memberships` fails with `42501`. Renaming a workspace (column update) and reading one's own profile still work.

The existing `foundation.test.sql` and `clubs.test.sql` must still pass unchanged.

## Docs and tooling
- **`CLAUDE.md`, Database conventions:** new tables, sequences and functions in `public` start with no grants. Each migration grants what it needs (`grant select …`, `grant insert …`, `grant execute on function … to authenticated`), and `grants.test.sql` enforces it.
- **`/new-migration` skill:** add the grant step to the rules and template. Drop the now-redundant "revoke from public, anon" line, or keep it as a harmless belt-and-braces step. I'll keep it with a note.
- **`/tenant-feature` skill:** step 1 gains "grant `select, insert, update, delete` on the table to `authenticated` (RLS decides which rows)".
- **`rls-reviewer` agent:** its grants checklist becomes "default privileges deny; explicit grants match what the app calls".
- **Plan 04:** no plan text changes. It follows the updated skills.

## Verification
`/verify all`, then `rls-reviewer`, `security-auditor` and `code-reviewer`. There's no UI change, so no `ui-reviewer`. Confirm in `psql` that `pg_default_acl` for `postgres` in `public` no longer lists `anon` or `authenticated`. The app should work exactly as before; the existing e2e tests show that.

## Commits after approval
`feat(db): deny new tables and functions by default, drop extra grants`, `test: catalog-wide grant checks`, `chore(claude): grant rules in skills, CLAUDE.md and rls-reviewer`, then this plan → Done.

## Notes from the build
- **MAINTAIN.** The foundation tables showed `authenticated=rm` after the first pass. `m` is Postgres 17's MAINTAIN, which allows VACUUM, REINDEX and `LOCK TABLE` on tables every workspace shares. It's revoked too, and the tests check for it.
- **Two more callable functions.** `authenticated` could execute 16 functions, not 14. `assert_can_assign` and `assert_can_manage_member` had picked up the old schema default. They're only called from the `security definer` member RPCs, which run as the owner, so the migration revokes them. Calling them directly could only raise an error, and only in a workspace where the caller already manages members.
- **The global function default reaches `pg_temp` too.** `foundation.test.sql` creates a `pg_temp.id()` helper that `authenticated` calls, so it now grants itself execute (one line). The plan expected that file to stay unchanged. The `tests` schema helpers were already granted explicitly.
- **Proving the tests bite.** Temporarily granting TRIGGER on `clubs` to `authenticated`, plus EXECUTE on a helper to `anon`, failed three checks (`grants.test.sql` 2 and 6, `clubs.test.sql` 27). Revoking them made everything pass again. The guard hook refused the first attempt because the command contained the word `truncate`, so TRIGGER stood in for it.
- **Unchanged:** app behaviour (14 e2e tests) and database types (`npm run db:types` produced no diff).
- **Reviews** (`code-reviewer`, `security-auditor`, `rls-reviewer`): no critical or high findings. Fixed from them:
  - **`grants.test.sql` (now 17 checks):**
    - materialized views and foreign tables (no RLS possible) can't be readable by `authenticated`;
    - column-level REFERENCES is checked;
    - views are checked by column privilege and any spelling of `security_invoker = true`;
    - every `security definer` function pins `search_path = ""`;
    - `search_path` is pinned so the allowlist reads the same everywhere;
    - the behaviour checks read the rename back and read one's own profile.
  - **Docs and skills:**
    - the function default applies in every schema;
    - `execute` is needed for anything that runs as the caller (policies, defaults, checks, invoker triggers);
    - auth hooks grant only to `supabase_auth_admin`;
    - no `serial` ids, extensions go in `extensions`, and schema objects are created only through migrations (Studio runs as `supabase_admin`);
    - tenant tests need a `lives_ok` next to every `42501`, since a missing grant also raises 42501.
- **The foundation tables only had SELECT because of a platform default.** Setting `auto_expose_new_tables = false` in `config.toml` (as `security-auditor` suggested) made `authenticated` lose `select` on `workspaces`, `profiles` and `memberships`. The foundation migration had never granted it; it only revoked what it didn't want. This migration now grants it explicitly. With the setting `true` or `false`, `anon` and `authenticated` end up with identical privileges and pgTAP passes both ways (checked by resetting with each). Only `service_role` differs.

## Follow-ups
- **`service_role` grants:** with auto-expose off, `service_role` keeps only `Dxtm` on new tables, with no select, insert or update. The app doesn't use it today. The first plan that does (alerts or cron, plan 07) grants it explicitly.
- **Plan 08 (deploy docs):**
  - the hosted project must run Postgres 17 (this migration revokes MAINTAIN);
  - its Data API "expose new tables" setting must be off to match `config.toml`.
