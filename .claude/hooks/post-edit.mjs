#!/usr/bin/env node
// PostToolUse(Write|Edit|MultiEdit): type-check after a TypeScript edit, so errors are
// fixed straight away instead of piling up until the build.
import { execFileSync } from "node:child_process";
import { feedback, projectDir, readEvent, relPath } from "./lib.mjs";

const file = relPath(readEvent().tool_input?.file_path);
if (!/^(src|e2e)\/.+\.(ts|tsx)$/.test(file)) process.exit(0);

try {
  execFileSync("npx", ["--no-install", "tsc", "--noEmit", "--pretty", "false"], {
    cwd: projectDir(),
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    timeout: 90_000,
  });
} catch (error) {
  const out = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim().split("\n").slice(0, 30).join("\n");
  feedback(`TypeScript errors after editing ${file}:\n${out}\n`);
}
process.exit(0);
