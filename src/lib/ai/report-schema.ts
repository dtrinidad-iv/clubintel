import { z } from "zod";

// The intelligence report Claude writes, as structured output. Shared by the server (the API's
// output format, and validation before saving) and the client (rendering). No length limits in
// the schema itself: structured output supports few of them, so the prompt asks for brevity and
// the database caps the stored size.

export const REPORT_PRIORITIES = ["high", "medium", "low"] as const;

export const reportSchema = z.object({
  summary: z.string().describe("Two or three sentences on the state of the pipeline."),
  highlights: z.array(z.string()).describe("Three to five things going well, each one sentence."),
  risks: z
    .array(z.object({ title: z.string(), detail: z.string() }))
    .describe("Up to five risks to revenue, most serious first."),
  recommended_actions: z
    .array(z.object({ action: z.string(), why: z.string(), priority: z.enum(REPORT_PRIORITIES) }))
    .describe("Three to five concrete next steps for the commercial team."),
  clubs_to_watch: z
    .array(z.object({ club: z.string(), reason: z.string() }))
    .describe("Up to five clubs from the data worth attention, with why."),
});

export type ReportContent = z.infer<typeof reportSchema>;

// What a half-written report can look like while it streams in: any field may be missing or cut off.
export type PartialReport = {
  summary?: string;
  highlights?: string[];
  risks?: { title?: string; detail?: string }[];
  recommended_actions?: { action?: string; why?: string; priority?: string }[];
  clubs_to_watch?: { club?: string; reason?: string }[];
};
