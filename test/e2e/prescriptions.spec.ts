import { test, expect, type Page } from "@playwright/test";
import {
  fields,
  type Prescription,
} from "../../src/components/prescription-model";
const medicineId = "11111111-1111-4111-8111-111111111111";
const rxId = "22222222-2222-4222-8222-222222222222";
async function setup(page: Page) {
  const state: {
    rx: Prescription | null;
    creates: number;
    uploads: number;
    conflict: boolean;
    uploadFail: boolean;
    revision: number;
  } = {
    rx: null,
    creates: 0,
    uploads: 0,
    conflict: false,
    uploadFail: false,
    revision: 1,
  };
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname,
      method = req.method();
    const send = (data: unknown, status = 200, meta = {}) =>
      route.fulfill({ status, json: { data, meta } });
    const fail = (code: string, status = 409) =>
      route.fulfill({ status, json: { error: { code } } });
    if (path === "/api/session")
      return send({ authenticated: true, sessionVersion: "synthetic-version" });
    expect(req.headers()["x-session-version"]).toBe("synthetic-version");
    if (path.endsWith("/me/profile")) return send({ firstName: "Synthetic" });
    if (path.endsWith("/me/inventory") || path.endsWith("/me/treatments"))
      return send([], 200, { total: 0, totalPages: 1 });
    if (path.endsWith("/medicines"))
      return send([
        {
          id: medicineId,
          name: "Synthetic catalog medicine",
          strength: "DEMO",
        },
      ]);
    if (path.endsWith("/me/prescriptions")) {
      if (method === "POST") {
        state.creates++;
        const input = req.postDataJSON();
        state.rx = {
          id: rxId,
          status: "DRAFT",
          createdAt: "2026-09-25",
          prescriptionDate: input.prescriptionDate,
          validUntil: input.validUntil,
          documents: [],
          medications: input.medications.map(
            (v: Record<string, unknown>, index: number) => ({
              id: `line-${index}`,
              extractedName: v.extractedName,
              medicine: v.medicineId
                ? { id: medicineId, name: "Synthetic catalog medicine" }
                : null,
              confirmationStatus: "PENDING",
              fields: fields.map((f, i) => ({
                id: `field-${index}-${i}-1`,
                fieldName: f.name,
                value: v[f.name],
                confirmed: false,
                revision: 1,
              })),
            }),
          ),
        };
        return send(state.rx, 201);
      }
      return send(
        state.rx &&
          (!url.searchParams.get("status")
            ? state.rx.status !== "ARCHIVED"
            : state.rx.status === url.searchParams.get("status"))
          ? [{ ...state.rx, medicationCount: 1 }]
          : [],
        200,
        { totalPages: 1 },
      );
    }
    if (path.endsWith(`/me/prescriptions/${rxId}/documents`)) {
      state.uploads++;
      expect(req.headers()["content-type"]).toMatch(
        /multipart\/form-data; boundary=/,
      );
      expect(req.postDataBuffer()!.toString()).toContain('name="pageNumber"');
      state.rx!.documents.push({
        id: "document-1",
        pageNumber: 1,
        mimeType: "image/png",
      });
      if (state.uploadFail) return fail("SERVICE_UNAVAILABLE", 503);
      return send(state.rx!.documents[0], 201);
    }
    if (path.endsWith(`/me/prescriptions/${rxId}`)) {
      if (method === "PATCH") {
        const body = req.postDataJSON();
        if (state.conflict) {
          state.conflict = false;
          return fail("PRESCRIPTION_REVIEW_CONFLICT");
        }
        if (body.fieldReviews) {
          state.revision++;
          for (const med of state.rx!.medications)
            for (const field of med.fields) {
              const v = body.fieldReviews.find(
                (f: { fieldId: string }) => f.fieldId === field.id,
              );
              if (v) {
                field.value = v.value;
                field.confirmed = v.confirmed;
                field.id = `${field.fieldName}-${state.revision}`;
              }
            }
        }
        if (body.status === "CONFIRMED") {
          expect(body.confirmationFieldIds).toEqual(
            state.rx!.medications.flatMap((m) => m.fields.map((f) => f.id)),
          );
          expect(
            state.rx!.medications.every((m) =>
              m.fields.every((f) => f.confirmed),
            ),
          ).toBeTruthy();
          state.rx!.status = "CONFIRMED";
          for (const med of state.rx!.medications)
            med.confirmationStatus = "CONFIRMED";
        }
      }
      if (method === "DELETE") state.rx!.status = "ARCHIVED";
      return send(state.rx);
    }
    return fail("UNEXPECTED_ROUTE", 404);
  });
  await page.goto("/portal");
  await page
    .locator("button:visible")
    .filter({ hasText: /^More$/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Prescriptions", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "New prescription", exact: true }),
  ).toBeVisible();
  return state;
}
async function draft(page: Page) {
  await page
    .getByRole("button", { name: "New prescription", exact: true })
    .click();
  await page
    .getByLabel("Medicine name as written", { exact: true })
    .fill("Synthetic prescription medicine");
  await page.getByLabel("Search catalog", { exact: true }).fill("Synthetic");
  await page
    .getByRole("button", { name: "Search medicines", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Synthetic catalog medicine DEMO",
      exact: true,
    })
    .click();
  await page.getByLabel("Dose", { exact: true }).fill("1");
  await page.getByLabel("Dose unit", { exact: true }).fill("tablet");
  await page
    .getByLabel("Daily times (HH:mm, separated by commas)", { exact: true })
    .fill("08:00");
  await page
    .getByLabel("Start date (YYYY-MM-DD)", { exact: true })
    .fill("2026-10-01");
  await page
    .getByLabel("End date (YYYY-MM-DD)", { exact: true })
    .fill("2026-10-03");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByText("Draft saved. Review the fields before confirming."),
  ).toBeVisible();
}
async function checkAll(page: Page) {
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  await page
    .getByRole("button", { name: "Save this medicine review", exact: true })
    .click();
  await expect(
    page.getByText("Prescription updated.", { exact: true }),
  ).toBeVisible();
}
test("create, attach, explicitly review, confirm and archive a prescription", async ({
  page,
}, info) => {
  const state = await setup(page);
  await draft(page);
  expect(state.creates).toBe(1);
  await page
    .getByLabel("Attach page 1")
    .setInputFiles({
      name: "synthetic.png",
      mimeType: "image/png",
      buffer: Buffer.from("synthetic image"),
    });
  await expect(
    page.getByRole("button", { name: "Download page 1" }),
  ).toBeVisible();
  expect(state.uploads).toBe(1);
  await expect(
    page.getByRole("button", { name: "Confirm prescription", exact: true }),
  ).toBeDisabled();
  await checkAll(page);
  await expect(
    page.getByRole("button", { name: "Confirm prescription", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Prescribed quantity", { exact: true }).fill("10");
  await expect(
    page.getByRole("button", { name: "Confirm prescription", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: /I reviewed prescribed quantity/ })
    .check();
  await page
    .getByRole("button", { name: "Save this medicine review", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirm prescription", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Confirm prescription", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm action", exact: true })
    .click();
  await expect(page.locator(".rx-section .badge").first()).toHaveText(
    "CONFIRMED",
  );
  await expect(
    page.getByRole("button", {
      name: "Save this medicine review",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("prescription-confirmed.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Archive prescription", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm action", exact: true })
    .click();
  await expect(page.locator(".rx-section .badge").first()).toHaveText(
    "ARCHIVED",
  );
  await page
    .getByRole("button", { name: "Back to prescriptions", exact: true })
    .click();
  await page.getByLabel("Prescription status").selectOption("ARCHIVED");
  await expect(
    page.getByRole("button", { name: /Prescription · 2026-09-25/ }),
  ).toBeVisible();
});
test("stale review requires reload and an uncertain upload cannot be resubmitted blindly", async ({
  page,
}) => {
  const state = await setup(page);
  await draft(page);
  state.conflict = true;
  await page
    .getByRole("button", { name: "Save this medicine review", exact: true })
    .click();
  await expect(page.locator(".rx-section [role=alert]")).toContainText(
    "This prescription changed",
  );
  await expect(
    page.getByRole("button", {
      name: "Save this medicine review",
      exact: true,
    }),
  ).toHaveCount(0);
  page.on("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Reload prescription", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Save this medicine review",
      exact: true,
    }),
  ).toBeVisible();
  state.uploadFail = true;
  await page
    .getByLabel("Attach page 1")
    .setInputFiles({
      name: "synthetic.png",
      mimeType: "image/png",
      buffer: Buffer.from("synthetic"),
    });
  await expect(
    page.getByText("Reload and check the attached pages before retrying.", {
      exact: false,
    }),
  ).toBeVisible();
  expect(state.uploads).toBe(1);
  await expect(page.locator("input[type=file]")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Reload prescription", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Download page 1" }),
  ).toBeVisible();
  await expect(page.getByLabel("Attach page 2")).toBeVisible();
  expect(state.uploads).toBe(1);
});
