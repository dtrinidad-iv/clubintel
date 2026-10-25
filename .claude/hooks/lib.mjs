// Shared helpers for Claude Code hooks. Hooks get the event as JSON on stdin.
import { readFileSync } from "node:fs";
import { relative } from "node:path";

export function readEvent() {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

export const projectDir = () => process.env.CLAUDE_PROJECT_DIR || process.cwd();

export function relPath(file) {
  return file ? relative(projectDir(), file).split("\\").join("/") : "";
}

// PreToolUse decision: "deny" | "ask". Exits.
export function decide(decision, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision, permissionDecisionReason: reason },
    }),
  );
  process.exit(0);
}

// Exit 2 = blocking feedback shown to Claude (PostToolUse: the edit happened, Claude must fix it).
export function feedback(message) {
  process.stderr.write(message);
  process.exit(2);
}

// The text a Write/Edit/MultiEdit call is about to put in a file.
export function incomingText(input = {}) {
  if (typeof input.content === "string") return input.content;
  if (typeof input.new_string === "string") return input.new_string;
  if (Array.isArray(input.edits)) return input.edits.map((e) => e.new_string || "").join("\n");
  return "";
}

// Describes the first Supabase secret found in text, or null.
// Talking about "the service role key" is fine; an actual key value is not.
export function findSecret(text = "") {
  if (/\bsb_secret_[A-Za-z0-9_-]{8,}/.test(text)) return "Supabase secret key (sb_secret_…)";
  for (const jwt of text.match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []) {
    try {
      const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
      if (payload.role === "service_role") return "service_role JWT";
    } catch {
      // not a JWT we can read
    }
  }
  if (/\bsk-ant-[A-Za-z0-9_-]{20,}/.test(text)) return "Anthropic API key";
  return null;
}
