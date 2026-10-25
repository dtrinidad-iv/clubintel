import { Badge } from "@/components/ui/badge";
import { reportStatusLabel } from "@/lib/format";
import type { ReportListItem } from "@/lib/reports";

// Approved reads as settled; failed and discarded as outcomes; the label always carries the meaning.
export function ReportStatusBadge({ status }: { status: ReportListItem["status"] }) {
  const variant = status === "approved" ? "default" : status === "failed" ? "destructive" : status === "draft" || status === "generating" ? "secondary" : "outline";
  return <Badge variant={variant}>{reportStatusLabel(status)}</Badge>;
}
