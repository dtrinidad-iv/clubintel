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

const REGION_LABELS = {
  "england-north": "England North",
  "england-midlands": "England Midlands",
  "england-south": "England South",
  scotland: "Scotland",
  wales: "Wales",
  "northern-ireland": "Northern Ireland",
  ireland: "Ireland",
} as const;

export function regionLabel(region: keyof typeof REGION_LABELS): string {
  return REGION_LABELS[region];
}

// Seasons are stored by starting year: 2025 is "2025/26".
export function seasonLabel(season: number): string {
  return `${season}/${String((season + 1) % 100).padStart(2, "0")}`;
}

const numberFormat = new Intl.NumberFormat("en-GB");

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

export function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}
