import { describe, expect, it } from "vitest";
import { initials } from "./format";

describe("initials", () => {
  it.each([
    ["Northbridge Athletic Commercial", "NA"],
    ["olivia@clubintel.test", "OC"],
    ["Ana", "A"],
    ["  ", "?"],
  ])("%s → %s", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
