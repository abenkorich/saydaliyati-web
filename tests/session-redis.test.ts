import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "redis";
import { RedisSessionStore } from "../src/server/redis-store";
import { Sessions, type Transport } from "../src/server/session";

test(
  "real Redis atomically coordinates independent clients without resurrection",
  { skip: !process.env.REDIS_TEST_URL },
  async () => {
    const url = process.env.REDIS_TEST_URL!;
    const a = createClient({
      url,
      disableOfflineQueue: true,
      socket: { connectTimeout: 3000, reconnectStrategy: false },
    });
    const b = createClient({
      url,
      disableOfflineQueue: true,
      socket: { connectTimeout: 3000, reconnectStrategy: false },
    });
    a.on("error", () => {});
    b.on("error", () => {});
    await Promise.all([a.connect(), b.connect()]);
    const storeA = new RedisSessionStore(a);
    const storeB = new RedisSessionStore(b);
    const ids: string[] = [];
    try {
      let rotations = 0;
      const transport: Transport = async (path, init) => {
        if (path === "auth/refresh") {
          rotations++;
          await new Promise((r) => setTimeout(r, 35));
          return Response.json({
            data: {
              accessToken: "synthetic-new",
              refreshToken: "synthetic-next",
            },
          });
        }
        return new Headers(init?.headers).get("authorization") ===
          "Bearer synthetic-new"
          ? Response.json({ data: [] })
          : new Response("{}", { status: 401 });
      };
      const first = new Sessions(storeA, transport);
      const second = new Sessions(storeB, transport);
      const id = await first.create({
        data: {
          accessToken: "synthetic-old",
          refreshToken: "synthetic-refresh",
        },
      });
      ids.push(id);
      await Promise.all(
        Array.from({ length: 20 }, (_, n) =>
          (n % 2 ? first : second).request(id, "me/treatments"),
        ),
      );
      assert.equal(rotations, 1);
      assert.equal((await storeB.get(id))?.accessToken, "synthetic-new");
      const version = (await storeA.get(id))!.version;
      await storeB.remove(id);
      assert.equal(
        await storeA.compareAndSet(id, version, {
          version: "late",
          accountVersion: "late",
          accessToken: "late",
          refreshToken: "late",
          expiresAt: Date.now() + 10000,
        }),
        false,
      );
      assert.equal(await storeA.get(id), null);
    } finally {
      await Promise.all(ids.map((id) => storeA.remove(id)));
      await Promise.all([a.quit(), b.quit()]);
    }
  },
);
