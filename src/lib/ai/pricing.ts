// US dollars per million tokens, from Anthropic's price list. Cache writes (5-minute TTL) cost
// 1.25x input. A model we don't know is priced at the highest rate, so the budget errs safe.

type Price = { input: number; output: number; cacheRead: number };

const PRICES: Record<string, Price> = {
  "claude-fable-5-1": { input: 10, output: 50, cacheRead: 0.25 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
  fake: { input: 0, output: 0, cacheRead: 0 },
};

const HIGHEST: Price = PRICES["claude-fable-5-1"];

export type TokenUsage = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };
export type ModelUsage = TokenUsage & { model: string };

export function costUsd(model: string, usage: TokenUsage): number {
  const price = PRICES[model] ?? HIGHEST;
  const dollars =
    usage.inputTokens * price.input +
    usage.cacheWriteTokens * price.input * 1.25 +
    usage.cacheReadTokens * price.cacheRead +
    usage.outputTokens * price.output;
  // Stored with six decimals.
  return Number((dollars / 1_000_000).toFixed(6));
}

// Several models can serve one request (a refusal fallback): each part at its own model's price.
export function totalCostUsd(entries: ModelUsage[]): number {
  return Number(entries.reduce((sum, e) => sum + costUsd(e.model, e), 0).toFixed(6));
}

export function totalTokens(entries: ModelUsage[]): TokenUsage {
  return entries.reduce(
    (t, e) => ({
      inputTokens: t.inputTokens + e.inputTokens,
      outputTokens: t.outputTokens + e.outputTokens,
      cacheReadTokens: t.cacheReadTokens + e.cacheReadTokens,
      cacheWriteTokens: t.cacheWriteTokens + e.cacheWriteTokens,
    }),
    { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
  );
}
