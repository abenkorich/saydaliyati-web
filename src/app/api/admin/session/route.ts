import {
  failure,
  json,
  runtime as services,
  sessionId,
  setCookie,
} from "../../../../server/http";
import { SessionError } from "../../../../server/session";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<Response> {
  try {
    const { sessions, ttl } = await services();
    const id = sessionId(request);
    if (!id || !(await sessions.authenticated(id)))
      return setCookie(
        json({ data: { authenticated: false } }),
        await sessions.anonymous(),
        ttl,
      );
    const sessionVersion = await sessions.sessionVersion(id);
    const response = await sessions.request(
      id,
      "admin/overview",
      {},
      sessionVersion,
    );
    if (!response.ok)
      throw new SessionError(
        response.status,
        response.status === 403
          ? "FORBIDDEN"
          : response.status === 401
            ? "AUTH_SESSION_EXPIRED"
            : "SERVICE_UNAVAILABLE",
      );
    return json({ data: { authenticated: true, sessionVersion } });
  } catch (error) {
    if (
      error instanceof SessionError &&
      error.status === 401 &&
      error.code !== "AUTH_SESSION_CHANGED"
    ) {
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
    return failure(error);
  }
}
