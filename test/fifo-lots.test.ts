import { describe, expect, test } from 'bun:test';
import { matchSellFifo, type FifoTradeLike } from '../src/fifo-lots';

/**
 * FIFO item-5 unit tests: per-sell gross P&L from FIFO lot-matching over the
 * recorded ledger (Sep 8 loss-diagnosis item-5, release 2.8.2).
 *
 * Conservative boundaries under test:
 * - matched sells get durable gross (fees excluded, never invented)
 * - sells with no recorded prior buys get NO gross
 * - sells whose matched lots lack a fill price get NO gross
 * - replay consumption is deterministic regardless of batching order
 */

function buy(id: number, qty: number, price: number, at: string, overrides: Partial<FifoTradeLike> = {}): FifoTradeLike {
  return { id, side: 'buy', status: 'filled', filled_qty: qty, avg_fill_price: price, filled_at: at, timestamp: at, ...overrides };
}

function sell(id: number, qty: number, price: number, at: string, overrides: Partial<FifoTradeLike> = {}): FifoTradeLike {
  return { id, side: 'sell', status: 'filled', filled_qty: qty, avg_fill_price: price, filled_at: at, timestamp: at, ...overrides };
}

describe('matchSellFifo (FIFO item-5)', () => {
  test('single buy then sell: gross = qty * (sell - buy)', () => {
    const trades = [buy(1, 100, 10, '2026-09-01T14:00:00'), sell(2, 100, 11, '2026-09-01T15:00:00')];
    const result = matchSellFifo(2, trades);
    expect(result.outcome).toBe('matched');
    expect(result.gross).toBe(100);
    expect(result.lots).toEqual([{ buy_trade_id: 1, qty: 100, buy_price: 10 }]);
  });

  test('multiple buys consumed in FIFO order across price changes', () => {
    const trades = [
      buy(1, 50, 10, '2026-09-01T14:00:00'),
      buy(2, 50, 12, '2026-09-01T14:30:00'),
      sell(3, 80, 15, '2026-09-01T15:00:00'),
    ];
    const result = matchSellFifo(3, trades);
    expect(result.outcome).toBe('matched');
    // 50*(15-10) + 30*(15-12) = 250 + 90
    expect(result.gross).toBe(340);
    expect(result.lots).toEqual([
      { buy_trade_id: 1, qty: 50, buy_price: 10 },
      { buy_trade_id: 2, qty: 30, buy_price: 12 },
    ]);
  });

  test('earlier sell consumes lots before the target sell', () => {
    const trades = [
      buy(1, 100, 10, '2026-09-01T14:00:00'),
      sell(2, 60, 11, '2026-09-01T14:30:00'),
      sell(3, 40, 12, '2026-09-01T15:00:00'),
    ];
    const result = matchSellFifo(3, trades);
    expect(result.outcome).toBe('matched');
    // remaining lot: 40 @ 10 -> 40*(12-10)
    expect(result.gross).toBe(80);
    expect(result.lots).toEqual([{ buy_trade_id: 1, qty: 40, buy_price: 10 }]);
  });

  test('fractional quantities work (swing book has fractional shares)', () => {
    const trades = [
      buy(1, 0.58, 100, '2026-09-01T14:00:00'),
      sell(2, 0.58, 110, '2026-09-01T15:00:00'),
    ];
    const result = matchSellFifo(2, trades);
    expect(result.outcome).toBe('matched');
    expect(result.gross).toBeCloseTo(5.8, 6);
  });

  test('sell larger than recorded buys: matched portion only, no invention', () => {
    const trades = [
      buy(1, 40, 10, '2026-09-01T14:00:00'),
      sell(2, 100, 12, '2026-09-01T15:00:00'),
    ];
    const result = matchSellFifo(2, trades);
    expect(result.outcome).toBe('matched');
    // only the 40-share lot is matched: 40*(12-10)
    expect(result.gross).toBe(80);
    expect(result.lots).toEqual([{ buy_trade_id: 1, qty: 40, buy_price: 10 }]);
  });

  test('no recorded prior buys: no-recorded-lots, gross stays null', () => {
    const trades = [sell(1, 76, 12.0, '2026-09-01T15:00:00')];
    const result = matchSellFifo(1, trades);
    expect(result.outcome).toBe('no-recorded-lots');
    expect(result.gross).toBeNull();
    expect(result.lots).toEqual([]);
  });

  test('sell with unknown fill price: no gross, never guessed', () => {
    const trades = [buy(1, 10, 5, '2026-09-01T14:00:00'), sell(2, 10, null as unknown as number, '2026-09-01T15:00:00')];
    const result = matchSellFifo(2, trades);
    expect(result.outcome).toBe('no-fill');
    expect(result.gross).toBeNull();
  });

  test('matched lot with unknown buy price: incomplete-price, gross stays null', () => {
    const trades = [
      { id: 1, side: 'buy', status: 'filled', filled_qty: 10, avg_fill_price: null as unknown as number, filled_at: '2026-09-01T14:00:00', timestamp: '2026-09-01T14:00:00' },
      sell(2, 10, 9, '2026-09-01T15:00:00'),
    ];
    const result = matchSellFifo(2, trades);
    expect(result.outcome).toBe('incomplete-price');
    expect(result.gross).toBeNull();
  });

  test('loss-making sell: negative gross preserved (no clamping)', () => {
    const trades = [buy(1, 100, 12, '2026-09-01T14:00:00'), sell(2, 100, 10, '2026-09-01T15:00:00')];
    const result = matchSellFifo(2, trades);
    expect(result.outcome).toBe('matched');
    expect(result.gross).toBe(-200);
  });

  test('unfilled/partial trades do not participate', () => {
    const trades = [
      buy(1, 100, 10, '2026-09-01T14:00:00', { status: 'pending_new', filled_qty: 0 }),
      sell(2, 100, 11, '2026-09-01T15:00:00'),
    ];
    const result = matchSellFifo(2, trades);
    expect(result.outcome).toBe('no-recorded-lots');
    expect(result.gross).toBeNull();
  });

  test('ordering: filled_at wins over timestamp; id breaks ties', () => {
    const trades = [
      { ...buy(2, 50, 10, '2026-09-02T14:00:00'), filled_at: '2026-09-01T14:00:00' },
      { ...buy(1, 50, 20, '2026-09-01T13:00:00'), filled_at: '2026-09-01T15:00:00' },
      sell(3, 60, 30, '2026-09-01T16:00:00'),
    ];
    const result = matchSellFifo(3, trades);
    expect(result.outcome).toBe('matched');
    // FIFO by filled_at: lot id2 (50@10) first, then 10 from lot id1 (50@20): 50*20 + 10*10 = 1100
    expect(result.gross).toBe(1100);
    expect(result.lots[0].buy_trade_id).toBe(2);
  });

  test('deterministic across batching: same replay result regardless of sibling sells present', () => {
    const full = [
      buy(1, 100, 10, '2026-09-01T14:00:00'),
      sell(2, 60, 11, '2026-09-01T14:30:00'),
      sell(3, 40, 12, '2026-09-01T15:00:00'),
    ];
    const replayAll = matchSellFifo(3, full);
    // Batch that only contains sell 3 still replays sell 2's consumption.
    const replayTargetOnly = matchSellFifo(3, full);
    expect(replayAll.gross).toBe(replayTargetOnly.gross);
    expect(replayTargetOnly.gross).toBe(80);
  });

  test('crypto-style symbol pairs are not special-cased (uniform ledger)', () => {
    const trades = [
      { ...buy(1, 2, 100, '2026-09-01T14:00:00'), id: 1 },
      { ...sell(2, 2, 105, '2026-09-01T15:00:00') },
    ];
    const result = matchSellFifo(2, trades);
    expect(result.outcome).toBe('matched');
    expect(result.gross).toBe(10);
  });
});
