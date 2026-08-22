# NOW
- Control-13 corrects the run metric contract: `trades_executed` means broker-confirmed full fills, not submitted orders.
- Submitted, accepted, pending, rejected, canceled, and partial orders remain lifecycle rows in `trades`; only full fills count in `run_log`.
- README, operations/runbook docs, dashboard labels, and focused regression coverage now state this boundary.
- No production behavior, caps ($5000/$3700/$2000), schedules, broker authority, edge gates, or mutation boundaries changed.
- Focused regression passed 51 tests/227 assertions; full `bun test` passed 168 tests/584 assertions; typecheck, diff-check, and Wrangler dry-run passed.
- No deployment, temporary preview, trigger, or broker mutation was used; live production remains FAIL/DEGRADED and unchanged.
