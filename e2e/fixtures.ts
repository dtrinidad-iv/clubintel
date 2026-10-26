import { test as base, expect } from "@playwright/test";

// While a page streams in, React can briefly hold a hidden copy of a Suspense boundary's
// content (<div hidden id="S:1">) next to the copy already on screen. Users never see it, but
// getByTestId (unlike getByRole) matches hidden elements, so a strict lookup would find two.
// Every spec imports `test` from here: page-level test-id lookups only see visible elements.
export const test = base.extend({
  page: async ({ page }, provide) => {
    const byTestId = page.getByTestId.bind(page);
    page.getByTestId = (testId) => byTestId(testId).filter({ visible: true });
    await provide(page);
  },
});

export { expect };
