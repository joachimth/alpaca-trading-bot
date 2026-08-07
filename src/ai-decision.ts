// AI Decision Layer
// Takes TA signals and refines them using LLM reasoning
// Falls back to pure TA if LLM is unavailable or fails

import type { TASignal } from './technical-analysis';
import type { Position } from './alpaca';

export interface AIDecision {
  action: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';
  confidence: number;     // 0.0 to 1.0
  reasoning: string;
  factors: string[];
  adjustedFromTA: boolean; // true if AI changed the TA signal
  taSignal: TASignal;
}

export interface AIMarketContext {
    account: {
      equity: number;
      cash: number;
      positionsCount: number;
      dailyPlPct: number;
    };
    marketRegime: string;    // e.g. "bullish", "bearish", "volatile", "choppy"
    topMovers: { gainers: string[]; losers: string[] };
    positions: Position[];
    sentiment?: string;      // market sentiment text (Fear & Greed, trending, etc.)
  }

export interface AIRefinementConfig {
  apiKey: string;
  model: string;
  temperature: number;
  minConfidence: number;
}

// ============================================================
// Market regime detection
// ============================================================

export function detectMarketRegime(
  snapshots: { spyTrend: number; vixLevel: number; breadth: number }
): string {
  if (snapshots.vixLevel > 30) return 'volatile';
  if (snapshots.vixLevel > 20) return 'cautious';
  if (snapshots.spyTrend > 0.5 && snapshots.breadth > 0.6) return 'bullish';
  if (snapshots.spyTrend < -0.5 && snapshots.breadth < 0.4) return 'bearish';
  return 'choppy';
}

// ============================================================
// LLM Refinement
// ============================================================

export async function refineWithLLM(
  signal: TASignal,
  context: AIMarketContext,
  config: AIRefinementConfig
): Promise<AIDecision> {
  const taAction = signal.action;
  const taConfidence = signal.confidence;

  try {
    const prompt = buildPrompt(signal, context);
    const llmResponse = await callLLM(prompt, config);

    if (!llmResponse) {
      // Fallback to pure TA
      return {
        action: taAction,
        confidence: taConfidence,
        reasoning: 'LLM unavailable — using pure TA signal',
        factors: signal.reasons,
        adjustedFromTA: false,
        taSignal: signal,
      };
    }

    const parsed = parseLLMResponse(llmResponse);

    // Validate AI doesn't go against strong TA signals without good reason
    let finalAction = parsed.action;
    let finalConfidence = parsed.confidence;
    let adjusted = false;

    if (finalAction !== taAction) {
      // AI wants to change the TA signal
      // Only allow if AI confidence is high enough
      if (parsed.confidence < 0.7) {
        // Not confident enough to override TA
        finalAction = taAction;
        finalConfidence = taConfidence;
      } else {
        adjusted = true;
      }
    }

    // Ensure confidence meets minimum threshold
    if (finalConfidence < config.minConfidence && finalAction !== 'HOLD') {
      finalAction = 'HOLD';
      finalConfidence = finalConfidence;
      parsed.reasoning += ' [Downgraded to HOLD: confidence below threshold]';
    }

    return {
      action: finalAction,
      confidence: finalConfidence,
      reasoning: parsed.reasoning,
      factors: parsed.factors,
      adjustedFromTA: adjusted,
      taSignal: signal,
    };
  } catch (error) {
    // Any error → fall back to TA
    console.error('LLM refinement error:', error);
    return {
      action: taAction,
      confidence: taConfidence,
      reasoning: `LLM error: ${error instanceof Error ? error.message : 'unknown'} — using pure TA signal`,
      factors: signal.reasons,
      adjustedFromTA: false,
      taSignal: signal,
    };
  }
}

