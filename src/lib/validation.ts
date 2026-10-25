import { z } from "zod";

// Shared by forms and Server Actions. The server always parses again; client checks are only for feedback.

// Trim before checking the format (zod checks a format before any later transforms).
const email = z.string().trim().toLowerCase().pipe(z.email({ error: "Enter a valid email address" }));

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: "Enter your password" }),
});

export const signUpSchema = z.object({
  fullName: z.string().trim().min(1, { error: "Enter your name" }).max(120),
  email,
  password: z.string().min(8, { error: "Use at least 8 characters" }).max(72),
});

export const emailOnlySchema = z.object({ email });

export const newPasswordSchema = z.object({
  password: z.string().min(8, { error: "Use at least 8 characters" }).max(72),
});

export const workspaceNameSchema = z.object({
  name: z.string().trim().min(1, { error: "Enter a name" }).max(80, { error: "Keep it under 80 characters" }),
});

// Roles that can be granted. The owner is built in and never granted.
export const assignableRoleSchema = z.enum(["admin", "analyst", "viewer"]);

export const addMemberSchema = z.object({ email, role: assignableRoleSchema });

export const memberChangeSchema = z.object({ userId: z.uuid(), role: assignableRoleSchema });

export const uuidSchema = z.uuid();

// Only same-site paths, so a crafted ?next= can't send someone off-site.
export function safeNext(next: unknown, fallback = "/dashboard"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  return next;
}

// Club search, from the /clubs URL or the API query string. Invalid values are dropped rather
// than rejected, so a stale or hand-edited link still shows results.
export const CLUB_REGIONS = [
  "england-north",
  "england-midlands",
  "england-south",
  "scotland",
  "wales",
  "northern-ireland",
  "ireland",
] as const;

export const CLUB_PAGE_SIZE = 20;

const firstValue = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => {
    const first = firstValue(v);
    return typeof first === "string" && first.trim() === "" ? undefined : first;
  }, schema.optional().catch(undefined));

// Longest search text the list pages accept; links that search by a title cut it to this.
export const SEARCH_MAX = 80;

export const clubSearchSchema = z.object({
  q: optional(z.string().trim().max(SEARCH_MAX)),
  league: optional(z.string().regex(/^[a-z0-9-]{1,40}$/)),
  region: optional(z.enum(CLUB_REGIONS)),
  tier: optional(z.coerce.number().int().min(1).max(10)),
  page: z.preprocess(firstValue, z.coerce.number().int().min(1).max(1000).catch(1)),
});

export type ClubSearch = z.infer<typeof clubSearchSchema>;

export function parseClubSearch(params: Record<string, string | string[] | undefined> | URLSearchParams): ClubSearch {
  // Every value per key, so a repeated param resolves to its first value on both paths.
  const record = params instanceof URLSearchParams ? Object.fromEntries([...new Set(params.keys())].map((k) => [k, params.getAll(k)])) : params;
  return clubSearchSchema.parse(record);
}

// The query string for a search, without defaults, so links stay short.
export function clubSearchQuery(search: Partial<ClubSearch>): string {
  const params = new URLSearchParams();
  if (search.q) params.set("q", search.q);
  if (search.league) params.set("league", search.league);
  if (search.region) params.set("region", search.region);
  if (search.tier) params.set("tier", String(search.tier));
  if (search.page && search.page > 1) params.set("page", String(search.page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

// Opportunities and contacts. Forms send strings; empty optional fields become null.
export const OPPORTUNITY_STAGES = ["lead", "qualified", "proposal", "negotiation", "won", "lost"] as const;
export const OPPORTUNITY_CATEGORIES = ["sponsorship", "hospitality", "media", "partnership", "other"] as const;

// The most rows the list or board shows; the page says so when it hits it.
export const OPPORTUNITY_LIMIT = 500;

export const opportunityStageSchema = z.enum(OPPORTUNITY_STAGES, { error: "Choose a stage" });

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const optionalText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max, { error: `Keep it under ${max} characters` }).nullable());
const optionalId = z.preprocess(emptyToNull, z.uuid({ error: "Choose from the list" }).nullable());

export const opportunitySchema = z.object({
  title: z.string().trim().min(1, { error: "Enter a title" }).max(120, { error: "Keep it under 120 characters" }),
  partnerName: z.string().trim().min(1, { error: "Enter the partner" }).max(120, { error: "Keep it under 120 characters" }),
  clubId: z.uuid({ error: "Choose a club" }),
  category: z.enum(OPPORTUNITY_CATEGORIES, { error: "Choose a category" }),
  stage: opportunityStageSchema,
  valueGbp: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/[£,\s]/g, "") || "0" : v),
    z.coerce
      .number({ error: "Enter an amount in pounds" })
      .min(0, { error: "The value can't be negative" })
      .max(9_999_999_999.99, { error: "That's too large" })
      .transform((n) => Math.round(n * 100) / 100),
  ),
  ownerId: optionalId,
  contactId: optionalId,
  expectedCloseDate: z.preprocess(emptyToNull, z.iso.date({ error: "Enter a date" }).nullable()),
  notes: optionalText(2000),
});

export type OpportunityInput = z.infer<typeof opportunitySchema>;

export const contactSchema = z.object({
  name: z.string().trim().min(1, { error: "Enter a name" }).max(120, { error: "Keep it under 120 characters" }),
  // The database also refuses ? & # % , ; (they'd add headers to a mailto: link).
  email: z.preprocess(
    emptyToNull,
    z.string().trim().toLowerCase().pipe(z.email({ error: "Enter a valid email address" })).pipe(z.string().regex(/^[^?&#%,;]+$/, { error: "Enter a valid email address" })).nullable(),
  ),
  roleTitle: optionalText(120),
  phone: z.preprocess(emptyToNull, z.string().trim().regex(/^\+?[0-9 ().-]{3,40}$/, { error: "Use digits, spaces and + ( ) - only" }).nullable()),
  clubId: optionalId,
  notes: optionalText(2000),
});

export type ContactInput = z.infer<typeof contactSchema>;

export const opportunityFiltersSchema = z.object({
  q: optional(z.string().trim().max(SEARCH_MAX)),
  stage: optional(opportunityStageSchema),
  category: optional(z.enum(OPPORTUNITY_CATEGORIES)),
  owner: optional(z.union([z.uuid(), z.literal("none")])),
  view: z.preprocess(firstValue, z.enum(["table", "board"]).catch("table")),
});

export type OpportunityFilters = z.infer<typeof opportunityFiltersSchema>;

export const contactSearchSchema = z.object({ q: optional(z.string().trim().max(SEARCH_MAX)) });
