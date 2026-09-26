import { test } from "node:test";
import assert from "node:assert/strict";
import { allowed } from "../src/server/http";
test("AI proxy permits only the admin settings, usage and verification methods", () => {
  for (const [method, path] of [
    ["GET", "admin/ai/settings"],
    ["GET", "admin/ai/usage"],
    ["PATCH", "admin/ai/settings"],
    ["POST", "admin/ai/verify"],
  ])
    assert.equal(allowed(method, path), true);
  for (const [method, path] of [
    ["GET", "admin/ai/verify"],
    ["POST", "admin/ai/settings"],
    ["DELETE", "admin/ai/settings"],
    ["GET", "admin/ai/key"],
    ["POST", "admin/ai/usage"],
    ["GET", "admin/ai/settings/extra"],
  ])
    assert.equal(allowed(method, path), false);
});
