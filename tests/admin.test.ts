import assert from "node:assert/strict";
import { test } from "node:test";
import { allowed, protectMutation } from "../src/server/http";
test("administration forwarding is strictly allowlisted and mutations remain CSRF protected", () => {
  for (const path of [
    "admin/overview",
    "admin/users",
    "admin/medicines",
    "admin/directory/doctors",
    "admin/directory/pharmacies",
    "admin/directory/hospitals",
    "admin/settings",
  ])
    assert.equal(allowed("GET", path), true);
  for (const [method, path] of [
    ["DELETE", "admin/users/123"],
    ["POST", "admin/users"],
    ["POST", "admin/subscriptions"],
    ["PATCH", "admin/users/123/role"],
    ["GET", "admin/directory/other"],
    ["GET", "admin/../me/profile"],
  ])
    assert.equal(allowed(method, path), false);
  assert.throws(() =>
    protectMutation(
      new Request("https://portal.example/api/backend/admin/settings", {
        method: "PATCH",
        headers: { origin: "https://evil.example" },
      }),
      "https://portal.example",
    ),
  );
});
