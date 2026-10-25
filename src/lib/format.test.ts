import { describe, expect, it } from "vitest";
import { formatNumber, initials, ordinal, seasonLabel } from "./format";

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

describe("ordinal", () => {
  it.each([
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
    [22, "22nd"],
  ])("%i → %s", (n, expected) => {
    expect(ordinal(n)).toBe(expected);
  });
});

describe("seasonLabel", () => {
  it("shows the season by its two years", () => {
    expect(seasonLabel(2025)).toBe("2025/26");
    expect(seasonLabel(2099)).toBe("2099/00");
  });
});

describe("formatNumber", () => {
  it("groups thousands", () => {
    expect(formatNumber(52800)).toBe("52,800");
  });
});
