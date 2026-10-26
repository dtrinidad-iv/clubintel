import { expect, type Page } from "@playwright/test";

export const PASSWORD = "demo1234";

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function openSidebar(page: Page) {
  // On mobile (below md) the sidebar is a sheet behind the toggle. Decide by width, not by
  // whether the switcher is visible yet: while the sidebar is still streaming in, a desktop
  // check would wrongly click the toggle and collapse it.
  if ((page.viewportSize()?.width ?? 1280) < 768) {
    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  }
  await expect(page.getByRole("button", { name: "Switch workspace" })).toBeVisible();
}

export async function switchWorkspace(page: Page, name: string) {
  await openSidebar(page);
  const current = page.getByTestId("current-workspace");
  if ((await current.textContent()) === name) return;
  await page.getByRole("button", { name: "Switch workspace" }).click();
  await page.getByRole("menuitem", { name }).click();
  await expect(current).toHaveText(name);
}
