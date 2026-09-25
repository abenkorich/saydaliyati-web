# Browser session design

The browser stores one 256-bit opaque session identifier in a host-only HttpOnly,
SameSite=Lax cookie. Production uses the `__Host-` prefix, Secure and Path=/.
React never receives an API access or refresh token. Anonymous bootstrap creates
the cookie before login; authentication responses never replace cookies. This
prevents a delayed login Set-Cookie from resurrecting a logged-out account.

Redis stores credentials under SHA-256 hashed session keys. Every portal replica
uses the same Redis store. Sessions have an absolute expiry and random version.
Redis Lua compare-and-set atomically consumes a refresh token before contacting
the API. Concurrent requests wait for that version to resolve. A crash, timeout,
lost rotation response or lost persistence response fails closed; consumed
credentials are never replayed. The user signs in again when recovery is unsafe.

Logout deletes shared state before attempting upstream revocation. Late refresh
or login completion cannot reinsert a deleted record. Upstream logout is best
effort if unreachable or if its access token has expired; locally removed
credentials remain inaccessible. If Redis itself is unavailable, browser UI
clears private state and presents a retry-sign-out action because server-side
revocation cannot be confirmed.

Every protected browser request also carries a nonsecret `X-Session-Version`
account-generation value obtained at bootstrap/login and kept only in memory.
It is not a credential and cannot authorize without the HttpOnly cookie. The BFF
rejects a mismatched generation before contacting the API. This prevents a stale
tab's preferences/read-all/inventory action from applying to a newly signed-in
account during BroadcastChannel delivery delay. Generation is also checked after
requests and before any retry, suppressing late private responses and preventing
old-account retries under another account.

The BFF allowlists only implemented patient operations. It neither accepts caller
Authorization headers nor forwards API cookies/redirects. The API is the ownership
and medical rules authority. A 401 rejected by the API auth guard can trigger one
serialized refresh and retry; timeout/network failures, conflicts, 5xx and other
ambiguous mutations are never automatically retried. Dose confirmations explain
that records cannot be edited, and uncertain results require reloading state.

All mutations, including login/register/logout, require the exact configured
WEB_ORIGIN; login/registration and domain mutations require JSON request bodies.
Cross-site fetch metadata is rejected. Bodies
are capped at 16 KiB. Production API and web origins must use HTTPS. Runtime
configuration and transport errors are redacted, with canonical safe error codes.
All API responses use private no-store and Cookie Vary headers; server fetches
also disable caching. The statically generated root contains only a public shell.
No service worker/offline health cache or browser credential persistence is used.

Production prerequisites remain operational: private authenticated Redis,
HTTPS termination, correct runtime origins, no upstream/CDN health-data caching,
redacted logging, and API capacity planning for its shared socket-IP rate limit.
The synthetic tests verify application behavior; they do not certify a future
VPS/reverse-proxy configuration or replace the API's own authorization tests.
