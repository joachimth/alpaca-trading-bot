import type { AccountInfo } from './alpaca';

export type EquityDirectionSource = 'broker_change_today_pct' | 'equity_delta_fallback' | 'unavailable';

export interface EquityDirection {
  changeTodayPct: number;
  changeToday: number;
  source: EquityDirectionSource;
  fallbackUsed: boolean;
  reason?: string;
}

export function accountWithEquityDirection<T extends Pick<AccountInfo, 'change_today' | 'change_today_pct' | 'equity' | 'last_equity'>>(account: T): T {
  const direction = resolveEquityDirection(account);
  return { ...account, change_today: direction.changeToday, change_today_pct: direction.changeTodayPct };
}

/**
 * Keep broker daily direction when it is present and non-zero. When the broker
 * omits or reports a zero daily field, use the independently available equity
 * delta only as an observable, fail-safe fallback; never invent a gain/loss.
 */
export function resolveEquityDirection(account: Pick<AccountInfo, 'change_today' | 'change_today_pct' | 'equity' | 'last_equity'>): EquityDirection {
  const brokerPct = Number(account.change_today_pct);
  const brokerChange = Number(account.change_today);
  if (Number.isFinite(brokerPct) && brokerPct !== 0) {
    return {
      changeTodayPct: brokerPct,
      changeToday: Number.isFinite(brokerChange) ? brokerChange : 0,
      source: 'broker_change_today_pct',
      fallbackUsed: false,
    };
  }

  const equity = Number(account.equity);
  const lastEquity = Number(account.last_equity);
  if (Number.isFinite(equity) && Number.isFinite(lastEquity) && lastEquity > 0) {
    const delta = equity - lastEquity;
    return {
      changeTodayPct: (delta / lastEquity) * 100,
      changeToday: delta,
      source: 'equity_delta_fallback',
      fallbackUsed: true,
      reason: 'broker change_today_pct was zero or unavailable',
    };
  }

  return {
    changeTodayPct: 0,
    changeToday: 0,
    source: 'unavailable',
    fallbackUsed: true,
    reason: 'broker daily direction and equity delta were unavailable',
  };
}
