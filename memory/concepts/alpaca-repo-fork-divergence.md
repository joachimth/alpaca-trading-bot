---
edges:
  - alpaca-docs-push-413
ref_files: []
summary: Origin/main of the Alpaca repo is fork-diverged from local main (non-fast-forward, merge-base 4c9df61) — the proximate docs-push blocker since C-750 (Sep 20); remote 1b4cfa1/C-736 lacks deployed src 2ea5e9d (local 692 ahead/465 behind); RESOLVED Sep 23 2026 (C-825): Joachim delegated the method ("Du vælger den rigtige løsning"); remote main force-pushed to the authoritative local line 9bb80a7 WITH backup branch backup/remote-main-pre-reconcile-20260923 (= old remote tip 1b4cfa1). All 735 blocked control commits are on GitHub. Push channel = plain git push with the stored credential (x-access-token in git credential store) — works end-to-end.
---
# Alpaca repo fork divergence — the current docs-push blocker

- **The fork:** `git push` of Alpaca docs to origin/main rejected NON-FAST-FORWARD (found C-750, Sep 20 04:00 UTC). origin/main is stuck at Control-736 (1b4cfa1) on a separate line that LACKS the deployed source commit 2ea5e9d (465 behind); local main carries 2ea5e9d + the docs chain (692 ahead by C-783, Sep 21). Merge-base: 4c9df61.
- **Causality correction:** the proxy 413 (~1.03MB payloads) was the earlier enabler of push failures but is NO LONGER the proximate blocker — that history and the per-push playbook live on → alpaca-docs-push-413.md.
- **Decision = Joachim's, not mine:** which line is authoritative, whether force-push is acceptable. I did NOT autonomously force-push/merge/rebase a 465-commit fork. Until resolved, every control's docs commit is LOCAL-ONLY (latest e75b84a, Control-784).
- **Watcher incident (Sep 21 ~08:45 CEST):** the C-655 docs-push retry watcher (0984d5f4, 60s poll) was primed to push to origin/main as soon as api.github.com recovered — INTO the forked line. Live check confirmed fork unchanged; repointed the watcher to DEFER (verify fork unchanged each poll, no push, escalate to Joachim only if origin/main gains 2ea5e9d), poll hourly. Notified Joachim (7a60b627).
- **Banked lesson:** before any push attempt, `git fetch origin` and confirm the local vs origin/main relationship first; autonomous force-push/merge over a 100+ commit fork is out of scope.
