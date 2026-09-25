import assert from "node:assert/strict";
import { test } from "node:test";
import { allowed, documentBody, protectMutation } from "../src/server/http";
const url = "https://portal.example/api/backend/me/prescriptions/id/documents";
function form(type = "image/png", size = 8) {
  const f = new FormData();
  f.append(
    "file",
    new Blob([new Uint8Array(size)], { type }),
    "private-name.png",
  );
  f.append("pageNumber", "1");
  return f;
}
test("prescription proxy allowlist enables only intended owner routes", () => {
  for (const [method, path] of [
    ["GET", "me/prescriptions"],
    ["POST", "me/prescriptions"],
    ["PATCH", "me/prescriptions/id"],
    ["DELETE", "me/prescriptions/id"],
    ["POST", "me/prescriptions/id/documents"],
    ["GET", "me/prescriptions/id/documents/doc/download"],
  ])
    assert.equal(allowed(method!, path!), true);
  for (const [method, path] of [
    ["POST", "me/prescriptions/id/scan"],
    ["DELETE", "me/prescriptions/id/documents/doc"],
    ["PATCH", "users/id"],
    ["GET", "me/prescriptions/../profile"],
  ])
    assert.equal(allowed(method!, path!), false);
});
test("upload parser preserves file bytes and page while removing identifying filename", async () => {
  const result = await documentBody(
    new Request(url, { method: "POST", body: form() }),
  );
  assert.equal(result.get("pageNumber"), "1");
  const file = result.get("file") as File;
  assert.equal(file.name, "prescription.png");
  assert.equal(file.size, 8);
  assert.equal(file.type, "image/png");
});
test("upload parser rejects invalid types, extra fields, invalid pages and oversized bytes", async () => {
  for (const f of [form("application/pdf"), form("image/png", 5242881)])
    await assert.rejects(
      documentBody(new Request(url, { method: "POST", body: f })),
    );
  const extra = form();
  extra.append("patientId", "other");
  await assert.rejects(
    documentBody(new Request(url, { method: "POST", body: extra })),
  );
  const page = form();
  page.set("pageNumber", "21");
  await assert.rejects(
    documentBody(new Request(url, { method: "POST", body: page })),
  );
  const huge = form("image/png", 5 * 1024 * 1024 + 65536);
  const encoded = new Request(url, { method: "POST", body: huge });
  const bytes = await encoded.arrayBuffer();
  await assert.rejects(
    documentBody(
      new Request(url, {
        method: "POST",
        headers: encoded.headers,
        body: bytes,
      }),
    ),
    { status: 413 },
  );
  await assert.rejects(
    documentBody(
      new Request(url, {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=bad" },
        body: "not multipart",
      }),
    ),
  );
});
test("multipart requests retain same-origin protection", () => {
  assert.throws(() =>
    protectMutation(
      new Request(url, {
        method: "POST",
        body: form(),
        headers: { origin: "https://evil.example" },
      }),
      "https://portal.example",
    ),
  );
});
