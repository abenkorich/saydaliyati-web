import { test, expect, type Page } from "@playwright/test";
async function chooseFilter(page: Page, label: string, option: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  const search = page.getByRole("searchbox", { name: `Search ${label.toLowerCase()}`, exact: true });
  await search.fill("no-such-option");
  await expect(page.getByText("No matching options.")).toBeVisible();
  await search.fill(option);
  await page.getByRole("button", { name: option, exact: true }).click();
  await expect(search).toBeHidden();
}
const medicine = {
  id: "demo-one",
  name: "Alpha medicine",
  strength: "10 mg",
  dosageForm: "Tablet",
  genericName: "Example ingredient",
  registrationHolder: "Test Laboratory",
  holderCountry: "ALGERIE",
  regulatoryStatus: "CURRENT",
  status: "ACTIVE",
  registrationNumber: "352/01 A 003/06/22",
  packageSize: "B/10",
  sourceVersion: "2026-08-31",
  barcodes: [{ barcode: "0012345678901", barcodeType: "EAN13" }],
  miph: {
    sheet: "Nomenclature Aout 2026",
    row: 17,
    sourceUrl: null,
    checksum: "test",
    fields: [
      { name: "CODE", displayValue: "01 A 003" },
      { name: "DUREE DE STABILITE", displayValue: "60 MOIS" },
      { name: "OBS", displayValue: null },
    ],
  },
  boxImageUrl: "https://images.example.test/broken.png",
  category: { id: "category-one", name: "Allergy", slug: "allergy" },
};
test("catalog suggestions, image fallback, category filtering and keyboard selection", async ({
  page,
}, info) => {
  const calls: string[] = [];
  await page.route("https://images.example.test/**", (r) => r.abort());
  await page.route("**/api/**", async (r) => {
    const u = new URL(r.request().url());
    calls.push(u.pathname + u.search);
    const send = (data: unknown, meta = {}) =>
      r.fulfill({ json: { data, meta } });
    if (u.pathname === "/api/session")
      return send({ authenticated: true, sessionVersion: "test-version" });
    if (u.pathname.endsWith("/profile"))
      return send({ firstName: "Test", lastName: "Patient" });
    if (u.pathname.endsWith("/filters"))
      return send({
        laboratories: ["Test Laboratory"],
        countries: ["ALGERIE"],
        dosageForms: ["Tablet"],
      });
    if (u.pathname.endsWith("/categories")) return send([medicine.category]);
    if (u.pathname.endsWith("/suggestions")) {
      if (u.searchParams.get("q") === "older")
        await new Promise((resolve) => setTimeout(resolve, 600));
      return send([
        {
          ...medicine,
          name:
            u.searchParams.get("q") === "older"
              ? "Old response"
              : medicine.name,
        },
      ]);
    }
    if (u.pathname.endsWith("/demo-one")) return send(medicine);
    if (u.pathname.endsWith("/medicines"))
      return send([medicine], { total: 1, totalPages: 1 });
    return send([], { total: 0, totalPages: 1 });
  });
  await page.goto("/portal");
  await page
    .getByRole("heading", { name: "Add medicine", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Open Alpha medicine" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Box image not available" }),
  ).toBeVisible();
  await chooseFilter(page, 'Category', 'Allergy');
  await expect
    .poll(() =>
      calls.some(
        (p) => p.includes("/medicines?") && p.includes("category=category-one"),
      ),
    )
    .toBe(true);
  await chooseFilter(page, 'Laboratory (registration holder)', 'Test Laboratory');
  await chooseFilter(page, 'Laboratory country', 'ALGERIE');
  await chooseFilter(page, 'Dosage form', 'Tablet');
  await expect
    .poll(() =>
      calls.some(
        (p) =>
          p.includes("/medicines?") &&
          p.includes("laboratory=Test+Laboratory") &&
          p.includes("holderCountry=ALGERIE") &&
          p.includes("dosageForm=Tablet"),
      ),
    )
    .toBe(true);
  await chooseFilter(page, 'Registration status', 'Withdrawn');
  await expect
    .poll(() =>
      calls.some(
        (p) =>
          p.includes("status=ALL") && p.includes("regulatoryStatus=WITHDRAWN"),
      ),
    )
    .toBe(true);
  await chooseFilter(page, 'Registration status', 'Active medicines');
  const columns = await page.locator(".medicine-results").evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  expect(columns).toBe(info.project.name.startsWith("desktop") ? 4 : 1);
  const categoryBox = await page.getByRole("button", { name: "Category", exact: true }).boundingBox();
  const searchBox = await page.getByRole("combobox", { name: "Search medicine names" }).boundingBox();
  const submitBox = await page.locator(".catalog-search-bar > button").boundingBox();
  expect(categoryBox!.x).toBeLessThan(searchBox!.x);
  expect(searchBox!.x).toBeLessThan(submitBox!.x);
  const input = page.getByRole("combobox", { name: "Search medicine names" });
  const beforeWildcard = calls.length;
  await input.fill(" * ");
  await expect.poll(() => calls.slice(beforeWildcard).some(path => {
    const url = new URL(path, "http://localhost");
    return url.pathname.endsWith("/medicines") && !url.searchParams.has("q") &&
      url.searchParams.get("category") === "category-one" && url.searchParams.get("page") === "1";
  })).toBe(true);
  await expect(page.getByRole("button", { name: "Open Alpha medicine" })).toBeVisible();
  await input.fill("a");
  await page.waitForTimeout(400);
  expect(calls.filter((p) => p.includes("/suggestions"))).toHaveLength(0);
  await input.fill("older");
  await page.waitForTimeout(350);
  await input.fill("alpha");
  await expect(page.getByRole("listbox").getByRole("option")).toContainText(
    "Alpha medicine",
  );
  await page.waitForTimeout(400);
  await expect(page.getByRole("listbox").getByRole("option")).not.toContainText(
    "Old response",
  );
  await page.screenshot({
    path: info.outputPath("catalog-suggestions.png"),
    fullPage: true,
  });
  await expect
    .poll(() =>
      calls.some(
        (p) =>
          p.includes("/suggestions?") &&
          p.includes("laboratory=Test+Laboratory") &&
          p.includes("dosageForm=Tablet"),
      ),
    )
    .toBe(true);
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Alpha medicine", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(0);
  await expect(page.getByText("0012345678901 (EAN13)")).toBeVisible();
  await page.getByText("All MIPH source fields", { exact: true }).click();
  await expect(page.getByText("01 A 003", { exact: true })).toBeVisible();
  await expect(page.getByText("60 MOIS", { exact: true })).toBeVisible();
  await page.screenshot({
    path: info.outputPath("miph-details.png"),
    fullPage: true,
  });
});
test("landing suggests public catalog names without a session", async ({
  page,
}) => {
  await page.route("**/api/medicines/suggestions?*", (r) =>
    r.fulfill({ json: { data: [medicine] } }),
  );
  await page.route("**/api/session", (r) =>
    r.fulfill({ json: { data: { authenticated: false } } }),
  );
  await page.goto("/en");
  const input = page.getByRole("combobox");
  await input.fill("alpha");
  await expect(page.getByRole("listbox").getByRole("option")).toContainText(
    "Alpha medicine",
  );
  await expect(page.getByRole("listbox")).toHaveCSS("position", "absolute");
  const bounds = await page.getByRole("listbox").boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  await input.press("Escape");
  await expect(input).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("listbox")).toBeHidden();
});
