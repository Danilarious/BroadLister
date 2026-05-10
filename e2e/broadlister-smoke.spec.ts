import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const navLabels = ["Journalists", "Outlets", "Articles", "Tags", "Imports", "Review Queue", "Campaigns"];
const screenText: Record<string, string> = {
  Journalists: "Global media graph",
  Outlets: "Global media graph",
  Articles: "Global media graph",
  Tags: "Global media graph",
  Imports: "CSV media contacts",
  "Review Queue": "Review detail",
  Campaigns: "Select a client"
};

test.beforeEach(async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "BroadLister" })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("desktop app loads and core screens render @screenshots", async ({ page }, testInfo) => {
  await expect(page.getByRole("heading", { name: /Build sourced media lists/ })).toBeVisible();
  await screenshot(page, `${testInfo.project.name}-dashboard.png`);

  for (const label of navLabels) {
    await page.getByRole("button", { name: label }).click();
    await expect(page.locator("main")).toContainText(screenText[label]);
  }

  await page.getByRole("button", { name: "Imports" }).click();
  await expect(page.getByRole("heading", { name: "CSV media contacts" })).toBeVisible();
  await expect(page.getByLabel("CSV rows")).toBeVisible();

  await page.getByRole("button", { name: "Review Queue" }).click();
  await expect(page.getByRole("heading", { name: "Review detail" })).toBeVisible();

  await page.getByRole("button", { name: "Dashboard" }).click();
  await page.getByRole("button", { name: "Add Trace Finance client" }).click();
  await expect(page.getByLabel("Client")).toContainText("Trace Finance");

  await page.getByRole("button", { name: "Campaigns" }).click();
  await expect(page.getByRole("heading", { name: /Campaign Workspace/ })).toBeVisible();
  await expect(page.getByText("Client overlay")).toBeVisible();
});

test("mobile viewport has no horizontal overflow and keeps controls usable @screenshots", async ({ page }, testInfo) => {
  await expect(page.getByRole("heading", { name: "BroadLister" })).toBeVisible();

  for (const label of navLabels) {
    await page.getByRole("button", { name: label }).click();
    await expect(page.locator("main")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  await expectAccessibleTouchTargets(page);
  await screenshot(page, `${testInfo.project.name}-mobile.png`);
});

test("import and review screens expose labeled operator controls", async ({ page }) => {
  await page.getByRole("button", { name: "Imports" }).click();
  await expect(page.getByLabel("CSV rows")).toBeVisible();
  await expect(page.getByLabel("Article URL")).toBeVisible();
  await expect(page.getByLabel("Optional pasted HTML for local/offline extraction testing")).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview CSV" })).toBeEnabled();

  await page.getByRole("button", { name: "Review Queue" }).click();
  await expect(page.getByRole("heading", { name: "Review detail" })).toBeVisible();
  await expect(page.getByText(/Imports never write directly to global records|Select a review item/)).toBeVisible();
});

test("mobile import flow creates visible article proposals", async ({ page }) => {
  await page.getByRole("button", { name: "Imports" }).click();
  await page.getByLabel("Article URL").fill("https://www.coindesk.com/policy/2026/05/02/brazil-s-central-bank-bans-stablecoin-and-crypto-settlement-in-cross-border-payments");
  await page.getByLabel("Optional pasted HTML for local/offline extraction testing").fill(`
    <html lang="en">
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            "headline": "Brazil's Central Bank Bans Stablecoin and Crypto Settlement in Cross-Border Payments",
            "datePublished": "2026-05-02T12:00:00Z",
            "description": "Brazil stablecoin payment regulation and cross-border crypto settlement policy.",
            "author": [{"@type": "Person", "name": "Ana Paula Pereira"}],
            "publisher": {"@type": "Organization", "name": "CoinDesk"}
          }
        </script>
      </head>
    </html>
  `);
  await page.getByRole("button", { name: "Propose article records" }).click();
  await expect(page.getByText(/review proposals created/)).toBeVisible();
  await expect(page.getByText("Outlet: CoinDesk")).toBeVisible();
  await page.getByRole("button", { name: "Open Review Queue" }).click();
  await expect(page.getByRole("heading", { name: "Review detail" })).toBeVisible();
  await expect(page.locator("main")).toContainText(/article_candidate|outlet_candidate|journalist_candidate/);
});

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectAccessibleTouchTargets(page: import("@playwright/test").Page) {
  const smallTargets = await page.locator("button, a.button-link, input, select, textarea").evaluateAll((nodes) => nodes
    .map((node) => {
      const rect = node.getBoundingClientRect();
      const label = node.textContent?.trim() || node.getAttribute("aria-label") || node.getAttribute("placeholder") || node.tagName;
      return { label, width: Math.round(rect.width), height: Math.round(rect.height) };
    })
    .filter((item) => item.width > 0 && item.height > 0 && (item.width < 44 || item.height < 44)));
  expect(smallTargets).toEqual([]);
}

async function screenshot(page: import("@playwright/test").Page, filename: string) {
  mkdirSync("test-results/screenshots", { recursive: true });
  await page.screenshot({ fullPage: true, path: `test-results/screenshots/${filename}` });
}
