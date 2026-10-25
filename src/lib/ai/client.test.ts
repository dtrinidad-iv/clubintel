import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { aiConfig } from "./client";

describe("aiConfig", () => {
  it.each([
    [{}, "off"],
    [{ ANTHROPIC_API_KEY: "k" }, "anthropic"],
    [{ AI_PROVIDER: "anthropic" }, "off"],
    [{ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" }, "anthropic"],
    [{ AI_PROVIDER: "fake" }, "fake"],
    [{ AI_PROVIDER: "fake", ANTHROPIC_API_KEY: "k" }, "fake"],
    [{ AI_PROVIDER: "something-else", ANTHROPIC_API_KEY: "k" }, "off"],
  ])("%j → %s", (env, provider) => {
    expect(aiConfig(env).provider).toBe(provider);
  });

  it("defaults the model to Claude Opus 5.5, and AI_MODEL overrides it", () => {
    expect(aiConfig({ ANTHROPIC_API_KEY: "k" }).model).toBe("claude-opus-5-5");
    expect(aiConfig({ ANTHROPIC_API_KEY: "k", AI_MODEL: "claude-sonnet-5-5" }).model).toBe("claude-sonnet-5-5");
  });
});
