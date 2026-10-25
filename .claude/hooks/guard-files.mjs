#!/usr/bin/env node
// PreToolUse(Write|Edit|MultiEdit):
//  1. never write a secret key into the repo
//  2. never edit a committed migration (it may already be applied in production)
//  3. never edit env files other than .env.example
//  4. browser code never reads server-only secrets
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { decide, findSecret, incomingText, projectDir, readEvent, relPath } from "./lib.mjs";

const { tool_input: input = {} } = readEvent();
const file = relPath(input.file_path);
const text = incomingText(input);

const secret = findSecret(text);
if (secret) {
  decide("deny", `Blocked: this content contains a ${secret}. Keep secrets in env vars that only the server reads; only the publishable key may appear in the repo.`);
}

if (/^supabase\/migrations\/.+\.sql$/.test(file) && existsSync(input.file_path)) {
  let committed = false;
  try {
    execFileSync("git", ["cat-file", "-e", `HEAD:${file}`], { cwd: projectDir(), stdio: "ignore" });
    committed = true;
  } catch {
    // new or uncommitted migration: fine to edit
  }
  if (committed) {
    decide("deny", `Blocked: ${file} is committed and may already be applied in production. Add a new migration instead (/new-migration).`);
  }
}

if (/(^|\/)\.env(\.|$)/.test(file) && !file.endsWith(".env.example")) {
  decide("deny", `Blocked: ${file} holds real settings. Add new keys to .env.example with a comment and tell the user what to set.`);
}

if (/^src\/.+\.(ts|tsx)$/.test(file)) {
  const before = existsSync(input.file_path) ? readFileSync(input.file_path, "utf8") : "";
  const isClient = /^\s*["']use client["']/m.test(input.content ?? before);
  const serverSecret = /process\.env\.(SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|ANTHROPIC_API_KEY|CRON_SECRET)\b/;
  if (isClient && serverSecret.test(text)) {
    decide("deny", `Blocked: ${file} is a Client Component and would ship this secret to the browser. Read it in server-only code (import "server-only").`);
  }
  if (/NEXT_PUBLIC_[A-Z_]*(SECRET|SERVICE_ROLE|API_KEY)/.test(text)) {
    decide("deny", "Blocked: NEXT_PUBLIC_ variables are bundled into browser code. Secrets must not use that prefix.");
  }
}
process.exit(0);
