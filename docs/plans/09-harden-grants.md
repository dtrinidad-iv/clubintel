# 09 — Harden grants: deny by default

**Status:** Proposed

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
