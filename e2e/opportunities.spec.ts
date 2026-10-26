import { type Locator, type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { openSidebar, signIn, switchWorkspace } from "./helpers";

// Runs against the seeded demo workspace. Each test names its rows uniquely, so reruns don't collide.
const unique = (label: string) => `${label} ${Date.now()}`;

// Choose from a select inside `scope` (the dialog, or the page for filters). Options render in
// a portal, so they're looked up on the page.
async function pick(scope: Page | Locator, label: string, option: string) {
  await scope.getByRole("combobox", { name: label, exact: true }).click();
  const page = "page" in scope ? scope.page() : scope;
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function createOpportunity(page: Page, title: string) {
  await page.getByRole("button", { name: "New opportunity" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByLabel("Partner").fill("E2E Partner");
  await pick(dialog, "Club", "Caerwen City");
  await pick(dialog, "Category", "Media");
  await dialog.getByLabel("Value (£)").fill("£25,000");
  await dialog.getByRole("button", { name: "Add opportunity" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Opportunity added.")).toBeVisible();
}

test("an analyst creates an opportunity, moves it through the stages, and can't delete it", async ({ page }) => {
  const title = unique("E2E deal");
  await signIn(page, "analyst@clubintel.test");
  await page.getByRole("link", { name: "Opportunities" }).click();
  await createOpportunity(page, title);

  const row = page.getByTestId("opportunity-row").filter({ hasText: title });
  await expect(row).toContainText("Caerwen City");
  await expect(row).toContainText("£25,000");
  await expect(row).toContainText("Lead");

  // Move with the menu: the keyboard and touch path.
  await row.getByRole("button", { name: `Actions for ${title}` }).click();
  await expect(page.getByRole("menuitem", { name: "Delete" })).toHaveCount(0);
  await page.getByRole("menuitemradio", { name: "Qualified" }).click();
  await expect(row).toContainText("Qualified");

  // Then on the board, by dragging with the keyboard: two stages right.
  await page.getByRole("link", { name: "Board", exact: true }).click();
  await expect(page).toHaveURL(/view=board/);
  // Each step waits for the screen-reader announcement, which also proves they're made.
  const live = page.locator("[id^=DndLiveRegion]");
  // The announcement comes as the drag starts; dnd-kit measures on the next frames, so let two
  // frames pass before the next key, as a person always would.
  const settle = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  await page.getByRole("button", { name: `Drag ${title}` }).focus();
  await page.keyboard.press("Space");
  // "Picked up …" is followed at once by where the card is.
  await expect(live).toHaveText(`${title} is over Qualified.`);
  await settle();
  await page.keyboard.press("ArrowRight");
  await expect(live).toHaveText(`${title} is over Proposal.`);
  await settle();
  await page.keyboard.press("ArrowRight");
  await expect(live).toHaveText(`${title} is over Negotiation.`);
  await settle();
  await page.keyboard.press("Space");
  await expect(live).toHaveText(`Moved ${title} to Negotiation.`);
  await expect(page.getByTestId("stage-negotiation")).toContainText(title);

  // And it stuck.
  await page.reload();
  await expect(page.getByTestId("stage-negotiation")).toContainText(title);
});

test("filters narrow the list and live in the URL", async ({ page }) => {
  await signIn(page, "viewer@clubintel.test");
  await page.goto("/opportunities");
  await pick(page, "Stage", "Won");
  await expect(page).toHaveURL(/\/opportunities\?stage=won$/);
  for (const stage of await page.getByTestId("opportunity-row").locator("td:nth-child(3)").allTextContents()) {
    expect(stage).toBe("Won");
  }
  await page.getByLabel("Search").fill("Highlights");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/q=Highlights&stage=won/);
  await expect(page.getByTestId("opportunity-row")).toHaveCount(1);
});

test("a viewer sees no write controls, and a direct Server Action call is refused", async ({ page, browser }) => {
  await signIn(page, "viewer@clubintel.test");
  await page.goto("/opportunities");
  await expect(page.getByTestId("opportunity-row").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "New opportunity" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Actions for/ })).toHaveCount(0);
  await page.goto("/opportunities?view=board");
  await expect(page.getByRole("button", { name: /^Drag / })).toHaveCount(0);

  // Open the form as an analyst, then submit it with the viewer's session: the action runs as the viewer.
  const analyst = await browser.newContext();
  const analystPage = await analyst.newPage();
  await signIn(analystPage, "analyst@clubintel.test");
  await analystPage.goto("/opportunities");
  await analystPage.getByRole("button", { name: "New opportunity" }).click();
  const dialog = analystPage.getByRole("dialog");
  await dialog.getByLabel("Title").fill(unique("Forged by viewer"));
  await dialog.getByLabel("Partner").fill("X");
  await pick(dialog, "Club", "Caerwen City");

  const viewerCookies = await page.context().cookies();
  await analyst.clearCookies();
  await analyst.addCookies(viewerCookies);
  await dialog.getByRole("button", { name: "Add opportunity" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("You don't have permission to do that.");
  // What was typed is still there.
  await expect(dialog.getByLabel("Partner")).toHaveValue("X");
  await analyst.close();
});

test("a session that expires mid-form goes to sign in, not an error page", async ({ page }) => {
  await signIn(page, "analyst@clubintel.test");
  await page.goto("/opportunities");
  await page.getByRole("button", { name: "New opportunity" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Expired session");
  await page.context().clearCookies();
  await dialog.getByRole("button", { name: "Add opportunity" }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("the dialog validates inline and gives focus back when it closes", async ({ page }) => {
  await signIn(page, "analyst@clubintel.test");
  await page.goto("/opportunities");
  const newButton = page.getByRole("button", { name: "New opportunity" });
  await newButton.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Add opportunity" }).click();
  await expect(dialog.getByText("Enter a title")).toBeVisible();
  await expect(dialog.getByText("Choose a club")).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "Club" })).toHaveAttribute("aria-invalid", "true");
  // Choices made before a failed submit are kept (selects included).
  await pick(dialog, "Stage", "Won");
  await dialog.getByRole("button", { name: "Add opportunity" }).click();
  await expect(dialog.getByText("Enter a title")).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "Stage", exact: true })).toHaveText("Won");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(newButton).toBeFocused();
});

test("contacts: an analyst adds and edits one; an admin deletes it", async ({ page, browser }) => {
  const name = unique("E2E Contact");
  await signIn(page, "analyst@clubintel.test");
  await page.getByRole("link", { name: "Contacts" }).click();
  await page.getByRole("button", { name: "New contact" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Email").fill(" E2E@Club.Example ");
  await pick(dialog, "Club", "Kestrelby United");
  await dialog.getByRole("button", { name: "Add contact" }).click();
  await expect(dialog).toBeHidden();

  const row = page.getByTestId("contact-row").filter({ hasText: name });
  await expect(row).toContainText("e2e@club.example");
  await expect(row).toContainText("Kestrelby United");

  await row.getByRole("button", { name: `Actions for ${name}` }).click();
  await expect(page.getByRole("menuitem", { name: "Delete" })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page.getByRole("dialog").getByLabel("Role").fill("Ticketing");
  await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(row).toContainText("Ticketing");

  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByTestId("contact-row")).toHaveCount(1);

  const admin = await browser.newPage();
  await signIn(admin, "admin@clubintel.test");
  await admin.goto(`/contacts?q=${encodeURIComponent(name)}`);
  await admin.getByRole("button", { name: `Actions for ${name}` }).click();
  await admin.getByRole("menuitem", { name: "Delete" }).click();
  await admin.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(admin.getByRole("heading", { name: "No contacts match" })).toBeVisible();
  await admin.close();
});

test("each workspace sees only its own opportunities", async ({ page }) => {
  await signIn(page, "owner@clubintel.test");
  await switchWorkspace(page, "Demo Sports Agency");
  await page.goto("/opportunities");
  await expect(page.getByTestId("opportunity-row")).toHaveCount(1);
  await expect(page.getByTestId("opportunity-row")).toContainText("Agency retainer");
  await switchWorkspace(page, "Northbridge Athletic Commercial");
  await page.goto("/opportunities");
  await expect(page.getByTestId("opportunity-row").filter({ hasText: "Agency retainer" })).toHaveCount(0);
});

test("opportunities on a phone show as cards @mobile", async ({ page }) => {
  await signIn(page, "viewer@clubintel.test");
  await openSidebar(page);
  await page.getByRole("link", { name: "Opportunities" }).click();
  await expect(page.getByRole("table")).toBeHidden();
  await expect(page.getByTestId("opportunity-card").first()).toBeVisible();
});
