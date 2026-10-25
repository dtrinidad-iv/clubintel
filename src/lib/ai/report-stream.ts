import "server-only";
import { z } from "zod";
import { isAbortError, type AiClient, type AiStream } from "@/lib/ai/client";
import { totalCostUsd, totalTokens } from "@/lib/ai/pricing";
import { buildReportPrompt, REPORT_SYSTEM_PROMPT, type ReportPromptData } from "@/lib/ai/prompts/report";
import { reportSchema } from "@/lib/ai/report-schema";
import type { User, Workspace } from "@/lib/dal";
import { encodeSse } from "@/lib/sse";
import type { ServiceClient } from "@/lib/supabase/admin";

// POST /api/ai/reports, with its dependencies passed in so tests can run it without a network.
// Everything that can refuse happens before the stream opens, so refusals are plain JSON with a
// status code. The user is checked here with the DAL; the report writes then go through the
// service client (functions only the server may call), which re-checks the user and workspace.
// Money: start_report reserves the most a report may cost. Settling replaces that with the real
// cost when the call completed, or with a cautious estimate when it was stopped (so stopping
// calls on purpose can't tie up the platform's daily limit). A crashed call keeps the reservation.

export type ReportDeps = {
  getUser: () => Promise<User | null>;
  getWorkspace: () => Promise<Workspace | null>;
  service: () => ServiceClient;
  ai: () => AiClient | null;
  gather: (workspace: Workspace) => Promise<ReportPromptData>;
  siteUrl?: string;
};

export const reportRequestSchema = z.object({ focus: z.string().trim().max(300, "Keep the focus under 300 characters.").optional() });

const MAX_TOKENS = 16_000;
const MAX_BODY_BYTES = 4_096;
// Thinking already done before a stop is billed but never streamed: count this much of it.
const STOPPED_THINKING_TOKENS = 8_000;
const SAFE_ERROR = "The AI service didn't respond. Try again in a moment.";

const json = (status: number, error: string) => Response.json({ error }, { status });

