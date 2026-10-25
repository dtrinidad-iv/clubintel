#!/usr/bin/env node
// PreToolUse(Bash): refuse commands that destroy data or history, and make anything
// that touches production, GitHub or Vercel wait for a human.
import { decide, readEvent } from "./lib.mjs";

const cmd = String(readEvent().tool_input?.command || "");

const DENY = [
  [/\bgit\s+push\b[^\n]*(\s--force\b|\s-f\b|\s--force-with-lease\b)/, "Force-pushing rewrites shared history. Push normally or ask the user."],
  [/\bsupabase\s+db\s+reset\b[^\n]*--(linked|db-url)\b/, "This would wipe a remote (production) database. Only reset the local stack."],
  [/\bsupabase\s+projects\s+delete\b/, "Deleting a Supabase project is irreversible."],
  [/\brm\s+-[a-z]*r[a-z]*\s+[^\n]*supabase\/migrations/, "Migrations are the database's history. Write a new migration instead of deleting one."],
  [/\b(psql|docker\s+exec)\b[^\n]*\b(drop\s+(table|schema|database)|truncate)\b/i, "Dropping or truncating tables by hand bypasses migrations. Write a migration, or ask the user."],
  [/\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f)/, "This throws away uncommitted work. Ask the user first."],
];

const ASK = [
  [/\bsupabase\s+(db\s+push|link|secrets\s+set|functions\s+deploy)\b/, "Changes the linked Supabase project (production)."],
  [/\bgit\s+push\b/, "Publishes commits to GitHub."],
  [/\bgh\s+(repo\s+(create|delete|edit|rename)|release|pr\s+merge)\b/, "Changes the GitHub repository."],
  [/\b(npx\s+)?vercel\b(?!\s+(--version|help|ls|list|inspect|logs)\b)/, "Deploys or changes the Vercel project."],
];

for (const [re, reason] of DENY) if (re.test(cmd)) decide("deny", `Blocked by project hook: ${reason}`);
for (const [re, reason] of ASK) if (re.test(cmd)) decide("ask", `Needs your OK: ${reason}`);
process.exit(0);
