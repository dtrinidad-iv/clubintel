import { describe, expect, it } from "vitest";
import {
  addMemberSchema,
  clubSearchQuery,
  contactSchema,
  opportunityFiltersSchema,
  opportunitySchema,
  parseClubSearch,
  safeNext,
  signUpSchema,
  workspaceNameSchema,
} from "./validation";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/settings?tab=members")).toBe("/settings?tab=members");
  });

  it.each(["https://evil.test", "//evil.test", "/\\evil.test", "", null, 42])("rejects %s", (next) => {
    expect(safeNext(next)).toBe("/dashboard");
  });
});

describe("signUpSchema", () => {
  it("normalises the email and trims the name", () => {
    const parsed = signUpSchema.parse({ fullName: "  Ana  ", email: " Ana@Example.COM ", password: "longenough" });
    expect(parsed).toEqual({ fullName: "Ana", email: "ana@example.com", password: "longenough" });
  });

  it("rejects short passwords", () => {
    expect(signUpSchema.safeParse({ fullName: "Ana", email: "a@b.co", password: "short" }).success).toBe(false);
  });
});

describe("workspaceNameSchema", () => {
  it("rejects blank and overly long names", () => {
    expect(workspaceNameSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(workspaceNameSchema.safeParse({ name: "x".repeat(81) }).success).toBe(false);
    expect(workspaceNameSchema.parse({ name: "  Test FC " }).name).toBe("Test FC");
  });
});

describe("addMemberSchema", () => {
  it("never accepts owner as a role", () => {
    expect(addMemberSchema.safeParse({ email: "a@b.co", role: "owner" }).success).toBe(false);
    expect(addMemberSchema.safeParse({ email: "a@b.co", role: "analyst" }).success).toBe(true);
  });
});

describe("parseClubSearch", () => {
  it("reads every filter from the URL", () => {
    expect(parseClubSearch({ q: "  Rovers ", league: "league-one", region: "wales", tier: "3", page: "2" })).toEqual({
      q: "Rovers",
      league: "league-one",
      region: "wales",
      tier: 3,
      page: 2,
    });
  });

  it("drops invalid or empty values instead of failing", () => {
    expect(parseClubSearch({ q: "   ", league: "DROP TABLE", region: "mars", tier: "99", page: "-1" })).toEqual({
      q: undefined,
      league: undefined,
      region: undefined,
      tier: undefined,
      page: 1,
    });
  });

  it("takes the first of repeated params, and accepts URLSearchParams", () => {
    expect(parseClubSearch({ region: ["scotland", "wales"] }).region).toBe("scotland");
    expect(parseClubSearch(new URLSearchParams("tier=2&page=abc"))).toMatchObject({ tier: 2, page: 1 });
    expect(parseClubSearch(new URLSearchParams("region=scotland&region=wales")).region).toBe("scotland");
  });

  it("caps the search length", () => {
    expect(parseClubSearch({ q: "x".repeat(81) }).q).toBeUndefined();
  });
});

describe("clubSearchQuery", () => {
  it("leaves out defaults and empty filters", () => {
    expect(clubSearchQuery({ page: 1 })).toBe("");
    expect(clubSearchQuery({ q: "a&b", tier: 4, page: 3 })).toBe("?q=a%26b&tier=4&page=3");
  });

  it("round-trips through parseClubSearch", () => {
    const search = { q: "City", league: "championship", region: "ireland" as const, tier: 2, page: 2 };
    expect(parseClubSearch(new URLSearchParams(clubSearchQuery(search)))).toEqual(search);
  });
});

const CLUB = "336a6d1c-8347-4ef9-91be-c5519ad0f40f";
const form = (overrides: Record<string, string> = {}) => ({
  title: " Shirt deal ",
  partnerName: "Brightlane",
  clubId: CLUB,
  category: "sponsorship",
  stage: "lead",
  valueGbp: "£1,250,000.50",
  ownerId: "",
  contactId: "",
  expectedCloseDate: "",
  notes: "  ",
  ...overrides,
});

describe("opportunitySchema", () => {
  it("parses a form: trims, reads pounds, empty optionals become null", () => {
    expect(opportunitySchema.parse(form())).toEqual({
      title: "Shirt deal",
      partnerName: "Brightlane",
      clubId: CLUB,
      category: "sponsorship",
      stage: "lead",
      valueGbp: 1250000.5,
      ownerId: null,
      contactId: null,
      expectedCloseDate: null,
      notes: null,
    });
  });

  it("treats an empty value as zero and rounds to pence", () => {
    expect(opportunitySchema.parse(form({ valueGbp: "" })).valueGbp).toBe(0);
    expect(opportunitySchema.parse(form({ valueGbp: "10.555" })).valueGbp).toBe(10.56);
  });

  it.each([
    ["title", { title: "  " }],
    ["clubId", { clubId: "" }],
    ["clubId", { clubId: "not-a-uuid" }],
    ["category", { category: "bribery" }],
    ["stage", { stage: "maybe" }],
    ["valueGbp", { valueGbp: "-5" }],
    ["valueGbp", { valueGbp: "lots" }],
    ["valueGbp", { valueGbp: "99999999999" }],
    ["ownerId", { ownerId: "someone" }],
    ["expectedCloseDate", { expectedCloseDate: "next week" }],
    ["notes", { notes: "x".repeat(2001) }],
  ])("rejects a bad %s", (field, overrides) => {
    const result = opportunitySchema.safeParse(form(overrides));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });

  it("never reads a workspace id from the form", () => {
    const parsed = opportunitySchema.parse({ ...form(), workspaceId: CLUB, workspace_id: CLUB });
    expect(parsed).not.toHaveProperty("workspaceId");
    expect(parsed).not.toHaveProperty("workspace_id");
  });
});

describe("contactSchema", () => {
  it("normalises the email and nulls empty fields", () => {
    expect(contactSchema.parse({ name: " Priya ", email: " Priya@Club.Example ", roleTitle: "", phone: "", clubId: "", notes: "" })).toEqual({
      name: "Priya",
      email: "priya@club.example",
      roleTitle: null,
      phone: null,
      clubId: null,
      notes: null,
    });
  });

  it("refuses emails that would add mailto: headers, and phones that aren't numbers", () => {
    const contact = (fields: Record<string, string>) => ({ name: "A", email: "", roleTitle: "", phone: "", clubId: "", notes: "", ...fields });
    expect(contactSchema.safeParse(contact({ email: "a@b.co?subject=Pay" })).success).toBe(false);
    expect(contactSchema.safeParse(contact({ phone: "123;ext=1" })).success).toBe(false);
    expect(contactSchema.parse(contact({ phone: " +44 (20) 7946-0101 " })).phone).toBe("+44 (20) 7946-0101");
  });

  it("rejects a bad email and a missing name", () => {
    expect(contactSchema.safeParse({ name: "A", email: "nope" }).success).toBe(false);
    expect(contactSchema.safeParse({ name: " ", email: "" }).success).toBe(false);
  });
});

describe("opportunityFiltersSchema", () => {
  it("drops invalid filters and defaults to the table", () => {
    expect(opportunityFiltersSchema.parse({ stage: "maybe", category: "media", owner: "none", view: "grid" })).toEqual({
      q: undefined,
      stage: undefined,
      category: "media",
      owner: "none",
      view: "table",
    });
    expect(opportunityFiltersSchema.parse({ owner: "x", view: "board" })).toMatchObject({ owner: undefined, view: "board" });
  });
});
