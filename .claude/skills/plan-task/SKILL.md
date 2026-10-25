---
name: plan-task
description: Write a task plan in docs/plans/NN-task-name.md with Status Proposed, add it to the index, and stop for approval. Use before building anything that touches more than 3 files, or whenever the user asks for a plan.
argument-hint: "[task description]"
---

# Plan a task

Task: $ARGUMENTS

## Steps
1. **Read first.** Read CLAUDE.md, `docs/plans/README.md` and the plans this task builds on. Open the real code you'll change, plus the Next docs in `node_modules/next/dist/docs/` for any Next API you'll use. Don't plan against code or docs you haven't opened.
2. **Ask only about real forks**, where the answer changes the plan. For anything with an obvious default, choose it and say so under Decisions.
3. **Number and name.** The next `NN` is the highest in `docs/plans/` + 1, zero-padded. Name the file after the task in kebab-case, e.g. `09-club-notes.md`. If a Proposed plan for this task already exists, update it instead.
4. **Write the plan** with the template below. Name the actual tables, functions, policies, routes, files and tests.
5. **Add a row** to `docs/plans/README.md`: `| NN | [Title](NN-task-name.md) | Proposed |`.
6. **Stop.** Summarize in a few lines and ask for approval. Build nothing until the user says go. On approval, set Status to **WIP** in the plan and the index.

In plan mode the same applies: when the user approves, save the plan to the next `NN` file with this template and Status **WIP** before writing code.

## Template
```markdown
# NN — Title

**Status:** Proposed

## Goal
What this adds and why, in 2-3 sentences. What is explicitly out of scope.

## Decisions
Choices made, with one line on why. Any new dependency and why it's needed (it needs the user's OK).

## Database (`supabase/migrations/`)
Tables (tenant-owned → `workspace_id` set by trigger), constraints and indexes, functions (`security definer` + `search_path = ''` only when needed), new permissions in `role_permissions`, and the RLS policy for each command (select, insert, update, delete).

## App (`src/`)
DAL queries, Server Actions (zod schema, permission), Route Handlers, pages and components, navigation.

## Tests
pgTAP: **workspace A cannot read or write B** for every tenant table, plus the permission matrix. Vitest for logic and schemas. Playwright for the user flow.

## Verification
`/verify all`, the reviewers that fit (code, security and RLS always; UI when pages change), and screenshots for new pages.

Flows: numbered user steps, each with the expected result.

## Commits after approval
`feat(db): ...`, `feat(web): ...`, `test: ...`, then this plan → Done.
```

## Rules
- A workspace id from the client is never proof of access. Server code takes it from the DAL, and RLS checks membership.
- Never edit a committed migration; plan a new one.
- New env keys go in `.env.example` with a comment.
