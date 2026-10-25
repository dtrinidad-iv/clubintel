import { describe, expect, it } from "vitest";
import { addMemberSchema, safeNext, signUpSchema, workspaceNameSchema } from "./validation";

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
