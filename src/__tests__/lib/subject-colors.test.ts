import { describe, expect, it } from "vitest";
import { getSubjectColor } from "@/lib/subject-colors";

describe("getSubjectColor", () => {
  it("returns the configured color for known prefixes regardless of case", () => {
    expect(getSubjectColor("csci")).toBe("blue");
    expect(getSubjectColor("MATH")).toBe("violet");
  });

  it("falls back to gray for unknown prefixes", () => {
    expect(getSubjectColor("UNKNOWN")).toBe("gray");
  });
});
