import { randomBytes, randomUUID } from "node:crypto";

export type Session = {
  version: string;
  accountVersion: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  rotatingSince?: number;
};
export interface SessionStore {
  get(id: string): Promise<Session | null>;
  create(id: string, session: Session): Promise<void>;
  compareAndSet(
    id: string,
    version: string,
    session: Session | null,
  ): Promise<boolean>;
  remove(id: string): Promise<void>;
}
export class SessionError extends Error {
  constructor(
    public readonly status = 401,
    public readonly code = "AUTH_SESSION_EXPIRED",
  ) {
    super(code);
  }
}
export type Transport = (path: string, init?: RequestInit) => Promise<Response>;
export class Sessions {
  constructor(
    private readonly store: SessionStore,
    private readonly transport: Transport,
    private readonly ttlSeconds = 2592000,
    private readonly rotationTimeoutMs = 15000,
  ) {}

  async create(payload: unknown): Promise<string> {
    const tokens = tokenPair(payload);
    const id = randomBytes(32).toString("base64url");
    await this.store.create(id, {
      ...tokens,
      version: randomUUID(),
      accountVersion: randomUUID(),
      expiresAt: Date.now() + this.ttlSeconds * 1000,
    });
    return id;
  }

  async anonymous(): Promise<string> {
    const id = randomBytes(32).toString("base64url");
    await this.store.create(id, {
      version: randomUUID(),
      accountVersion: randomUUID(),
      accessToken: "",
      refreshToken: null,
      expiresAt: Date.now() + this.ttlSeconds * 1000,
    });
    return id;
  }

  async authenticated(id: string): Promise<boolean | null> {
    const session = await this.store.get(id);
    return session ? Boolean(session.accessToken) : null;
  }

  async sessionVersion(id: string): Promise<string> {
    const session = await this.current(id);
    if (!session.accessToken) throw new SessionError();
    return session.accountVersion;
  }

  async beginAuthentication(id: string): Promise<string> {
    return (await this.current(id)).version;
  }

  async completeAuthentication(
    id: string,
    version: string,
    payload: unknown,
  ): Promise<string> {
    const tokens = tokenPair(payload);
    const previous = await this.store.get(id);
    const replacement: Session = {
      ...tokens,
      version: randomUUID(),
      accountVersion: randomUUID(),
      expiresAt: Date.now() + this.ttlSeconds * 1000,
    };
    if (!(await this.store.compareAndSet(id, version, replacement))) {
      await this.revoke(tokens.accessToken);
      throw new SessionError();
    }
    if (previous?.accessToken) await this.revoke(previous.accessToken);
    return replacement.accountVersion;
  }

  private async revoke(accessToken: string): Promise<void> {
    try {
      await this.transport("auth/logout", {
        method: "POST",
        body: "{}",
        headers: { authorization: `Bearer ${accessToken}` },
      });
    } catch {
      /* Credentials are gone locally; upstream revocation is best effort. */
    }
  }

  private async current(id: string): Promise<Session> {
    const session = await this.store.get(id);
    if (!session || session.expiresAt <= Date.now()) throw new SessionError();
    return session;
  }

  async refresh(
    id: string,
    observedToken: string,
    accountVersion?: string,
  ): Promise<Session> {
    for (;;) {
      const session = await this.current(id);
      if (
        accountVersion !== undefined &&
        session.accountVersion !== accountVersion
      )
        throw new SessionError(401, "AUTH_SESSION_CHANGED");
      if (session.rotatingSince !== undefined) {
        if (Date.now() - session.rotatingSince > this.rotationTimeoutMs) {
          await this.store.compareAndSet(id, session.version, null);
          throw new SessionError();
        }
        await new Promise((resolve) => setTimeout(resolve, 40));
        continue;
      }
      if (session.accessToken !== observedToken) return session;
      if (!session.refreshToken) throw new SessionError();
      // Persist consumption BEFORE the network call. A crash/lost response never
      // leaves a replayable refresh token. Redis CAS coordinates all instances.
      const rotating: Session = {
        ...session,
        version: randomUUID(),
        refreshToken: null,
        rotatingSince: Date.now(),
      };
      if (!(await this.store.compareAndSet(id, session.version, rotating)))
        continue;
      try {
        const response = await this.transport("auth/refresh", {
          method: "POST",
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        });
        if (!response.ok) throw new SessionError();
        const tokens = tokenPair(await response.json());
        const replacement: Session = {
          ...tokens,
          expiresAt: session.expiresAt,
          version: randomUUID(),
          accountVersion: session.accountVersion,
        };
        if (
          !(await this.store.compareAndSet(id, rotating.version, replacement))
        ) {
          await this.revoke(tokens.accessToken);
          throw new SessionError();
        }
        return replacement;
      } catch {
        // Conditional removal cannot erase another session or resurrect logout.
        await this.store.compareAndSet(id, rotating.version, null);
        throw new SessionError();
      }
    }
  }

  async request(
    id: string,
    path: string,
    init: RequestInit = {},
    expectedAccountVersion?: string,
  ): Promise<Response> {
    let session = await this.current(id);
    if (!session.accessToken) throw new SessionError();
    if (
      expectedAccountVersion !== undefined &&
      session.accountVersion !== expectedAccountVersion
    )
      throw new SessionError(401, "AUTH_SESSION_CHANGED");
    if (session.rotatingSince !== undefined)
      session = await this.refresh(
        id,
        session.accessToken,
        session.accountVersion,
      );
    const send = (token: string) =>
      this.transport(path, {
        ...init,
        headers: {
          ...Object.fromEntries(new Headers(init.headers)),
          authorization: `Bearer ${token}`,
        },
      });
    let response = await send(session.accessToken);
    // The API auth guard rejects 401 before domain mutation. No other response,
    // network error, timeout, or medical conflict is ever automatically retried.
    if (response.status === 401) {
      session = await this.refresh(
        id,
        session.accessToken,
        session.accountVersion,
      );
      response = await send(session.accessToken);
      if (response.status === 401)
        await this.store.compareAndSet(id, session.version, null);
    }
    // Suppress late private responses after logout, including another tab.
    if ((await this.current(id)).accountVersion !== session.accountVersion)
      throw new SessionError(401, "AUTH_SESSION_CHANGED");
    return response;
  }

  async logout(id: string): Promise<void> {
    const session = await this.store.get(id);
    await this.store.remove(id);
    if (session) {
      try {
        await this.transport("auth/logout", {
          method: "POST",
          body: "{}",
          headers: { authorization: `Bearer ${session.accessToken}` },
        });
      } catch {
        /* Local credentials are irrevocably gone even if API is unavailable. */
      }
    }
  }
}

function tokenPair(payload: unknown): {
  accessToken: string;
  refreshToken: string;
} {
  const data = (
    payload as { data?: { accessToken?: unknown; refreshToken?: unknown } }
  )?.data;
  if (
    typeof data?.accessToken !== "string" ||
    typeof data.refreshToken !== "string" ||
    !data.accessToken ||
    !data.refreshToken
  )
    throw new SessionError(503, "SERVICE_UNAVAILABLE");
  return { accessToken: data.accessToken, refreshToken: data.refreshToken };
}
