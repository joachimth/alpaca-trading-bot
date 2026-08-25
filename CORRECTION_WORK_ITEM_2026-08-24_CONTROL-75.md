# Correction work item: Control-75 production-control reliability inspection

**Date:** Monday, August 24, 2026  
**Disposition:** **OPEN FAIL/DEGRADED** for live production; **LOCAL VALIDATED**  
**Scope:** read-only source/documentation correction work only

## Safety boundary

No deployment, migration, trigger, submit, cancel, close, replace, retry, external write, or broker-mutating endpoint was called for this work item. Capital caps remain exactly **5000 / 3700 / 2000 USD** for daytrading, swing, and crypto. The four schedules remain unchanged: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and reconciliation `*/10 * * * *`.

## Worktree and provenance

The worktree was inspected before editing. The checked-out branch is `fix/remove-premature-position-upsert-entryside` at commit `1c6914d1766e420fc3cfa3be2f1e2914c5e197de`, release `2.6.0`; cleanliness is not asserted as deployment provenance. The local source is therefore source-tied to that commit. The active Worker cannot be source-tied from this environment: `bunx wrangler whoami` returned `You are not authenticated. Please run wrangler login.` Live health/config remain **1.0.0 / 2.4.0** per the prior GET-only control, so production remains **OPEN FAIL/DEGRADED**, not healthy.

## Inspection result

The required documentation files already existed and contained the prior control status, cap/schedule invariants, safety boundary, release identity, and deployment blocker. They were updated with this work item's explicit local-versus-live provenance status.

The checked-out source already contains the requested reliability surfaces, so no trading-code change was justified:

- `/api/runs` applies strategy, trigger/alias, status, code, search, limit, offset, and page handling through read-only SQL; durable `analyzed_candidates` and `filtered_candidates` fields are logged and returned.
- Historical canonical triggers remain unchanged; requested production aliases are translated only at the read-only API boundary.
- Crypto admission carries calibrated raw edge through the strategy-to-risk path and fails closed when fee telemetry or calibrated edge is unavailable/stale. Structured skip context records status/reason without inventing numeric edge or fee values.
- Existing regressions cover filtered runs, pagination, candidate counts, release identity, and crypto edge-gate behavior.

No cap, schedule, threshold, sizing, fee policy, order semantic, migration, or trading-behavior change was made.

## Validation

- Focused regression suite: `bun test test/audit-regressions.test.ts test/dashboard-readonly.test.ts test/crypto-runtime.test.ts test/release-version.test.ts` — **passed**.
- Full suite: `bun test` — **passed**.
- Typecheck: `bun run typecheck` — **passed**.
- Patch validation: `git diff --check` — **passed**.
- Deployment preview: `bunx wrangler deploy --dry-run` — **passed**, preview only; no deployment.
- Authentication/provenance check: `bunx wrangler whoami` — **blocked** by `You are not authenticated. Please run wrangler login.`

## Follow-up blocker

Restore Wrangler authentication through the secure credential flow, establish active Worker/source provenance and deployment authorization, and deploy only the already-validated artifact if separately authorized. Then perform a separate GET-only verification of release identity, broker-authoritative positions, caps, schedules, natural strategy delivery, filtered observability, lifecycle/accounting fields, and crypto edge-gate evidence. Until that occurs, retain **OPEN FAIL/DEGRADED**.
