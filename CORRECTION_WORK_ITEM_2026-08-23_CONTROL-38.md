# CORRECTION WORK ITEM: Control-38

Date: Sunday, August 23, 2026. Disposition: **OPEN FAIL/DEGRADED - documentation/evidence correction only**.

Control-38 records a documentation evidence gap found during the Control-37 release audit. The leading status in `README.md`, `docs/OPERATIONS.md`, `docs/DEPLOYMENT_RUNBOOK.md`, repository `NOW.md`, and workspace `/workspace/NOW.md` correctly remains **OPEN FAIL/DEGRADED**, with live `1.0.0/2.4.0` versus local `2.6.0`, stale filtered observability/pagination, and unresolved Wrangler provenance.

Historical deployment entries in the operations documentation, including dated August 21 records, are historical records and must not be interpreted as current deployment provenance. No current deployment receipt or source-SHA binding was found for Control-37. The directly captured Control-37 regression evidence is `/workspace/alpaca_control_37_focused.txt` (`72 pass`, `0 fail`, `331 expect() calls`) and `/workspace/alpaca_control_37_full.txt` (`178 pass`, `0 fail`, `632 expect() calls`); no standalone Control-37 typecheck/diff-check log or deployment receipt was found.

No runtime, capital-cap, schedule, lease, broker-authority, accounting, edge-gate, sizing, or trading-behavior change was made. No deployment, preview, trigger, submit, cancel, close, replace, retry, migration, or broker mutation occurred.

Follow-up: preserve the dated historical deployment records, restore authenticated Wrangler access, generate reproducible standalone typecheck/diff-check evidence for the next correction, establish source/deployment binding, and perform authorized deployment plus separate GET-only verification before treating any release as current.
