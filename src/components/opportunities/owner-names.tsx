"use client";

import { createContext, use } from "react";

const OwnerNames = createContext<Map<string, string>>(new Map());

export function OwnerNamesProvider({ members, children }: { members: { id: string; name: string }[]; children: React.ReactNode }) {
  return <OwnerNames value={new Map(members.map((m) => [m.id, m.name]))}>{children}</OwnerNames>;
}

export function useOwnerName() {
  const names = use(OwnerNames);
  return (id: string | null) => (id ? (names.get(id) ?? "Former member") : "Unassigned");
}
