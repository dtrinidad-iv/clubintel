import { describe, expect, it } from "vitest";
import { encodeSse, readSse } from "./sse";

// A stream that delivers the text in the given pieces, as the network might.
function streamOf(...chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const events = [];
  for await (const event of readSse(stream)) events.push(event);
  return events;
}

describe("encodeSse", () => {
  it("writes one event with a single JSON data line", () => {
    expect(encodeSse("delta", { text: "a\nb" })).toBe('event: delta\ndata: {"text":"a\\nb"}\n\n');
  });
});

describe("readSse", () => {
  it("reads events split across chunks at any point", async () => {
    const text = encodeSse("start", { id: "r1" }) + encodeSse("delta", { text: "Hé" }) + encodeSse("done", {});
    const pieces = [text.slice(0, 7), text.slice(7, 30), text.slice(30, 31), text.slice(31)];
    expect(await collect(streamOf(...pieces))).toEqual([
      { event: "start", data: { id: "r1" } },
      { event: "delta", data: { text: "Hé" } },
      { event: "done", data: {} },
    ]);
  });

  it("skips comments and malformed data, and reads a final event without a blank line", async () => {
    expect(await collect(streamOf(": keep-alive\n\n", "event: x\ndata: {nope\n\n", 'event: error\ndata: {"message":"m"}'))).toEqual([
      { event: "error", data: { message: "m" } },
    ]);
  });
});
