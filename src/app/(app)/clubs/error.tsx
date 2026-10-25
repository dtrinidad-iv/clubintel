"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ClubsError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
      <h1 className="text-lg font-medium">Couldn&apos;t load clubs</h1>
      <p className="text-sm text-muted-foreground">Something went wrong on our side. Try again in a moment.</p>
      <Button variant="outline" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
