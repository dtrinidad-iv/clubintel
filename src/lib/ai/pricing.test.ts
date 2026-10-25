import { describe, expect, it } from "vitest";
import { costUsd } from "./pricing";

const usage = { inputTokens: 10_000, outputTokens: 3_000, cacheReadTokens: 0, cacheWriteTokens: 0 };

describe("costUsd", () => {
  it("prices Opus 5.5 at $4 in and $20 out per million tokens", () => {
    expect(costUsd("claude-opus-5-5", usage)).toBe(0.1);
  });

  it("prices cache writes at 1.25x input and cache reads at the cache rate", () => {
    expect(costUsd("claude-opus-5-5", { inputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000, cacheWriteTokens: 1_000_000 })).toBe(5.2);
  });

  it("prices an unknown model at the highest known rate, so budgets err safe", () => {
    expect(costUsd("claude-something-new", usage)).toBe(0.25);
  });

  it("prices the fake provider at zero", () => {
    expect(costUsd("fake", usage)).toBe(0);
  });
});
