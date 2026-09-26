export type Value = string | number | string[] | null;
export const fields = [
  { name: "medicineId", label: "Catalog medicine", kind: "medicine" },
  {
    name: "extractedName",
    label: "Medicine name as written",
    kind: "text",
    max: 255,
  },
  { name: "strength", label: "Strength", kind: "text", max: 100 },
  { name: "dosage", label: "Dose", kind: "number" },
  { name: "dosageUnit", label: "Dose unit", kind: "text", max: 50 },
  { name: "frequency", label: "Frequency", kind: "number" },
  {
    name: "frequencyUnit",
    label: "Frequency unit (DAY for daily plans)",
    kind: "text",
    max: 50,
  },
  { name: "duration", label: "Duration", kind: "number" },
  {
    name: "durationUnit",
    label: "Duration unit (DAY for daily plans)",
    kind: "text",
    max: 50,
  },
  { name: "quantity", label: "Prescribed quantity", kind: "number" },
  { name: "instructions", label: "Instructions", kind: "text", max: 4000 },
  {
    name: "scheduledTimes",
    label: "Daily times",
    kind: "times",
  },
  { name: "startDate", label: "Start date", kind: "date" },
  { name: "endDate", label: "End date", kind: "date" },
] as const;
export type FieldName = (typeof fields)[number]["name"];
export type Inputs = Record<FieldName, string>;
export type RxField = {
  id: string;
  fieldName: FieldName;
  value: Value;
  confirmed: boolean;
  revision: number;
};
export type Medication = {
  id: string;
  extractedName: string | null;
  medicine: { id: string; name: string } | null;
  confirmationStatus: string;
  fields: RxField[];
};
export type Prescription = {
  id: string;
  status: "DRAFT" | "CONFIRMED" | "ARCHIVED";
  prescriptionDate: string | null;
  validUntil: string | null;
  createdAt: string;
  medicationCount?: number;
  medications: Medication[];
  documents: { id: string; pageNumber: number; mimeType: string }[];
};
export type Result<T> = {
  data: T;
  meta?: { totalPages?: number; total?: number };
};
export type Request = <T>(
  path: string,
  method?: string,
  body?: unknown,
) => Promise<Result<T>>;
export const blank = (): Inputs =>
  Object.fromEntries(fields.map((f) => [f.name, ""])) as Inputs;
