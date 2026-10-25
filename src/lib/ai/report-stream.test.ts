import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { FakeAiClient, SAMPLE_REPORT } from "@/lib/ai/client";
import type { ReportPromptData } from "@/lib/ai/prompts/report";
import { handleReportRequest, type ReportDeps } from "@/lib/ai/report-stream";
import type { Workspace } from "@/lib/dal";
import { readSse } from "@/lib/sse";

const WORKSPACE: Workspace = { id: "ws-1", name: "Test FC", role: "analyst", permissions: ["ai.use", "reports.view"] };
const DATA = { workspace: "Test FC" } as ReportPromptData;

type RpcResult = { data?: unknown; error?: { code?: string; message: string } | null };

// A stand-in for the service client: records RPC calls and answers from a table of results.
function fakeService(results: Record<string, RpcResult> = {}) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  return {
    calls,
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      return { data: null, error: null, ...(name === "start_report" ? { data: "report-1" } : {}), ...results[name] };
    },
  };
}

function deps(overrides: Partial<ReportDeps> & { db?: ReturnType<typeof fakeService> } = {}): ReportDeps & { db: ReturnType<typeof fakeService> } {
  const db = overrides.db ?? fakeService();
  return {
    getUser: async () => ({ id: "u1", email: "a@test.local", fullName: "A" }),
    getWorkspace: async () => WORKSPACE,
    service: () => db as never,
    ai: () => new FakeAiClient(undefined, 0),
    gather: async () => DATA,
    ...overrides,
    db,
  };
}

