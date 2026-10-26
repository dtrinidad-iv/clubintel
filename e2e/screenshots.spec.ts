import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { signIn } from "./helpers";

// Rewrites docs/screenshots/ from the seeded demo: `supabase db reset`, then
// `npm run screenshots` (which builds first; stop `npm run dev` before). Not part of the normal
// run (see playwright.config.ts).

const DIR = "docs/screenshots";

async function shot(page: Page, name: string) {
  // Let charts and fonts settle; nothing on these pages animates with reduced motion.
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/${name}.png` });
}

test.describe.configure({ mode: "serial" });

test("landing @screenshots", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
  await shot(page, "landing");
});

test("owner pages @screenshots", async ({ page }) => {
  await signIn(page, "owner@clubintel.test");

  await expect(page.getByTestId("upcoming")).toBeVisible();
  await shot(page, "dashboard");

  await page.goto("/clubs");
  await expect(page.getByRole("table")).toBeVisible();
  await shot(page, "clubs");

  await page.getByRole("link", { name: "Northbridge Athletic" }).first().click();
  await expect(page.getByRole("img", { name: "Average attendance and capacity by season" })).toBeVisible();
  await shot(page, "club-profile");

  await page.goto("/opportunities?view=board");
  await expect(page.getByTestId("stage-negotiation")).toBeVisible();
  await shot(page, "opportunities-board");

  await page.goto("/reports");
  await page.getByRole("link", { name: "Naming rights outlook" }).click();
  await expect(page.getByRole("heading", { name: "Recommended actions" })).toBeVisible();
  await shot(page, "ai-report");

  await page.goto("/alerts");
  await expect(page.getByTestId("alert-list")).toBeVisible();
  await shot(page, "alerts");

  await page.goto("/settings");
  await expect(page.getByTestId("member-viewer@clubintel.test")).toBeVisible();
  await shot(page, "settings-members");
});

test("mobile dashboard @screenshots", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  await signIn(page, "owner@clubintel.test");
  // A page from newContext() skips the fixture in fixtures.ts, so filter to visible here.
  await expect(page.getByTestId("kpi-open-pipeline").filter({ visible: true })).toBeVisible();
  await shot(page, "mobile-dashboard");
  await context.close();
});
