# CORRECTION WORK ITEM: Control-53

Date: Monday, August 24, 2026. This is the current control after Control-52. Disposition: **OPEN FAIL/DEGRADED — strict read-only production control remains unresolved**.

## Documentation/status-only boundary

This work item records status and documentation only. No runtime code, tests, schema, caps, schedules, sizing, thresholds, trading behavior, deployment configuration, deployment, or broker state changed. No deployment and no broker mutation occurred. Historical control receipts remain historical; earlier `182/657` and `184/666` receipts are not rewritten where they accurately describe prior controls.

## Current production evidence

- All six required GET endpoints previously returned HTTP 200: `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`. HTTP 200 reachability does not clear the control.
- Production remains **OPEN FAIL/DEGRADED**, not healthy. Live health is `1.0.0` and live config is `2.4.0`, versus local `2.6.0` at HEAD `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`.
- Positions remain broker-authoritative: `source=alpaca`, 29 rows. Equity direction is ambiguous, with account equity around `98497.23-98499.29` versus `last_equity=98504.5039` and `change_today=0`.
- Caps remain exactly `5000/3700/2000` USD.
- Local schedules remain daytrading `*/5 13-21` weekdays, swing `0 22` weekdays, crypto `7-59/30` at `:07/:37` UTC, and reconciliation `*/10`. Crypto was fresh around `01:07:55` and `01:37:55`; reconciliation was around its ten-minute cadence. Daytrading run `3180` was `MARKET_CLOSED`; swing run `3182` errored with 8 errors including Cloudflare subrequest exhaustion.
- Current `lease-held` delivery is not proven. Live run rows omit `trigger_alias`, `analyzed_candidates`, and `filtered_candidates`; run code/search filters were ignored; trade status filters were ignored; and trade offset/page probes repeated IDs `645`, `644`, and `643`.
- Lifecycle fields exist, but gross/fee/net are null under `unavailable_fill_lot_exact` and `none-recorded`. Local crypto fee/calibrated-edge fail-closed wiring passes locally but is not live-proven.
- Schedule provenance is additionally conflicted: one live schedule artifact lists only three crons and omits reconciliation, while local/post-release capture lists four. Historical daytrading exposure `5679.8784` versus the `5000` cap remains an open reconciliation question.

## Local validation receipt

The current local receipt is focused **87 passed / 388 assertions across 9 files** and full **184 passed / 678 assertions across 26 files**; typecheck passed and the Alpaca-repository diff-check passed. A broader workspace diff-check has unrelated pre-existing trailing whitespace under `data/qdrant/**/LOG`.

The local source already contains the relevant reliability fixes, but they are not live-proven. No additional runtime change is justified by this documentation/status control.

## Deployment gate and follow-up

The exact deployment blocker remains `bunx wrangler whoami`:

> `You are not authenticated. Please run \`wrangler login\``

The worktree is dirty; never deploy uncommitted files. Follow-up is to restore authenticated provenance, reconcile four-schedule identity, establish a clean immutable commit, obtain separate deployment authorization and deploy only if required, perform separate GET-only verification, observe a natural weekday swing run, and resolve the historical cap exposure. Until independently evidenced, production remains **OPEN FAIL/DEGRADED**.
