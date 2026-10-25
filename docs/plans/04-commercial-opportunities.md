# 04 — Commercial opportunities

**Status:** Proposed

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
