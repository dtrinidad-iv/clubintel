"use client";

import { RouteError } from "@/components/app/route-error";

export default function AlertsError(props: { error: unknown; retry: () => void }) {
  return <RouteError {...props} what="alerts" />;
}
