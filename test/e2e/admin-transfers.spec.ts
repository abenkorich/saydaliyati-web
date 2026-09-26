import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("JSON/CSV downloads, preview, validation and confirmed import", async ({
  page,
}, info) => {
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    const send = (data: unknown) => route.fulfill({ json: { data } });
    if (url.pathname === "/api/admin/session")
      return send({
        authenticated: true,
        sessionVersion: "transfer-test-session",
      });
    expect(req.headers()["x-session-version"]).toBe("transfer-test-session");
    if (url.pathname.endsWith("/overview"))
      return send({
        users: 1,
        medicines: 2,
        doctors: 0,
        pharmacies: 0,
        hospitals: 0,
      });
    if (url.pathname.endsWith("/export"))
      return send({
        filename: `saydaliyati-medicines.${url.searchParams.get("format")}`,
        content:
          url.searchParams.get("format") === "csv"
            ? 'id,name\r\n1,"Sample, medicine"\r\n'
            : '[{"name":"Sample medicine"}]',
        count: 1,
      });
    const body = req.postDataJSON();
    calls.push({ path: url.pathname, body });
    if (url.pathname.endsWith("/preview"))
      return send(
        String(body.content).includes("invalid")
          ? {
              valid: false,
              issues: [{ row: 1, field: "name", message: "Name is required." }],
              rows: [],
              total: 0,
            }
          : {
              valid: true,
              issues: [],
              total: 1,
              creates: 1,
              updates: 0,
              unchanged: 0,
              token: "signed-preview",
              rows: [{ row: 1, label: "Sample medicine", operation: "create" }],
            },
      );
    if (url.pathname.endsWith("/apply"))
      return send({ applied: 1, alreadyApplied: false });
    return route.fulfill({
      status: 404,
      json: { error: { message: "Unexpected route" } },
    });
  });
  await page.goto("/admin");
  await page
    .getByRole("navigation", { name: "Administration" })
    .getByRole("button", { name: "Import & Export" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Import & Export", exact: true }),
  ).toBeVisible();
  for (const format of ["json", "csv"]) {
    await page
      .getByRole("combobox", { name: "File format", exact: true })
      .selectOption(format);
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: `Download ${format.toUpperCase()}`,
        exact: true,
      })
      .click();
    const file = await download;
    expect(file.suggestedFilename()).toBe(`saydaliyati-medicines.${format}`);
    expect(await readFile((await file.path())!, "utf8")).toContain("Sample");
  }
  await page.getByLabel("Choose import file").setInputFiles({
    name: "medicines.json",
    mimeType: "application/json",
    buffer: Buffer.from('[{"name":"Sample medicine"}]'),
  });
  await page
    .getByRole("button", { name: "Preview import", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Import preview" }),
  ).toBeVisible();
  expect(calls.filter((c) => c.path.endsWith("/apply"))).toHaveLength(0);
  await page.screenshot({
    path: info.outputPath("transfer-preview.png"),
    fullPage: true,
  });
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Confirm import", exact: true })
    .click();
  expect(calls.filter((c) => c.path.endsWith("/apply"))).toHaveLength(0);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Confirm import", exact: true })
    .click();
  await expect(
    page.getByText("Import complete. 1 records changed."),
  ).toBeVisible();
  expect(calls.find((c) => c.path.endsWith("/apply"))?.body.token).toBe(
    "signed-preview",
  );
  await page.getByLabel("Choose import file").setInputFiles({
    name: "invalid.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("invalid"),
  });
  await page
    .getByRole("button", { name: "Preview import", exact: true })
    .click();
  await expect(
    page.getByText("Name is required.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm import", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Data to manage", exact: true })
    .selectOption("users");
  await page
    .getByText("Import format & matching rules", { exact: true })
    .click();
  await expect(
    page.getByText("Users require an existing ID.", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
test("oversized files are rejected locally and stale previews cannot be confirmed", async ({
  page,
}) => {
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/session"))
      return route.fulfill({
        json: { data: { authenticated: true, sessionVersion: "test" } },
      });
    if (path.endsWith("/overview"))
      return route.fulfill({ json: { data: {} } });
    if (path.endsWith("/preview"))
      return route.fulfill({
        json: {
          data: {
            valid: true,
            issues: [],
            total: 1,
            creates: 1,
            updates: 0,
            unchanged: 0,
            token: "stale-token",
            rows: [{ row: 1, label: "Test", operation: "create" }],
          },
        },
      });
    return route.fulfill({
      status: 409,
      json: {
        error: {
          message:
            "Import preview expired or data changed. Preview the file again.",
        },
      },
    });
  });
  await page.goto("/admin");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Import & Export" })
    .click();
  await page.getByLabel("Choose import file").setInputFiles({
    name: "large.json",
    mimeType: "application/json",
    buffer: Buffer.alloc(512 * 1024 + 1),
  });
  await expect(
    page.getByText("Choose a file of 512 KiB or less.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preview import", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Choose import file").setInputFiles({
    name: "small.json",
    mimeType: "application/json",
    buffer: Buffer.from("[{}]"),
  });
  await page
    .getByRole("button", { name: "Preview import", exact: true })
    .click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Confirm import", exact: true })
    .click();
  await expect(
    page.getByText(
      "Import preview expired or data changed. Preview the file again.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm import", exact: true }),
  ).toHaveCount(0);
});
