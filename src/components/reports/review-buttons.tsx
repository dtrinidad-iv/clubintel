"use client";

import { Check, X } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reviewReport } from "@/lib/report-actions";

export function ReviewButtons({ reportId }: { reportId: string }) {
  const [pending, startTransition] = useTransition();

  function review(decision: "approved" | "discarded") {
    startTransition(async () => {
      const result = await reviewReport(reportId, decision);
      if (result?.error) toast.error(result.error);
      else if (result?.message) toast.success(result.message);
    });
  }

  return (
    <div className="flex gap-2">
      <Button onClick={() => review("approved")} disabled={pending}>
        <Check aria-hidden /> Approve
      </Button>
      <Button variant="outline" onClick={() => review("discarded")} disabled={pending}>
        <X aria-hidden /> Discard
      </Button>
    </div>
  );
}
