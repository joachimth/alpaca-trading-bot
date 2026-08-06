/** Structured, backward-compatible explanations for actions/cycles that were skipped.
 *
 * Run-log error_details remains a JSON array so legacy string entries and real
 * errors continue to round-trip unchanged. New entries are objects with type=skip.
 */
export interface SkipReason {
  type: 'skip';
  code: string;
  scope: string;
  message: string;
  context?: Record<string, unknown>;
  count?: number;
}

export type RunDetail = string | SkipReason;

const MAX_REASONS = 50;
const MAX_CONTEXT_KEYS = 12;
const MAX_CONTEXT_VALUE_LENGTH = 240;

function compactContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context) return undefined;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(context).slice(0, MAX_CONTEXT_KEYS)) {
    const value = context[key];
    if (value === undefined) continue;
    if (typeof value === 'string') out[key] = value.slice(0, MAX_CONTEXT_VALUE_LENGTH);
    else if (typeof value === 'number' || typeof value === 'boolean' || value === null) out[key] = value;
    else out[key] = JSON.stringify(value).slice(0, MAX_CONTEXT_VALUE_LENGTH);
  }
  return Object.keys(out).length ? out : undefined;
}

export class SkipReasonCollector {
  private readonly reasons = new Map<string, SkipReason>();

  add(code: string, scope: string, message: string, context?: Record<string, unknown>): void {
    const key = `${code}|${scope}|${message}`;
    const existing = this.reasons.get(key);
    if (existing) {
      existing.count = (existing.count || 1) + 1;
      return;
    }
    if (this.reasons.size >= MAX_REASONS) return;
    const compact = compactContext(context);
    this.reasons.set(key, {
      type: 'skip', code, scope, message,
      ...(compact ? { context: compact } : {}),
      count: 1,
    });
  }

  toArray(): SkipReason[] { return Array.from(this.reasons.values()); }
  get size(): number { return this.reasons.size; }
}

export function serializeRunDetails(errors: readonly string[] = [], skips?: SkipReasonCollector): string | null {
  const details: RunDetail[] = [...errors, ...(skips?.toArray() || [])];
  return details.length ? JSON.stringify(details) : null;
}

export function parseRunDetails(value: unknown): RunDetail[] {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value as RunDetail[];
  if (typeof value !== 'string') return [String(value)];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed as RunDetail[];
    return [value];
  } catch {
    return [value];
  }
}

export function hasSkipDetails(value: unknown): boolean {
  return parseRunDetails(value).some(item => typeof item === 'object' && item !== null && (item as SkipReason).type === 'skip');
}

export function runStatus(errors: readonly string[], skips: SkipReasonCollector, degraded = false, tradesExecuted = 0): string {
  if (errors.length > 0) return 'error';
  if (degraded) return 'degraded';
  // A cycle containing successful orders is still an ordinary successful run;
  // only a run made up entirely of skips gets the visibly distinct skipped label.
  if (skips.size > 0 && tradesExecuted === 0) return 'skipped';
  return 'ok';
}
