import assert from "node:assert/strict";
import { test } from "node:test";
import { allowed, body } from "../src/server/http";
test("geography forwarding permits only explicit reads and admin mutations", () => {
  for (const kind of ["countries", "wilayas", "communes"]) {
    assert.equal(allowed("GET", `geography/${kind}`), true);
    assert.equal(allowed("POST", `admin/geography/${kind}/preview`), true);
    assert.equal(allowed("POST", `admin/geography/${kind}/apply`), true);
    assert.equal(allowed("POST", `geography/${kind}`), false);
    assert.equal(allowed("DELETE", `admin/geography/${kind}/id`), false);
  }
  assert.equal(allowed("POST", "admin/geography/users/apply"), false);
});
test("large geographic import payloads require the explicitly expanded body limit", async () => {
  const text = JSON.stringify({
    content:
      "communeId,name,wilayaId\n" +
      Array.from({ length: 1541 }, (_, i) => `${i},Commune ${i},1`).join("\n"),
  });
  const request = () =>
    new Request(
      "http://localhost/api/backend/admin/geography/communes/preview",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: text,
      },
    );
  await assert.rejects(body(request()));
  assert.equal(await body(request(), 4 * 1024 * 1024), text);
});