function buildPrompt(signal: TASignal, context: AIMarketContext): string {
  const ind = signal.indicators;
  const positions = context.positions.map(p =>
    `${p.symbol}: ${p.qty} shares, P&L ${p.unrealized_plpc * 100 >= 0 ? '+' : ''}${(p.unrealized_plpc * 100).toFixed(1)}%`
  ).join('; ') || 'None';

  return `You are an expert daytrading analyst. Analyze this stock and decide: BUY, SELL, HOLD, or CLOSE (close existing position).

STOCK: ${ind.symbol}
CURRENT PRICE: $${ind.price.toFixed(2)}
TA SIGNAL: ${signal.action} (confidence ${(signal.confidence * 100).toFixed(0)}%)

TECHNICAL INDICATORS:
- RSI: ${ind.rsi.toFixed(1)} (oversold <30, overbought >70)
- EMA9: ${ind.emaFast.toFixed(2)}, EMA21: ${ind.emaSlow.toFixed(2)}, Trend: ${ind.emaTrend}
- MACD: ${ind.macd.toFixed(4)}, Signal: ${ind.macdSignal.toFixed(4)}, Histogram: ${ind.macdHistogram.toFixed(4)} (${ind.macdTrend})
- ATR: ${ind.atr.toFixed(2)} (${ind.atrPct.toFixed(2)}% of price — volatility)
- Volume: ${ind.volumeRatio.toFixed(2)}x average
- Stochastic: %K=${ind.stochK.toFixed(1)}, %D=${ind.stochD.toFixed(1)}
- Bollinger Bands: position ${(ind.bbPosition * 100).toFixed(0)}% (0=lower, 100=upper)
- ADX: ${ind.adx.toFixed(1)} (trend strength, >25 = strong)
- OBV trend: ${ind.obvTrend}
- Support: $${ind.support.toFixed(2)}, Resistance: $${ind.resistance.toFixed(2)}
- Price in range: ${(ind.pricePosition * 100).toFixed(0)}% (0%=support, 100%=resistance)

TA REASONS: ${signal.reasons.join('; ')}

MARKET CONTEXT:
- Market regime: ${context.marketRegime}
- Account equity: $${context.account.equity.toFixed(2)}, Cash: $${context.account.cash.toFixed(2)}
- Open positions: ${context.account.positionsCount}/15
- Daily P&L: ${context.account.dailyPlPct >= 0 ? '+' : ''}${context.account.dailyPlPct.toFixed(2)}%
  - Current positions: ${positions}
  ${context.sentiment ? `\nMARKET SENTIMENT:\n${context.sentiment}` : ''}

Respond in EXACTLY this JSON format (no other text):
{
  "action": "BUY|SELL|HOLD|CLOSE",
  "confidence": 0.0-1.0,
  "reasoning": "one clear sentence explaining the decision",
  "factors": ["factor 1", "factor 2", "factor 3"]
}

Rules:
- BUY only if multiple bullish indicators align with volume confirmation
- SELL only if multiple bearish indicators align
- CLOSE if existing position has hit stop/target or signals reversed
- HOLD when signals are mixed or unclear
- In volatile regime, require higher confidence (0.7+)
- Consider the full picture: trend, momentum, volume, volatility, market regime
- Be decisive but not reckless — better to HOLD than force a trade`;
}

async function callLLM(prompt: string, config: AIRefinementConfig): Promise<string | null> {
  // Using Fireworks AI API (compatible with OpenAI format)
  const apiUrl = 'https://api.fireworks.ai/inference/v1/chat/completions';

  try {
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: 'You are an expert quantitative daytrading analyst. Respond only in the requested JSON format.' },
          { role: 'user', content: prompt },
        ],
        temperature: config.temperature,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!resp.ok) {
      console.error(`LLM API error: ${resp.status}`);
      return null;
    }

    const data = await resp.json() as any;
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    return content;
  } catch (error) {
    console.error('LLM call failed:', error);
    return null;
  }
}

function normalizeReasoningValue(value: unknown, fallback = 'No reasoning provided'): string {
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return fallback;
    // Some models occasionally put a second decision JSON object inside reasoning.
    if (text.startsWith('{') && text.endsWith('}')) {
      try {
        const nested = JSON.parse(text) as Record<string, unknown>;
        const nestedReason = nested.reasoning ?? nested.reason ?? nested.text ?? nested.content;
        if (nestedReason !== undefined) return normalizeReasoningValue(nestedReason, fallback);
        if (Array.isArray(nested.factors)) {
          const factors = nested.factors.map(item => normalizeReasoningValue(item, '')).filter(Boolean);
          if (factors.length > 0) return factors.join('; ');
        }
        if (nested.action) {
          const confidence = typeof nested.confidence === 'number' ? ` (${nested.confidence.toFixed(2)})` : '';
          return `${String(nested.action).toUpperCase()} decision${confidence}`;
        }
      } catch { /* keep the original text */ }
    }
    return text;
  }
  if (Array.isArray(value)) {
    const items = value.map(item => normalizeReasoningValue(item, '')).filter(Boolean);
    return items.length > 0 ? items.join('; ') : fallback;
  }
  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    return normalizeReasoningValue(objectValue.reasoning ?? objectValue.reason ?? objectValue.text ?? objectValue.content, fallback);
  }
  return fallback;
}

