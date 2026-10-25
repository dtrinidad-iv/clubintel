#!/usr/bin/env node
// SessionStart: open plans (so work resumes where it stopped) and whether local Supabase is up.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { projectDir } from "./lib.mjs";

const lines = [];

const index = join(projectDir(), "docs/plans/README.md");
if (existsSync(index)) {
  const open = readFileSync(index, "utf8")
    .split("\n")
    .map((row) => row.match(/^\|\s*(\d+)\s*\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*(\w+)\s*\|/))
    .filter((m) => m && m[4] !== "Done")
    .map((m) => `- ${m[1]} ${m[4]}: ${m[2]} (docs/plans/${m[3]})`);
  if (open.length) {
    lines.push("Open plans (docs/plans/README.md):", ...open, "Read a plan before continuing it. New work: plan first (/plan-task or plan mode).");
  }
}

try {
  const out = execFileSync("supabase", ["status", "-o", "env"], {
    cwd: projectDir(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 8000,
  });
  lines.push(/API_URL=/.test(out) ? "Local Supabase is running (API :55321, Studio :55323, Mailpit :55324)." : "Local Supabase status unknown.");
} catch {
  lines.push("Local Supabase is NOT running. Start it with `npm run db:start` (colima/Docker first) before database or e2e tests.");
}

process.stdout.write(
  JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: lines.join("\n") } }),
);
