import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";

async function navigate(page: Page, name: string) {
  await expect(page.locator("nav:visible").first()).toBeVisible();
  const desktop = page.getByRole("navigation", { name: "Main navigation" });
  if (await desktop.isVisible()) {
    await desktop.getByRole("button", { name, exact: true }).click();
    return;
  }
  const mobile = page.getByRole("navigation", { name: "Mobile navigation" });
  if (name === "Medicines") {
    await mobile
      .getByRole("button", { name: "Open quick actions", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add a medicine", exact: true })
      .click();
  } else if (name === "Settings" || name === "Inbox") {
    await mobile.getByRole("button", { name: "More", exact: true }).click();
    await page
      .getByRole("main")
      .getByRole("button", { name, exact: true })
      .click();
  } else await mobile.getByRole("button", { name, exact: true }).click();
}

async function register(page: Page, email: string, password: string) {
  await page.goto("/portal");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("First name", { exact: true }).fill("Synthetic");
  await page.getByLabel("Last name", { exact: true }).fill("Integration");
  await page.getByLabel(/Email or international phone/).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByText("Hello, Synthetic.")).toBeVisible();
}

test("real isolated API supports browser registration, stock, preferences, treatment reminders, ownership and logout", async ({
  page,
  context,
  browser,
  request,
}) => {
  const api = process.env.LIVE_API_URL!;
  const email = `web-${randomUUID()}@example.invalid`;
  const password = `  Synthetic-${randomUUID()}  `;
  await register(page, email, password);
  const sessionCookies = await context.cookies();
  expect(sessionCookies.some((cookie) => cookie.httpOnly)).toBe(true);
  expect(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
  ).toBe(0);
  await page.reload();
  await expect(page.getByText("Hello, Synthetic.")).toBeVisible();

  // Direct API requests run in the test process, never in React/browser storage.
  // Successful login with surrounding spaces verifies registration kept them.
  const login = await request.post(`${api}/auth/login`, {
    data: { identifier: email, password },
  });
  expect(login.status()).toBe(200);
  const credentials = (await login.json()).data as { accessToken: string };
  const authorization = { Authorization: `Bearer ${credentials.accessToken}` };
  const catalogue = await request.get(`${api}/medicines?limit=20&q=DEMO`, {
    headers: authorization,
  });
  expect(catalogue.status()).toBe(200);
  const medicines = (await catalogue.json()).data as {
    id: string;
    name: string;
  }[];
  expect(medicines.length).toBeGreaterThan(0);
  const medicine = medicines[0];
  await navigate(page, "Medicines");
  await page.getByLabel("Search medicine names").fill(medicine.name);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByRole("button", { name: `Open ${medicine.name}`, exact: true })
    .click();
  await expect(
    page.getByText("DEMO · Synthetic", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Stock quantity", { exact: true }).fill("12.5");
  await page.getByLabel(/^Stock unit/).selectOption("TABLET");
  await page
    .getByRole("button", { name: "Add to My Pharmacy", exact: true })
    .click();
  await expect(page.getByText("Medicine added to My Pharmacy.")).toBeVisible();
  await expect(page.getByText(medicine.name, { exact: true })).toBeVisible();

  await navigate(page, "Settings");
  for (const label of [
    "Dose reminders",
    "Expiry reminders",
    "Low stock alerts",
    "Sharing updates",
    "System updates",
  ]) {
    await expect(page.getByLabel(label, { exact: true })).not.toBeChecked();
    await page.getByLabel(label, { exact: true }).check();
  }
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect(page.getByText("Preferences saved.")).toBeVisible();
  await page.reload();
  await navigate(page, "Settings");
  for (const label of [
    "Dose reminders",
    "Expiry reminders",
    "Low stock alerts",
    "Sharing updates",
    "System updates",
  ]) {
    await expect(page.getByLabel(label, { exact: true })).toBeChecked();
  }

  const due = new Date(Math.ceil((Date.now() + 10_000) / 60_000) * 60_000);
  const date = due.toISOString().slice(0, 10);
  const treatmentName = `Synthetic browser course ${randomUUID().slice(0, 8)}`;
  const created = await request.post(`${api}/me/treatments`, {
    headers: authorization,
    data: {
      prescriptionId: null,
      name: treatmentName,
      startDate: date,
      endDate: date,
      medications: [
        {
          medicineId: medicine.id,
          dose: 1,
          doseUnit: "tablet",
          scheduleType: "FIXED_TIMES",
          instructions: "Synthetic integration test only",
          schedules: [
            {
              time: due.toISOString().slice(11, 16),
              daysOfWeek: [due.getUTCDay()],
              startDate: date,
              endDate: date,
            },
          ],
        },
      ],
    },
  });
  expect(created.status()).toBe(201);
  const treatmentId = (await created.json()).data.id as string;
  const active = await request.patch(`${api}/me/treatments/${treatmentId}`, {
    headers: authorization,
    data: { status: "ACTIVE" },
  });
  expect(active.status()).toBe(200);

  // Wait for the real isolated worker, before recording the due occurrence.
  await expect
    .poll(
      async () => {
        const response = await request.get(`${api}/me/notifications?limit=20`, {
          headers: authorization,
        });
        if (!response.ok()) return false;
        const notices = (await response.json()).data as {
          data: { treatmentId: string };
        }[];
        return notices.some(
          (notice) => notice.data.treatmentId === treatmentId,
        );
      },
      { timeout: due.getTime() - Date.now() + 25_000, intervals: [5000] },
    )
    .toBe(true);
  await navigate(page, "Inbox");
  await page
    .getByRole("button", { name: "Review treatment", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: treatmentName, exact: true }),
  ).toBeVisible();
  await expect(page.getByText("UTC · Stored treatment timezone")).toBeVisible();
  await page
    .getByRole("button", { name: "Taken", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "This record cannot be edited.",
  );
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByText("TAKEN", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Taken", exact: true }),
  ).toHaveCount(0);

  const outsider = await browser.newContext({
    baseURL: process.env.LIVE_WEB_URL,
    timezoneId: "UTC",
  });
  try {
    const outsiderPage = await outsider.newPage();
    await register(
      outsiderPage,
      `outsider-${randomUUID()}@example.invalid`,
      `Synthetic-${randomUUID()}`,
    );
    const bootstrap = await outsider.request.get("/api/session");
    const version = (await bootstrap.json()).data.sessionVersion as string;
    const foreign = await outsider.request.get(
      `/api/backend/me/treatments/${treatmentId}`,
      { headers: { "X-Session-Version": version } },
    );
    expect(foreign.status()).toBe(404);
  } finally {
    await outsider.close();
  }

  const otherTab = await context.newPage();
  await otherTab.goto("/portal");
  await expect(otherTab.getByText("Hello, Synthetic.")).toBeVisible();
  await navigate(page, "Settings");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(
    otherTab.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  const privateAfterLogout = await context.request.get(
    "/api/backend/me/profile",
  );
  expect(privateAfterLogout.status()).toBe(401);
});
