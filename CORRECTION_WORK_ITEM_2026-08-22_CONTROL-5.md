# Alpaca production control correction work item: Control-5

- **Opened:** August 22, 2026 UTC during strict read-only production control.
- **Status:** **FAIL/DEGRADED**, not healthy.
- **Scope:** response-only run-alias observability. Preserve canonical `run_log.trigger` values and all caps, schedules, trading behavior, broker authority, and broker safety boundaries.

## Confirmed defect

Live canonical `/api/runs?trigger=cron` and `/api/runs?trigger=reconcile_cron` returned rows, while alias requests `/api/runs?trigger=daytrading_cron` and `/api/runs?trigger=reconciliation_cron` returned empty arrays in the saved live control captures. Local source had alias SQL translation and tests, but the live Worker is an older or unverified release (`/health` 1.0.0, `/api/config` 2.4.0; local tested release 2.6.0).

## Correction

`GET /api/runs` now retains canonical stored triggers and adds `trigger_alias` only when an alias request is used. This is read-only response annotation and does not rewrite history, alter cron dispatch, add DDL, change caps of `$5,000/$3,700/$2,000`, change crypto fail-closed edge or fee gates, or call the broker.

## Validation

- Focused alias/read-only tests cover canonical history preservation, explicit daytrading and reconciliation aliases, pagination, filters, and no DDL/broker access.
- Full regression, TypeScript, diff check, and Wrangler dry-run are required and must be captured under `/workspace`.
- Deployment is not claimed without an authenticated receipt tied to this checkout.

## Blocker and follow-up

The standing reliability-maintenance rule permits deployment of this narrow correction after validation, but `bunx wrangler whoami` reports unauthenticated and non-interactive Wrangler requires `CLOUDFLARE_API_TOKEN`. Until a Wrangler-compatible credential path is restored, do not deploy or claim live correction; then deploy only this tested checkout and perform a separate GET-only verification of all six endpoints, alias filters, positions/source, caps, schedules, fresh run delivery, lifecycle/accounting fields, and crypto edge-gate observability.

## Post-attempt result

- Exact tested commit: `57a4efbfc2b3e0949829d9951776e8d7115b4f1f`.
- Local validation: focused **26 tests / 156 assertions**, full **157 tests / 520 assertions**, TypeScript, diff-check, and Wrangler dry-run passed; dry-run upload preview was **281.40 KiB**.
- Authorized deployment attempt stopped before upload with: `In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN environment variable for wrangler to work.`
- Separate GET-only verification at approximately **09:04 UTC**: all six endpoints HTTP 200; live `/health` `1.0.0`, `/api/config` `2.4.0`; positions `positionsAvailable=true`, `source=alpaca`, 29 rows; caps `5000/3700/2000`; alias responses still lack `trigger_alias`. No trigger, submit, cancel, close, replace, retry, migration, or other broker mutation occurred.
- Disposition remains **FAIL/DEGRADED**. Follow-up: restore Wrangler-compatible authenticated deployment access, deploy this exact commit, then repeat separate GET-only verification.
