import { Badge } from "@/components/ui/badge";
import { stageLabel } from "@/lib/format";
import type { OpportunityRow } from "@/lib/opportunities";

// Won and lost read as outcomes; open stages stay neutral. The label always carries the meaning.
export function StageBadge({ stage }: { stage: OpportunityRow["stage"] }) {
  const variant = stage === "won" ? "default" : stage === "lost" ? "outline" : "secondary";
  return <Badge variant={variant}>{stageLabel(stage)}</Badge>;
}
