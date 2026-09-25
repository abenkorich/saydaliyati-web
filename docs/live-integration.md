# Isolated real-backend acceptance

Run `pnpm test:live --api-root /absolute/path/to/sayadaliyati-api` from this web repository.

Requires Node 24, pnpm 11, running Docker, installed Playwright Chromium, and an existing API checkout with its dependencies installed. Stop any development server for this web checkout before running: Next uses one development lock per checkout. Allow several minutes, since reminders use the real clock and worker.

The runner builds the independent API, creates disposable PostgreSQL 17 and Redis 8 containers on random loopback ports, applies migrations and restricted runtime grants, and seeds five synthetic DEMO medicines using the API checkout's own scripts. It launches the API, reminder worker and web BFF as separate processes. The web application still accesses medical data only through HTTP.

Explicit subprocess settings override existing environment files. The suite never uses configured remote databases or live patient accounts. Generated credentials stay in process memory; browser traces, videos and screenshots are disabled. The runner removes its own containers and child processes after success, failure or an ordinary interrupt. A forced process termination or host crash may require manually removing containers with the `saydaliyati-web-live-` prefix.

Desktop Chrome and Pixel 7 browser scenarios verify:

- Registration with an untrimmed password, HttpOnly sessions and restoration after reload.
- Real catalog lookup and manual pharmacy stock entry.
- Persistence of all five notification preferences.
- An explicitly scheduled synthetic treatment, actual worker-generated dose reminder, inbox navigation and confirmed immutable TAKEN record.
- Cross-account treatment ownership enforcement.
- Sign-out propagation across tabs and denial of subsequent private access.

Treatment fixtures are created through the API in the Node test process; treatment creation is not a portal feature. An occurrence is scheduled in the next eligible future minute because activation does not backfill past occurrences. The test waits for that occurrence and the actual worker without altering the medical rules.

This complements the mocked browser suite and session tests. It does not validate production deployment, delivery of external notifications, or real patient data.

## Verified run

On 2026-09-25, both desktop and mobile scenarios passed against the disposable real backend (2/2, about two minutes). ESLint and TypeScript checks also passed. Separately, the configured API readiness endpoint and anonymous web session initialization were verified; no live patient account flows were exercised.
