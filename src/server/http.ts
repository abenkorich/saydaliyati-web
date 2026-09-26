import { Sessions, SessionError, type Transport } from "./session";
import { redisStore } from "./redis-store";

const privateHeaders = {
  "cache-control": "private, no-store, max-age=0",
  pragma: "no-cache",
  "x-content-type-options": "nosniff",
  vary: "Cookie",
  "content-type": "application/json",
};
export function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: privateHeaders,
  });
}
export function failure(error: unknown): Response {
  const status = error instanceof SessionError ? error.status : 503;
  const code =
    error instanceof SessionError ? error.code : "SERVICE_UNAVAILABLE";
  const messages: Record<string, string> = {
    AUTH_SESSION_CHANGED: "Your account session changed. Please refresh.",
    AUTH_SESSION_EXPIRED: "Session expired. Please sign in again.",
    FORBIDDEN: "Access is denied.",
    VALIDATION_ERROR: "Invalid request.",
    RESOURCE_NOT_FOUND: "Resource not found.",
    SERVICE_UNAVAILABLE: "Service temporarily unavailable.",
  };
  return json(
    { error: { code, message: messages[code] ?? "Request failed." } },
    status,
  );
}
export function protectMutation(
  request: Request,
  origin = process.env.WEB_ORIGIN,
): void {
  if (!origin) throw new SessionError(503, "SERVICE_UNAVAILABLE");
  if (
    request.headers.get("origin") !== new URL(origin).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new SessionError(403, "FORBIDDEN");
}
export function allowed(method: string, path: string): boolean {
  const id = "[a-zA-Z0-9-]+";
  const patterns: Record<string, RegExp[]> = {
    GET: [
      /^directory\/(hospitals|pharmacies|doctors)$/,
      /^admin\/(overview|users|medicines|settings)$/,
      /^admin\/directory\/(doctors|pharmacies|hospitals)$/,
      /^medicines$/,
      new RegExp(`^medicines/${id}$`),
      /^me\/treatments$/,
      new RegExp(`^me/treatments/${id}$`),
      /^me\/medication-events$/,
      /^me\/notifications$/,
      /^me\/notification-preferences$/,
      /^me\/profile$/,
      /^me\/inventory$/,
      /^me\/prescriptions$/,
      new RegExp(`^me/prescriptions/${id}$`),
      new RegExp(`^me/prescriptions/${id}/documents/${id}/download$`),
    ],
    POST: [
      /^admin\/medicines$/,
      /^admin\/directory\/(doctors|pharmacies|hospitals)$/,
      /^me\/medication-events$/,
      /^me\/inventory$/,
      /^me\/prescriptions$/,
      new RegExp(`^me/prescriptions/${id}/documents$`),
    ],
    DELETE: [new RegExp(`^me/prescriptions/${id}$`)],
    PATCH: [
      /^admin\/settings$/,
      new RegExp(`^admin/(users|medicines)/${id}$`),
      new RegExp(`^admin/directory/(doctors|pharmacies|hospitals)/${id}$`),
      new RegExp(`^me/prescriptions/${id}$`),
      /^me\/notification-preferences$/,
      /^me\/notifications\/read-all$/,
      new RegExp(`^me/notifications/${id}/read$`),
    ],
  };
  return (patterns[method] ?? []).some((pattern) => pattern.test(path));
}
export function cookieName(): string {
  return process.env.NODE_ENV === "production"
    ? "__Host-saydaliyati"
    : "saydaliyati";
}
export function sessionId(request: Request): string | null {
  const value = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName()}=`))
    ?.slice(cookieName().length + 1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
export function setCookie(
  response: Response,
  id: string | null,
  ttl = 2592000,
): Response {
  response.headers.set(
    "set-cookie",
    `${cookieName()}=${id ?? ""}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${id ? ttl : 0}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
  return response;
}
export async function body(request: Request): Promise<string> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new SessionError(400, "VALIDATION_ERROR");
  const reader = request.body?.getReader();
  if (!reader) throw new SessionError(400, "VALIDATION_ERROR");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.length;
    if (size > 16384) {
      await reader.cancel();
      throw new SessionError(400, "VALIDATION_ERROR");
    }
    chunks.push(next.value);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    JSON.parse(text);
  } catch {
    throw new SessionError(400, "VALIDATION_ERROR");
  }
  return text;
}
export async function runtime(): Promise<{
  sessions: Sessions;
  transport: Transport;
  ttl: number;
}> {
  const { API_BASE_URL, REDIS_URL, WEB_ORIGIN } = process.env;
  if (!API_BASE_URL || !REDIS_URL || !WEB_ORIGIN)
    throw new SessionError(503, "SERVICE_UNAVAILABLE");
  const api = new URL(API_BASE_URL);
  const origin = new URL(WEB_ORIGIN);
  if (
    !["http:", "https:"].includes(api.protocol) ||
    !["", "/", "/api/v1", "/api/v1/"].includes(api.pathname) ||
    (process.env.NODE_ENV === "production" && api.protocol !== "https:") ||
    !["http:", "https:"].includes(origin.protocol) ||
    api.username ||
    api.password ||
    api.search ||
    api.hash ||
    origin.origin !== WEB_ORIGIN ||
    (process.env.NODE_ENV === "production" && origin.protocol !== "https:")
  )
    throw new SessionError(503, "SERVICE_UNAVAILABLE");
  const ttl = Number(process.env.WEB_SESSION_TTL_SECONDS ?? 2592000);
  if (!Number.isInteger(ttl) || ttl < 60 || ttl > 2592000)
    throw new SessionError(503, "SERVICE_UNAVAILABLE");
  const base = `${API_BASE_URL.replace(/\/$/, "").replace(/\/api\/v1$/, "")}/api/v1/`;
  const transport: Transport = (path, init = {}) =>
    fetch(`${base}${path}`, {
      ...init,
      headers: {
        ...(init.body instanceof FormData
          ? {}
          : { "content-type": "application/json" }),
        accept: "application/json",
        ...Object.fromEntries(new Headers(init.headers)),
      },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  return {
    sessions: new Sessions(await redisStore(REDIS_URL), transport, ttl),
    transport,
    ttl,
  };
}
export async function relay(response: Response): Promise<Response> {
  // Never forward Set-Cookie, CORS, caching headers, or transport diagnostics.
  const payload: unknown = await response.json();
  const result = json(payload, response.status);
  const retry = response.headers.get("retry-after");
  if (retry && /^\d+$/.test(retry)) result.headers.set("retry-after", retry);
  return result;
}

// Bound multipart bytes before parsing. Only document routes opt into this limit.
export async function documentBody(request: Request): Promise<FormData> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;"))
    throw new SessionError(400, "VALIDATION_ERROR");
  const reader = request.body?.getReader();
  if (!reader) throw new SessionError(400, "VALIDATION_ERROR");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.length;
    if (size > 5 * 1024 * 1024 + 65536) {
      await reader.cancel();
      throw new SessionError(413, "DOCUMENT_TOO_LARGE");
    }
    chunks.push(next.value);
  }
  let parsed: FormData;
  try {
    parsed = await new Response(Buffer.concat(chunks), {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    throw new SessionError(400, "VALIDATION_ERROR");
  }
  const file = parsed.get("file"),
    page = parsed.get("pageNumber");
  if (
    Array.from(parsed.keys()).length !== 2 ||
    !(file instanceof File) ||
    !["image/jpeg", "image/png"].includes(file.type) ||
    !file.size ||
    file.size > 5 * 1024 * 1024 ||
    typeof page !== "string" ||
    !/^([1-9]|1[0-9]|20)$/.test(page)
  )
    throw new SessionError(400, "VALIDATION_ERROR");
  const form = new FormData();
  form.append(
    "file",
    file,
    "prescription." + (file.type === "image/png" ? "png" : "jpg"),
  );
  form.append("pageNumber", page);
  return form;
}
