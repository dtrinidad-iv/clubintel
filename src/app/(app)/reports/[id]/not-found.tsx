import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ReportNotFound() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
      <h1 className="text-lg font-medium">Report not found</h1>
      <p className="text-sm text-muted-foreground">It may be in another workspace, or the link is wrong.</p>
      <Button variant="outline" asChild>
        <Link href="/reports">Back to reports</Link>
      </Button>
    </div>
  );
}