function normalizeParsedDecision(parsed: Record<string, unknown>): {
  action: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';
  confidence: number;
  reasoning: string;
  factors: string[];
} {
  const reasoning = normalizeReasoningValue(parsed.reasoning ?? parsed.reason);
  const factors = Array.isArray(parsed.factors)
    ? parsed.factors.map(item => normalizeReasoningValue(item, '')).filter(Boolean)
    : [reasoning];
  return {
    action: String(parsed.action || 'HOLD').toUpperCase() as 'BUY' | 'SELL' | 'HOLD' | 'CLOSE',
    confidence: Math.max(0, Math.min(1, parseFloat(String(parsed.confidence ?? '0.5')) || 0.5)),
    reasoning,
    factors: factors.length > 0 ? factors : [reasoning],
  };
}

function parseLLMResponse(response: string): {
    action: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';
    confidence: number;
    reasoning: string;
    factors: string[];
  } {

    try {
      let jsonStr = response.trim();
      if (jsonStr.includes('```')) {
        const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) jsonStr = match[1].trim();
      }
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
      return normalizeParsedDecision(parsed);
    } catch { /* fall through */ }

    // Strategy 1b: Strip <think> tags and other prefix/suffix, then try JSON.parse
    const cleaned = response.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    if (cleaned !== response.trim()) {
      try {
        const parsed = JSON.parse(cleaned) as Record<string, unknown>;
        return normalizeParsedDecision(parsed);
      } catch { /* fall through */ }
    }

    // Strategy 1c: Find first { and last } — extract substring and try parsing
    const firstBrace = response.indexOf('{');
    const lastBrace = response.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonCandidate = response.substring(firstBrace, lastBrace + 1);
      try {
        const parsed = JSON.parse(jsonCandidate) as Record<string, unknown>;
        return normalizeParsedDecision(parsed);
      } catch { /* fall through */ }
    }

    // Strategy 2: Extract JSON object from thinking/model output
    // GLM-5p2 and DeepSeek sometimes wrap JSON in their thinking process
    const jsonMatch = response.match(/\{[^{}]*"action"[^{}]*\}/s);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        return normalizeParsedDecision(parsed);
      } catch { /* fall through */ }
    }

    // Strategy 3: Multi-line JSON extraction (action + confidence + reasoning across lines)
    const multilineMatch = response.match(/\{\s*"action"\s*:\s*"(\w+)"[\s\S]*?"confidence"\s*:\s*([\d.]+)[\s\S]*?"reasoning"\s*:\s*"([^"]*)"[\s\S]*?\}/s);
    if (multilineMatch) {
      const [, action, conf, rawReasoning] = multilineMatch;
      const reasoning = normalizeReasoningValue(rawReasoning);
      return {
        action: action.toUpperCase() as 'BUY' | 'SELL' | 'HOLD' | 'CLOSE',
        confidence: Math.max(0, Math.min(1, parseFloat(conf) || 0.5)),
        reasoning,
        factors: [reasoning],
      };
    }

    // Strategy 3b: Extract action, confidence, and reasoning with flexible quoting
    const actionMatch = response.match(/"action"\s*:\s*"(\w+)"/i);
    const confMatch = response.match(/"confidence"\s*:\s*([\d.]+)/i);
    const reasoningMatch = response.match(/"reasoning"\s*:\s*"([^"]+)"/i);
    if (actionMatch) {
      const reasoning = normalizeReasoningValue(reasoningMatch?.[1]);
      return {
        action: actionMatch[1].toUpperCase() as 'BUY' | 'SELL' | 'HOLD' | 'CLOSE',
        confidence: Math.max(0, Math.min(1, parseFloat(confMatch?.[1] || '0.5'))),
        reasoning,
        factors: reasoningMatch ? [reasoning] : ['LLM response partially parsed'],
      };
    }

    // Strategy 4: Last resort — extract action keyword from text
    const upper = response.toUpperCase();
    // Check for the last occurrence of each action (models often conclude at the end)
    const actions: Array<'BUY' | 'SELL' | 'HOLD' | 'CLOSE'> = ['BUY', 'SELL', 'HOLD', 'CLOSE'];
    let lastAction: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE' = 'HOLD';
    let lastPos = -1;
    for (const a of actions) {
      const pos = upper.lastIndexOf(a);
      if (pos > lastPos) { lastPos = pos; lastAction = a; }
    }
    return {
      action: lastAction,
      confidence: 0.5,
      reasoning: response.slice(0, 200).replace(/\n/g, ' '),
      factors: ['LLM text response (JSON parse failed)'],
    };
  }

// ============================================================
// Batch refinement: process multiple TA signals
// ============================================================

export async function batchRefine(
  signals: TASignal[],
  context: AIMarketContext,
  config: AIRefinementConfig
): Promise<AIDecision[]> {
  // Process sequentially to respect rate limits
  const results: AIDecision[] = [];

  for (const signal of signals) {
    const decision = await refineWithLLM(signal, context, config);
    results.push(decision);
  }

  return results;
}
