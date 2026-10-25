"use client";

import { RouteError } from "@/components/app/route-error";

export default function ContactsError(props: { error: unknown; retry: () => void }) {
  return <RouteError {...props} what="contacts" />;
}
