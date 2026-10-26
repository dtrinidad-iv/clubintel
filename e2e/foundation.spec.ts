import { expect, test } from "./fixtures";
import { signIn, switchWorkspace } from "./helpers";

test("sign up, create a workspace and land on its dashboard", async ({ page }) => {
  const email = `e2e-${Date.now()}@test.local`;
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Erin Example");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("e2e-password");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Workspace name").fill("Test FC");
  await page.getByRole("button", { name: "Create workspace" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByTestId("current-workspace")).toHaveText("Test FC");
});

test("signed-out visitors are sent to sign in, and come back after", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login\?next=%2Fsettings$/);
  await page.getByLabel("Email").fill("viewer@clubintel.test");
  await page.getByLabel("Password").fill("demo1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/settings$/);
});

test("a wrong password shows one generic error and keeps the email", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("owner@clubintel.test");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("That email and password don't match an account.");
  await expect(page.getByLabel("Email")).toHaveValue("owner@clubintel.test");
});

test("switching workspace shows only that workspace's members", async ({ page }) => {
  await signIn(page, "owner@clubintel.test");
  await switchWorkspace(page, "Northbridge Athletic Commercial");
  await switchWorkspace(page, "Demo Sports Agency");

  await page.goto("/settings");
  await expect(page.getByTestId("member-agency@clubintel.test")).toBeVisible();
  await expect(page.getByTestId("member-viewer@clubintel.test")).toHaveCount(0);

  // Leave the demo account where it started.
  await switchWorkspace(page, "Northbridge Athletic Commercial");
  await page.goto("/settings");
  await expect(page.getByTestId("member-viewer@clubintel.test")).toBeVisible();
});

test("a viewer sees members but no management controls", async ({ page }) => {
  await signIn(page, "viewer@clubintel.test");
  await page.goto("/settings");
  await expect(page.getByTestId("member-owner@clubintel.test")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add member" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Manage / })).toHaveCount(0);
  await expect(page.getByLabel("Name")).toBeDisabled();
});

test("an admin manages members ranked below them, but not the owner", async ({ page }) => {
  await signIn(page, "admin@clubintel.test");
  await page.goto("/settings");
  await expect(page.getByRole("button", { name: "Manage Olivia Owner" })).toHaveCount(0);

  const analyst = page.getByTestId("member-analyst@clubintel.test");
  await page.getByRole("button", { name: "Manage Ana Analyst" }).click();
  await page.getByRole("menuitem", { name: "Make viewer" }).click();
  await expect(analyst.getByText("Viewer", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Manage Ana Analyst" }).click();
  await page.getByRole("menuitem", { name: "Make analyst" }).click();
  await expect(analyst.getByText("Analyst", { exact: true })).toBeVisible();
});

test("the sidebar opens as a sheet on mobile @mobile", async ({ page }) => {
  await signIn(page, "owner@clubintel.test");
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await expect(page.getByTestId("current-workspace")).toBeVisible();
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
});
