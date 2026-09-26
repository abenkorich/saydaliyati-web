import { test, expect } from "@playwright/test";

test("search selection initializes units, preserves manual edits and resets for another medicine", async ({
  page,
}) => {
  const tablets = {
    id: "tablets",
    name: "Example tablets",
    dosageForm: "COMPRIME PELLICULE",
    packageSize: "B/10",
    strength: "10MG",
    genericName: "Example",
    category: null,
  };
  const liquid = {
    ...tablets,
    id: "liquid",
    name: "Example liquid",
    dosageForm: "SOLUTION BUVABLE",
    packageSize: "FL/150ML",
  };
  let posted: Record<string, unknown> | undefined;
  await page.route("**/api/**", async (r) => {
    const url = new URL(r.request().url());
    const send = (data: unknown, meta = {}) =>
      r.fulfill({ json: { data, meta } });
    if (url.pathname === "/api/session")
      return send({ authenticated: true, sessionVersion: "test" });
    if (url.pathname.endsWith("/profile"))
      return send({ firstName: "Test", lastName: "Patient" });
    if (url.pathname.endsWith("/filters"))
      return send({ laboratories: [], countries: [], dosageForms: [] });
    if (url.pathname.endsWith("/categories")) return send([]);
    if (url.pathname.endsWith("/suggestions"))
      return send([
        url.searchParams.get("q")?.includes("liquid") ? liquid : tablets,
      ]);
    if (url.pathname.endsWith("/tablets")) return send(tablets);
    if (url.pathname.endsWith("/liquid")) return send(liquid);
    if (url.pathname.endsWith("/medicines"))
      return send([tablets, liquid], { total: 2, totalPages: 1 });
    if (
      url.pathname.endsWith("/inventory") &&
      r.request().method() === "POST"
    ) {
      posted = r.request().postDataJSON();
      return send({ id: "saved" });
    }
    return send([], { total: 0, totalPages: 1 });
  });
  await page.goto("/portal");
  await page
    .getByRole("heading", { name: "Add medicine", exact: true })
    .click();
  const search = page.getByRole("combobox", { name: "Search medicine names" });
  await search.fill("tablets");
  await page.getByRole("option").filter({ hasText: "Example tablets" }).click();
  const unit = page.getByRole("combobox", { name: "Stock unit", exact: true });
  await expect(unit).toHaveValue("TABLET");
  await expect(page.getByLabel("Stock quantity", { exact: true })).toHaveValue(
    "",
  );
  await unit.selectOption("OTHER");
  await page.getByLabel("Stock quantity", { exact: true }).fill("2");
  await expect(unit).toHaveValue("OTHER");
  await page.getByRole("button", { name: "← Back to list", exact: true }).click();
  await search.fill("liquid");
  await page.getByRole("option").filter({ hasText: "Example liquid" }).click();
  await expect(unit).toHaveValue("ML");
  await expect(page.getByLabel("Stock quantity", { exact: true })).toHaveValue(
    "",
  );
  await page.getByLabel("Stock quantity", { exact: true }).fill("50");
  await page
    .getByRole("button", { name: "Add to My Pharmacy", exact: true })
    .click();
  await expect.poll(() => posted?.unit).toBe("ML");
  expect(posted?.medicineId).toBe("liquid");
  expect(posted?.quantity).toBe(50);
});
