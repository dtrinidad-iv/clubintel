import { describe, expect, it } from "vitest";
import { formatGbp, formatMonth, formatNumber, formatPercent, initials, ordinal, seasonLabel } from "./format";

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

describe("formatGbp", () => {
  it.each([
    [0, false, "£0"],
    [12500, false, "£12,500"],
    [999, true, "£999"],
    [786000, true, "£786k"],
    [1850000, true, "£1.9m"],
    [3200000, true, "£3.2m"],
    [2000000, true, "£2m"],
    [999950, true, "£1m"],
    [999400, true, "£999.4k"],
    [1049, true, "£1k"],
  ])("%i (compact %s) → %s", (value, compact, expected) => {
    expect(formatGbp(value, { compact })).toBe(expected);
  });
});

describe("formatMonth", () => {
  it.each([
    ["2026-10-01", "Oct 26"],
    ["2025-09-01", "Sep 25"],
    ["2030-01-01", "Jan 30"],
  ])("%s → %s", (date, expected) => {
    expect(formatMonth(date)).toBe(expected);
  });
});

describe("formatPercent", () => {
  it.each([
    [0, "0%"],
    [2 / 3, "67%"],
    [1, "100%"],
  ])("%d → %s", (share, expected) => {
    expect(formatPercent(share)).toBe(expected);
  });
});
