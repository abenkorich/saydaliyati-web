import { test, expect } from "@playwright/test";

test("patients browse hospitals, pharmacies and doctors with search, city, paging and recovery", async ({
  page,
}, info) => {
  const calls: string[] = [];
  let fail = false;
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    calls.push(url.pathname + url.search);
    const send = (data: unknown, meta = {}) =>
      route.fulfill({ json: { data, meta } });
    if (url.pathname === "/api/session")
      return send({ authenticated: true, sessionVersion: "directory-test" });
    expect(route.request().headers()["x-session-version"]).toBe(
      "directory-test",
    );
    if (url.pathname.endsWith("/me/profile"))
      return send({ firstName: "Synthetic" });
    if (url.pathname.includes("/directory/")) {
      if (fail) {
        fail = false;
        return route.fulfill({
          status: 503,
          json: { error: { code: "SERVICE_UNAVAILABLE" } },
        });
      }
      const kind = url.pathname.split("/").at(-1)!;
      if (url.searchParams.get("q") === "missing")
        return send([], { total: 0, totalPages: 0 });
      const second = url.searchParams.get("page") === "2";
      return send(
        [
          {
            id: `${kind}-${second ? 2 : 1}`,
            name: `Synthetic ${kind} ${second ? 2 : 1}`,
            specialty: kind === "doctors" ? "Cardiology" : "General services",
            address: "10 Example Street",
            city: "Alger",
            phone: "+213 21 12 34 56",
            email: "contact@example.test",
          },
        ],
        { total: 21, totalPages: 2 },
      );
    }
    return send([], { total: 0, totalPages: 1 });
  });
  await page.goto("/portal");
  await page.getByRole("button", { name: "More", exact: true }).first().click();
  await page.getByRole("button", { name: "Hospitals", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Synthetic hospitals 1" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Call Synthetic hospitals 1" }),
  ).toHaveAttribute("href", "tel:+21321123456");
  await expect(
    page.getByRole("link", { name: "View Synthetic hospitals 1 on map" }),
  ).toHaveAttribute("href", /https:\/\/www.google.com\/maps\/search\//);
  await page
    .getByLabel("Directory pagination")
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Synthetic hospitals 2" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pharmacies", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Synthetic pharmacies 1" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Doctors", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Synthetic doctors 1" }),
  ).toBeVisible();
  await page.getByLabel("Search doctors", { exact: true }).fill("cardio");
  await page.getByLabel("City", { exact: true }).fill("Alger");
  await page
    .getByRole("button", { name: "Search directory", exact: true })
    .click();
  await expect
    .poll(() =>
      calls.some(
        (path) =>
          path.includes("/directory/doctors?") &&
          path.includes("q=cardio") &&
          path.includes("city=Alger") &&
          path.includes("page=1"),
      ),
    )
    .toBe(true);
  await page.getByLabel("Search doctors", { exact: true }).fill("missing");
  await page
    .getByRole("button", { name: "Search directory", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "No doctors found" }),
  ).toBeVisible();
  fail = true;
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(
    page.locator(".healthcare-directory").getByRole("alert"),
  ).toContainText("couldn’t load");
  await page
    .getByRole("button", { name: "Retry directory", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Synthetic doctors 1" }),
  ).toBeVisible();
  expect(calls.some((path) => path.includes("/admin/"))).toBe(false);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("healthcare-directory.png"),
    fullPage: true,
  });
});

test("a late directory response cannot replace the next directory", async ({
  page,
}) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const send = (data: unknown) =>
      route.fulfill({ json: { data, meta: { total: 1, totalPages: 1 } } });
    if (path === "/api/session")
      return send({ authenticated: true, sessionVersion: "directory-test" });
    if (path.endsWith("/me/profile")) return send({ firstName: "Synthetic" });
    if (path.endsWith("/directory/hospitals")) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      return send([{ id: "h", name: "Late hospital" }]);
    }
    if (path.endsWith("/directory/doctors"))
      return send([{ id: "d", name: "Current doctor" }]);
    return send([]);
  });
  await page.goto("/portal");
  await page.getByRole("button", { name: "More", exact: true }).first().click();
  await page.getByRole("button", { name: "Hospitals", exact: true }).click();
  await page.getByRole("button", { name: "Doctors", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Current doctor" }),
  ).toBeVisible();
  await page.waitForTimeout(750);
  await expect(
    page.getByRole("heading", { name: "Late hospital" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Current doctor" }),
  ).toBeVisible();
});
