import { describe, expect, it } from "vitest";
import { addMemberSchema, clubSearchQuery, parseClubSearch, safeNext, signUpSchema, workspaceNameSchema } from "./validation";

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
