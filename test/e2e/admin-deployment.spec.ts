import { test, expect } from "@playwright/test";
test("missing API releases show actionable errors for AI, JSON export and geography", async ({
  page,
}) => {
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/admin/session")
      return route.fulfill({
        json: { data: { authenticated: true, sessionVersion: "test" } },
      });
    if (path.endsWith("/overview") || path.endsWith("/admin/settings"))
      return route.fulfill({ json: { data: {} } });
    return route.fulfill({
      status: 404,
      json: {
        error: { code: "RESOURCE_NOT_FOUND", message: "Resource not found." },
      },
    });
  });
  await page.goto("/admin");
  await page
    .getByRole("navigation", { name: "Administration" })
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  const sections = page.getByRole("navigation", { name: "Settings sections" });
  await sections.getByRole("button", { name: "AI", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Deploy the AI API release" }),
  ).toBeVisible();
  await sections
    .getByRole("button", { name: "Import & Export", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Download JSON", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Deploy the data-transfer API release" }),
  ).toBeVisible();
  await sections
    .getByRole("button", { name: "Countries & locations", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Deploy the geography API release" }),
  ).toBeVisible();
});
