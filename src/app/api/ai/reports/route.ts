import { getAiClient } from "@/lib/ai/client";
import { gatherReportData } from "@/lib/ai/report-data";
import { handleReportRequest } from "@/lib/ai/report-stream";
import { getCurrentWorkspace, getUser } from "@/lib/dal";
import { createServiceClient } from "@/lib/supabase/admin";

// A report with adaptive thinking can take a few minutes; give the stream room to finish.
export const maxDuration = 300;

// POST /api/ai/reports { focus? } → Server-Sent Events: start, delta…, reset (a fallback model
// took over), then done or error.
export async function POST(request: Request) {
  return handleReportRequest(request, {
    getUser,
    getWorkspace: getCurrentWorkspace,
    service: createServiceClient,
    ai: getAiClient,
    gather: gatherReportData,
    siteUrl: process.env.SITE_URL || undefined,
  });
}
