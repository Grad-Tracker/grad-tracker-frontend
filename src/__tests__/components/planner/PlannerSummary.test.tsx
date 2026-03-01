import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import React from "react";
import { renderWithChakra } from "../../helpers/mocks";
import type {
  Term,
  Season,
  RequirementBlockWithCourses,
  PlannedCourseWithDetails,
} from "@/types/planner";
import type { Course } from "@/types/course";
import PlannerSummary from "@/components/planner/PlannerSummary";

// Mock Chakra ProgressCircle to avoid rendering issues in jsdom
vi.mock("@/components/ui/progress-circle", () => ({
  ProgressCircleRoot: ({ children }: any) =>
    React.createElement("div", null, children),
  ProgressCircleRing: () => null,
  ProgressCircleValueText: ({ children }: any) =>
    React.createElement("span", null, children),
}));

// ── Factories ──────────────────────────────────────────────

function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: 1,
    subject: "CS",
    number: "101",
    title: "Intro",
    credits: 3,
    ...overrides,
  };
}

function makeTerm(overrides: Partial<Term> = {}): Term {
  return { id: 1, season: "Fall" as Season, year: 2025, ...overrides };
}

function makeBlock(
  overrides: Partial<RequirementBlockWithCourses> = {}
): RequirementBlockWithCourses {
  return {
    id: 1,
    program_id: 1,
    name: "Required",
    rule: "ALL_OF",
    n_required: null,
    credits_required: 30,
    courses: [
      makeCourse({ id: 1 }),
      makeCourse({ id: 2 }),
      makeCourse({ id: 3 }),
    ],
    ...overrides,
  };
}

function makePlannedCourse(
  courseId: number,
  termId: number
): PlannedCourseWithDetails {
  return {
    student_id: 1,
    term_id: termId,
    course_id: courseId,
    status: "planned",
    plan_id: 1,
    course: makeCourse({ id: courseId }),
  };
}

// ── Tests ──────────────────────────────────────────────────

describe("PlannerSummary", () => {
  const defaultProps = {
    terms: [makeTerm({ id: 1 }), makeTerm({ id: 2, season: "Spring" as Season, year: 2026 })],
    plannedCourses: [
      makePlannedCourse(1, 1),
      makePlannedCourse(2, 1),
      makePlannedCourse(3, 2),
    ],
    blocks: [makeBlock()],
    completedCourseIds: new Set<number>(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders semester count in collapsed pill", () => {
    renderWithChakra(<PlannerSummary {...defaultProps} />);
    // 2 terms
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("sem").length).toBeGreaterThanOrEqual(1);
  });

  it("renders course count", () => {
    renderWithChakra(<PlannerSummary {...defaultProps} />);
    // 3 planned courses
    expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("courses").length).toBeGreaterThanOrEqual(1);
  });

  it("renders credit total", () => {
    renderWithChakra(<PlannerSummary {...defaultProps} />);
    // 3 courses * 3 credits = 9 total planned credits
    expect(screen.getAllByText("9").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("cr").length).toBeGreaterThanOrEqual(1);
  });

  it("clicking the pill toggles expanded state showing more details", () => {
    renderWithChakra(<PlannerSummary {...defaultProps} />);

    // Expanded labels should not be visible before click (maxH=0, overflow hidden)
    // We check "Completed" label appears after click
    const pill = screen.getAllByText("sem")[0].closest("[cursor]") ||
      screen.getAllByText("sem")[0].closest("div");

    // Click to expand
    fireEvent.click(pill!);

    // After expanding, the detail labels should be in the DOM
    expect(screen.getAllByText("Completed").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Planned").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Remaining").length).toBeGreaterThanOrEqual(1);
  });

  it("shows completed/planned/remaining breakdown in expanded state", () => {
    // Mark course id=1 as completed (3 credits)
    const props = {
      ...defaultProps,
      completedCourseIds: new Set<number>([1]),
    };

    renderWithChakra(<PlannerSummary {...props} />);

    // Click to expand
    const pill = screen.getAllByText("sem")[0].closest("div")!;
    fireEvent.click(pill);

    // Completed: 3 credits (course id 1), Planned: 9 credits, Remaining: 30-9-3=18
    expect(screen.getAllByText("3 credits").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("9 credits").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("18 credits").length).toBeGreaterThanOrEqual(1);
  });

  it("handles empty state (0 terms, 0 courses, 0 blocks)", () => {
    const emptyProps = {
      terms: [],
      plannedCourses: [],
      blocks: [],
      completedCourseIds: new Set<number>(),
    };

    renderWithChakra(<PlannerSummary {...emptyProps} />);

    // Should show 0 for semesters, courses, and credits
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("sem").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("courses").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("cr").length).toBeGreaterThanOrEqual(1);

    // "remaining" indicator should not appear (semsNeeded = 0)
    expect(screen.queryAllByText("remaining").length).toBe(0);
  });

  it("shows 'Avg per Semester' only when terms.length > 0", () => {
    // First: render with no terms, verify "Avg per Semester" is absent
    const emptyTermsProps = {
      ...defaultProps,
      terms: [],
    };

    const { unmount } = renderWithChakra(
      <PlannerSummary {...emptyTermsProps} />
    );

    // Click to expand
    const pill = screen.getAllByText("sem")[0].closest("div")!;
    fireEvent.click(pill);

    expect(screen.queryAllByText("Avg per Semester").length).toBe(0);

    unmount();

    // Now render with terms, verify "Avg per Semester" is present
    renderWithChakra(<PlannerSummary {...defaultProps} />);

    const pill2 = screen.getAllByText("sem")[0].closest("div")!;
    fireEvent.click(pill2);

    expect(
      screen.getAllByText("Avg per Semester").length
    ).toBeGreaterThanOrEqual(1);
  });
});
