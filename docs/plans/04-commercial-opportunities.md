# 04 — Commercial opportunities

**Status:** Done
**Commits:** `1ab7ed4` (db), `f485231` (web), `4a2a936` (tests), `5aa8ec8` (claude)

## Goal
The first tenant-owned feature, built with `/tenant-feature`. A workspace tracks commercial opportunities (sponsorships, partnerships, hospitality, media) against clubs from the national database, plus the contacts behind them.

## Decisions
- `opportunities`:
  - `workspace_id`, `club_id` → `clubs`, `title`, `partner_name`;
  - `category` enum (sponsorship, hospitality, media, partnership, other);
  - `value_gbp` numeric(12,2) ≥ 0;
  - `stage` enum (lead, qualified, proposal, negotiation, won, lost);
  - `owner_id` (must be a member), `expected_close_date`, `notes`, timestamps, `stage_changed_at`.
- `contacts`: `workspace_id`, `club_id` (nullable), `name`, `email`, `role_title`, `phone`, `notes`.
- `workspace_id` is set by a trigger from `current_workspace()` and can't change on update. Insert policies require `can(workspace_id, 'opportunities.write')`.
- Permissions are added to `role_permissions`:

  | Permission | Viewer | Analyst | Admin | Owner |
  |---|---|---|---|---|
  | `opportunities.view` | ✓ | ✓ | ✓ | ✓ |
  | `opportunities.write` | | ✓ | ✓ | ✓ |
  | `opportunities.delete` | | | ✓ | ✓ |

- `owner_id` must be a member of the same workspace, checked in a trigger so another workspace's user id can't be linked.
- UI: a table view with filters and a kanban by stage (moving a card is a Server Action, with an optimistic update). Create and edit dialogs use zod, sharing one schema between client and server.

