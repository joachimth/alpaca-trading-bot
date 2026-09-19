# NOW
- **LØR 19/9 10:00 +02: RELEASE 2.8.1 DEPLOYET — CRYPTO NU MED I ANALYTICS.** Joachim spurgte "mangler crypto?" — ja, scope var kun day/swing. Fix: strategy=crypto tilladt, comparison = Day/Swing/Crypto (crypto-kolonne + cryptoTrading-KPIs), Crypto i filter-dropdown, 3. A4-rapportknap. Live: /health 2.8.1, /api/analytics?strategy=crypto = 9 trades, -56.63 (11,1% win, PF 0,06), crons 07:57:53, runs flyder. 263 tests/969 assertions, typecheck 0. Commits 2ea5e9d+3a94f24, 12 filer pushet sha-verified, Pages = 2.8.1. Rollback: 2.8.0 bundle 3d4bf876 fra git ff2e09d.
- Crypto handel stadig config-disabled — analytics er read-only over historiske lukninger; fylder sig selv ud hvis crypto genaktiveres.
- **Verify mandag 13:30z: min_confidence 0.8-afvisninger (C-726); swing-fire 22:00z mandag = 6. kadence-test.** Eskalerings-predikat ARMED. Pending Joachim: D1 paid-tier, cap fill-drift re-check.
- Data-grænse uændret: daytrading EOD-flatten → closed_pl NULL = "Insufficient data" (FIFO item-5 er forudsætning); MFE/MAE/funding/leverage ikke optaget.
- Michael Koldsø + mail-items 1/4 LØST. Drafts: FW 593759 + 593551 til lb@ pending send.
- 🟠 HØJ: Niels optælling borde/stole (50), Kragerup (5/10), Ladebox-lead Søren Wulf Møller, Ulrik Lerche uge 40, Zaptec/Minuba 47289, Apple T&C 29/9.
