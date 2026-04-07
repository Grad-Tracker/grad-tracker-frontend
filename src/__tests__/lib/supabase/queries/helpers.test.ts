import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLogStudentActivity = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/queries/activity", () => ({
  logStudentActivity: mockLogStudentActivity,
}));

import {
  viewItemToCourse,
  safeLogActivity,
  formatActivityCourseLabel,
} from "@/lib/supabase/queries/helpers";

describe("viewItemToCourse", () => {
  it("converts a ViewProgramBlockCourseItem with all fields populated", () => {
    const item = {
      course_id: 42,
      subject: "CSCI",
      number: "101",
      title: "Intro to CS",
      credits: 3,
    };

    expect(viewItemToCourse(item)).toEqual({
      id: 42,
      subject: "CSCI",
      number: "101",
      title: "Intro to CS",
      credits: 3,
    });
  });

  it("handles null fields with sensible defaults", () => {
    const item = {
      course_id: 7,
      subject: null,
      number: null,
      title: null,
      credits: null,
    };

    expect(viewItemToCourse(item)).toEqual({
      id: 7,
      subject: "",
      number: "",
      title: "",
      credits: 0,
    });
  });
});

describe("safeLogActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls logStudentActivity with the correct arguments", async () => {
    mockLogStudentActivity.mockResolvedValue(undefined);

    await safeLogActivity(5, "course_added", "Added CSCI 101", { course_id: 101 });

    expect(mockLogStudentActivity).toHaveBeenCalledWith(
      5,
      "course_added",
      "Added CSCI 101",
      { course_id: 101 }
    );
  });

  it("catches and logs errors without throwing", async () => {
    const error = new Error("DB down");
    mockLogStudentActivity.mockRejectedValue(error);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Should NOT throw
    await expect(
      safeLogActivity(5, "course_removed", "Removed a course", {})
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to log student activity:",
      error
    );

    consoleSpy.mockRestore();
  });
});

describe("formatActivityCourseLabel", () => {
  it("returns the label when a non-empty string is provided", () => {
    expect(formatActivityCourseLabel("CSCI 101")).toBe("CSCI 101");
  });

  it("trims whitespace from the label", () => {
    expect(formatActivityCourseLabel("  MATH 200  ")).toBe("MATH 200");
  });

  it('returns "a course" for undefined input', () => {
    expect(formatActivityCourseLabel(undefined)).toBe("a course");
  });

  it('returns "a course" for an empty string', () => {
    expect(formatActivityCourseLabel("")).toBe("a course");
  });

  it('returns "a course" for a whitespace-only string', () => {
    expect(formatActivityCourseLabel("   ")).toBe("a course");
  });
});
