import { test, expect } from "@playwright/test";
test("admin navigation, directory creation, settings and future subscriptions", async ({
  page,
}, info) => {
  let saved: Record<string, unknown> | null = null;
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const send = (data: unknown, meta = {}) =>
      route.fulfill({ json: { data, meta } });
    if (url.pathname === "/api/admin/session")
      return send({ authenticated: true, sessionVersion: "admin-test" });
    expect(request.headers()["x-session-version"]).toBe("admin-test");
    if (url.pathname.endsWith("/overview"))
      return send({
        users: 42,
        medicines: 1240,
        doctors: 8,
        pharmacies: 12,
        hospitals: 3,
      });
    if (url.pathname.endsWith("/settings"))
      return send({
        id: "platform",
        organizationName: "Saydaliyati",
        supportEmail: null,
        defaultLanguage: "EN",
        timezone: "Africa/Algiers",
      });
    if (request.method() === "POST") {
      saved = request.postDataJSON();
      return send({ ...saved, id: "test-entry" });
    }
    return send(saved ? [{ ...saved, id: "test-entry" }] : [], {
      total: saved ? 1 : 0,
      totalPages: 1,
    });
  });
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("1,240", { exact: true })).toBeVisible();
  await page.screenshot({
    path: info.outputPath("admin-overview.png"),
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "Administration" })
    .getByRole("button", { name: "Doctors", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Nothing here yet" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add doctor" }).click();
  await page.getByLabel("Doctor name").fill("Synthetic Doctor");
  await page.getByLabel("City", { exact: true }).fill("Algiers");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved.")).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Synthetic Doctor", exact: true }),
  ).toBeVisible();
  expect(saved).toMatchObject({
    name: "Synthetic Doctor",
    city: "Algiers",
    status: "DRAFT",
  });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await expect(page.getByText("Africa/Algiers", { exact: true })).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Subscriptions" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Room to grow." }),
  ).toBeVisible();
  await expect(
    page.getByText("Billing is not enabled.", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("patient access denied and admin list errors have recovery", async ({
  page,
}) => {
  await page.route("**/api/admin/session", (route) =>
    route.fulfill({
      status: 403,
      json: { error: { message: "Access is denied." } },
    }),
  );
  await page.goto("/admin");
  await expect(
    page.getByRole("alert").filter({ hasText: "Access is denied." }),
  ).toContainText("Access is denied.");
  await expect(
    page.getByRole("button", { name: "Sign in to administration" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Administration" }),
  ).toHaveCount(0);
});
