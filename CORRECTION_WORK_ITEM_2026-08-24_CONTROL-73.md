# Correction work item: Control-73 strict read-only production control

**Date:** Monday, August 24, 2026  
**Disposition:** **OPEN FAIL/DEGRADED**  
**Scope:** documentation/status correction; no code, cap, schedule, deployment, migration, or trading-behavior change

## Safety boundary

This control used only GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, together with read-only filter and pagination probes. No trigger, submit, cancel, close, replace, retry, migration, deployment, or other broker-mutating endpoint was called.

## Exact live defects and evidence

The archived strict GET-only capture is `/workspace/alpaca-control-live-2026-08-24-control72/`.

### 1. Repeated daytrading minimum-notional broker 403s

The live artifact allowed sub-minimum daytrading BUYs to reach Alpaca repeatedly:

- Run **3328** at **2026-08-24 16:16:17 UTC** recorded `Buy failed for PLUG` with Alpaca HTTP **403**, code **40310000**, `cost basis must be >= minimal amount of order 1`.
- Run **3344** at **2026-08-24 17:56:27 UTC** recorded `Buy failed for NIO` with the same Alpaca HTTP **403**, code **40310000**, and minimum-order message.

These are repeated deterministic minimum-notional failures, not evidence for retrying or resizing an order. The checked-out source already contains the targeted daytrading BUY minimum-order preflight and structured `MIN_ORDER_SIZE` observability immediately before submission; the live failures remain evidence that the active artifact is older or otherwise not source-matched.

### 2. Live API version drift from the validated local release

- `/health` returned `status=ok` with live version **1.0.0**.
- `/api/config` returned persisted config version **2.4.0**.
- The checked-out source is release **2.6.0** at commit **42c45142851a6cf3026363ab673fac35ccdbf3b0**; the prior minimum-order implementation is in the latest reliability history at commit **0b7a6e5**.
- Wrangler is unauthenticated, so the active production Worker cannot be mapped independently to the checked-out commit or validated artifact.

HTTP health is therefore not release-health proof. Production remains open and degraded until authenticated provenance and any separately authorized release are verified.

### 3. Missing live filtered-run fields and candidate counters

The live `/api/runs` rows expose stored run IDs, timestamps, trigger, status, decisions, and errors, but do not expose the locally implemented filtered-run metadata fields `trigger_alias`, `analyzed_candidates`, or `filtered_candidates`. The `code=LEASE_HELD` and `search=LEASE` GET probes returned the same current page rather than proving filtered matches. The live response also does not provide filter metadata needed to certify the filtered contract.

The latest live run evidence includes daytrading run **3346** at **2026-08-24 18:01:37 UTC**, reconciliation run **3345** at **18:01:19 UTC** with `MAINTENANCE_ONLY`, and crypto run **3338** at **17:38:15 UTC**. No fresh August 24 swing strategy run or explicit `CYCLE_LEASE_HELD` row is proven in this capture. The absence of fields is a live observability defect/gap, not permission to infer candidate counts or lease behavior.

### 4. Conservative null filled-trade gross/fee/net evidence

Filled trade samples retain broker order IDs, client IDs, quantities, fill prices, statuses, and lifecycle timestamps, but exact per-fill economics remain intentionally unavailable:

- Trade **682**, created **2026-08-24 17:56:17 UTC**, has `gross=null`, `fee=null`, `net=null`, `accounting_status=unavailable_fill_lot_exact`, and `fee_attribution=none-recorded`.
- Trade **681**, created **2026-08-24 17:51:22 UTC**, has the same conservative null economics and attribution status.
- The sampled `status=filled` response therefore does not prove fill-lot-level gross, fee, or net for individual rows. The schema/source cannot establish a deterministic closed-trade fill-lot link, so uncertain values remain null rather than being estimated or assigned from aggregate data.

The crypto aggregate remains arithmetically consistent at gross **-56.616426**, fees **269.110169**, and net **-325.726595**, but aggregate consistency is not a substitute for exact per-fill attribution. This is conservative evidence behavior and is not a reason to loosen accounting controls.

## Preserved control state

The checked-out source and existing minimum-order change were inspected without changing trading behavior. Preserve:

- Capital caps exactly **5000 / 3700 / 2000 USD** for daytrading, swing, and crypto.
- The four UTC schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and read-only reconciliation `*/10 * * * *`.
- Broker-authoritative positions (`positionsAvailable=true`, `source=alpaca` when the broker is available); D1 remains metadata, not a fallback live position source.
- The existing daytrading BUY minimum-notional preflight only; do not broaden it to exits or other strategies, resize/clamp orders, or alter thresholds, sizing intent, fee freshness, crypto edge policy, order semantics, or schedules.
- Conservative null economics when fill-lot attribution is not proven.
- No-mutation validation: GET-only production checks and local tests only.

## Validation and deployment boundary

This work item is documentation/status-only because the required runtime reliability fix is already present in the checked-out 2.6.0 source and no additional code change is justified by the evidence. No migration or broker mutation occurred. The authorized production deployment attempt reached Wrangler but produced no deployment receipt; `bunx wrangler whoami` and the deployment path report `You are not authenticated. Please run wrangler login.` The active Worker therefore remains uncorrected and unproven. Local validation for the resulting tree is recorded below after execution:

- Focused audit/capital/position-authority/crypto-edge/observability regressions: **54 tests / 319 assertions passed** across the requested control suites.
- Full `bun test`: **204 tests / 775 assertions passed**, 0 failed.
- `bunx tsc --noEmit`: exit **0**.
- `git diff --check`: exit **0**.

The local pass does not certify the stale live artifact. Do not use a trigger or broker-mutating endpoint as a smoke test.

## Explicit follow-up

1. Restore Wrangler authentication through the secure credential flow and identify the active production Worker, deployment, version, source commit, and schedule state.
2. If and only if separately authorized under the standing reliability-maintenance rule, prepare and release a clean artifact containing the already-validated daytrading BUY minimum-notional preflight; do not change caps or trading behavior and do not deploy this documentation correction as a substitute for provenance.
3. After any authorized release, run a separate GET-only verification of all six endpoints and confirm live version identity, `MIN_ORDER_SIZE` skip evidence, filtered-run fields (`trigger_alias`, `analyzed_candidates`, `filtered_candidates`), filter metadata, and disjoint trade pagination.
4. Observe natural scheduled delivery, including fresh daytrading and swing evidence and explicit lease-held behavior; do not manufacture evidence with triggers.
5. Preserve null per-fill `gross`/`fee`/`net` until deterministic fill-lot/order attribution is designed, tested, and separately authorized.

Until those steps are complete, Control-73 remains **OPEN FAIL/DEGRADED**, not healthy.
