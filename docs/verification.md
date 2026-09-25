# Verification — 2026-09-25

Implementation: `/Volumes/Data/Workshop/Projects/saydaliyati-web`.
Node 24.21.0, pnpm 11.24.0, Next.js 16.3.6, React 19.3.0, TypeScript 5.9.3.

## Passed

- Frozen-lockfile offline installation: dependencies and lockfile consistent.
- `pnpm lint`: clean.
- `pnpm typecheck`: route generation and strict TypeScript clean.
- `REDIS_TEST_URL=redis://127.0.0.1:16389 pnpm test`: **14/14 passed**, no skips.
  Used a disposable Redis 8 container and a synthetic local HTTP API. Covers
  cross-instance rotation, consumed-token loss/crash handling, logout/login races,
  stale-account mutation rejection, isolated browser sessions, CSRF, allowlists,
  canonical error forwarding, no-cache behavior and no ambiguous mutation retry.
- `pnpm build`: optimized production build passed without API/Redis secrets.
  Standalone packaging includes static assets and public files.
- Standalone production smoke: public root and nine static assets returned 200;
  security headers present; missing runtime configuration returned redacted 503
  SERVICE_UNAVAILABLE with private no-store. Production cookie check verified
  __Host- name, Secure, HttpOnly and no Domain attribute.
- `pnpm test:e2e`: **36/36 passed in one final run**, 18 scenarios each on desktop
  Chromium (1280×720) and Pixel 7 emulation. Covers auth/registration feedback,
  Unicode/password preservation, Home live counts, Pharmacy filters/paging,
  manual stock and uncertain-save safety, all original screens, immutable dose
  confirmation/eligibility, five explicit flags, invisible preference preservation,
  late navigation responses, cross-tab logout and keyboard/layout checks.
- Visually reviewed desktop/mobile Home, mobile Pharmacy and desktop Settings
  screenshots. Full-page screenshots include a viewport-positioned fixed mobile
  navigation bar; actual browser checks verify responsive width and navigation.
- Specification metadata regenerated and verified in both `sayadaliyati-api`
  (57 documents / 60 checksums) and original `Saydaliyati` (55 / 58).

The default `pnpm test` skips the two real-Redis integration tests when
REDIS_TEST_URL is absent. To repeat them, start a disposable Redis instance:

```sh
docker run --rm -d --name saydaliyati-web-test-redis \
  -p 127.0.0.1:16389:6379 redis:8-alpine redis-server --save '' --appendonly no
REDIS_TEST_URL=redis://127.0.0.1:16389 pnpm test
docker stop saydaliyati-web-test-redis
```

## Limits and pending acceptance

No live API URL was supplied. Browser fixtures and the HTTP test upstream are
synthetic; this run does not claim live end-to-end backend ownership validation.
The existing API continues to enforce patient ownership and medical domain rules.
No real patient data or existing medical database resources were accessed.

Safari, Firefox, physical-device testing, screen-reader acceptance and production
HTTPS/proxy deployment remain unverified. Dockerfile/runtime instructions were
provided; a production container image was not built or deployed in this task.
ESLint 9 is pinned for Next's React-plugin compatibility; moving to ESLint 10
requires an upstream-compatible plugin version. Production must also plan for
the API's current shared socket-IP rate-limit budget.

No remote was configured, no push or deployment was performed. Existing mobile
and backend implementation files were preserved. Only the approved web milestone
and blueprint documents plus generated metadata were updated in those spec repos.

## Multilingual landing page update

Added static Arabic `/ar`, English `/en` and French `/fr` landing pages; `/`
redirects to English and the patient portal now lives at `/portal`. Arabic has
server-rendered RTL direction and locale-correct document language. Public pages
load without server credentials and do not make authenticated API requests.

Final checks: lint, strict TypeScript and production build passed. All **46 browser
checks passed** together (36 portal regressions plus 10 landing checks), covering
language switching, keyboard-operated FAQs, portal entry, unknown-language 404,
RTL and 320px phone layout. Reviewed desktop and Arabic mobile screenshots and
captured the standalone production page in all three languages.

The landing page is translated; the patient portal remains in English, explicitly
stated in each language. No new medical/notification capabilities are advertised.
No deployment or remote push was performed.
