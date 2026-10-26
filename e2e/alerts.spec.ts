import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

// The full flow runs in a new workspace each time, so repeated runs don't depend on read state
// or the once-a-minute limit in the demo workspace. Per-person read state is covered in pgTAP.

async function signUpWithWorkspace(page: Page) {
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Alex Alerts");
  await page.getByLabel("Email").fill(`e2e-alerts-${Date.now()}@test.local`);
  await page.getByLabel("Password").fill("e2e-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Workspace name").fill("Alerts FC");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function pick(page: Page, label: string, option: string) {
  await page.getByRole("dialog").getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

// A date in London, where the alert checks count days (en-CA formats as YYYY-MM-DD).
const daysAgo = (n: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date(Date.now() - n * 86_400_000));

test("a rule raises an alert, the badge counts it, and its link opens that exact deal", async ({ page }) => {
  await signUpWithWorkspace(page);

  // A deal three days past its close date.
  await page.goto("/opportunities");
  await page.getByRole("button", { name: "New opportunity" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Overdue boxes");
  await dialog.getByLabel("Partner").fill("E2E Partner");
  await pick(page, "Club", "Caerwen City");
  await dialog.getByLabel("Expected close").fill(daysAgo(3));
  await dialog.getByRole("button", { name: "Add opportunity" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("link", { name: "Alerts", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No alerts yet" })).toBeVisible();
  await page.getByRole("link", { name: "Manage rules" }).click();
  await page.getByRole("button", { name: "New rule" }).click();
  await pick(page, "Alert when", "A close date passes");
  await page.getByRole("dialog").getByRole("button", { name: "Add rule" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByTestId("rule")).toContainText("An open deal is past its expected close date.");

  await page.getByRole("link", { name: "Alerts", exact: true }).first().click();
  await page.getByRole("button", { name: "Run checks now" }).click();
  await expect(page.getByText("1 new alert.")).toBeVisible();
  const alert = page.getByTestId("alert").filter({ hasText: "Close date passed: Overdue boxes" });
  await expect(alert).toContainText("3 days ago");
  await expect(page.getByTestId("alerts-badge")).toHaveText("1");

  // Again straight away: politely refused.
  await page.getByRole("button", { name: "Run checks now" }).click();
  await expect(page.getByText("Checks ran less than a minute ago. Try again shortly.")).toBeVisible();

  await alert.getByRole("button", { name: /^Mark ".*" read$/ }).click();
  await expect(page.getByTestId("alerts-badge")).toHaveCount(0);
  await expect(alert).toHaveAttribute("data-read", "true");

  await alert.getByRole("link", { name: "Close date passed: Overdue boxes" }).click();
  await expect(page).toHaveURL(/\/opportunities\?id=/);
  await expect(page.getByTestId("opportunity-row")).toHaveCount(1);
  await expect(page.getByTestId("opportunity-row")).toContainText("Overdue boxes");
});

test("a viewer reads alerts and rules but can't run checks or change rules", async ({ page }) => {
  await signIn(page, "viewer@clubintel.test");
  await page.goto("/alerts");
  await expect(page.getByTestId("alert-list")).toContainText("Attendance down at Ashmarket Town");
  await expect(page.getByRole("button", { name: "Run checks now" })).toHaveCount(0);
  await page.getByRole("link", { name: "See rules" }).click();
  await expect(page.getByTestId("rule-list")).toContainText("Ashmarket Town");
  await expect(page.getByRole("button", { name: "New rule" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Turn (off|on):/ })).toHaveCount(0);
});

test("a rule form keeps its choices after an error", async ({ page }) => {
  await signIn(page, "admin@clubintel.test");
  await page.goto("/alerts/rules");
  await page.getByRole("button", { name: "New rule" }).click();
  await pick(page, "Alert when", "A club's attendance drops");
  await page.getByRole("dialog").getByRole("button", { name: "Add rule" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Choose a club", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "Alert when" })).toHaveText("A club's attendance drops");
});

test("alerts fit a phone screen @mobile", async ({ page }) => {
  await signIn(page, "viewer@clubintel.test");
  await page.goto("/alerts");
  await expect(page.getByTestId("alert-list")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
});
