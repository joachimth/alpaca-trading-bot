import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const workerSource = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
const swingSource = readFileSync(new URL('../src/swing-strategy.ts', import.meta.url), 'utf8');
const cryptoSource = readFileSync(new URL('../src/crypto-strategy.ts', import.meta.url), 'utf8');

function sectionBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex, `missing section marker: ${start}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `missing section marker: ${end}`).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe('broker-authoritative entry position persistence', () => {
  test.each([
    ['daytrading', workerSource, '// BUY: submit new order', '// 12. Sync positions from Alpaca to DB'],
    ['swing', swingSource, '// Execute buys (respecting turnover control)', '// Sync positions'],
    ['crypto', cryptoSource, '// BUY: risk check then execute', '// Sync positions'],
  ] as const)('%s entry intent never upserts a current D1 position before broker sync', (_strategy, source, start, end) => {
    const entrySection = sectionBetween(source, start, end);
    expect(entrySection).toContain('submitOrder');
    expect(entrySection).toContain('logOrderTrade');
    expect(entrySection).not.toContain('upsertPosition');
  });

  test.each([
    ['daytrading', workerSource, '// 12. Sync positions from Alpaca to DB'],
    ['swing', swingSource, '// Sync positions'],
    ['crypto', cryptoSource, '// Sync positions'],
  ] as const)('%s current D1 rows are written only in the broker position sync', (_strategy, source, start) => {
    const syncSection = source.slice(source.indexOf(start));
    expect(syncSection).toContain('getPositions');
    expect(syncSection).toContain('upsertPosition');
    if (_strategy === 'daytrading') expect(syncSection).toContain("strategy: 'daytrading'");
  });

  test('daytrading sync keeps broker authority and D1 protective fallback fields unchanged', () => {
    const syncSection = sectionBetween(workerSource, '// 12. Sync positions from Alpaca to DB', '// 13. Log run');
    for (const field of ['qty: pos.qty', 'avg_entry_price: pos.avg_entry_price', 'current_price: pos.current_price', 'market_value: pos.market_value', 'unrealized_pl: pos.unrealized_pl', 'unrealized_plpc: pos.unrealized_plpc']) {
      expect(syncSection).toContain(field);
    }
    expect(syncSection).toContain('stop_loss_price: existing?.stop_loss_price ?? null');
    expect(syncSection).toContain('take_profit_price: existing?.take_profit_price ?? null');
  });

  test('protective and exit paths remain present in all strategy sources', () => {
    expect(workerSource).toContain('closePosition(');
    expect(swingSource).toContain('closePosition(');
    expect(cryptoSource).toContain('closePosition(');
  });
});
