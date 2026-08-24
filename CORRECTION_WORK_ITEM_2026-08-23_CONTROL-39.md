# CORRECTION WORK ITEM: Control-39

Date: Sunday, August 23, 2026. Disposition: **OPEN FAIL/DEGRADED - release-evidence correction only**.

## Finding

The release audit found that `/workspace/alpaca-worker-bundle-crypto-edge-fix` is a stale artifact generated at `2026-08-21T07:57:40.258Z`. Its `index.js` contains the earlier crypto `requireCalibratedEdge`/missing-edge guard, but does not contain the later filtered-run observability symbols or durable candidate-counter behavior. It is therefore not evidence that the validated local `2.6.0` source is the active production release.

The metadata file `/workspace/alpaca-worker-direct-upload-2637a1e.json` and schedule file `/workspace/alpaca-schedules-2637a1e.json` do not bind the active Worker to the local source commit, release version, and complete artifact hash. Dated deployment entries in `docs/OPERATIONS.md` are historical records and must not be interpreted as current provenance.

Control-37 live evidence remains unchanged: live `/health=1.0.0`, `/api/config.version=2.4.0`, missing live filtered aliases/candidate counters, repeated trade pages, stale swing delivery with divergence/RISK_HALTED, and conservative null per-fill gross/fee/net. Local `2.6.0` implementation and tests remain the authoritative validation target, but no current typecheck/diff-check log or deployment receipt is independently captured for Control-37.

## Action and safety boundary

This is documentation/status-only. No runtime code, capital cap, schedule, lease, broker-authority, accounting, edge-gate, sizing, or trading behavior changed. No deployment, preview, trigger, submit, cancel, close, replace, retry, migration, or broker mutation occurred.

## Validation and follow-up

Post-correction validation completed:

- Focused suites: `/workspace/alpaca_control_39_focused.txt`, **72 pass / 0 fail / 331 assertions across 7 files**.
- Full suite: `/workspace/alpaca_control_39_full.txt`, **178 pass / 0 fail / 632 assertions across 25 files**.
- Typecheck: `/workspace/alpaca_control_39_typecheck.txt`, `bunx tsc --noEmit --pretty false`, exit code 0 with no diagnostics.
- Diff check: `/workspace/alpaca_control_39_diffcheck.txt`, `git diff --check`, exit code 0.

Restore authenticated Wrangler access, establish source/SHA/release/bundle/schedule binding, obtain deployment authorization, and only then deploy the validated artifact if required. Capture a deployment receipt and perform separate GET-only verification. Restore authenticated Wrangler access, establish source/SHA/release/bundle/schedule binding, obtain deployment authorization, and only then deploy the validated artifact if required. Perform separate GET-only post-deployment verification, including natural weekday swing delivery and filtered/paginated observability.
