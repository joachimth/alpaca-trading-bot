# Control-707 — Strict Read-Only Alpaca Production Control

**Status:** HEALTHY 2.7.0 — docs-only, NO deploy, no defect.
**Timestamp:** 2026-09-18 ~14:00-14:05 UTC (date -u 14:00:15; C-370 clock lesson applied).
**Repo HEAD prior:** b7db43f (C-705 NOW sync / C-705 docs commit). Deployed src **2fe9c5a** (zero src diff).
**Control:** Control-707 (hourly cadence; prior C-705 at 13:00 UTC; C-706 hourly interval).

## This control is significant
It is the **first control capturing an ACTIVE live daytrading session at the Fri 13:30 UTC open** — the exact live predicate test the C-688 escalate-again rule awaited. **Result: session delivering correctly, 0 suppression recurrence — the predicate remains DORMANT.**

## Live endpoints consulted (all GET, 200)
- `/health` → ok 2.7.0
- `/api/account` (broker-direct) → equity $97,121.98, change_today +$5.11 POSITIVE
- `/api/config` → 2.7.0, risk-guard keys unchanged, caps 5000/3700/2000
- `/api/dashboard` → broker-authoritative, current_state_source=alpaca, metadata_source=d1
- `/api/positions` → source=alpaca, 14 broker positions
- `/api/runs?limit=300` → id-contiguous, 0 gaps/errors/lease
- `/api/trades?limit=300` → 300/300 filled

No trigger/submit/cancel/close/replace/retry/migration/broker-mutating endpoints were called.

## Artifacts saved here
- h.json / acct.json / cfg.json / dash.json / pos.json / runs.json / trades.json (raw responses).

## Validation
- `bun test` 241 pass / 0 fail / 893 assertions
- `bun run typecheck` exit 0
- `git diff 2fe9c5a -- src/` empty (ZERO src diff)
- `git diff --check` clean
- Deployed bundle index.js md5 e34318f5 (unchanged C-688 bundle, 321,210 B), RELEASE_VERSION + guard markers present

## Final
Docs pushed remote==local (README / OPERATIONS / RUNBOOK) via GitHub OAuth Contents API. See Control-707 doc entry (this control).
