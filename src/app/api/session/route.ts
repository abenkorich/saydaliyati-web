import {
  failure,
  json,
  runtime as services,
  sessionId,
  setCookie,
} from "../../../server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<Response> {
  const id = sessionId(request);
  try {
    const { sessions, ttl } = await services();
    if (!id)
      return setCookie(
        json({ data: { authenticated: false } }),
        await sessions.anonymous(),
        ttl,
      );
    const authenticated = await sessions.authenticated(id);
    if (authenticated === null)
      return setCookie(
        json({ data: { authenticated: false } }),
        await sessions.anonymous(),
        ttl,
      );
    if (!authenticated) return json({ data: { authenticated: false } });
    const sessionVersion = await sessions.sessionVersion(id);
    const result = await sessions.request(id, "me/profile", {}, sessionVersion);
    if (result.status === 403) {
      const admin = await sessions.request(
        id,
        "admin/overview",
        {},
        sessionVersion,
      );
      if (admin.ok)
        return json({
          data: { authenticated: true, sessionVersion, role: "ADMIN" },
        });
      if (admin.status !== 403 && admin.status !== 401)
        return failure(new Error("Upstream unavailable"));
    }
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        await sessions.logout(id);
        return setCookie(
          json({ data: { authenticated: false } }),
          await sessions.anonymous(),
          ttl,
        );
      }
      return failure(new Error("Upstream unavailable"));
    }
    return json({ data: { authenticated: true, sessionVersion } });
  } catch (error) {
    const result = failure(error);
    if (
      result.status !== 401 ||
      (error instanceof Error &&
        "code" in error &&
        error.code === "AUTH_SESSION_CHANGED")
    )
      return result;
    try {
      const { sessions, ttl } = await services();
      return setCookie(
        json({ data: { authenticated: false } }),
        await sessions.anonymous(),
        ttl,
      );
    } catch (unavailable) {
      return failure(unavailable);
    }
  }
}
