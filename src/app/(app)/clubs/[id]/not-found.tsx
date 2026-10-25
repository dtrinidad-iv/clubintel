import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ClubNotFound() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
      <h1 className="text-lg font-medium">Club not found</h1>
      <p className="text-sm text-muted-foreground">It may have been removed, or the link is wrong.</p>
      <Button variant="outline" asChild>
        <Link href="/clubs">Back to clubs</Link>
      </Button>
    </div>
  );
}
