import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { AnthropicAiClient, isAbortError, type AiStream } from "./client";
import { totalCostUsd } from "./pricing";

// The real SDK client against recorded Messages API event streams, through a stubbed fetch.

const schema = z.object({ summary: z.string() });

function sse(events: object[]): string {
  return events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
}

function messageStart(model = "claude-opus-5-5", input = 1000) {
  return {
    type: "message_start",
    message: {
      id: "msg_1",
      type: "message",
      role: "assistant",
      model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: input, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    },
  };
}

const textBlock = (index: number, ...parts: string[]) => [
  { type: "content_block_start", index, content_block: { type: "text", text: "" } },
  ...parts.map((text) => ({ type: "content_block_delta", index, delta: { type: "text_delta", text } })),
  { type: "content_block_stop", index },
];

const end = (stopReason: string, output: number, extra: object = {}) => [
  { type: "message_delta", delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: output, ...extra } },
  { type: "message_stop" },
];

// A client whose fetch answers with the given SSE text, or hangs until aborted.
function clientFor(body: string | "hang") {
  const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        if (body === "hang") {
          controller.enqueue(encoder.encode(sse([messageStart(), ...textBlock(0, '{"summary": "Par').slice(0, 2)])));
          init?.signal?.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")));
          return;
        }
        controller.enqueue(encoder.encode(body));
        controller.close();
      },
    });
    return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
  });
  const anthropic = new Anthropic({ apiKey: "test-key", fetch: fetch as unknown as typeof globalThis.fetch, maxRetries: 0 });
  return { ai: new AnthropicAiClient(anthropic, "claude-opus-5-5"), fetch };
}

async function drain(stream: AiStream) {
  const chunks = [];
  for await (const chunk of stream.chunks()) chunks.push(chunk);
  return chunks;
}

const request = { system: "s", prompt: "p", schema, maxTokens: 16_000 };

describe("AnthropicAiClient", () => {
  it("streams the text, then reports final usage after the stream has ended", async () => {
    const { ai, fetch } = clientFor(sse([messageStart(), ...textBlock(0, '{"summary": ', '"Healthy"}'), ...end("end_turn", 500)]));
    const stream = ai.stream(request);
    const chunks = await drain(stream);
    expect(chunks.map((c) => (c.type === "text" ? c.text : "|")).join("")).toBe('{"summary": "Healthy"}');

    const result = await stream.result();
    expect(result).toEqual({ text: '{"summary": "Healthy"}', model: "claude-opus-5-5", stopReason: "end_turn" });
    const usage = stream.usage();
    expect(usage.final).toBe(true);
    expect(usage.entries).toEqual([{ model: "claude-opus-5-5", inputTokens: 1000, outputTokens: 500, cacheReadTokens: 0, cacheWriteTokens: 0 }]);
    expect(totalCostUsd(usage.entries)).toBe(0.014);

    // The request carries the plain JSON schema, effort and the refusal fallback.
    const sent = JSON.parse((fetch.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.output_config.effort).toBe("medium");
    expect(sent.output_config.format.type).toBe("json_schema");
    expect(sent.output_config.format.schema.properties.summary).toBeTruthy();
    expect(sent.fallbacks).toBe("default");
  });

  it("returns a cut-off report as max_tokens instead of throwing", async () => {
    const { ai } = clientFor(sse([messageStart(), ...textBlock(0, '{"summary": "Cut'), ...end("max_tokens", 16_000)]));
    const stream = ai.stream(request);
    await drain(stream);
    const result = await stream.result();
    expect(result.stopReason).toBe("max_tokens");
    expect(result.text).toBe('{"summary": "Cut');
    expect(stream.usage()).toMatchObject({ final: true, entries: [{ outputTokens: 16_000 }] });
  });

  it("after a refusal fallback, resets the text and keeps only the fallback model's answer", async () => {
    const fallback = {
      type: "content_block_start",
      index: 1,
      content_block: { type: "fallback", from: { model: "claude-opus-5-5" }, to: { model: "claude-sonnet-5-5" }, trigger: { type: "refusal" } },
    };
    const { ai } = clientFor(
      sse([
        messageStart(),
        ...textBlock(0, '{"summ'),
        fallback,
        { type: "content_block_stop", index: 1 },
        ...textBlock(2, '{"summary": "From the fallback"}'),
        ...end("end_turn", 300),
      ]),
    );
    const stream = ai.stream(request);
    const chunks = await drain(stream);
    expect(chunks.map((c) => c.type)).toEqual(["text", "reset", "text"]);
    const result = await stream.result();
    expect(result.text).toBe('{"summary": "From the fallback"}');
  });

  it("on abort, throws an abort error and reports usage as not final", async () => {
    const { ai } = clientFor("hang");
    const controller = new AbortController();
    const stream = ai.stream({ ...request, signal: controller.signal });
    const iterator = stream.chunks()[Symbol.asyncIterator]();
    await iterator.next();
    controller.abort();
    const error = await iterator.next().then(
      () => null,
      (e: unknown) => e,
    );
    expect(isAbortError(error)).toBe(true);
    expect(stream.usage()).toMatchObject({ final: false, entries: [{ model: "claude-opus-5-5", inputTokens: 1000 }] });
  });
});
