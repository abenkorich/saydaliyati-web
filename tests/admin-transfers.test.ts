import { test } from "node:test";
import assert from "node:assert/strict";
import { allowed, body } from "../src/server/http";
test("transfer proxy permits only the six datasets and intended operations", () => {
  for (const dataset of [
    "users",
    "medicines",
    "doctors",
    "pharmacies",
    "hospitals",
    "settings",
  ]) {
    assert.equal(allowed("GET", `admin/transfers/${dataset}/export`), true);
    for (const action of ["preview", "apply"])
      assert.equal(
        allowed("POST", `admin/transfers/${dataset}/${action}`),
        true,
      );
  }
  for (const [method, path] of [
    ["GET", "admin/transfers/passwords/export"],
    ["POST", "admin/transfers/users/export"],
    ["GET", "admin/transfers/users/apply"],
    ["DELETE", "admin/transfers/medicines/apply"],
    ["POST", "admin/transfers/subscriptions/apply"],
    ["POST", "admin/transfers/../users/apply"],
  ])
    assert.equal(allowed(method, path), false);
});
test("larger transfer bodies must explicitly opt in; ordinary JSON limits stay unchanged", async () => {
  const value = JSON.stringify({ content: "x".repeat(20000) });
  const request = () =>
    new Request("https://example.test/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: value,
    });
  await assert.rejects(() => body(request()));
  assert.equal(await body(request(), 4 * 1024 * 1024), value);
  await assert.rejects(() =>
    body(
      new Request("https://example.test/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "x".repeat(4 * 1024 * 1024 + 1),
      }),
      4 * 1024 * 1024,
    ),
  );
});
