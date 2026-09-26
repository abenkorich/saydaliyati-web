import { test, expect } from "@playwright/test";
const settings = {
  enabled: true,
  model: null,
  effectiveModel: "test-vision",
  keyConfigured: true,
  inputRate: 2,
  cachedInputRate: 0.5,
  outputRate: 8,
  monthlyBudget: 50,
  verification: { status: "NOT_CHECKED", checkedAt: null as string | null },
};
const data = {
  period: {
    since: "2026-09-01T00:00:00Z",
    until: "2026-09-26T00:00:00Z",
    days: 30,
  },
  stats: {
    requests: 3,
    successful: 2,
    failed: 1,
    pending: 0,
    inputTokens: 1000,
    cachedInputTokens: 200,
    outputTokens: 300,
    averageDurationMs: 1250,
    estimatedCostUsd: 0.0041,
    unknownCostRequests: 1,
    unknownUsageRequests: 1,
  },
  credits: {
    currency: "USD",
    month: "2026-09",
    monthlyBudget: 50,
    estimatedSpend: 0.0041,
    estimatedRemaining: null,
    unknownCostRequests: 1,
    providerBalance: null,
  },
  features: [
    {
      feature: "PRESCRIPTION",
      requests: 3,
      tokens: 1300,
      estimatedCostUsd: 0.0041,
    },
  ],
  daily: [
    { date: "2026-09-25", requests: 2, tokens: 1000, cost: 0.003 },
    { date: "2026-09-26", requests: 1, tokens: 300, cost: 0.0011 },
  ],
  history: [
    {
      id: "12345678-1234-1234-1234-123456789012",
      feature: "PRESCRIPTION",
      model: "test-vision",
      status: "SUCCEEDED",
      inputTokens: 1000,
      cachedInputTokens: 200,
      outputTokens: 300,
      estimatedCostUsd: 0.0041,
      durationMs: 1250,
      errorCode: null,
      createdAt: "2026-09-26T08:00:00Z",
    },
  ],
};
test("AI admin verifies access, saves settings and filters usage on desktop and mobile", async ({
  page,
}, info) => {
  let current = { ...settings },
    saved: unknown;
  const queries: string[] = [];
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    const send = (data: unknown, meta = {}) =>
      route.fulfill({ json: { data, meta } });
    if (url.pathname === "/api/admin/session")
      return send({ authenticated: true, sessionVersion: "admin-test" });
    expect(req.headers()["x-session-version"]).toBe("admin-test");
    if (url.pathname.endsWith("/overview"))
      return send({
        users: 12,
        medicines: 123,
        doctors: 2,
        pharmacies: 3,
        hospitals: 1,
      });
    if (url.pathname === "/api/backend/admin/settings")
      return send({
        organizationName: "Saydaliyati",
        defaultLanguage: "EN",
        timezone: "UTC",
      });
    if (url.pathname.endsWith("/ai/settings")) {
      if (req.method() === "PATCH") {
        saved = req.postDataJSON();
        current = { ...current, ...req.postDataJSON() };
      }
      return send(current);
    }
    if (url.pathname.endsWith("/ai/verify")) {
      expect(req.method()).toBe("POST");
      current = {
        ...current,
        verification: {
          status: "ACCESSIBLE",
          checkedAt: "2026-09-26T09:00:00Z",
        },
      };
      return send(current);
    }
    if (url.pathname.endsWith("/ai/usage")) {
      queries.push(url.search);
      return send(data, {
        page: Number(url.searchParams.get("page")),
        total: 26,
        totalPages: 2,
      });
    }
    throw Error(url.pathname);
  });
  await page.goto("/admin");
  await page
    .getByRole("navigation", { name: "Administration" })
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Settings sections" })
    .getByRole("button", { name: "AI", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "AI settings", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("1,300", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Not available in this integration", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Verify connection" }).click();
  await expect(
    page.getByRole("heading", { name: "Model access verified" }),
  ).toBeVisible();
  await page.getByLabel("Model override").fill("test-new-model");
  await page.getByLabel("Monthly budget USD", { exact: true }).fill("100");
  await page.getByLabel("Enable AI extraction").uncheck();
  await page.getByRole("button", { name: "Save AI settings" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "AI settings saved" }),
  ).toContainText("AI settings saved");
  expect(saved).toMatchObject({
    enabled: false,
    model: "test-new-model",
    monthlyBudget: 100,
    inputRate: 2,
    cachedInputRate: 0.5,
    outputRate: 8,
  });
  await page
    .getByRole("combobox", { name: "Feature", exact: true })
    .selectOption("MEDICINE_BOX");
  await expect.poll(() => queries.at(-1)).toContain("feature=MEDICINE_BOX");
  await page
    .getByRole("combobox", { name: "Outcome", exact: true })
    .selectOption("FAILED");
  await expect.poll(() => queries.at(-1)).toContain("status=FAILED");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await expect.poll(() => queries.at(-1)).toContain("page=2");
  await page
    .getByRole("combobox", { name: "Period", exact: true })
    .selectOption("7");
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await expect.poll(() => queries.at(-1)).toContain("days=7");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: info.outputPath("admin-ai.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("AI loading errors recover and expired sessions remove the workspace", async ({
  page,
}) => {
  let failed = true,
    expired = false;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const send = (data: unknown) =>
      route.fulfill({
        json: { data, meta: { page: 1, total: 0, totalPages: 1 } },
      });
    if (path === "/api/admin/session")
      return send({ authenticated: !expired, sessionVersion: "admin-test" });
    if (path.endsWith("/overview"))
      return send({
        users: 0,
        medicines: 0,
        doctors: 0,
        pharmacies: 0,
        hospitals: 0,
      });
    if (path.includes("/ai/") && (failed || expired))
      return route.fulfill({
        status: expired ? 401 : 503,
        json: {
          error: {
            message: expired
              ? "Session expired."
              : "Service temporarily unavailable.",
          },
        },
      });
    if (path.endsWith("/ai/settings"))
      return send({ ...settings, keyConfigured: false, effectiveModel: null });
    return send({
      ...data,
      history: [],
      daily: [],
      features: [],
      stats: {
        ...data.stats,
        requests: 0,
        successful: 0,
        failed: 0,
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
        estimatedCostUsd: null,
      },
    });
  });
  await page.goto("/admin");
  await page
    .getByRole("navigation", { name: "Administration" })
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Settings sections" })
    .getByRole("button", { name: "AI", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Service temporarily unavailable." }),
  ).toContainText("Service temporarily unavailable.");
  failed = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Missing — set OPENAI_API_KEY")).toBeVisible();
  await expect(
    page.getByText("No requests match these filters."),
  ).toBeVisible();
  expired = true;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in to administration" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Administration" }),
  ).toHaveCount(0);
});
