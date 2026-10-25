import { describe, expect, it } from "vitest";
import { parsePartialJson } from "./partial-json";

const report = JSON.stringify({
  summary: 'Pipeline is "healthy" \\ steady.',
  highlights: ["One", "Two"],
  risks: [{ title: "Late close", detail: "Fan app deal is overdue." }],
  recommended_actions: [{ action: "Call Kestrelby", why: "Overdue", priority: "high" }],
  clubs_to_watch: [],
  score: -12.5,
  done: true,
});

describe("parsePartialJson", () => {
  it.each([
    ["", undefined],
    ["  ", undefined],
    ["{", {}],
    ['{"sum', {}],
    ['{"summary"', {}],
    ['{"summary":', {}],
    ['{"summary": "The pip', { summary: "The pip" }],
    ['{"summary": "a\\', { summary: "a" }],
    ['{"summary": "a\\u00', { summary: "a" }],
    // A complete escaped backslash at the cut is kept.
    ['{"summary": "a\\\\', { summary: "a\\" }],
    ['{"summary": "a\\\\u00', { summary: "a\\u00" }],
    ['{"summary": "a", "highlights": ["One", "Tw', { summary: "a", highlights: ["One", "Tw"] }],
    ['{"a": 1, "b":', { a: 1 }],
    ['{"a": 12', { a: 12 }],
    ['{"a": tr', {}],
    ['{"a": true', { a: true }],
    ['{"a": "b", "c"', { a: "b" }],
    ['{"risks": [{"title": "x", "detail": "y"}, {"tit', { risks: [{ title: "x", detail: "y" }, {}] }],
    ['{"a": [1, 2,', { a: [1, 2] }],
  ])("%j", (input, expected) => {
    expect(parsePartialJson(input)).toEqual(expected);
  });

  it("parses every prefix of a real report without throwing, and the whole of it exactly", () => {
    let lastSummary = "";
    for (let i = 1; i <= report.length; i++) {
      const value = parsePartialJson(report.slice(0, i)) as { summary?: string } | undefined;
      // The summary only ever grows as more text arrives.
      if (value?.summary !== undefined) {
        expect(value.summary.startsWith(lastSummary.replace(/\\$/, ""))).toBe(true);
        lastSummary = value.summary;
      }
    }
    expect(parsePartialJson(report)).toEqual(JSON.parse(report));
  });
});
