// Server-Sent Events over a POST response: the server encodes, the browser reads with fetch
// (EventSource only does GET). Each event carries one JSON payload.

export type SseEvent = { event: string; data: unknown };

export function encodeSse(event: string, data: unknown): string {
  // JSON.stringify never emits a raw newline, so the payload stays one data line.
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// Yields events as they arrive. Ignores comments and events without data.
export async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    // stream: true keeps a multi-byte character split across chunks intact.
    buffer += decoder.decode(value, { stream: true });
    let end: number;
    while ((end = buffer.indexOf("\n\n")) !== -1) {
      const parsed = parseBlock(buffer.slice(0, end));
      buffer = buffer.slice(end + 2);
      if (parsed) yield parsed;
    }
  }
  const last = parseBlock(buffer + decoder.decode());
  if (last) yield last;
}

function parseBlock(block: string): SseEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (data.length === 0) return null;
  try {
    return { event, data: JSON.parse(data.join("\n")) };
  } catch {
    return null;
  }
}
