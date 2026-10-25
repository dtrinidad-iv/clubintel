"use client";

import { RouteError } from "@/components/app/route-error";

export default function DashboardError(props: { error: unknown; retry: () => void }) {
  return <RouteError {...props} what="the dashboard" />;
}