function post(body: unknown = { focus: "hospitality" }, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3020/api/ai/reports", {
    method: "POST",
    headers: { host: "localhost:3020", origin: "http://localhost:3020", "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function events(response: Response) {
  const out: { event: string; data: unknown }[] = [];
  for await (const e of readSse(response.body!)) out.push(e);
  return out;
}

// No test may reach the network: the fake client never calls fetch, and this proves it.
beforeEach(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("Network access in a unit test");
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/ai/reports", () => {
  it("refuses a signed-out caller with 401", async () => {
    const response = await handleReportRequest(post(), deps({ getUser: async () => null }));
    expect(response.status).toBe(401);
  });

  it.each([
    ["another site", { origin: "https://evil.example" }],
    ["no origin", { origin: "" }],
  ])("refuses a request from %s with 403", async (_name, headers) => {
    const response = await handleReportRequest(post(undefined, headers), deps());
    expect(response.status).toBe(403);
  });

  it("refuses a non-JSON body with 415", async () => {
    const response = await handleReportRequest(post(undefined, { "content-type": "text/plain" }), deps());
    expect(response.status).toBe(415);
  });

  it("refuses without ai.use, before any AI call or database write", async () => {
    const d = deps({ getWorkspace: async () => ({ ...WORKSPACE, permissions: ["reports.view"] }) });
    const response = await handleReportRequest(post(), d);
    expect(response.status).toBe(403);
    expect(d.db.calls).toEqual([]);
  });

  it("answers 503 when AI isn't configured", async () => {
    const response = await handleReportRequest(post(), deps({ ai: () => null }));
    expect(response.status).toBe(503);
  });

  it("refuses a focus over 300 characters with 400", async () => {
    const response = await handleReportRequest(post({ focus: "x".repeat(301) }), deps());
    expect(response.status).toBe(400);
  });

  it("passes the database's budget or rate-limit refusal on as 429", async () => {
    const db = fakeService({ start_report: { data: null, error: { code: "P0001", message: "This month's AI budget is used up." } } });
    const response = await handleReportRequest(post(), deps({ db }));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "This month's AI budget is used up." });
  });

  it("checks the origin against SITE_URL when it is set", async () => {
    const d = deps({ siteUrl: "https://clubintel.example" });
    expect((await handleReportRequest(post(), d)).status).toBe(403);
    const ok = post(undefined, { origin: "https://clubintel.example", host: "internal:3000" });
    expect((await handleReportRequest(ok, { ...d, ai: () => null })).status).toBe(503);
  });

  it("refuses a body over 4 KB with 413", async () => {
    const response = await handleReportRequest(post({ focus: "x".repeat(5000) }), deps());
    expect(response.status).toBe(413);
  });

  it("refuses a large streamed body that has no Content-Length", async () => {
    const big = new TextEncoder().encode(JSON.stringify({ focus: "x".repeat(10_000) }));
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < big.length; i += 1000) controller.enqueue(big.slice(i, i + 1000));
        controller.close();
      },
    });
    const request = new Request("http://localhost:3020/api/ai/reports", {
      method: "POST",
      headers: { host: "localhost:3020", origin: "http://localhost:3020", "content-type": "application/json" },
      body,
      duplex: "half",
    } as RequestInit);
    expect(request.headers.get("content-length")).toBeNull();
    expect((await handleReportRequest(request, deps())).status).toBe(413);
  });

  it("passes the user and workspace it checked to start_report", async () => {
    const d = deps();
    await events(await handleReportRequest(post(), d));
    expect(d.db.calls[0]).toEqual({ name: "start_report", args: { p_user: "u1", p_workspace: "ws-1", p_focus: "hospitality" } });
  });

  it("streams start, deltas and done, then saves the report and records usage", async () => {
    const d = deps();
    const response = await handleReportRequest(post(), d);
    expect(response.headers.get("content-type")).toMatch(/text\/event-stream/);

    const all = await events(response);
    expect(all[0]).toEqual({ event: "start", data: { reportId: "report-1" } });
    expect(all.at(-1)).toEqual({ event: "done", data: { reportId: "report-1" } });
    const text = all.filter((e) => e.event === "delta").map((e) => (e.data as { text: string }).text).join("");
    expect(JSON.parse(text)).toEqual(SAMPLE_REPORT);

    expect(d.db.calls.map((c) => c.name)).toEqual(["start_report", "settle_ai_usage", "finish_report"]);
    expect(d.db.calls[1].args).toMatchObject({ p_report: "report-1", p_workspace: "ws-1", p_model: "fake", p_cost: 0 });
    expect(d.db.calls[2].args).toMatchObject({ p_id: "report-1", p_workspace: "ws-1", p_content: SAMPLE_REPORT, p_model: "fake" });
  });

  it("marks the report failed when the output doesn't match the schema, and still settles its cost", async () => {
    const d = deps({ ai: () => new FakeAiClient('{"summary": 5}', 0) });
    const all = await events(await handleReportRequest(post(), d));
    expect(all.at(-1)).toEqual({ event: "error", data: { reportId: "report-1", message: "The report didn't come back in the expected shape." } });
    expect(d.db.calls.map((c) => c.name)).toEqual(["start_report", "settle_ai_usage", "fail_report"]);
  });

  it("fails the report when saving it fails, rather than leaving it generating", async () => {
    const db = fakeService({ finish_report: { error: { code: "23514", message: "too big" } } });
    const all = await events(await handleReportRequest(post(), deps({ db })));
    expect(all.at(-1)).toEqual({ event: "error", data: { reportId: "report-1", message: "The report couldn't be saved." } });
    expect(db.calls.map((c) => c.name)).toEqual(["start_report", "settle_ai_usage", "finish_report", "fail_report"]);
  });

  it("stops when the browser disconnects and marks the report failed, keeping the reserved cost", async () => {
    const d = deps({ ai: () => new FakeAiClient(undefined, 5) });
    const controller = new AbortController();
    const request = new Request(post(), { signal: controller.signal });
    const response = await handleReportRequest(request, d);
    const reader = response.body!.getReader();
    await reader.read();
    controller.abort();
    await vi.waitFor(() => expect(d.db.calls.map((c) => c.name)).toEqual(["start_report", "settle_ai_usage", "fail_report"]));
    expect(d.db.calls[2].args).toMatchObject({ p_workspace: "ws-1", p_error: "Stopped before it finished." });
    // Settled with an estimate that includes a thinking allowance, not left at the reservation.
    expect(d.db.calls[1].args.p_output as number).toBeGreaterThanOrEqual(8_000);
  });
});
