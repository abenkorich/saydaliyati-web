import { test, expect } from "@playwright/test";
const medicine = {
  id: "demo-one",
  name: "Alpha medicine",
  strength: "10 mg",
  dosageForm: "Tablet",
  genericName: "Example ingredient",
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
  await page
    .getByLabel("Category", { exact: true })
    .selectOption("category-one");
  await expect
    .poll(() =>
      calls.some(
        (p) => p.includes("/medicines?") && p.includes("category=category-one"),
      ),
    )
    .toBe(true);
  const input = page.getByRole("combobox", { name: "Search medicine names" });
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
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Alpha medicine", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(0);
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
  await input.press("Escape");
  await expect(input).toHaveAttribute("aria-expanded", "false");
});
