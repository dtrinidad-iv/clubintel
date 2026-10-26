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
  // CI also writes the HTML report, uploaded when a run fails.
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:3020", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, grepInvert: /@mobile|@screenshots/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/, grepInvert: /@screenshots/ },
    // `npm run screenshots` only: rewrites docs/screenshots/ from the seeded demo.
    ...(process.env.SCREENSHOTS
      ? [{ name: "screenshots", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, colorScheme: "light" as const, reducedMotion: "reduce" as const }, grep: /@screenshots/ }]
      : []),
  ],
  webServer: {
    command: "npm run start",
    // Reports use the fake AI provider: no network, no key, no cost.
    env: { AI_PROVIDER: "fake", ...(secretKey ? { SUPABASE_SECRET_KEY: secretKey } : {}) },
    url: "http://localhost:3020",
    // Screenshots always start their own server, so a running dev server (and its dev
    // indicator) can never end up in the images.
    reuseExistingServer: !process.env.CI && !process.env.SCREENSHOTS,
    timeout: 60_000,
  },
});
