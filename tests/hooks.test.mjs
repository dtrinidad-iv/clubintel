// Tests for the Claude Code hooks in .claude/hooks. Each hook gets the same JSON
// Claude Code sends on stdin. Run: npm run test:hooks
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOOKS = join(ROOT, ".claude/hooks");

function run(hook, event) {
  const r = spawnSync(process.execPath, [join(HOOKS, hook)], {
    input: JSON.stringify(event),
    env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT },
    encoding: "utf8",
  });
  let decision = null;
  try {
    decision = JSON.parse(r.stdout).hookSpecificOutput.permissionDecision ?? null;
  } catch {
    // no decision printed
  }
  return { code: r.status, decision, stdout: r.stdout, stderr: r.stderr };
}

const bash = (command) => run("guard-bash.mjs", { tool_name: "Bash", tool_input: { command } });
const write = (file, content) => run("guard-files.mjs", { tool_name: "Write", tool_input: { file_path: join(ROOT, file), content } });
const edit = (file, new_string) =>
  run("guard-files.mjs", { tool_name: "Edit", tool_input: { file_path: join(ROOT, file), old_string: "x", new_string } });

// Shape of the local demo keys `supabase start` prints (public, the same on every machine).
const jwt = (role) =>
  ["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", Buffer.from(JSON.stringify({ iss: "supabase-demo", role })).toString("base64url"), "sig"].join(".");

test("bash: destructive commands are denied", () => {
  for (const c of [
    "git push --force origin main",
    "git push -f",
    "supabase db reset --linked",
    "supabase db reset --db-url postgres://prod",
    "supabase projects delete abc",
    "rm -rf supabase/migrations",
    'docker exec supabase_db_clubintel psql -U postgres -c "DROP TABLE workspaces"',
    'psql $DB -c "truncate memberships"',
    "git reset --hard HEAD~1",
  ]) {
    assert.equal(bash(c).decision, "deny", c);
  }
});

test("bash: production, GitHub and Vercel changes ask the user", () => {
  for (const c of ["supabase db push", "supabase link --project-ref x", "git push origin main", "gh repo create clubintel --private", "npx vercel --prod", "vercel env add"]) {
    assert.equal(bash(c).decision, "ask", c);
  }
});

test("bash: everyday commands pass through", () => {
  for (const c of [
    "npm test",
    "supabase db reset",
    "supabase test db",
    "supabase status",
    "git status",
    'git commit -m "feat: drop table support in the UI"',
    "vercel --version",
    'docker exec supabase_db_clubintel psql -U postgres -tc "select 1"',
  ]) {
    const r = bash(c);
    assert.equal(r.code, 0, c);
    assert.equal(r.decision, null, c);
  }
});

test("files: secret keys are blocked, the publishable key is allowed", () => {
  assert.equal(write("src/lib/x.ts", `const key = "${jwt("service_role")}"`).decision, "deny");
  assert.equal(write("README.md", "SUPABASE_SECRET_KEY=sb_secret_N7UND0UgjKTVK").decision, "deny");
  assert.equal(write("src/lib/ai.ts", 'const k = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz"').decision, "deny");
  assert.equal(write("src/lib/x.ts", `const anon = "${jwt("anon")}"`).decision, null);
  assert.equal(write("README.md", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_abc123").decision, null);
  assert.equal(write("CLAUDE.md", "Never put the service role key in client code.").decision, null);
});

test("files: committed migrations are read-only, new ones are not", () => {
  assert.equal(edit("supabase/migrations/20261025130453_foundation.sql", "-- change").decision, "deny");
  assert.equal(write("supabase/migrations/29990101000000_new.sql", "create table t ();").decision, null);
});

test("files: env files other than .env.example are off limits", () => {
  assert.equal(write(".env.local", "X=1").decision, "deny");
  assert.equal(write(".env", "X=1").decision, "deny");
  assert.equal(edit(".env.example", "# New key\nX=").decision, null);
});

test("files: browser code can't read server secrets", () => {
  const client = '"use client";\nexport const k = process.env.SUPABASE_SECRET_KEY;';
  assert.equal(write("src/components/x.tsx", client).decision, "deny");
  assert.equal(write("src/lib/admin.ts", 'import "server-only";\nexport const k = process.env.SUPABASE_SECRET_KEY;').decision, null);
  assert.equal(write("src/lib/x.ts", "process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY").decision, "deny");
});

test("post-edit: ignores files that aren't TypeScript", () => {
  const r = run("post-edit.mjs", { tool_name: "Edit", tool_input: { file_path: join(ROOT, "README.md") } });
  assert.equal(r.code, 0);
});

test("session-start: lists open plans", () => {
  const r = run("session-start.mjs", { hook_event_name: "SessionStart" });
  assert.equal(r.code, 0);
  const context = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
  assert.match(context, /Open plans/);
  assert.doesNotMatch(context, /01 Done/);
});
