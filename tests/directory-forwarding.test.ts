import assert from "node:assert/strict";
import { test } from "node:test";
import { allowed } from "../src/server/http";
test("portal directory forwarding permits only reads of the three directories", () => {
  for (const kind of ["hospitals", "pharmacies", "doctors"]) {
    assert.equal(allowed("GET", `directory/${kind}`), true);
    for (const method of ["POST", "PATCH", "DELETE"])
      assert.equal(allowed(method, `directory/${kind}`), false);
  }
  for (const path of [
    "directory/users",
    "directory/hospitals/one",
    "directory/../admin/users",
  ])
    assert.equal(allowed("GET", path), false);
});