## Decisions made at the start of the build
- **Contacts get the full feature** (user's choice):
  - a `/contacts` page with list, create, edit and delete;
  - `contacts.view`, `contacts.write` and `contacts.delete`, with the same role matrix as opportunities;
  - an optional contact on each opportunity.
- **Kanban:** drag and drop with `@dnd-kit/core` (new dependency, approved). Every card also has a "Move to…" menu, so keyboard and touch users don't depend on dragging.
- **Same-workspace references are enforced by composite foreign keys, not triggers:**
  - `(workspace_id, contact_id)` → `contacts (workspace_id, id)`;
  - `(workspace_id, owner_id)` → `memberships (workspace_id, user_id)`.

  Postgres itself then guarantees that the contact is in the same workspace and the owner is a member of it. Removing a member or deleting a contact clears only that column (`on delete set null (col)`). A forged id fails the same way whether or not it exists in another workspace, so nothing can be inferred.
- **`club_id`** → `clubs` is `on delete restrict`: shared data can't take tenant rows with it.
- **One generic trigger function**, `public.tenant_row_defaults()`, reused by later tenant tables:
  - on insert, sets `workspace_id` from `current_workspace_id()` (refusing when there is none) and `created_by` from `auth.uid()`;
  - on update, refuses a `workspace_id` change and keeps `created_by` and `created_at`;
  - stamps `updated_at`.

  A separate trigger stamps `stage_changed_at`.
- **Grants** follow plan 09: `select, insert, update, delete` to `authenticated`; RLS decides the rows.
- **Write actions return a permission error instead of throwing**, through a new DAL helper `checkPermission()`. A direct call by a viewer gets a message rather than an error page.
- **Editing is in dialogs.** There's no opportunity detail page in this plan.

## Tests
- pgTAP:
  - **workspace A cannot read, insert into, update or delete in B**;
  - a forged `workspace_id` on insert is overridden or refused;
  - a cross-workspace `owner_id` is refused;
  - the permission matrix per role.
- Vitest: opportunity schema.
- Playwright: an analyst creates and moves an opportunity; a viewer sees no create button and a direct Server Action call fails.

## Verification
`/verify`, plus `rls-reviewer`, `security-auditor`, `code-reviewer` and `ui-reviewer`.

## Notes from the build
- **Database:** migration `opportunities_and_contacts` adds:
  - the two enums and two tables;
  - six permissions (`role_permissions` replaced, keeping every existing entry);
  - the shared `tenant_row_defaults()` trigger, plus `stamp_stage_change()`;
  - one policy per command on each table, and explicit grants (plan 09).

  Also:
  - `workspace_id` defaults to `current_workspace_id()`. That only makes it optional in the generated insert types; the trigger still sets it.
  - `stage_changed_at` can't be forged: a non-stage update keeps the old value even if one is sent.
  - `opportunities.search_text` is a generated column (title + partner) with a trigram index. Search is then one escaped `ilike` rather than an `.or()` filter string built from user input. `likePattern()` moved to `src/lib/search.ts` for clubs and opportunities.
- **pgTAP:** `opportunities.test.sql` (33) and `contacts.test.sql` (20). Each refusal sits next to the allowed case. They cover:
  - forged `workspace_id`;
  - cross-workspace contact and owner links (23503);
  - moving rows between workspaces;
  - no active workspace;
  - member removal clearing ownership;
  - deleting a contact only unlinking its opportunities;
  - the permission matrix.

  Loosening both read policies to `using (true)` failed five isolation checks; after a reset everything passed again.
- **Seed:** `supabase/seeds/demo-pipeline.sql` is hand-written. It signs in as each demo owner, so its rows go through the triggers and RLS: 12 opportunities and 6 contacts for Northbridge, and 1 of each for the agency. It grants its own `pg_temp` helper, because of plan 09's function default.
- **Board** (`@dnd-kit/core`):
  - pointer, touch (press and hold) and keyboard sensors;
  - arrow keys jump a whole stage (a custom coordinate getter), since the default 25px step never reached the next column;
  - screen-reader announcements name the deal and the stage, and the e2e test waits on them;
  - `DndContext` gets a `useId()` id, so its generated aria ids match between server and client;
  - columns have a fixed width and the board scrolls sideways. `grid-cols-1` (`minmax(0, 1fr)`) lets long titles truncate instead of widening the cards.
- **Hydration fixes:**
  - compact currency (`£786k`) is formatted by hand, because Intl's compact notation differs between Node's and the browser's locale data;
  - `formatDate` formats in UTC.
- **A bug the e2e tests found (fixed):** form fields used their field name as the element id. Next keeps visited routes mounted but hidden, so after signing in, the login form's `#email` was still in the page, and the contact dialog's "Email" label pointed at it. `Field`, `SelectField` and `TextareaField` (and the settings role select) now use `useId()`. Recorded in `CLAUDE.md`.
- **Permission errors as messages:** `checkPermission()` and `NO_PERMISSION` in the DAL. The e2e test opens the form as an analyst, swaps in a viewer's session cookies and submits, and gets "You don't have permission to do that."
- **Reviews** (`code-reviewer`, `security-auditor`, `rls-reviewer`, `ui-reviewer`): no critical or high findings. Fixed from them:
  - **Column-level grants** (RLS, medium). Insert and update cover only the editable columns. Choosing an `id` would have let A confirm that one of B's uuids exists, through a duplicate-key error; `workspace_id` and the timestamps are the database's too. pgTAP now covers an insert with `id` or `workspace_id`, and an update of `id`.
  - **Emails and phones** (security, low). The database and zod refuse `? & # % , ;` in emails, which would add headers to a `mailto:` link, and phones must be digits and separators. A missing club gets its own message.
  - **Actions** (code):
    - deletes check that a row went;
    - "no longer exists" refreshes the page, so a stale card disappears;
    - every error returns what was typed, including the permission error. The e2e test checks the field still holds it.
  - **Contacts split out** into `src/lib/contacts.ts` and `src/lib/contact-actions.ts`. The contacts page loads only the club list (`clubOptions()` in `clubs.ts`).
  - **Dialogs** (`useDialogState`): focus returns to the button or menu that opened them; titles no longer blank during the exit animation; forms use `noValidate`, so every error, the club included, shows inline from zod.
  - **Layout:** tables switch in at `lg`, not `md`; at 768px the sidebar left the Actions column scrolled out of view. Summary amounts stay compact until `lg`.
  - **Expired session mid-form:** the proxy redirected the Server Action's POST to `/login`, and the client showed "Couldn't load opportunities". The proxy now redirects page loads only, and the action's DAL call sends the user to sign in. There's an e2e test.
  - **Smaller fixes:**
    - `formatGbp` picks the unit after rounding (999,950 is £1m);
    - friendly length messages;
    - the board's context value is memoised;
    - the list notes when it hits its 500-row cap;
    - summary totals are labelled when filters apply.

- **A flaky keyboard-drag e2e test, traced and fixed.** Against the production build, the board test failed in 3 of 4 runs.
  - **Why the first arrow press got lost:** the "over Qualified" announcement fires the moment a drag starts. dnd-kit measures on the next frames, and the test pressed ArrowRight inside that window.
  - **Why the drag scrolled:** a target past the middle of the sideways-scrolling board makes dnd-kit scroll the board under the card rather than move it.
  - **Fixes:**
    - the coordinate getter reads the column's live position;
    - keyboard scrolling is instant (`scrollBehavior: "auto"`);
    - the test lets two animation frames pass after each announcement.

  12 of 12 runs then passed. A person never presses within a frame of picking a card up, so users weren't affected.

## Follow-ups
- **Pipeline totals:** they come from the rows shown (at most 500). Plan 05's dashboard should aggregate in SQL.
- **`created_by`:** it keeps a removed member's user id, visible only inside the workspace. Decide on retention when plan 06/07 adds history.
