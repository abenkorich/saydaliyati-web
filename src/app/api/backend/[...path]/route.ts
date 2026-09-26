import {
  allowed,
  body,
  documentBody,
  failure,
  protectMutation,
  relay,
  runtime as services,
  sessionId,
} from "../../../../server/http";
import { SessionError } from "../../../../server/session";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  try {
    if (request.method !== "GET") protectMutation(request);
    const path = (await context.params).path.join("/");
    if (!allowed(request.method, path))
      throw new SessionError(404, "RESOURCE_NOT_FOUND");
    const id = sessionId(request);
    if (!id) throw new SessionError();
    const sessionVersion = request.headers.get("x-session-version");
    if (!sessionVersion) throw new SessionError(401, "AUTH_SESSION_CHANGED");
    const { sessions } = await services();
    const payload =
      request.method === "GET" || request.method === "DELETE"
        ? undefined
        : request.method === "POST" &&
            /^me\/prescriptions\/[a-zA-Z0-9-]+\/documents$/.test(path)
          ? await documentBody(request)
          : await body(
              request,
              /^admin\/transfers\/(users|medicines|doctors|pharmacies|hospitals|settings)\/(preview|apply)$/.test(
                path,
              )
                ? 4 * 1024 * 1024
                : 16384,
            );
    return await relay(
      await sessions.request(
        id,
        `${path}${new URL(request.url).search}`,
        {
          method: request.method,
          ...(payload === undefined ? {} : { body: payload }),
        },
        sessionVersion,
      ),
    );
  } catch (error) {
    const response = failure(error);
    return response;
  }
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
