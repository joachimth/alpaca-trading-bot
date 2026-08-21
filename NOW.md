# NOW
## 2026-08-21 09:00 CEST
- Production control is degraded, not healthy: lease-held skips, stale/missing fresh run proof, gross/net display inconsistency, and partial-exit lifecycle risk were found by read-only GET audit.
- Local correction candidate adds net-consistent `totalPl`, `/api/runs` pagination/filters, broker-authoritative quantity persistence, pending stock/swing exit guards, and precise BUY-block mismatch observability.
- Validation target: full tests, typecheck, diff-check, dry-run; no broker mutation. Deployment is not yet performed.
- Vital parameters unchanged: daytrading $5,000, swing $3,700, crypto $2,000.
- Remaining live follow-up after deployment: separate read-only verification of all endpoints, schedules, fresh runs, lifecycle fields, fees/net, and caps.
