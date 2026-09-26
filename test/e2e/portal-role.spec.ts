import { test, expect } from "@playwright/test";
for (const restored of [false, true]) {
  test(`administrator ${restored ? "restoration" : "login"} goes to administration without patient requests`, async ({
    page,
  }) => {
    const patientRequests: string[] = [];
    await page.route("**/admin", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<h1>Administration destination</h1>",
      }),
    );
    await page.route("**/api/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.includes("/backend/me/")) patientRequests.push(path);
      if (path === "/api/session")
        return route.fulfill({
          json: {
            data: restored
              ? {
                  authenticated: true,
                  sessionVersion: "test-version",
                  role: "ADMIN",
                }
              : { authenticated: false },
          },
        });
      if (path === "/api/auth/login")
        return route.fulfill({
          json: {
            data: {
              authenticated: true,
              sessionVersion: "test-version",
              role: "ADMIN",
            },
          },
        });
      return route.fulfill({
        status: 403,
        json: { error: { code: "FORBIDDEN" } },
      });
    });
    await page.goto("/portal");
    if (!restored) {
      await page
        .getByLabel("Email or international phone number", { exact: true })
        .fill("admin@example.test");
      await page
        .getByLabel("Password", { exact: true })
        .fill("synthetic password");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
    }
    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByRole("heading", { name: "Administration destination" }),
    ).toBeVisible();
    expect(patientRequests).toEqual([]);
  });
}
test("patient login can visit Home, My Pharmacy and Treatments", async ({
  page,
}) => {
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const data =
      path === "/api/session"
        ? { authenticated: false }
        : path === "/api/auth/login"
          ? {
              authenticated: true,
              sessionVersion: "patient-version",
              role: "PATIENT",
            }
          : path.endsWith("/profile")
            ? { firstName: "Patient" }
            : [];
    return route.fulfill({ json: { data, meta: { total: 0, totalPages: 1 } } });
  });
  await page.goto("/portal");
  await page
    .getByLabel("Email or international phone number", { exact: true })
    .fill("patient@example.test");
  await page.getByLabel("Password", { exact: true }).fill("synthetic password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Hello/ })).toBeVisible();
  await page
    .getByRole("button", { name: /^(My Pharmacy|Pharmacy)$/, exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "My Pharmacy", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Treatments", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Treatments", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/FORBIDDEN/)).toHaveCount(0);
});
