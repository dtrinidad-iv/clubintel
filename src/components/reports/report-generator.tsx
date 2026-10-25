"use client";

import { Loader2, Sparkles, Square } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { ReportBody } from "@/components/reports/report-body";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parsePartialJson } from "@/lib/ai/partial-json";
import type { PartialReport } from "@/lib/ai/report-schema";
import { readSse } from "@/lib/sse";

type State =
  | { phase: "idle" }
  | { phase: "thinking"; reportId?: string }
  | { phase: "writing"; reportId: string; report: PartialReport }
  | { phase: "done"; reportId: string; report: PartialReport }
  | { phase: "error"; reportId?: string; message: string; report?: PartialReport };

// Starts a report and shows it filling in. The route checks everything; this only reads events.
export function ReportGenerator({ sample }: { sample: boolean }) {
  const router = useRouter();
  const focusId = useId();
  const [state, setState] = useState<State>({ phase: "idle" });
  const abort = useRef<AbortController | null>(null);
  const busy = state.phase === "thinking" || state.phase === "writing";

  // No abort on unmount: Next keeps this page mounted (hidden) when someone navigates away in
  // the app, and a report already paid for should finish. Leaving the site ends the request.
  async function generate(event: React.FormEvent<HTMLFormElement>) {
    // A plain submit handler, not a form action: React resets a form after its action, and the
    // focus should survive an error.
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const controller = new AbortController();
    abort.current = controller;
    setState({ phase: "thinking" });
    let reportId: string | undefined;
    let text = "";
    let report: PartialReport = {};

    try {
      const response = await fetch("/api/ai/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focus: String(formData.get("focus") ?? "") }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        setState({ phase: "error", message: body?.error ?? "Couldn't start the report. Try again." });
        return;
      }

      for await (const { event, data } of readSse(response.body)) {
        const payload = data as { reportId?: string; text?: string; message?: string };
        if (event === "start") {
          reportId = payload.reportId;
          setState({ phase: "thinking", reportId });
        } else if (event === "reset" && reportId) {
          // A fallback model took over: its text replaces what came before.
          text = "";
          report = {};
          setState({ phase: "thinking", reportId });
        } else if (event === "delta" && reportId) {
          text += payload.text ?? "";
          report = (parsePartialJson(text) as PartialReport | undefined) ?? report;
          setState({ phase: "writing", reportId, report });
        } else if (event === "done" && reportId) {
          setState({ phase: "done", reportId, report });
          router.refresh();
          return;
        } else if (event === "error") {
          setState({ phase: "error", reportId, message: payload.message ?? "The report failed.", report });
          router.refresh();
          return;
        }
      }
      setState({ phase: "error", reportId, message: "The connection closed before the report finished.", report });
      router.refresh();
    } catch {
      if (controller.signal.aborted) {
        setState({ phase: "error", reportId, message: "Stopped. The report is marked failed.", report });
      } else {
        setState({ phase: "error", reportId, message: "The connection dropped. Try again.", report });
      }
      router.refresh();
    } finally {
      if (abort.current === controller) abort.current = null;
    }
  }

  const shown = state.phase === "writing" || state.phase === "done" || (state.phase === "error" && state.report) ? state.report : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <h2>New report</h2>
          {sample && <Badge variant="outline">Sample output</Badge>}
        </CardTitle>
        <CardDescription>
          Claude reads this workspace&apos;s pipeline and the national club data, then writes a draft for an admin to approve.
          {sample && " AI isn't connected here, so this produces a fixed sample."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form onSubmit={generate} className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor={focusId}>Focus (optional)</Label>
            <Textarea id={focusId} name="focus" maxLength={300} rows={2} placeholder="e.g. hospitality deals, or clubs in Wales" disabled={busy} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Sparkles aria-hidden />}
              {busy ? "Generating…" : "Generate report"}
            </Button>
            {busy && (
              <Button type="button" variant="outline" onClick={() => abort.current?.abort()}>
                <Square aria-hidden /> Stop
              </Button>
            )}
            <p className="text-sm text-muted-foreground" role="status">
              {state.phase === "thinking" && "Reading your pipeline…"}
              {state.phase === "writing" && "Writing…"}
              {state.phase === "done" && (
                <>
                  Draft saved.{" "}
                  <Link href={`/reports/${state.reportId}`} className="font-medium text-foreground underline underline-offset-4">
                    Open the report
                  </Link>
                </>
              )}
            </p>
          </div>
        </form>

        {state.phase === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        )}

        {shown && (
          <div className="rounded-lg border p-4" data-testid="report-live">
            <ReportBody report={shown} streaming={state.phase === "writing"} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
