# Current mobile feature audit and web parity

Audit date: 25 September 2026. Source audited before browser test implementation:
`app/index.tsx`, `src/client.ts`, `src/session.tsx`, `src/pharmacy.tsx`, and `src/stock.ts` in the separate
`sayadaliyati-app` repository; approved API `docs/WEB-PORTAL.md`, decision D023,
and `docs/api.openapi.json` in the separate `sayadaliyati-api` repository.
This document records current implemented mobile scope, not the broader future
product specification. No runtime imports from those repositories are used.

## Authentication and session boundaries

Mobile registers with email or international phone, first and last names,
untrimmed password, `preferredLanguage: EN`, and the detected timezone. Login
sends the identifier and untrimmed password. Mobile keeps refresh credentials in
its secure vault, restores the session, serializes token refresh, invalidates
stale generations, and clears private state on sign-out. A consumed refresh
credential is never retried after an ambiguous response.

The browser port adapts these boundaries to a same-origin server session; browser
JavaScript receives only authentication state. Registration provides explicit
field validation, including password length measured in Unicode code points,
without modifying the supplied password. Browser tests inspect synthetic request
bodies and check that credentials are not persisted in browser storage. Server
tests cover the separate BFF credential, refresh, authorization, origin and cookie
boundaries; route-mocked browser checks alone cannot prove those boundaries.

## Patient areas (including the updated mobile pharmacy scope)

- **Home:** greeting from the profile API, real inventory/low-stock/active-treatment totals from API metadata, recent stock, active courses and navigation shortcuts. No invented counts.
- **My Pharmacy:** paginated stock with All, Low stock and Expired filters. The API determines low stock and filtering. Stock cards preserve quantity, unit and recorded/unknown expiry.
- **Add stock:** catalogue medicine details accept an explicitly entered quantity, packaging unit and optional expiry; POST inventory sends source MANUAL. Input validation follows the audited mobile stock validation and does not infer packaging or change prescribed doses.
- **Treatments:** paginated existing courses, course details, instructions,
  medicine lookup, stored occurrence timezone, server-supplied eligibility,
  existing records, and confirmation before immutable TAKEN/SKIPPED recording.
  Cancellation makes no write. Ambiguous writes are not automatically replayed.
- **Medicines:** paginated catalogue, name search, detail/back navigation,
  synthetic DEMO labels, null-safe metadata and empty results. Unknown medicine
  facts remain unknown.
- **Inbox:** paginated reminders, unread state, mark-all-read, and mark-read
  before opening the associated treatment. These are in-app reminders.
- **Settings:** explicit configured/unconfigured notification preferences,
  all five flags (dose, expiry, low stock, sharing and system), save feedback,
  preservation of unsaved selections after a failed save, and sign-out. All
  unconfigured flags begin disabled; viewing the page implies no consent.
  Only dose inbox reminders are currently delivered by the API.

Loading, errors, retries, empty states, pagination, busy locks, back navigation,
manual refresh and focus/reconnect refresh are part of the port. Late requests
must not restore content after navigation or logout. The theme retains the
approved mobile colors, white rounded cards, spacious typography and English
branding. Semantic navigation, keyboard access, labelled inputs and confirmation
dialogs adapt the same features to desktop and phone browsers.

## Verification scope

`test/e2e/portal.spec.ts` uses isolated synthetic HTTP route fixtures in Chromium
at desktop and Pixel 7 dimensions. It exercises registration/login payloads,
session entry, logout clearing, list/search/detail/pagination/error recovery,
DEMO and null handling, occurrence eligibility and confirmation, reminder
mutation order, and all five preferences including a failed save. It checks
horizontal overflow and keyboard navigation. `playwright.config.ts` starts the
local application on loopback port 3100; no API address or real account is needed.

These fixtures verify browser behavior against the API shape. They do not prove
live API delivery, a deployed proxy, real cross-device behavior, or delivery of
any push notification. The final delivery report records actual commands and
results, separately from test coverage.

## Future scope, not missing mobile parity

The audited mobile implementation does not yet provide treatment creation,
prescription screens, profile editing, account recovery, native
push or web push. The browser port does not invent those capabilities. Remote
hosting, domains, live API integration checks and deployment remain outside this
local implementation task.

The expanded responsive navigation follows Home / Pharmacy / Add / Treatments / More. Inbox and Settings remain accessible through More. Inventory was added during this task after the mobile source gained it; it is completed port scope rather than a future-scope exclusion.

## Local browser result

On 25 September 2026, the Playwright checks passed **36/36 in total**: the full 34-check suite
plus the final two configured-preference regression checks. This covers 18 scenarios each at desktop Chromium and Pixel 7 Chromium dimensions. This
includes real same-origin BroadcastChannel logout between two tabs, account
version headers, Home API counts, stock filters, explicit stock submission and
ambiguous stock-write safety. Screenshots for Home, Pharmacy, treatments,
treatment detail and preferences are produced under the ignored `test-results/`
directory. Test-source ESLint also passed. The suite uses only synthetic route
fixtures; no live API URL or patient data was used.

Configured preference fixtures include the API-only `expiryLeadDays` field. The final regression verifies saves send exactly the five visible flags and never overwrite that unseen setting.

Final integrated rerun: all 36 checks passed together after the configured-preferences regression.
