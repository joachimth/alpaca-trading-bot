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
  });

  test('protective and exit paths remain present in all strategy sources', () => {
    expect(workerSource).toContain('closePosition(');
    expect(swingSource).toContain('closePosition(');
    expect(cryptoSource).toContain('closePosition(');
  });
});