export async function handleReportRequest(request: Request, deps: ReportDeps): Promise<Response> {
  const user = await deps.getUser();
  if (!user) return json(401, "Not signed in");

  // Route Handlers get no CSRF protection from Next: only same-origin JSON requests may spend
  // the workspace's AI budget. A cross-site form can't send application/json without a preflight.
  if (!sameOrigin(request, deps.siteUrl)) return json(403, "Cross-site request refused");
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json(415, "Send JSON");
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return json(413, "Request too large");

  const workspace = await deps.getWorkspace();
  if (!workspace) return json(409, "Choose a workspace first");
  if (!workspace.permissions.includes("ai.use")) return json(403, "You don't have permission to do that.");

  const ai = deps.ai();
  if (!ai) return json(503, "AI isn't set up for this deployment.");

  const text = await readCapped(request, MAX_BODY_BYTES);
  if (text === null) return json(413, "Request too large");
  const body = reportRequestSchema.safeParse(parseJson(text));
  if (!body.success) return json(400, body.error.issues[0]?.message ?? "Invalid request");

  // Read the data first (as the user, for this workspace), so a failure here costs nothing.
  let data: ReportPromptData;
  try {
    data = await deps.gather(workspace);
  } catch (error) {
    console.error(error);
    return json(500, "Something went wrong. Please try again.");
  }

  // Permission, budget and limits, checked again by Postgres for this user and workspace.
  const service = deps.service();
  const started = await service.rpc("start_report", { p_user: user.id, p_workspace: workspace.id, p_focus: body.data.focus ?? "" });
  if (started.error) {
    const status = started.error.code === "P0001" ? 429 : started.error.code === "42501" ? 403 : 500;
    if (status === 500) console.error(started.error);
    return json(status, status === 500 ? "Something went wrong. Please try again." : started.error.message);
  }
  const reportId = started.data;

  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort(), { once: true });
  const prompt = buildReportPrompt(data, body.data.focus);
  const stream = ai.stream({
    system: REPORT_SYSTEM_PROMPT,
    prompt,
    schema: reportSchema,
    maxTokens: MAX_TOKENS,
    signal: abort.signal,
  });

  const encoder = new TextEncoder();
  const responseBody = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, payload: unknown) => {
        if (abort.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(encodeSse(event, payload)));
        } catch {
          // The browser went away; the report still finishes and its cost is still settled.
        }
      };
      send("start", { reportId });
      const outcome = await runReport(stream, send);
      await settleUsage(service, { reportId, workspaceId: workspace.id }, stream, prompt.length + REPORT_SYSTEM_PROMPT.length, outcome.streamedChars);

      const model = outcome.model ?? null;
      if (outcome.ok) {
        const finished = await service.rpc("finish_report", {
          p_id: reportId,
          p_workspace: workspace.id,
          p_content: outcome.content,
          p_model: outcome.model,
        });
        if (finished.error) {
          console.error(finished.error);
          await failReport(service, { reportId, workspaceId: workspace.id }, "The report couldn't be saved.", model);
          send("error", { reportId, message: "The report couldn't be saved." });
        } else {
          send("done", { reportId });
        }
      } else {
        await failReport(service, { reportId, workspaceId: workspace.id }, outcome.error, model);
        send("error", { reportId, message: outcome.error });
      }
      try {
        controller.close();
      } catch {
        // Already closed: the browser went away.
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(responseBody, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}

type Outcome = (
  | { ok: true; content: z.infer<typeof reportSchema>; model: string }
  | { ok: false; error: string; model?: string }
) & { streamedChars: number };

async function runReport(stream: AiStream, send: (event: string, payload: unknown) => void): Promise<Outcome> {
  let streamedChars = 0;
  try {
    for await (const chunk of stream.chunks()) {
      if (chunk.type === "reset") send("reset", {});
      else {
        streamedChars += chunk.text.length;
        send("delta", { text: chunk.text });
      }
    }
    const result = await stream.result();
    const model = result.model;
    if (result.stopReason === "refusal") return { ok: false, error: "Claude declined to write this report.", model, streamedChars };
    if (result.stopReason === "max_tokens") return { ok: false, error: "The report was cut off before it finished.", model, streamedChars };

    const parsed = reportSchema.safeParse(parseJson(result.text));
    if (!parsed.success) return { ok: false, error: "The report didn't come back in the expected shape.", model, streamedChars };
    return { ok: true, content: parsed.data, model, streamedChars };
  } catch (error) {
    if (isAbortError(error)) return { ok: false, error: "Stopped before it finished.", streamedChars };
    console.error(error);
    return { ok: false, error: SAFE_ERROR, streamedChars };
  }
}

type ReportRef = { reportId: string; workspaceId: string };

// Settles the reservation: with the real usage when it's final, otherwise (a stopped or failed
// call) with a cautious estimate: the input (from the stream, or the prompt's length), the text
// streamed, plus an allowance for thinking that was billed but never streamed.
async function settleUsage(service: ServiceClient, ref: ReportRef, stream: AiStream, promptChars: number, streamedChars: number) {
  const usage = stream.usage();
  let entries = usage.entries;
  if (!usage.final) {
    const partial = totalTokens(entries);
    const model = entries.at(-1)?.model ?? "unknown";
    entries = [
      {
        model,
        inputTokens: partial.inputTokens || Math.ceil(promptChars / 3),
        outputTokens: Math.max(partial.outputTokens, Math.ceil(streamedChars / 3)) + STOPPED_THINKING_TOKENS,
        cacheReadTokens: partial.cacheReadTokens,
        cacheWriteTokens: partial.cacheWriteTokens,
      },
    ];
  }
  const tokens = totalTokens(entries);
  const { error } = await service.rpc("settle_ai_usage", {
    p_report: ref.reportId,
    p_workspace: ref.workspaceId,
    p_model: modelName(entries.at(-1)?.model),
    p_input: tokens.inputTokens,
    p_output: tokens.outputTokens,
    p_cache_read: tokens.cacheReadTokens,
    p_cache_write: tokens.cacheWriteTokens,
    p_cost: totalCostUsd(entries),
  });
  if (error) console.error("Couldn't settle AI usage", error);
}

async function failReport(service: ServiceClient, ref: ReportRef, message: string, model: string | null) {
  const { error } = await service.rpc("fail_report", {
    p_id: ref.reportId,
    p_workspace: ref.workspaceId,
    p_error: message,
    p_model: model ? modelName(model) : undefined,
  });
  if (error) console.error(error);
}

// The database accepts plain model ids only; anything else is recorded as "unknown" rather than
// failing to settle (and leaving the reservation in place).
function modelName(model: string | undefined): string {
  return model && /^[a-z0-9.-]{1,80}$/.test(model) ? model : "unknown";
}

// Reads the body, giving up past the limit even without a Content-Length header.
async function readCapped(request: Request, limit: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) return text + decoder.decode();
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
}

// Compared with SITE_URL when it's set (production); otherwise with the Host header, which
// the browser sets and a cross-site page can't change.
function sameOrigin(request: Request, siteUrl?: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const from = new URL(origin);
    if (siteUrl) return from.origin === new URL(siteUrl).origin;
    return from.host === request.headers.get("host");
  } catch {
    return false;
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
