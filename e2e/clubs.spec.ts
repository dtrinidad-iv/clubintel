import { expect, test } from "./fixtures";
import { openSidebar, signIn } from "./helpers";

test("filter clubs by league, then open a club profile", async ({ page }) => {
  await signIn(page, "viewer@clubintel.test");
  await page.getByRole("link", { name: "Clubs" }).click();
  await expect(page).toHaveURL(/\/clubs$/);
  await expect(page.getByRole("status")).toContainText("42 clubs");

  await page.getByRole("combobox", { name: "League", exact: true }).click();
  await page.getByRole("option", { name: "Demo League One" }).click();
  await expect(page).toHaveURL(/\/clubs\?league=league-one$/);
  await expect(page.getByRole("status")).toContainText("10 clubs");
  await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(10);
  for (const league of await page.getByRole("table").locator("tbody tr td:nth-child(2)").allTextContents()) {
    expect(league).toContain("Demo League One");
  }

  await page.getByLabel("Club name").fill("Pontyrhew");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/clubs\?q=Pontyrhew&league=league-one$/);
  await expect(page.getByRole("status")).toContainText("1 club");

  await page.getByRole("link", { name: "Pontyrhew Athletic" }).click();
  await expect(page.getByRole("heading", { name: "Pontyrhew Athletic", level: 1 })).toBeVisible();
  await expect(page.getByText("Demo League One").first()).toBeVisible();
  await expect(page.getByRole("img", { name: "Average attendance and capacity by season" })).toBeVisible();
  await expect(page.getByRole("img", { name: "League position by season" })).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(6); // header + five seasons
});

test("a search with no matches offers to clear the filters", async ({ page }) => {
  await signIn(page, "viewer@clubintel.test");
  await page.goto("/clubs?q=zzzz-no-such-club");
  await expect(page.getByRole("heading", { name: "No clubs match these filters" })).toBeVisible();
  await page.getByRole("link", { name: "Clear filters" }).first().click();
  await expect(page).toHaveURL(/\/clubs$/);
  await expect(page.getByRole("status")).toContainText("42 clubs");
});

test("pages through clubs, and a new filter starts at page 1", async ({ page }) => {
  await signIn(page, "viewer@clubintel.test");
  await page.goto("/clubs?tier=1");
  await expect(page.getByRole("navigation", { name: "Pagination" })).toHaveCount(0); // 10 clubs fit on one page

  await page.goto("/clubs");
  await page.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL(/\/clubs\?page=2$/);
  await expect(page.getByText("Page 2 of 3")).toBeVisible();
  await page.getByRole("combobox", { name: "Region", exact: true }).click();
  await page.getByRole("option", { name: "Wales" }).click();
  await expect(page).toHaveURL(/\/clubs\?region=wales$/); // a new filter starts at page 1
});

test("a page past the end links back to page 1", async ({ page }) => {
  await signIn(page, "viewer@clubintel.test");
  await page.goto("/clubs?region=wales&page=5");
  await expect(page.getByRole("heading", { name: "No more clubs" })).toBeVisible();
  await page.getByRole("link", { name: "Back to page 1" }).click();
  await expect(page).toHaveURL(/\/clubs\?region=wales$/);

  await page.goto("/clubs?q=zzzz-no-such-club&page=2");
  await expect(page.getByRole("heading", { name: "No clubs match these filters" })).toBeVisible();
});

test("an unknown club shows not found", async ({ page }) => {
  await signIn(page, "viewer@clubintel.test");
  await page.goto("/clubs/00000000-0000-4000-8000-000000000000");
  await expect(page.getByRole("heading", { name: "Club not found" })).toBeVisible();
});

test("the clubs API needs a session", async ({ page, request }) => {
  expect((await request.get("/api/v1/clubs")).status()).toBe(401);

  await signIn(page, "viewer@clubintel.test");
  const response = await page.request.get("/api/v1/clubs?tier=4&page=1");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.meta).toEqual({ page: 1, pageSize: 20, total: 12, totalPages: 1 });
  expect(body.data.every((club: { tier: number }) => club.tier === 4)).toBe(true);

  const one = await page.request.get(`/api/v1/clubs/${body.data[0].id}`);
  expect((await one.json()).data.seasons).toHaveLength(5);
  expect((await page.request.get("/api/v1/clubs/not-a-uuid")).status()).toBe(404);

  // Past the last page: no clubs, but the real total, so clients know where the end is.
  const past = await (await page.request.get("/api/v1/clubs?page=99")).json();
  expect(past).toEqual({ data: [], meta: { page: 99, pageSize: 20, total: 42, totalPages: 3 } });
});

test("clubs on a phone show as cards @mobile", async ({ page }) => {
  await signIn(page, "viewer@clubintel.test");
  await openSidebar(page);
  await page.getByRole("link", { name: "Clubs" }).click();
  await expect(page.getByRole("table")).toBeHidden();
  await page.getByRole("link", { name: /Northbridge Athletic/ }).click();
  await expect(page.getByRole("heading", { name: "Northbridge Athletic", level: 1 })).toBeVisible();
});
