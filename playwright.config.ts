import { defineConfig, devices } from "@playwright/test";

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
    url: "http://localhost:3020",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
