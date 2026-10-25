import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

async function signUpWithWorkspace(page: Page) {
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Dana Dashboard");
  await page.getByLabel("Email").fill(`e2e-dash-${Date.now()}@test.local`);
  await page.getByLabel("Password").fill("e2e-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Workspace name").fill("Dashboard FC");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function pick(page: Page, label: string, option: string) {
  await page.getByRole("dialog").getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("a new workspace starts empty, and a won deal shows up as won this quarter", async ({ page }) => {
  await signUpWithWorkspace(page);
  await expect(page.getByTestId("kpi-open-pipeline")).toContainText("£0");
  await expect(page.getByTestId("kpi-win-rate")).toContainText("Nothing closed in 12 months");
  await expect(page.getByText("No open deals yet.").first()).toBeVisible();
  // National context comes from shared data, so it's there from the start.
  await expect(page.getByRole("heading", { name: "National attendance by tier" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Average attendance and capacity/ })).toBeVisible();

  await page.getByRole("link", { name: "Add an opportunity" }).first().click();
  await page.getByRole("button", { name: "New opportunity" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill("First win");
  await dialog.getByLabel("Partner").fill("E2E Partner");
  await pick(page, "Club", "Caerwen City");
  await pick(page, "Stage", "Won");
  await dialog.getByLabel("Value (£)").fill("12345");
  await dialog.getByRole("button", { name: "Add opportunity" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByTestId("kpi-won-this-quarter")).toContainText("£12,345");
  await expect(page.getByTestId("kpi-won-this-quarter")).toContainText("1 deal");
  await expect(page.getByTestId("kpi-win-rate")).toContainText("100%");
  await expect(page.getByTestId("kpi-average-deal-size")).toContainText("£12,345");
  await expect(page.getByRole("img", { name: "Value won by month, last 12 months" })).toBeVisible();
});

test("the demo pipeline fills every section, with an overdue deal first", async ({ page }) => {
  await signIn(page, "viewer@clubintel.test");
  for (const tile of ["open-pipeline", "won-this-quarter", "win-rate", "average-deal-size", "stale-deals"]) {
    await expect(page.getByTestId(`kpi-${tile}`)).toBeVisible();
  }
  for (const name of ["Open pipeline value by stage", "Value won by month, last 12 months", "Open pipeline value by league tier"]) {
    await expect(page.getByRole("img", { name })).toBeVisible();
  }
  await expect(page.getByTestId("upcoming").getByRole("listitem").first()).toContainText("Overdue");
  // A viewer gets no write prompts.
  await expect(page.getByRole("link", { name: "Add an opportunity" })).toHaveCount(0);
});

test("on a phone the key numbers stack in one column, and the page hydrates cleanly @mobile", async ({ page }) => {
  await signIn(page, "viewer@clubintel.test");
  // A full load, where the sidebar streams in after the provider has switched to mobile.
  // React recovers from a hydration mismatch by re-rendering, so only the console shows it.
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.reload();
  await expect(page.getByTestId("upcoming")).toBeVisible();
  // Production logs the minified errors (#418, #423, #425) instead of the word.
  expect(errors.filter((e) => /hydrat|#41[89]|#42[35]/i.test(e))).toEqual([]);

  const first = await page.getByTestId("kpi-open-pipeline").boundingBox();
  const second = await page.getByTestId("kpi-won-this-quarter").boundingBox();
  expect(first && second && second.y > first.y && Math.abs(second.x - first.x) < 1).toBe(true);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
