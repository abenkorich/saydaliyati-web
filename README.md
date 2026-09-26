# Saydaliyati Portal

All my medicines, in one place.

Independent Next.js / React / strict TypeScript browser application, porting the
currently implemented patient mobile experience. Connects by HTTP to the existing
Saydaliyati API. No sibling repository runtime imports and no medical database access.

## Public landing page

The public introduction is available at `/en`, `/ar` (right-to-left), and `/fr`.
`/` redirects to `/en`. The existing English patient application is at `/portal`.
Landing pages are statically rendered, fully translated and need no API or Redis
configuration. Their product artwork is an explicitly labeled illustrative preview.

## Run locally

Use Node **24.21.0** and pnpm **11.24.0** (pinned in this repository):

```sh
corepack enable
pnpm install --frozen-lockfile
# Set API_BASE_URL, WEB_ORIGIN and REDIS_URL in your shell/process environment.
pnpm dev
```

The checked-in `.env.example` describes configuration; copying it to `.env.local`
is optional for development. **No mounted env file is required.** The example uses a placeholder API URL; supply your actual service configuration.
With no configuration the patient portal shows a session-check error and retry
control; authentication remains disabled until its server session can initialize. The default browser suite uses synthetic mocks.

- `API_BASE_URL`: existing API origin or URL ending `/api/v1`; HTTPS in production.
- `WEB_ORIGIN`: exact public browser origin, including port in development;
  HTTPS in production. Mutation Origin headers must match it exactly.
- `REDIS_URL`: dedicated private Redis server/database for browser sessions.
  Treat its contents as credentials. Use ACL authentication and TLS/private networking
  in production. All portal replicas must share the same store.
- `WEB_SESSION_TTL_SECONDS`: opaque session maximum lifetime, default 30 days.
  Backend session expiration/revocation remains authoritative.

Never put credentials or server configuration in `NEXT_PUBLIC_*` variables. Do
not log request bodies, cookies, Authorization headers, tokens, or health payloads.
Redis is session infrastructure only; the application does not connect to the
medical database. Loss of the store requires signing in again.

## Features

- Email or international-phone registration/login, names, English preference and
  browser timezone; untrimmed passwords with specific registration guidance.
- Safe browser session restoration, rotating refresh and sign-out.
- Personalized Home with live pharmacy/low-stock/treatment totals and recent stock.
- Paginated My Pharmacy with All / Low stock / Expired filters and explicit manual
  stock entry from medicine detail (quantity, unit and optional validated expiry).
- Paginated medicine search/details, unknown values and synthetic DEMO labels.
- Existing treatments, saved timezones, medicine lookup and eligibility-gated
  TAKEN/SKIPPED recording after an explicit immutable-record confirmation.
- Paginated reminder inbox, unread state, read-all and read/open treatment.
- Explicit configured/unconfigured notification settings for all five flags;
  only dose inbox reminders are currently delivered by the backend.
- Responsive desktop/mobile navigation, keyboard focus, retry, refresh,
  loading/empty states and preservation of unsaved preference choices.

Treatment creation, profile editing, account recovery, camera scanning,
AI assistance, community sharing,
native push and web push are future scope. They are not missing features from
this port of the current mobile app. This is a patient portal, not an admin console.

## Prescriptions

Open **More → My Prescriptions** or the **Add** menu for drafts, catalog lookup,
image attachments, explicit field review, confirmation and archive. See
[Prescription management](docs/prescriptions.md) for API storage requirements
and supported daily regimens.

## Commands and validation

```sh
pnpm lint
pnpm typecheck
pnpm test
# Include Redis + HTTP route integration tests against a disposable Redis instance:
REDIS_TEST_URL=redis://127.0.0.1:16389 pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
# Optional real backend acceptance in disposable local containers:
pnpm test:live --api-root /absolute/path/to/sayadaliyati-api
```

See `docs/live-integration.md` for the isolated real-backend suite and prerequisites.

The default browser suite mocks the same-origin BFF using isolated synthetic data. Session
unit/integration tests exercise authorization boundaries and rotation failures.
See `docs/mobile-parity.md` and `docs/verification.md` for the actual tested scope
and limitations. The API remains responsible for ownership, occurrence eligibility,
medical validation and canonical error codes; the web app never recreates that logic.

`contracts/api.openapi.json` is an explicit snapshot of the API contract at port
implementation time. Update it deliberately and re-run parity tests when API contracts
change. No generated client imports a sibling repository.

## Container and production runtime

```sh
docker build -t saydaliyati-web:local .
# Export these variables via your deployment secret/configuration mechanism first.
docker run --rm -p 3000:3000 \
  -e API_BASE_URL -e WEB_ORIGIN -e REDIS_URL -e WEB_SESSION_TTL_SECONDS \
  saydaliyati-web:local
```

The standalone production server runs as a non-root user. Configuration is read
at runtime, not baked into the build. Provide HTTPS at the reverse proxy, set
WEB_ORIGIN to that HTTPS origin and keep Redis off the public network. Production
cookies are Secure and HttpOnly. Do not cache `/api/*` in a CDN or reverse proxy;
the BFF returns private no-store responses. Keep payloads out of access/error logs.
For a direct Node deployment run `pnpm build && pnpm start` with the same server
environment, or copy `.next/standalone`, `.next/static` and `public` as in Dockerfile.

The upstream API currently rate-limits by socket IP. Requests from portal replicas
may share that budget; production capacity and trusted proxy/IP handling need
coordination with the API operator. The portal does not trust arbitrary forwarded
IP headers or change API authorization. Remote pushes, domains, VPS changes and
deployments are managed by the user and were not performed here.

## Dependency selection

Pinned Next.js 16.3.6 with React/React DOM 19.3.0, verified against registry peer
requirements and the official [Next.js installation guide](https://nextjs.org/docs/app/getting-started/installation).
Node 24 satisfies Next.js's Node >=20.9 requirement. TypeScript 5.9.3 is pinned because the installed typescript-eslint parser does not
support TypeScript 7. ESLint 9.39.5 is retained for Next's React plugin compatibility
(ESLint 10 currently crashes that plugin); track its upgrade separately. All package
versions and the pnpm lockfile belong to this independent repository.

## Administration

The web portal includes `/admin` for platform management. See [administration setup and scope](docs/administration.md) for environment credentials, migrations, provisioning and verification.
