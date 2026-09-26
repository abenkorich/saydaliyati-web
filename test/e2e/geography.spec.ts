import { test, expect } from "@playwright/test";
const country = {
  id: "11111111-1111-4111-8111-111111111111",
  code: "DZ",
  nameEnglish: "Algeria",
  nameFrench: "Algérie",
  nameArabic: "الجزائر",
};
const wilaya = {
  id: "22222222-2222-4222-8222-222222222222",
  code: "1",
  nameEnglish: "Adrar",
  nameArabic: "أدرار",
};
const commune = {
  id: "33333333-3333-4333-8333-333333333333",
  code: "101",
  nameEnglish: "Adrar",
  nameArabic: null,
};
test("admin previews and imports geographic CSV and edits locations", async ({
  page,
}, info) => {
  let applied = false;
  let saved = false;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = {};
    if (path === "/api/admin/session")
      data = { authenticated: true, sessionVersion: "geo-test" };
    else if (path === "/api/backend/admin/overview") data = {};
    else if (path === "/api/backend/geography/countries") data = [country];
    else if (path === "/api/backend/geography/wilayas") data = [wilaya];
    else if (path === "/api/backend/geography/communes") data = [commune];
    else if (path.endsWith("/preview")) {
      expect(route.request().postDataJSON().content).toContain("Country Code");
      data = { valid: true, count: 1, errors: [], rows: [country] };
    } else if (path.endsWith("/apply")) {
      applied = true;
      data = { valid: true, count: 1, applied: true };
    } else if (route.request().method() === "PATCH") {
      saved = true;
      expect(route.request().postDataJSON().nameFrench).toBe("Algérie");
      data = country;
    }
    return route.fulfill({ json: { data, meta: {} } });
  });
  await page.goto("/admin");
  await page
    .getByRole("button", { name: "Countries & locations", exact: true })
    .click();
  await page
    .getByLabel("CSV file")
    .setInputFiles({
      name: "countries.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "Country Code,English Name,Arabic Name,French Name\nDZ,Algeria,الجزائر,Algérie",
      ),
    });
  await page.getByRole("button", { name: "Preview CSV", exact: true }).click();
  await expect(page.getByText("1 valid rows ready to import.")).toBeVisible();
  expect(applied).toBe(false);
  await page
    .getByRole("button", { name: "Import 1 locations", exact: true })
    .click();
  await expect(page.getByText("1 locations imported.")).toBeVisible();
  expect(applied).toBe(true);
  await page.getByRole("button", { name: "Edit Algeria", exact: true }).click();
  await page
    .getByRole("button", { name: "Save location", exact: true })
    .click();
  await expect(page.getByText("Location saved.")).toBeVisible();
  expect(saved).toBe(true);
  await page.screenshot({
    path: info.outputPath("geography-admin.png"),
    fullPage: true,
  });
});
test("care directory cascades geographic filters and clears descendants", async ({
  page,
}, info) => {
  const searches: string[] = [];
  await page.route("**/api/**", (route) => {
    const u = new URL(route.request().url());
    let data: unknown = [];
    if (u.pathname === "/api/session")
      data = { authenticated: true, sessionVersion: "geo-test" };
    else if (u.pathname.endsWith("/profile")) data = { firstName: "Example" };
    else if (u.pathname.endsWith("/geography/countries")) data = [country];
    else if (u.pathname.endsWith("/geography/wilayas")) {
      expect(u.searchParams.get("parentId")).toBe(country.id);
      data = [wilaya];
    } else if (u.pathname.endsWith("/geography/communes")) {
      expect(u.searchParams.get("parentId")).toBe(wilaya.id);
      data = [commune];
    } else if (u.pathname.includes("/directory/")) searches.push(u.search);
    return route.fulfill({ json: { data, meta: { total: 0, totalPages: 1 } } });
  });
  await page.goto("/portal");
  await page.getByRole("button", { name: "More", exact: true }).first().click();
  await page.getByRole("button", { name: /Hospitals/ }).click();
  await page.getByLabel("Country", { exact: true }).selectOption(country.id);
  await page
    .getByLabel("Wilaya / Province", { exact: true })
    .selectOption(wilaya.id);
  await page
    .getByLabel("Commune / City", { exact: true })
    .selectOption(commune.id);
  await page
    .getByRole("button", { name: "Search directory", exact: true })
    .click();
  await expect.poll(() => searches.at(-1)).toContain(`communeId=${commune.id}`);
  await page.getByLabel("Country", { exact: true }).selectOption("");
  await expect(
    page.getByLabel("Wilaya / Province", { exact: true }),
  ).toHaveValue("");
  await expect(page.getByLabel("Commune / City", { exact: true })).toHaveValue(
    "",
  );
  await page
    .getByRole("button", { name: "Search directory", exact: true })
    .click();
  await expect.poll(() => searches.at(-1)).not.toContain("countryId");
  await page.screenshot({
    path: info.outputPath("geography-directory.png"),
    fullPage: true,
  });
});
