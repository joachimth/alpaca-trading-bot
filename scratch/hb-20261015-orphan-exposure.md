# Heartbeat 15/10 2026 ~12:45 CEST — FUND: ingen exit-lane ser en swing-position før den har en D1-række

Read-only. Intet ændret i D1 eller kode. Verificeret mod live D1 (Cloudflare API) + kildekode.

## Kæden (hvert led verificeret)

1. **Entréer bliver fill'et efter swing-lanen er kørt.**
   Swing-cron: `0 22 * * 2-6` UTC (`wrangler.toml:19`, `index.ts:227`) = 22:00z EFTER US-close.
   Swing-lanen indsender DAY-købsordrer (entré-benet bruger ikke gtc).
   → De fill'er først ved næste åbning 13:30z **~15,5 timer senere**.

2. **I det vindue findes positionen KUN hos brokeren — ikke i D1.**
   `swing-strategy.ts`'s exit-fase læser udelukkende `positions` fra `db.getOpenPositions()`:
   ```js
   const pos = positions.find(p => p.symbol === sell.symbol);
   if (!pos || !(pos.qty > 0)) {
     errors.push(`Swing exit skipped ${sell.symbol}: no broker position/qty to submit`);
     continue;                       // <-- INGEN ordre sendes
   }
   ```
   Kilden er `db.getOpenPositions()` = `SELECT * FROM positions WHERE closed_at IS NULL`.
   Rækken oprettes først når maintance-lanen (`reconcile_cron`, hvert 10. minut) upsert'er
   broker-snapshot'et ind i D1 — dvs. **efter 13:30z**.

3. **Konsekvens.** Fra fill (13:30z) til næste 22:00z findes positionen i broker-bogen, men
   **ingen D1-række**. I den periode kan ingen af `checkExit()`s tre veje (stop-loss 8% /
   take-profit 15% / z-score) se den, fordi de alle itererer over D1-positioner. Har positionen
   allerede tabt >8% ved lukningen, bliver den først evalueret ~8,5 timer senere.

## HÅRDT BEVIS: D1-rækken oprettes 8,5 timer efter brokeren har positionen

| symbol | broker fill (`trades.filled_at`) | D1-række oprettet (`positions.opened_at`) | lag |
|--------|----------------------------------|-------------------------------------------|-----|
| AAL    | 2026-10-08 **13:32:10z**         | 2026-10-08 **22:00:43z**                  | **8t28m** |
| RIVN   | 2026-10-08 **13:32:20z**         | 2026-10-08 **22:00:45z**                  | **8t28m** |

Begge er stadig åbne i dag. I de 8,5 timer ejede brokeren aktierne, men D1 havde ingen række —
og dermed kunne `checkExit()` ikke se dem. Det er ikke en teori; det er to levende positioner.

Årsagen til 08:00-submit i stedet for 13:30-fill: entré-ordren er en DAY market-ordre
(`swing-strategy.ts:715` `time_in_force: 'day'`) indsendt efter US-close. Nogle mæglere/venues
accepterer den før åbningen (`submitted_at` 15/10 **08:00:22z** for UAL/FCEL), hvorefter den
venter til åbningen med at fylde. Uanset hvornår den indsendes, er pointen den samme: **rækken
opstår først når maintance-lanen upsert'er broker-snapshot'et ved 22:00z-kørslen.**

Endnu et datapunkt: F (nu −14,18%) har `opened_at 2026-08-07 07:17:15` — den dag Joachim lagde
sine for-eksisterende positioner ind. Det er dén position der har ligget længst uden at et stop
har kunnet fyre.

## Live-bevis (D1, 15/10 ~10:40z)

`SELECT strategy, close_reason, COUNT(*) ... WHERE closed_at IS NOT NULL`:

| strategy   | close_reason                     | n  |
|------------|----------------------------------|----|
| NULL       | ai_signal                        | 2  |
| NULL       | auto_reconcile_not_in_broker     | 1  |
| crypto     | crypto_signal                    | 9  |
| daytrading | auto_reconcile_not_in_broker     | 27 |
| daytrading | ai_signal                        | 11 |
| daytrading | eod_flatten                      | 2  |
| daytrading | Fallback stop loss: 8.9% loss    | 1  |
| daytrading | Fallback stop loss: 8.2% loss    | 1  |
| swing      | **broker_authoritative_sync_absent** | **30** |

