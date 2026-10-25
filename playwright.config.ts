import { execSync } from "node:child_process";
import { defineConfig, devices } from "@playwright/test";

// The local stack's secret key, read from `supabase status` so it never lives in a file. The
// server needs it for the AI report writes.
function localSecretKey(): string | undefined {
  if (process.env.SUPABASE_SECRET_KEY) return process.env.SUPABASE_SECRET_KEY;
  try {
    return JSON.parse(execSync("supabase status -o json", { stdio: ["ignore", "pipe", "ignore"] }).toString()).SECRET_KEY;
  } catch {
    return undefined;
  }
}

const secretKey = localSecretKey();

// Runs against a production build on :3020 and the local Supabase stack (`npm run db:start`).
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://localhost:3020", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, grepInvert: /@mobile/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: {
    command: "npm run start",
    // Reports use the fake AI provider: no network, no key, no cost.
    env: { AI_PROVIDER: "fake", ...(secretKey ? { SUPABASE_SECRET_KEY: secretKey } : {}) },
    url: "http://localhost:3020",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
