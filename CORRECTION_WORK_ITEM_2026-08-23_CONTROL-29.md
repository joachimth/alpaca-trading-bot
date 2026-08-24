# CORRECTION WORK ITEM: Control-29

Date: Sunday, August 23, 2026. Disposition: **OPEN FAIL/DEGRADED - strict read-only control; documentation/status correction only**.

## Findings

- All six required production GET endpoints returned HTTP 200.
- Live identity is unresolved and stale: `/health=1.0.0`, `/api/config.version=2.4.0`, versus local validated release `2.6.0` at `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`.
- Positions are broker-authoritative and available: `positionsAvailable=true`, `source=alpaca`, 29 rows.
- Equity is `98504.50` versus `last_equity=98504.5039`; direct delta is about `-0.0039`, while `change_today=0`, so material current-day direction is unverified.
- Caps remain exactly `5000/3700/2000` USD for daytrading/swing/crypto.
- Local UTC schedules remain daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and reconciliation `*/10 * * * *`; live declaration/provenance is not exposed sufficiently to verify the deployed set.
- Fresh crypto delivery is present at `07:07:57` and `07:37:56` UTC, with recurring `:07/:37` cadence; fresh reconciliation is present at ten-minute intervals, including run `2961` at `08:01:05` as `MAINTENANCE_ONLY`.
- Sunday, August 23, 2026 does not expect weekday daytrading/swing cron delivery. Filtered daytrading is stale at run `2556` (`CYCLE_LEASE_HELD`, August 20); filtered swing is stale at run `1236` (August 11), with historical divergence/`RISK_HALTED` evidence.
- Historical errors remain observable: Alpaca 503s in runs `2802/2803` and D1 `too many SQL variables` in run `2678`.
- Live trades expose lifecycle fields, but exact per-fill economics remain conservatively unavailable: `gross=null`, `fee=null`, `net=null`, `accounting_status=unavailable_fill_lot_exact`, `fee_attribution=none-recorded`.
- Aggregate crypto accounting is consistent within rounding: `-56.616426000004 - 269.11016882811 = -325.726594828114`, matching reported net `-325.72659482810997`; `269.11016882811 + 3.21 = 272.32016882811`.
- Live filtered responses omit `trigger_alias` and durable analyzed/filtered candidate counters; offsets `0/30/60` repeat trade IDs `642..613`.
- Local filtered observability and crypto calibrated-edge wiring corrections are present and regression-tested, but not live-proven.
- `bunx wrangler whoami` is blocked by `You are not authenticated. Please run wrangler login.` / missing `CLOUDFLARE_API_TOKEN`.

## Correction and validation

This work item makes no runtime or configuration change. It updates only `README.md`, `docs/OPERATIONS.md`, `docs/DEPLOYMENT_RUNBOOK.md`, and `/workspace/NOW.md` with the current evidence, disposition, deployment blocker, and follow-up. No vital cap, schedule, broker-authority, lease, accounting, edge-gate, or trading behavior is changed.

Required post-update validation: focused regression suites covering dashboard/run/trade observability and crypto edge-gate behavior, full `bun test`, `bunx tsc --noEmit`, `git diff --check`, then a separate GET-only live verification of all six endpoints and the filtered/pagination probes. Deployment remains blocked and is not attempted.

## Acceptance

**Documentation/status correction complete locally; production remains OPEN FAIL/DEGRADED and not healthy.** Restore authenticated Wrangler access and obtain the required deployment decision before any release action. Never use trigger, submit, cancel, close, replace, retry, migration, or another broker-mutating endpoint as smoke testing.
