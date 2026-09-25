import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type Prescription,
  type FieldName,
  type Value,
  blank,
  fields,
  parseInputs,
  createBody,
  reviewBody,
  confirmationBody,
  confirmationProblem,
  uploadError,
  nextPage,
} from "../src/components/prescription-model";
const id = "11111111-1111-4111-8111-111111111111";
const values = () => ({
  ...blank(),
  medicineId: id,
  extractedName: "Synthetic medicine",
  dosage: "1",
  dosageUnit: "tablet",
  scheduledTimes: "08:00, 20:00",
  startDate: "2026-10-01",
  endDate: "2026-10-03",
});
const fixture = (): Prescription => {
  const parsed = parseInputs(values());
  return {
    id,
    status: "DRAFT",
    prescriptionDate: null,
    validUntil: null,
    createdAt: "2026-09-25",
    documents: [],
    medications: [
      {
        id,
        medicine: null,
        extractedName: "Synthetic",
        confirmationStatus: "PENDING",
        fields: fields.map((f, i) => ({
          id: `field-${i}`,
          fieldName: f.name,
          value: parsed[f.name],
          confirmed: true,
          revision: 1,
        })),
      },
    ],
  };
};
test("manual draft preserves unknown fields and does not invent a schedule", () => {
  const r = createBody([{ ...blank(), extractedName: "As written" }], "", "");
  assert.equal(r.medications[0].medicineId, null);
  assert.equal(r.medications[0].scheduledTimes, null);
  assert.equal(r.medications[0].quantity, null);
  assert.equal(r.source, "MANUAL");
  assert.throws(() => createBody([blank()], "", ""), /Choose a catalog/);
});
test("dose, quantity, calendar dates and explicit time validation reject invalid entries", () => {
  for (const v of ["0", "-1", "NaN", "1e3", "1.00001"])
    assert.throws(
      () => parseInputs({ ...values(), dosage: v }),
      /positive number/,
    );
  assert.throws(
    () => parseInputs({ ...values(), quantity: "1.0001" }),
    /decimal places/,
  );
  for (const v of ["8:00", "24:00", "08:00,08:00"])
    assert.throws(
      () => parseInputs({ ...values(), scheduledTimes: v }),
      /HH:mm/,
    );
  assert.throws(
    () => parseInputs({ ...values(), endDate: "2026-02-30" }),
    /calendar date/,
  );
  assert.throws(
    () => createBody([values()], "2026-10-02", "2026-10-01"),
    /precede/,
  );
});
test("review uses latest field IDs and only explicitly checked confirmations", () => {
  const rx = fixture();
  const body = reviewBody(rx.medications[0], values(), { dosage: true });
  assert.equal(body.fieldReviews.length, 14);
  assert.equal(
    body.fieldReviews.find((f) => f.fieldId === "field-3")!.confirmed,
    true,
  );
  assert.equal(
    body.fieldReviews.find((f) => f.fieldId === "field-0")!.confirmed,
    false,
  );
});
test("confirmation includes every latest field including nulls and excludes rejected lines", () => {
  const rx = fixture();
  rx.medications.push({
    ...rx.medications[0],
    id: "rejected",
    confirmationStatus: "REJECTED",
  });
  assert.equal(confirmationProblem(rx), null);
  assert.deepEqual(
    confirmationBody(rx).confirmationFieldIds,
    rx.medications[0].fields.map((f) => f.id),
  );
});
test("confirmation blocks unreviewed unknowns, missing required fields and duplicate medicines", () => {
  const rx = fixture();
  rx.medications[0].fields.find((f) => f.fieldName === "quantity")!.confirmed =
    false;
  assert.match(confirmationProblem(rx)!, /every field/);
  assert.throws(() => confirmationBody(rx), /every field/);
  const missing = fixture();
  missing.medications[0].fields.find(
    (f) => f.fieldName === "medicineId",
  )!.value = null;
  assert.match(confirmationProblem(missing)!, /required/);
  const duplicate = fixture();
  duplicate.medications.push({ ...duplicate.medications[0], id: "duplicate" });
  assert.match(confirmationProblem(duplicate)!, /distinct/);
});
test("daily frequency and duration must match explicit times and inclusive dates", () => {
  const rx = fixture();
  const set = (name: FieldName, value: Value) => {
    rx.medications[0].fields.find((f) => f.fieldName === name)!.value = value;
  };
  set("frequency", 2);
  set("frequencyUnit", "WEEK");
  assert.match(confirmationProblem(rx)!, /frequency/);
  set("frequencyUnit", "DAY");
  set("duration", 2);
  set("durationUnit", "DAY");
  assert.match(confirmationProblem(rx)!, /duration/);
  set("duration", 3);
  assert.equal(confirmationProblem(rx), null);
});
test("attachment policy rejects unsupported images and chooses the next page", () => {
  assert.match(uploadError("application/pdf", 20)!, /JPEG/);
  assert.match(uploadError("image/png", 5242881)!, /5 MiB/);
  assert.equal(uploadError("image/jpeg", 5242880), null);
  const rx = fixture();
  rx.documents = [{ id: "x", pageNumber: 2, mimeType: "image/png" }];
  assert.equal(nextPage(rx), 3);
});
