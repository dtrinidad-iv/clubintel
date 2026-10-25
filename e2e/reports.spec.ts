import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

// The server runs with AI_PROVIDER=fake (playwright.config.ts): a fixed sample report, no network.
// Generating happens in a new workspace each run, so the hourly limit never builds up.

async function signUpWithWorkspace(page: Page) {
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Rory Reports");
  await page.getByLabel("Email").fill(`e2e-reports-${Date.now()}@test.local`);
  await page.getByLabel("Password").fill("e2e-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Workspace name").fill("Reports FC");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("an owner generates a report that fills in live, approves it, and the budget stops the next one", async ({ page }) => {
  await signUpWithWorkspace(page);
  await page.getByRole("link", { name: "Reports" }).click();
  await expect(page.getByRole("heading", { name: "No reports yet" })).toBeVisible();

  await page.getByLabel("Focus (optional)").fill("hospitality");
  await page.getByRole("button", { name: "Generate report" }).click();
  // Sections appear while it's still writing.
  const live = page.getByTestId("report-live");
  await expect(live.getByRole("heading", { name: "Highlights" })).toBeVisible();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await expect(live.getByRole("heading", { name: "Clubs to watch" })).toBeVisible();

  const listed = page.getByTestId("report-list").getByRole("listitem").first();
  await expect(listed).toContainText("Focus: hospitality");
  await expect(listed).toContainText("Draft");

  await page.getByRole("link", { name: "Open the report" }).click();
  await expect(page.getByTestId("report-meta")).toContainText("Sample output");
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByTestId("report-meta")).toContainText("Approved by Rory Reports");
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);

  // The call shows in Settings → AI usage; a zero budget stops the next report.
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("cell", { name: "fake" })).toBeVisible();
  await page.getByLabel("Monthly budget (US$)").fill("0");
  await page.getByRole("button", { name: "Save budget" }).click();
  await expect(page.getByText("Budget saved.")).toBeVisible();

  await page.getByRole("link", { name: "Reports" }).click();
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("This month's AI budget is used up.");
});

test("a viewer reads reports but can't generate or approve them", async ({ page }) => {
  await signIn(page, "viewer@clubintel.test");
  await page.goto("/reports");
  await expect(page.getByTestId("report-list")).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate report" })).toHaveCount(0);

  // Seeded as a draft; it may have been reviewed by hand since the last reset, so the status isn't checked.
  await page.getByRole("link", { name: "Hospitality review" }).click();
  await expect(page.getByRole("heading", { name: "Risks" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
});

test("only owners and admins see AI usage", async ({ page }) => {
  await signIn(page, "analyst@clubintel.test");
  await page.goto("/settings");
  await expect(page.getByLabel("Name")).toBeVisible();
  await expect(page.getByText("AI usage", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Monthly budget (US$)")).toHaveCount(0);
});

test("another workspace's report is not found", async ({ page, browser }) => {
  await signIn(page, "viewer@clubintel.test");
  await page.goto("/reports");
  const href = await page.getByRole("link", { name: "Hospitality review" }).getAttribute("href");

  const agency = await browser.newPage();
  await signIn(agency, "agency@clubintel.test");
  await agency.goto("/reports");
  await expect(agency.getByRole("heading", { name: "No reports yet" })).toBeVisible();
  await agency.goto(href!);
  await expect(agency.getByRole("heading", { name: "Report not found" })).toBeVisible();
  await agency.close();
});

test("signed-out API calls are refused, and cross-site ones too", async ({ page, request }) => {
  const anonymous = await request.post("/api/ai/reports", { data: {}, headers: { origin: "http://localhost:3020" } });
  expect(anonymous.status()).toBe(401);

  await signIn(page, "analyst@clubintel.test");
  const crossSite = await page.request.post("/api/ai/reports", { data: {}, headers: { origin: "https://evil.example" } });
  expect(crossSite.status()).toBe(403);
});

test("on a phone the reports page fits the screen @mobile", async ({ page }) => {
  await signIn(page, "analyst@clubintel.test");
  await page.goto("/reports");
  await expect(page.getByTestId("report-list")).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate report" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
});
