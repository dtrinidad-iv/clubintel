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

const STAGE_LABELS = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
} as const;

export function stageLabel(stage: keyof typeof STAGE_LABELS): string {
  return STAGE_LABELS[stage];
}

const CATEGORY_LABELS = {
  sponsorship: "Sponsorship",
  hospitality: "Hospitality",
  media: "Media",
  partnership: "Partnership",
  other: "Other",
} as const;

export function categoryLabel(category: keyof typeof CATEGORY_LABELS): string {
  return CATEGORY_LABELS[category];
}

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

// Compact amounts are built by hand: Intl's compact notation differs between Node's and the
// browser's locale data ("£786K" vs "£786k"), which breaks hydration.
export function formatGbp(value: number, { compact = false } = {}): string {
  if (!compact || Math.abs(value) < 1000) return gbp.format(value);
  const thousands = Math.round(Math.abs(value) / 100) / 10;
  // Pick the unit after rounding, so 999,950 reads £1m rather than £1000k.
  const [scaled, unit] = thousands >= 1000 ? [Math.round(thousands / 100) / 10, "m"] : [thousands, "k"];
  return `${value < 0 ? "-" : ""}£${scaled}${unit}`;
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

// Dates arrive as YYYY-MM-DD; formatting in UTC keeps the day the same on server and client.
export function formatDate(date: string): string {
  return dateFormat.format(new Date(`${date}T00:00:00Z`));
}
