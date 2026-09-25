import test from "node:test";
import assert from "node:assert/strict";
import {
  Sessions,
  type Session,
  type SessionStore,
  type Transport,
} from "../src/server/session";
import {
  allowed,
  protectMutation,
  setCookie,
  json,
  failure,
} from "../src/server/http";
class MemoryStore implements SessionStore {
  data = new Map<string, Session>();
  async get(id: string) {
    return this.data.get(id) ?? null;
  }
  async create(id: string, value: Session) {
    if (this.data.has(id)) throw Error("collision");
    this.data.set(id, value);
  }
  async compareAndSet(id: string, version: string, value: Session | null) {
    if (this.data.get(id)?.version !== version) return false;
    if (value) this.data.set(id, value);
    else this.data.delete(id);
    return true;
  }
  async remove(id: string) {
    this.data.delete(id);
  }
}
const tokens = (accessToken = "old", refreshToken = "refresh-once") => ({
  data: { accessToken, refreshToken },
});
const ok = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200 });
test("concurrent API requests and independent server instances rotate exactly once", async () => {
  const store = new MemoryStore();
  let rotations = 0;
  const transport: Transport = async (path, init) => {
    if (path === "auth/refresh") {
      rotations++;
      await new Promise((r) => setTimeout(r, 30));
      return ok(tokens("new", "replacement"));
    }
    return new Headers(init?.headers).get("authorization") === "Bearer new"
      ? ok({ data: [] })
      : new Response("{}", { status: 401 });
  };
  const a = new Sessions(store, transport);
  const b = new Sessions(store, transport);
  const id = await a.create(tokens());
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      (index % 2 ? a : b).request(id, "me/treatments"),
    ),
  );
  assert.equal(rotations, 1);
  assert.ok(results.every((r) => r.ok));
});
test("lost refresh response consumes credentials and cannot replay", async () => {
  const store = new MemoryStore();
  let rotations = 0;
  const sessions = new Sessions(store, async () => {
    rotations++;
    throw Error("lost response");
  });
  const id = await sessions.create(tokens());
  await assert.rejects(sessions.refresh(id, "old"));
  await assert.rejects(sessions.refresh(id, "old"));
  assert.equal(rotations, 1);
  assert.equal(await store.get(id), null);
});
test("logout during rotating response never resurrects session", async () => {
  const store = new MemoryStore();
  let release!: () => void;
  const pending = new Promise<void>((r) => {
    release = r;
  });
  let began!: () => void;
  const started = new Promise<void>((r) => {
    began = r;
  });
  const sessions = new Sessions(store, async (path) => {
    if (path === "auth/refresh") {
      began();
      await pending;
      return ok(tokens("new", "next"));
    }
    return ok({ data: {} });
  });
  const id = await sessions.create(tokens());
  const refresh = sessions.refresh(id, "old");
  await started;
  await sessions.logout(id);
  release();
  await assert.rejects(refresh);
  assert.equal(await store.get(id), null);
});
test("crashed rotator fails closed without replay", async () => {
  const store = new MemoryStore();
  const sessions = new Sessions(
    store,
    async () => {
      throw Error("must not call");
    },
    60,
    1,
  );
  const id = await sessions.create(tokens());
  const entry = (await store.get(id))!;
  await store.compareAndSet(id, entry.version, {
    ...entry,
    refreshToken: null,
    rotatingSince: Date.now() - 100,
  });
  await assert.rejects(sessions.refresh(id, "old"));
  assert.equal(await store.get(id), null);
});
test("ambiguous medical mutation is sent once, never retried", async () => {
  const store = new MemoryStore();
  let calls = 0;
  const sessions = new Sessions(store, async () => {
    calls++;
    throw Error("connection lost after commit");
  });
  const id = await sessions.create(tokens());
  await assert.rejects(
    sessions.request(id, "me/medication-events", {
      method: "POST",
      body: "{}",
    }),
  );
  assert.equal(calls, 1);
});
test("API canonical authorization errors and conflicts are preserved without retries", async () => {
  for (const status of [403, 404, 409, 429, 503]) {
    const store = new MemoryStore();
    let calls = 0;
    const sessions = new Sessions(store, async () => {
      calls++;
      return new Response('{"error":{"code":"MEDICATION_EVENT_CONFLICT"}}', {
        status,
      });
    });
    const id = await sessions.create(tokens());
    const response = await sessions.request(id, "me/treatments/other-owner");
    assert.equal(response.status, status);
    assert.equal(calls, 1);
  }
});
test("late login and competing account login cannot override logout or winning account", async () => {
  const store = new MemoryStore();
  const sessions = new Sessions(store, async () => ok({ data: {} }));
  const id = await sessions.anonymous();
  const version = await sessions.beginAuthentication(id);
  await sessions.logout(id);
  await assert.rejects(
    sessions.completeAuthentication(id, version, tokens("late")),
  );
  assert.equal(await store.get(id), null);
  const next = await sessions.anonymous();
  const v = await sessions.beginAuthentication(next);
  await sessions.completeAuthentication(next, v, tokens("account-a"));
  await assert.rejects(
    sessions.completeAuthentication(next, v, tokens("account-b")),
  );
  assert.equal((await store.get(next))?.accessToken, "account-a");
});
test("mutation CSRF requires exact configured Origin, including login", () => {
  const origin = "https://portal.example";
  for (const attacker of [
    undefined,
    "null",
    "https://attacker.example",
    "https://portal.example.attacker.example",
  ]) {
    assert.throws(() =>
      protectMutation(
        new Request(`${origin}/api/auth/login`, {
          method: "POST",
          headers: attacker ? { origin: attacker } : {},
        }),
        origin,
      ),
    );
  }
  assert.doesNotThrow(() =>
    protectMutation(
      new Request(`${origin}/api/auth/login`, {
        method: "POST",
        headers: { origin },
      }),
      origin,
    ),
  );
});
test("proxy allowlist rejects traversal, admin, auth tokens, profile edits and treatment creation", () => {
  for (const [method, path] of [
    ["POST", "auth/refresh"],
    ["GET", "../auth/refresh"],
    ["GET", "medicines/../../auth/refresh"],
    ["PATCH", "me/profile"],
    ["POST", "me/treatments"],
    ["GET", "admin/users"],
  ])
    assert.equal(allowed(method!, path!), false);
  assert.equal(allowed("POST", "me/medication-events"), true);
  assert.equal(allowed("GET", "me/profile"), true);
  assert.equal(allowed("GET", "me/inventory"), true);
  assert.equal(allowed("POST", "me/inventory"), true);
  assert.equal(allowed("PATCH", "me/inventory/id"), false);
  assert.equal(allowed("PATCH", "me/notification-preferences"), true);
});
test("private responses never cache and errors redact secrets", async () => {
  const response = setCookie(json({ data: { authenticated: true } }), "opaque");
  assert.match(response.headers.get("cache-control")!, /no-store/);
  assert.match(response.headers.get("set-cookie")!, /HttpOnly/);
  assert.match(response.headers.get("set-cookie")!, /SameSite=Lax/);
  assert.doesNotMatch(
    await failure(Error("secret-token")).text(),
    /secret-token/,
  );
});
test("a stale 401 cannot replay an old account mutation under a newly signed-in account", async () => {
  const store = new MemoryStore();
  let release!: () => void;
  let began!: () => void;
  const paused = new Promise<void>((r) => {
    release = r;
  });
  const started = new Promise<void>((r) => {
    began = r;
  });
  let medicalCalls = 0;
  const sessions = new Sessions(store, async (path) => {
    if (path === "me/medication-events") {
      medicalCalls++;
      began();
      await paused;
      return new Response("{}", { status: 401 });
    }
    return ok({ data: {} });
  });
  const id = await sessions.create(tokens("account-a"));
  const request = sessions.request(id, "me/medication-events", {
    method: "POST",
    body: "{}",
  });
  await started;
  const version = await sessions.beginAuthentication(id);
  await sessions.completeAuthentication(id, version, tokens("account-b"));
  release();
  await assert.rejects(request);
  assert.equal(medicalCalls, 1);
  assert.equal((await store.get(id))?.accessToken, "account-b");
});
test("stale browser account generation rejects preference mutations before upstream", async () => {
  const store = new MemoryStore();
  let writes = 0;
  const sessions = new Sessions(store, async (path) => {
    if (path === "me/notification-preferences") writes++;
    return ok({ data: {} });
  });
  const id = await sessions.create(tokens("account-a"));
  const previous = await sessions.sessionVersion(id);
  const version = await sessions.beginAuthentication(id);
  const current = await sessions.completeAuthentication(
    id,
    version,
    tokens("account-b"),
  );
  assert.notEqual(previous, current);
  await assert.rejects(
    sessions.request(
      id,
      "me/notification-preferences",
      { method: "PATCH", body: "{}" },
      previous,
    ),
  );
  assert.equal(writes, 0);
  assert.equal(await sessions.sessionVersion(id), current);
  await sessions.request(
    id,
    "me/notification-preferences",
    { method: "PATCH", body: "{}" },
    current,
  );
  assert.equal(writes, 1);
});
