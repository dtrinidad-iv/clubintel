const ROLE_LABELS = { owner: "Owner", admin: "Admin", analyst: "Analyst", viewer: "Viewer" } as const;

export function roleLabel(role: keyof typeof ROLE_LABELS): string {
  return ROLE_LABELS[role];
}

export function initials(name: string): string {
  const letters = name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase());
  return letters.join("") || "?";
}
