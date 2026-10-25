import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import type { ModelUsage } from "@/lib/ai/pricing";

// The one door to an AI provider. A stream yields text as it's generated (and "reset" when a
// fallback model takes over and its text replaces what came before), then the final text, the
// model that answered and the stop reason. usage() reports the tokens per model so far; it is
// final only after result() resolves, and partial after an abort or error.

export type AiRequest = {
  system: string;
  prompt: string;
  schema: z.ZodType;
  maxTokens: number;
  signal?: AbortSignal;
};

export type AiChunk = { type: "text"; text: string } | { type: "reset" };
export type AiResult = { text: string; model: string; stopReason: string | null };

export interface AiStream {
  chunks(): AsyncIterable<AiChunk>;
  result(): Promise<AiResult>;
  usage(): { entries: ModelUsage[]; final: boolean };
}

export interface AiClient {
  readonly provider: "anthropic" | "fake";
  stream(request: AiRequest): AiStream;
}

export class AnthropicAiClient implements AiClient {
  readonly provider = "anthropic";

  constructor(
    private client: Anthropic,
    private model: string,
  ) {}

  stream(request: AiRequest): AiStream {
    // The schema goes to the API as a plain JSON schema, without the SDK's parser: the route
    // validates the text itself, so a cut-off or fallback response is reported, not thrown.
    const { type, schema } = betaZodOutputFormat(request.schema);
    const stream = this.client.beta.messages.stream(
      {
        model: this.model,
        max_tokens: request.maxTokens,
        system: request.system,
        messages: [{ role: "user", content: request.prompt }],
        // Opus 5.5 always thinks; medium is its default effort, set explicitly.
        output_config: { effort: "medium", format: { type, schema } },
        // If the model declines on policy grounds, the API retries on its default fallback
        // model within the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      },
      { signal: request.signal },
    );

    // Tracked from the events, because the SDK drops its running snapshot when the stream ends.
    let model = this.model;
    let usage: ModelUsage = { model, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
    let final: ModelUsage[] | null = null;

    return {
      async *chunks() {
        for await (const event of stream) {
          if (event.type === "message_start") {
            model = event.message.model;
            usage = fromUsage(model, event.message.usage);
          } else if (event.type === "message_delta") {
            // Cumulative counts for the whole message.
            usage = { ...usage, ...definedCounts(event.usage) };
          } else if (event.type === "content_block_start" && event.content_block.type === "fallback") {
            model = event.content_block.to.model;
            yield { type: "reset" };
          } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            yield { type: "text", text: event.delta.text };
          }
        }
      },
      async result() {
        const message = await stream.finalMessage();
        // Per-model usage when a fallback ran; otherwise the message's own.
        const iterations = message.usage.iterations ?? [];
        final = iterations.length
          ? iterations.map((i) => fromUsage("model" in i && i.model ? i.model : message.model, i))
          : [fromUsage(message.model, message.usage)];
        // Only the text after the last fallback is the answer.
        const lastFallback = message.content.findLastIndex((b) => b.type === "fallback");
        const text = message.content
          .slice(lastFallback + 1)
          .flatMap((b) => (b.type === "text" ? [b.text] : []))
          .join("");
        return { text, model: message.model, stopReason: message.stop_reason };
      },
      usage: () => (final ? { entries: final, final: true } : { entries: [{ ...usage, model }], final: false }),
    };
  }
}

type Counts = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

function fromUsage(model: string, u: Counts): ModelUsage {
  return {
    model,
    inputTokens: u.input_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
  };
}

function definedCounts(u: Counts): Partial<ModelUsage> {
  const out: Partial<ModelUsage> = {};
  if (u.input_tokens != null) out.inputTokens = u.input_tokens;
  if (u.output_tokens != null) out.outputTokens = u.output_tokens;
  if (u.cache_read_input_tokens != null) out.cacheReadTokens = u.cache_read_input_tokens;
  if (u.cache_creation_input_tokens != null) out.cacheWriteTokens = u.cache_creation_input_tokens;
  return out;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Anthropic.APIUserAbortError || (error instanceof Error && error.name === "AbortError");
}

// Streams a fixed sample report in small pieces, with no network. For tests and local work.
export class FakeAiClient implements AiClient {
  readonly provider = "fake";

  constructor(
    private output: string = JSON.stringify(SAMPLE_REPORT),
    private pieceDelayMs = 15,
  ) {}

  stream(request: AiRequest): AiStream {
    const { output, pieceDelayMs } = this;
    let sent = 0;
    let done = false;
    const pieces = Array.from({ length: Math.ceil(output.length / 24) }, (_, i) => output.slice(i * 24, i * 24 + 24));
    const usage = (): ModelUsage => ({
      model: "fake",
      inputTokens: Math.ceil(request.prompt.length / 4),
      outputTokens: Math.ceil(sent / 4),
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
    return {
      async *chunks() {
        for (const piece of pieces) {
          if (request.signal?.aborted) throw request.signal.reason ?? new Error("Aborted");
          if (pieceDelayMs) await new Promise((resolve) => setTimeout(resolve, pieceDelayMs));
          sent += piece.length;
          yield { type: "text", text: piece };
        }
      },
      async result() {
        done = true;
        return { text: output, model: "fake", stopReason: "end_turn" };
      },
      usage: () => ({ entries: [usage()], final: done }),
    };
  }
}

// Fictional, like all demo data.
export const SAMPLE_REPORT = {
  summary:
    "This is sample output from the fake AI provider, not an analysis of your data. Set AI_PROVIDER=anthropic and an API key to generate real reports.",
  highlights: ["Sample highlight: the open pipeline is spread across several stages.", "Sample highlight: recent wins came from media deals."],
  risks: [{ title: "Sample risk", detail: "A large deal is past its expected close date." }],
  recommended_actions: [
    { action: "Sample action: follow up on overdue deals.", why: "Close dates have passed without a stage change.", priority: "high" },
    { action: "Sample action: assign owners to unowned leads.", why: "Unowned leads go stale.", priority: "medium" },
  ],
  clubs_to_watch: [{ club: "Sample club", reason: "Attendance is close to capacity." }],
};

export type AiConfig = { provider: "anthropic" | "fake" | "off"; model: string };

// AI_PROVIDER picks the provider. Unset, it's anthropic when a key is set and off otherwise:
// production never falls back to sample output.
export function aiConfig(env: Record<string, string | undefined> = process.env): AiConfig {
  const model = env.AI_MODEL || "claude-opus-5-5";
  const requested = env.AI_PROVIDER;
  if (requested === "fake") return { provider: "fake", model: "fake" };
  if (requested === "anthropic" || (!requested && env.ANTHROPIC_API_KEY)) {
    return env.ANTHROPIC_API_KEY ? { provider: "anthropic", model } : { provider: "off", model };
  }
  return { provider: "off", model };
}

export function getAiClient(): AiClient | null {
  const config = aiConfig();
  if (config.provider === "fake") return new FakeAiClient();
  if (config.provider === "anthropic") {
    return new AnthropicAiClient(new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }), config.model);
  }
  return null;
}