export function inputValues(m: Medication): Inputs {
  return {
    ...blank(),
    ...Object.fromEntries(
      m.fields.map((f) => [
        f.fieldName,
        Array.isArray(f.value)
          ? f.value.join(", ")
          : f.value === null
            ? ""
            : String(f.value),
      ]),
    ),
  };
}
export function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !value.startsWith("0000") &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function parseInputs(input: Inputs): Record<FieldName, Value> {
  const values = {} as Record<FieldName, Value>;
  for (const f of fields) {
    const v = input[f.name].trim();
    if (!v) {
      values[f.name] = null;
      continue;
    }
    if (f.kind === "number") {
      const precision = f.name === "quantity" ? 3 : 4;
      const max = f.name === "quantity" ? 999999999.999 : 99999999.9999;
      if (
        !new RegExp(`^\\d+(\\.\\d{1,${precision}})?$`).test(v) ||
        Number(v) <= 0 ||
        Number(v) > max
      )
        throw new Error(
          `${f.label}: enter a positive number with up to ${precision} decimal places.`,
        );
      values[f.name] = Number(v);
    } else if (f.kind === "date") {
      if (!validDate(v))
        throw new Error(`${f.label}: enter a real calendar date.`);
      values[f.name] = v;
    } else if (f.kind === "times") {
      const times = v.split(",").map((x) => x.trim());
      if (
        times.length > 24 ||
        times.some((x) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(x)) ||
        new Set(times).size !== times.length
      )
        throw new Error(
          "Choose up to 24 different daily times. Fill or remove empty time slots.",
        );
      values[f.name] = times;
    } else {
      if (v.includes("\0") || ("max" in f && v.length > f.max))
        throw new Error(
          `${f.label} is too long or contains an unsupported character.`,
        );
      if (
        f.kind === "medicine" &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          v,
        )
      )
        throw new Error("Select a medicine from the catalog.");
      values[f.name] = v;
    }
  }
  if (!values.medicineId && !values.extractedName)
    throw new Error(
      "Choose a catalog medicine or enter the medicine name as written.",
    );
  if (values.startDate && values.endDate && values.endDate < values.startDate)
    throw new Error("End date must be on or after start date.");
  return values;
}
export function createBody(lines: Inputs[], date: string, until: string) {
  if (lines.length < 1 || lines.length > 20)
    throw new Error("Add between 1 and 20 medicine lines.");
  if ((date && !validDate(date)) || (until && !validDate(until)))
    throw new Error("Enter prescription dates as valid YYYY-MM-DD dates.");
  if (date && until && until < date)
    throw new Error("Valid until cannot precede the prescription date.");
  const body = {
    source: "MANUAL",
    prescriptionDate: date || null,
    validUntil: until || null,
    medications: lines.map(parseInputs),
  };
  if (new TextEncoder().encode(JSON.stringify(body)).length > 16000)
    throw new Error(
      "This draft is too large. Shorten the entered text before saving.",
    );
  return body;
}
export function reviewBody(
  m: Medication,
  input: Inputs,
  checked: Record<string, boolean>,
) {
  const values = parseInputs(input);
  return {
    fieldReviews: m.fields.map((f) => ({
      fieldId: f.id,
      value: values[f.fieldName],
      confirmed: !!checked[f.fieldName],
    })),
  };
}
export function confirmationProblem(rx: Prescription): string | null {
  const kept = rx.medications.filter(
    (m) => m.confirmationStatus !== "REJECTED",
  );
  if (!kept.length || kept.length > 20)
    return "Keep between 1 and 20 medicine lines before confirming.";
  const ids = new Set<Value>();
  for (const [i, m] of kept.entries()) {
    const prefix = `Medicine ${i + 1}: `;
    const v = Object.fromEntries(m.fields.map((f) => [f.fieldName, f.value]));
    if (
      fields.some(
        (f) => !m.fields.find((x) => x.fieldName === f.name)?.confirmed,
      )
    )
      return prefix + "review and save every field, including unknown values.";
    if (
      [
        "medicineId",
        "dosage",
        "dosageUnit",
        "scheduledTimes",
        "startDate",
        "endDate",
      ].some((k) => v[k] === null || v[k] === undefined)
    )
      return (
        prefix +
        "catalog medicine, dose, dose unit, daily times and start/end dates are required."
      );
    if (ids.has(v.medicineId!))
      return "Each retained medicine must be a distinct catalog entry.";
    ids.add(v.medicineId!);
    const times = v.scheduledTimes;
    if (!Array.isArray(times) || !times.length || times.length > 12)
      return prefix + "confirmation supports 1–12 explicit daily times.";
    if (
      v.frequency !== null &&
      (v.frequencyUnit !== "DAY" || v.frequency !== times.length)
    )
      return (
        prefix +
        "frequency must equal the number of daily times, with unit DAY, or remain unknown."
      );
    const days =
      (Date.parse(String(v.endDate)) - Date.parse(String(v.startDate))) /
        86400000 +
      1;
    if (
      v.duration !== null &&
      (v.durationUnit !== "DAY" || v.duration !== days)
    )
      return (
        prefix +
        "duration must match the inclusive date range, with unit DAY, or remain unknown."
      );
  }
  return null;
}
export function confirmationBody(rx: Prescription) {
  const problem = confirmationProblem(rx);
  if (problem) throw new Error(problem);
  return {
    status: "CONFIRMED",
    confirmationFieldIds: rx.medications
      .filter((m) => m.confirmationStatus !== "REJECTED")
      .flatMap((m) => m.fields.map((f) => f.id)),
  };
}
export function prescriptionError(e: unknown) {
  const code = (e as { code?: string })?.code;
  return (
    (
      {
        PRESCRIPTION_REVIEW_CONFLICT:
          "This prescription changed. Reload it and review the latest values before saving again.",
        PRESCRIPTION_CONFIRMATION_REQUIRED:
          "The review is incomplete or this regimen is unsupported. Check each medicine’s required fields.",
        DOCUMENT_CONFLICT:
          "The attachment list changed. Reload the prescription before selecting another page.",
        SERVICE_UNAVAILABLE:
          "The service is unavailable. Attachments also require configured private document storage.",
        VALIDATION_ERROR:
          "Some prescription values are invalid. Check the entered fields.",
        DOCUMENT_INVALID:
          "Choose a valid JPEG or PNG image, at most 5 MiB and 20 million pixels.",
      } as Record<string, string>
    )[code ?? ""] ??
    (code
      ? `Request failed (${code}).`
      : e instanceof Error
        ? e.message
        : "Request failed.")
  );
}
export function nextPage(rx: Prescription) {
  return Math.max(0, ...rx.documents.map((d) => d.pageNumber)) + 1;
}
export function uploadError(type: string, size: number) {
  return !["image/jpeg", "image/png"].includes(type)
    ? "Choose a JPEG or PNG image. PDF and HEIC are not supported."
    : size <= 0 || size > 5 * 1024 * 1024
      ? "Choose an image no larger than 5 MiB."
      : null;
}
