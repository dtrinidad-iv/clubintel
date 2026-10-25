"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// The body of an error.tsx: what failed, and a retry.
export function RouteError({ error, retry, what }: { error: unknown; retry: () => void; what: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
      <h1 className="text-lg font-medium">Couldn&apos;t load {what}</h1>
      <p className="text-sm text-muted-foreground">Something went wrong on our side. Try again in a moment.</p>
      <Button variant="outline" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
