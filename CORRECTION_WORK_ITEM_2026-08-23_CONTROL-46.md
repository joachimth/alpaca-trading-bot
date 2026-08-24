# CORRECTION WORK ITEM: Control-46

Date: Sunday, August 23, 2026. Disposition: **OPEN FAIL/DEGRADED - contained daytrading risk-rejection observability correction; local validation complete; deployment not performed**.

## Scope and safety

This is a reliability-only correction for the daytrading `RiskManager` rejection path in `src/index.ts`. It adds the existing bounded `SkipReasonCollector` recording used by the crypto/swing paths, with stable `NO_ENTRY_RISK` and `CAPITAL_CAP` classification and durable context containing strategy, symbol, decision ID, action, and the original RiskManager reason plus finite cost/edge evidence when present.

The existing `decisions.executed=2` update and plain `riskCheck.reason` in `execution_reason` are unchanged. The existing console log, rejection/`continue` behavior, caps, sizing, schedules, broker authority, and all trading behavior are unchanged. No rawEdgeBps producer was introduced and no vital cap was modified. Risk rejection remains before any broker order mutation path.

No deployment, trigger, submit, cancel, close, replace, retry, migration, or broker-mutating endpoint was used.

## Regression coverage

`test/audit-regressions.test.ts` proves:

- a rejected daytrading BUY remains rejected by `RiskManager`;
- the original rejection reason is preserved;
- the structured `NO_ENTRY_RISK` event and context survive `serializeRunDetails` / `parseRunDetails` durability round-trip;
- the rejection has no adjusted quantity and therefore cannot proceed to broker mutation;
- the source rejection block preserves decision update, structured collector call, console log, and no order mutation call.

## Validation and deployment status

- Focused: `/workspace/alpaca_control_46_focused.txt` — **18 tests passed, 0 failed, 59 assertions** across 2 files.
- Full `bun test`: `/workspace/alpaca_control_46_full.txt` — **182 tests passed, 0 failed, 657 assertions across 26 files**.
- Typecheck: `/workspace/alpaca_control_46_typecheck.txt` — **passed** (`tsc --noEmit`, no diagnostics).
- `git diff --check`: `/workspace/alpaca_control_46_diff_check.txt` — **passed** (no output).
- Deployment: **not attempted**. Production remains **OPEN FAIL/DEGRADED** because live release/source provenance is unresolved and authenticated Wrangler tooling remains unavailable (`You are not authenticated. Please run wrangler login.` / `wrangler: command not found`).

## Follow-up

Keep production OPEN FAIL/DEGRADED until the validated source is separately authorized, deployed, and GET-only verified against active Worker identity. Do not infer production behavior from this local correction.
