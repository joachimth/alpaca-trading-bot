# NOW
## 2026-08-08
- Fee-aware patch documented, uncommitted, undeployed; live Worker unchanged.
- Tabs show gross/fees/net; overview shows unattributed broker P&L.
- BUY costs are quantity-aware; discretionary exits are separate; protective/EOD/manual bypass.
- Swing costs use explicit round-trip bps; expectedEdgeBps=0 only logs costs.
- Validation target: typecheck, diff-check, dry-run, 53 tests, 151 assertions.
- Historical P&L is gross/model-style; fee ledger has three-day overlap.
- Follow-up: fill/FIFO accounting, swing peak state, commit/deploy verification.
