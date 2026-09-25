import {
  body,
  failure,
  json,
  protectMutation,
  relay,
  runtime as services,
  sessionId,
  setCookie,
} from "../../../../server/http";
import { SessionError } from "../../../../server/session";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  context: { params: Promise<{ action: string }> },
): Promise<Response> {
  try {
    protectMutation(request);
    const { action } = await context.params;
    if (!["login", "register", "logout"].includes(action))
      throw new SessionError(404, "RESOURCE_NOT_FOUND");
    const existing = sessionId(request);
    const { sessions, transport, ttl } = await services();
    if (action === "logout") {
      if (existing) await sessions.logout(existing);
      return setCookie(
        json({ data: { authenticated: false } }),
        await sessions.anonymous(),
        ttl,
      );
    }
    if (!existing) throw new SessionError();
    const version = await sessions.beginAuthentication(existing);
    const input = await body(request);
    const response = await transport(`auth/${action}`, {
      method: "POST",
      body: input,
    });
    if (!response.ok) return relay(response);
    const sessionVersion = await sessions.completeAuthentication(
      existing,
      version,
      await response.json(),
    );
    return json(
      { data: { authenticated: true, sessionVersion } },
      response.status,
    );
  } catch (error) {
    return failure(error);
  }
}