**Alle 30 lukkede swing-positioner er bogholderi-lukninger.** Nul strategi-lukninger.
Åbne lige nu: 16, alle med D1-række (ingen orphan i dette øjeblik).

## Hvorfor dagens fix IKKE løser det

`index.ts:337-355` (Control-1347-A) lukker netop de D1-rækker der er *absent* fra broker-snapshotet
— det er bogføring, og det **kan per konstruktion ikke se en position der endnu ikke har en
D1-række.** Fixet rettede det modsatte hul (række der bliver hængende efter fill). Orphanen er den
spejlede fejl.

Bemærk også at `closePosition` er `WHERE ticker = ? AND closed_at IS NULL` — uden
`strategy = 'swing'`-filter. Da brokeren slår swing+daytrading sammen pr. symbol (Control-854),
kan en swing-sync-absent lukke en daytrading-række for samme ticker.

## Orphan-vinduet er 8,5 timer, ikke 15,5

Den 15/10 22:00z-kørsel indsendte FCEL/UAL/AMD/TSM. Kl. 10:40z 15/10 stod FCEL og UAL stadig som
`new` med `submitted_at 15/10 08:00:2xz` og `filled_at = None`, mens AMD og TSM stod som `accepted`.
Dvs. ordrerne ventede stadig på åbningen kl. 13:30z. Positionerne er derfor i broker-bogen fra
13:30z, men kommer først i D1 ved 22:00z-kørslen → **8,5 timers blindhed pr. ny swing-position.**

## Hvad der stadig ikke er forklaret (ærligt)

For at lukke en D1-række kræves brokeren **flat**. To kandidat-mekanismer:
- **(a)** swing-lanens egne GTC-exits (stop-loss fyrer og sender en GTC-sell; positionen forsvinder
  fra broker-bogen ved næste snapshot → maintance-lukker rækken med sync_absent).
- **(b)** swing **gen-købte** det samme symbol ved næste 22:00z-kørsel og solgte senere — hvilket
  ville efterlade præcis det samme aftryk (alle lukninger = sync_absent, ingen strategi-lukninger).

Den observerede exit-miks (zscore 25 / stop 10 / TP 0) er *beslutninger*, ikke lukninger — så (a)
alene forklarer ikke at der slet ikke er nogen strategi-lukkede rækker. Sporet bør efterprøves mod
broker-ordrebogen pr. symbol (samme metode som C-1352-rettelsen: `/v2/orders?symbols=X&status=all`).

## Anbefaling (Joachims kald — INTET ændret)

1. **Luk orphan-vinduet:** giv swing-exit-lanen adgang til broker-positioner der endnu ikke har en
   D1-række (fx hent broker-snapshot og syntetisér rækken før exit-fasen), så en position kan
   stoppes fra dag ét.
2. **Gør manglende række synlig:** fejlen "no broker position/qty to submit" ender i `run_log.errors`
   men skriver ingen trade-række — samme usynlighed som 422-brøkdelene.
3. **Snævrere exit-vindue:** flyt swing-cron nærmere åbningen, eller kør exit-lanen oftere end 1×/døgn.
4. **Genbesøg `broker_authoritative_sync_absent`** som lukke-grund for swing (den stille bagdør fra
   hb-20261015-tp-refuted.md) — nu med tilføjelsen at den heller ikke kan se orphans.

## Bot-status i øvrigt (read-only)

- Equity **$96.937,50** (10:37z) · cash $93.636,37. Gulv `account_equity_floor_usd` = 95.000 →
  **$1.937 over**; gulvet er reelt arm'et (kode-fallback matcher: `RISK_GUARD_DEFAULTS` 95000).
  Ikke dis-armed, som tidligere noter sagde.
- Kørende runs sunde: 25778 reconcile_cron ok err=0, 25779 cron skipped err=0.
- BA (−12,95%) og MU (−13,99%) stadig stuck (GTC-422 på brøkdele). RIVN −8,83% lige under 8%-stoppen.
