import { AlertTriangle, ArrowRight, Shield, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PartialReport } from "@/lib/ai/report-schema";

// Renders a report, finished or still streaming in (any field may be missing or cut short).
// Text is always rendered as text, never as HTML or Markdown.

const PRIORITY_LABELS: Record<string, string> = { high: "High priority", medium: "Medium priority", low: "Low priority" };

export function ReportBody({ report, streaming = false }: { report: PartialReport; streaming?: boolean }) {
  const risks = report.risks?.filter((r) => r.title) ?? [];
  const actions = report.recommended_actions?.filter((a) => a.action) ?? [];
  const clubs = report.clubs_to_watch?.filter((c) => c.club) ?? [];
  const highlights = report.highlights?.filter(Boolean) ?? [];

  return (
    <div className="grid gap-6" aria-busy={streaming}>
      <section>
        <h2 className="sr-only">Summary</h2>
        <p className="text-base leading-relaxed">
          {report.summary ?? ""}
          {streaming && !report.highlights && <Cursor />}
        </p>
      </section>

      {highlights.length > 0 && (
        <Section title="Highlights" icon={Sparkles}>
          <ul className="grid gap-2 pl-5 [list-style:disc]">
            {highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </Section>
      )}

      {risks.length > 0 && (
        <Section title="Risks" icon={AlertTriangle}>
          <ul className="grid gap-3">
            {risks.map((r, i) => (
              <li key={i}>
                <p className="font-medium">{r.title}</p>
                {r.detail && <p className="text-sm text-muted-foreground">{r.detail}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {actions.length > 0 && (
        <Section title="Recommended actions" icon={ArrowRight}>
          <ol className="grid gap-3">
            {actions.map((a, i) => (
              <li key={i} className="grid gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{a.action}</span>
                  {a.priority && PRIORITY_LABELS[a.priority] && (
                    <Badge variant={a.priority === "high" ? "default" : "secondary"}>{PRIORITY_LABELS[a.priority]}</Badge>
                  )}
                </div>
                {a.why && <p className="text-sm text-muted-foreground">{a.why}</p>}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {clubs.length > 0 && (
        <Section title="Clubs to watch" icon={Shield}>
          <ul className="grid gap-3">
            {clubs.map((c, i) => (
              <li key={i}>
                <p className="font-medium">{c.club}</p>
                {c.reason && <p className="text-sm text-muted-foreground">{c.reason}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Sparkles; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        <Icon className="size-4" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Cursor() {
  return <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-foreground align-middle motion-reduce:animate-none" aria-hidden />;
}
