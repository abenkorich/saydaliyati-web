import { createHash } from "node:crypto";
import { createClient } from "redis";
import type { Session, SessionStore } from "./session";

const newClient = (url: string) =>
  createClient({
    url,
    disableOfflineQueue: true,
    socket: { connectTimeout: 3000, reconnectStrategy: false },
  });
type Client = ReturnType<typeof newClient>;
const compareScript = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local value = cjson.decode(raw)
if value.version ~= ARGV[1] then return 0 end
if ARGV[2] == '' then redis.call('DEL', KEYS[1])
else redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3]) end
return 1`;
export class RedisSessionStore implements SessionStore {
  constructor(private readonly client: Client) {}
  // Hash the cookie value so Redis key enumeration does not disclose cookies.
  private key(id: string) {
    return `saydaliyati:web:session:${createHash("sha256").update(id).digest("hex")}`;
  }
  async get(id: string): Promise<Session | null> {
    const raw = await this.client.get(this.key(id));
    return raw ? (JSON.parse(raw) as Session) : null;
  }
  async create(id: string, session: Session) {
    const result = await this.client.set(
      this.key(id),
      JSON.stringify(session),
      {
        PX: Math.max(1, session.expiresAt - Date.now()),
        NX: true,
      },
    );
    if (!result) throw new Error("Session creation failed");
  }
  async compareAndSet(id: string, version: string, session: Session | null) {
    return (
      (await this.client.eval(compareScript, {
        keys: [this.key(id)],
        arguments: [
          version,
          session ? JSON.stringify(session) : "",
          String(session ? Math.max(1, session.expiresAt - Date.now()) : 1),
        ],
      })) === 1
    );
  }
  async remove(id: string) {
    await this.client.del(this.key(id));
  }
}
let connection: Promise<Client> | undefined;
export async function redisStore(url: string): Promise<RedisSessionStore> {
  connection ??= (async () => {
    const client = newClient(url);
    // Never log connection errors: URLs can contain Redis credentials.
    client.on("error", () => {});
    await client.connect();
    client.on("end", () => {
      connection = undefined;
    });
    return client;
  })().catch((error: unknown) => {
    connection = undefined;
    throw error;
  });
  return new RedisSessionStore(await connection);
}

/** Call after server shutdown or route-handler integration tests have drained. */
export async function closeRedisStore(): Promise<void> {
  const pending = connection;
  connection = undefined;
  if (!pending) return;
  const client = await pending;
  if (client.isOpen) await client.quit();
}
