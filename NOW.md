# NOW
- Control-60 local reliability fix complete; live production remains OPEN FAIL/DEGRADED.
- Fixed ambiguous crypto POST reservation release, terminal partial-fill duplicate retry, expired orphan cleanup, crypto duplicate guard, and stale/zero D1 realized P&L writes.
- Focused validation: 85 tests / 272 assertions. Full validation: 197 tests / 738 assertions. Typecheck and diff-check passed.
- Live GETs remain reachable, but /health=1.0.0 and /api/config=2.4.0 versus local release 2.6.0; positions are broker-authoritative, source=alpaca, 29 rows.
- Live reconciliation and crypto cadence are present; swing subrequest failure, stale filters/pagination, stale fee telemetry, unsynchronized account/snapshot reads, and unavailable reservation route remain open.
- Caps remain 5000/3700/2000 USD; schedules, thresholds, max-trade limits, universe, sizing, signals, and order semantics unchanged.
- No trigger, broker mutation, migration, or deployment occurred for Control-60; local commit/push is the remaining release-record step.
- Final local validation is green: focused 85/272, full 197/738, typecheck and diff-check passed.
- Next: advisor review, final diff/status check, commit all Alpaca project changes, push branch, then keep deployment pending authenticated clean-artifact review and GET-only post-release verification.
