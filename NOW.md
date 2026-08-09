# NOW
## 2026-08-09
- Crypto hardening is local, uncommitted, and not deployed; no broker mutation was used.
- Protective exits precede halts; entries default to 1/cycle; discretionary exits default to 2/cycle.
- Same-cycle reservations, strict config aliases, seven-day crypto fee telemetry, fail-closed fee sync, D1 entry-rate protection, and unified ATR/fallback/trailing exit evaluation are implemented.
- Validation: 67 tests, 193 assertions, typecheck, schema validation, diff-check, Wrangler dry-run pass.
- Remaining before release: review lifecycle/fill accounting, then commit/push and separately verify deployment.
- Live Worker remains the prior capital-cap release; caps unchanged at day 5000, swing 3700, crypto 2000.
