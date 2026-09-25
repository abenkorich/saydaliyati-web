# Prescription management

Available through **More → My Prescriptions**, or the central **Add** menu.

- Browse current, draft, confirmed and archived prescriptions, with pagination.
- Create manual drafts with 1–20 medicine lines, optional prescription/validity dates,
  catalog lookup or a medicine name as written. Blank fields remain unknown.
- Attach JPEG/PNG images to saved drafts, one consecutive page at a time (20 max).
  Images are limited to 5 MiB / 20 million pixels. No OCR or automatic extraction.
- Open private document links issued by the API, valid for at most 60 seconds.
- Edit each line and explicitly review all fourteen values, including unknowns.
  Editing clears that field's review selection. Save each line before finalization.
- Confirm the saved review only when the supported daily regimen is complete:
  catalog link, dose/unit, daily times and start/end dates, with consistent optional
  daily frequency/duration. Confirmation uses every current retained field ID.
- Reject a medicine line or archive the prescription after explicit confirmation.
  Those actions preserve history; restoring rejected lines/archives is unavailable.

Confirmation is the patient's review of entered information, not professional
verification. It does not create or activate treatment schedules. Unknown values
are never guessed, and no stock or dose record is changed by this workflow.

## Conflicts and connectivity

Stale reviews require reloading the latest field revisions. Unsaved edits block
final confirmation. After an ambiguous draft creation, check the list before
creating another draft. After any upload failure, reload and reconcile the page
list before selecting a file again. Domain writes are not automatically retried;
only an authentication rejection can refresh the session and retry once.

## Server requirements

The existing API must have prescription migrations and grants applied. Attachments
require its private S3-compatible document storage settings. Database/Redis health
checks alone do not verify document storage. The signed storage endpoint must be
reachable from phones/browsers. API configuration remains server environment
variables; client apps do not receive storage credentials. Original image bytes
may retain embedded metadata; the selection UI explains this.

## Verification

Validation tests cover unknowns, dates, positive decimals, explicit times, field
review IDs, complete confirmation snapshots, duplicate medicines and attachment
bounds. Browser tests use synthetic data and exercise create/upload/review/confirm/
archive, stale reviews and recovery from a lost upload response at desktop and
phone widths. No real patient records are created by these tests.

## Web transport

The browser uses the existing HttpOnly session and X-Session-Version mechanism.
The backend proxy allowlists only owner prescription CRUD and document routes.
Multipart uploads retain exact-origin CSRF checks, a bounded 5 MiB + 64 KiB input
reader, exactly two fields and a rebuilt form with a generic filename. The API
performs image decoding and ownership checks. JSON requests retain the 16 KiB limit.
Private responses are not cached; no API tokens are exposed to browser JavaScript.

## Local verification result (2026-09-25)

- Mobile: format/lint/type checks, 20 tests, and Android JavaScript/assets export passed.
- Web: lint (one pre-existing ignored-work config warning), strict types, production
  build and 23 tests passed; two Redis integration tests skipped without REDIS_TEST_URL.
- All 52 browser checks passed using the existing local development server and
  synthetic API fixtures, across desktop and phone dimensions.
- Native Android image selection and end-to-end VPS document storage were not tested.
  No deployment or remote push was performed.
