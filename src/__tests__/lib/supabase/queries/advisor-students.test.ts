import { describe, it, expect } from "vitest";
import { computeProgressPct } from "@/lib/supabase/queries/advisor-students";

describe("computeProgressPct", () => {
  it("returns 0 when there are no required courses", () => {
    expect(computeProgressPct(new Set([1, 2]), new Set())).toBe(0);
  });

  it("returns 100 when all required courses are completed", () => {
    expect(computeProgressPct(new Set([1, 2, 3]), new Set([1, 2, 3]))).toBe(100);
  });

  it("returns the rounded percentage of intersection", () => {
    // 2 of 3 required completed (one extra completed course is ignored)
    expect(computeProgressPct(new Set([1, 2, 99]), new Set([1, 2, 3]))).toBe(67);
  });

  it("returns 0 when there is no intersection", () => {
    expect(computeProgressPct(new Set([4, 5]), new Set([1, 2, 3]))).toBe(0);
  });
});
