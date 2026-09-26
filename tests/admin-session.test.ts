import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { GET as adminSession } from "../src/app/api/admin/session/route";
import { POST as auth } from "../src/app/api/auth/[action]/route";
import { closeRedisStore } from "../src/server/redis-store";
test(
  "admin browser sessions verify upstream role and never expose credentials",
  { skip: !process.env.REDIS_TEST_URL },
  async () => {
    let permitted = false;
    const server = createServer(async (req, res) => {
      for await (const chunk of req) void chunk;
      res.setHeader("content-type", "application/json");
      if (req.url === "/api/v1/auth/login")
        res.end(
          JSON.stringify({
            data: {
              accessToken: "synthetic-admin-access",
              refreshToken: "synthetic-admin-refresh",
            },
          }),
        );
      else if (req.url === "/api/v1/admin/overview") {
        assert.equal(
          req.headers.authorization,
          "Bearer synthetic-admin-access",
        );
        res.statusCode = permitted ? 200 : 403;
        res.end(
          JSON.stringify(
            permitted
              ? { data: { users: 0 } }
              : { error: { code: "FORBIDDEN" } },
          ),
        );
      } else res.end('{"data":{}}');
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    process.env.API_BASE_URL = `http://127.0.0.1:${address.port}/api/v1`;
    process.env.REDIS_URL = process.env.REDIS_TEST_URL;
    const origin = "http://localhost:3199";
    process.env.WEB_ORIGIN = origin;
    let cookie = "";
    const request = (path: string, method = "GET", body?: unknown) =>
      new Request(origin + path, {
        method,
        headers: { cookie, origin, "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    try {
      const initial = await adminSession(request("/api/admin/session"));
      cookie = initial.headers.get("set-cookie")!.split(";")[0]!;
      assert.deepEqual(await initial.json(), {
        data: { authenticated: false },
      });
      const login = await auth(
        request("/api/auth/login", "POST", {
          identifier: "admin@example.test",
          password: "synthetic test password",
        }),
        { params: Promise.resolve({ action: "login" }) },
      );
      assert.equal(login.status, 200);
      const version = (await login.json()).data.sessionVersion;
      const denied = await adminSession(request("/api/admin/session"));
      assert.equal(denied.status, 403);
      assert.equal(denied.headers.get("set-cookie"), null);
      permitted = true;
      const accepted = await adminSession(request("/api/admin/session"));
      assert.equal(accepted.status, 200);
      assert.match(accepted.headers.get("cache-control")!, /no-store/);
      assert.deepEqual(await accepted.json(), {
        data: { authenticated: true, sessionVersion: version },
      });
      await auth(request("/api/auth/logout", "POST", {}), {
        params: Promise.resolve({ action: "logout" }),
      });
      const ended = await adminSession(request("/api/admin/session"));
      assert.deepEqual(await ended.json(), { data: { authenticated: false } });
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await closeRedisStore();
    }
  },
);
