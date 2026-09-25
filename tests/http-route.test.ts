import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { closeRedisStore } from "../src/server/redis-store";
import { GET as session } from "../src/app/api/session/route";
import { POST as auth } from "../src/app/api/auth/[action]/route";
import {
  GET as proxy,
  POST as mutate,
} from "../src/app/api/backend/[...path]/route";

// Entire upstream is synthetic: no patient data or existing API is contacted.
test(
  "real Redis and route handlers enforce cookies, CSRF, ownership, no-cache and canonical errors",
  { skip: !process.env.REDIS_TEST_URL },
  async () => {
    const calls: string[] = [];
    let holdLogin: Promise<void> | undefined;
    let loginStarted: (() => void) | undefined;
    const upstream = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const input = chunks.length
        ? JSON.parse(Buffer.concat(chunks).toString())
        : {};
      calls.push(req.url!);
      res.setHeader("content-type", "application/json");
      if (req.url === "/api/v1/auth/login") {
        assert.equal(input.password, "  synthetic password  ");
        loginStarted?.();
        if (holdLogin) await holdLogin;
        res.end(
          JSON.stringify({
            data: {
              accessToken: "synthetic-access",
              refreshToken: "synthetic-refresh",
            },
          }),
        );
      } else if (req.url === "/api/v1/auth/logout") res.end('{"data":{}}');
      else if (req.headers.authorization !== "Bearer synthetic-access") {
        res.statusCode = 401;
        res.end('{"error":{"code":"AUTH_REQUIRED"}}');
      } else if (req.url === "/api/v1/me/treatments/other-owner") {
        res.statusCode = 404;
        res.end('{"error":{"code":"RESOURCE_NOT_FOUND"}}');
      } else if (req.url === "/api/v1/me/medication-events") {
        res.statusCode = 409;
        res.end('{"error":{"code":"MEDICATION_EVENT_CONFLICT"}}');
      } else res.end('{"data":[],"meta":{"totalPages":1}}');
    });
    await new Promise<void>((resolve) =>
      upstream.listen(0, "127.0.0.1", resolve),
    );
    const addr = upstream.address();
    assert.ok(addr && typeof addr !== "string");
    process.env.API_BASE_URL = `http://127.0.0.1:${addr.port}/api/v1`;
    process.env.WEB_ORIGIN = "http://localhost:3101";
    process.env.REDIS_URL = process.env.REDIS_TEST_URL;
    const origin = process.env.WEB_ORIGIN;
    let cookie = "";
    let sessionVersion = "";
    const req = (path: string, method = "GET", value?: unknown, csrf = true) =>
      new Request(origin + path, {
        method,
        headers: {
          cookie,
          ...(sessionVersion ? { "x-session-version": sessionVersion } : {}),
          ...(method !== "GET"
            ? {
                "content-type": "application/json",
                ...(csrf ? { origin } : {}),
              }
            : {}),
        },
        ...(value === undefined ? {} : { body: JSON.stringify(value) }),
      });
    try {
      const missingBootstrap = await auth(
        req("/api/auth/login", "POST", {
          identifier: "synthetic@example.invalid",
          password: "  synthetic password  ",
        }),
        { params: Promise.resolve({ action: "login" }) },
      );
      assert.equal(missingBootstrap.status, 401);
      assert.equal(calls.length, 0);
      const bootstrap = await session(req("/api/session"));
      assert.equal(bootstrap.status, 200);
      assert.match(
        bootstrap.headers.get("set-cookie")!,
        /HttpOnly; SameSite=Lax/,
      );
      cookie = bootstrap.headers.get("set-cookie")!.split(";")[0]!;
      assert.deepEqual(await bootstrap.json(), {
        data: { authenticated: false },
      });
      const loginContext = { params: Promise.resolve({ action: "login" }) };
      const denied = await auth(
        req("/api/auth/login", "POST", {}, false),
        loginContext,
      );
      assert.equal(denied.status, 403);
      assert.equal(calls.length, 0);
      const login = await auth(
        req("/api/auth/login", "POST", {
          identifier: "synthetic@example.invalid",
          password: "  synthetic password  ",
        }),
        loginContext,
      );
      assert.equal(login.status, 200);
      sessionVersion = (await login.clone().json()).data.sessionVersion;
      assert.ok(sessionVersion);
      assert.doesNotMatch(
        await login.text(),
        /synthetic-access|synthetic-refresh|Token/,
      );
      const accountCookie = cookie;
      cookie = "";
      const independent = await session(req("/api/session"));
      assert.deepEqual(await independent.json(), {
        data: { authenticated: false },
      });
      assert.notEqual(
        independent.headers.get("set-cookie")!.split(";")[0],
        accountCookie,
      );
      cookie = independent.headers.get("set-cookie")!.split(";")[0]!;
      const isolated = await proxy(req("/api/backend/me/treatments"), {
        params: Promise.resolve({ path: ["me", "treatments"] }),
      });
      assert.equal(isolated.status, 401);
      cookie = accountCookie;
      const restored = await session(req("/api/session"));
      assert.deepEqual(await restored.json(), {
        data: { authenticated: true, sessionVersion },
      });
      const actualVersion = sessionVersion;
      sessionVersion = "stale-account-version";
      const callsBeforeStale = calls.length;
      const staleWrite = await mutate(
        req("/api/backend/me/medication-events", "POST", {
          occurrenceId: "synthetic-occurrence",
          status: "TAKEN",
        }),
        { params: Promise.resolve({ path: ["me", "medication-events"] }) },
      );
      assert.equal(staleWrite.status, 401);
      assert.equal(calls.length, callsBeforeStale);
      assert.equal(staleWrite.headers.get("set-cookie"), null);
      sessionVersion = actualVersion;
      const foreign = await proxy(
        req("/api/backend/me/treatments/other-owner"),
        {
          params: Promise.resolve({
            path: ["me", "treatments", "other-owner"],
          }),
        },
      );
      assert.equal(foreign.status, 404);
      assert.deepEqual(await foreign.json(), {
        error: { code: "RESOURCE_NOT_FOUND" },
      });
      assert.match(foreign.headers.get("cache-control")!, /private, no-store/);
      const conflict = await mutate(
        req("/api/backend/me/medication-events", "POST", {
          occurrenceId: "synthetic-occurrence",
          status: "TAKEN",
        }),
        { params: Promise.resolve({ path: ["me", "medication-events"] }) },
      );
      assert.equal(conflict.status, 409);
      assert.equal(
        calls.filter((p) => p.endsWith("/medication-events")).length,
        1,
      );
      const blocked = await proxy(req("/api/backend/auth/refresh"), {
        params: Promise.resolve({ path: ["auth", "refresh"] }),
      });
      assert.equal(blocked.status, 404);
      const logout = await auth(req("/api/auth/logout", "POST", {}), {
        params: Promise.resolve({ action: "logout" }),
      });
      assert.equal(logout.status, 200);
      const oldCookie = await proxy(req("/api/backend/me/treatments"), {
        params: Promise.resolve({ path: ["me", "treatments"] }),
      });
      assert.equal(oldCookie.status, 401);
      assert.equal(
        oldCookie.headers.get("set-cookie"),
        null,
        "late expired proxy response must not clear a newer browser cookie",
      );
      cookie = logout.headers.get("set-cookie")!.split(";")[0]!;
      let release!: () => void;
      holdLogin = new Promise<void>((resolve) => {
        release = resolve;
      });
      const started = new Promise<void>((resolve) => {
        loginStarted = resolve;
      });
      const lateLogin = auth(
        req("/api/auth/login", "POST", {
          identifier: "synthetic@example.invalid",
          password: "  synthetic password  ",
        }),
        loginContext,
      );
      await started;
      const racingLogout = await auth(req("/api/auth/logout", "POST", {}), {
        params: Promise.resolve({ action: "logout" }),
      });
      cookie = racingLogout.headers.get("set-cookie")!.split(";")[0]!;
      release();
      const rejectedLogin = await lateLogin;
      assert.equal(rejectedLogin.status, 401);
      assert.equal(rejectedLogin.headers.get("set-cookie"), null);
      const afterRace = await session(req("/api/session"));
      assert.deepEqual(await afterRace.json(), {
        data: { authenticated: false },
      });
    } finally {
      upstream.closeAllConnections();
      await new Promise<void>((resolve) => upstream.close(() => resolve()));
      await closeRedisStore();
    }
  },
);
