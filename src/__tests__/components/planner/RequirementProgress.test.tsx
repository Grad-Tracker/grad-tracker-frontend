import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import React from "react";
import { renderWithChakra } from "../../helpers/mocks";
import RequirementProgress from "@/components/planner/RequirementProgress";
import type { RequirementBlockWithCourses, PlannedCourseWithDetails } from "@/types/planner";
import type { Course } from "@/types/course";

// ── Factories ───────────────────────────────────────────────────────

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

function makeBlock(overrides: Partial<RequirementBlockWithCourses> = {}): RequirementBlockWithCourses {
  return {
    id: 1,
    program_id: 1,
    name: "Required Courses",
    rule: "ALL_OF",
    n_required: null,
    credits_required: 12,
    courses: [makeCourse()],
    ...overrides,
  };
}

function makePlannedCourse(overrides: Partial<PlannedCourseWithDetails> = {}): PlannedCourseWithDetails {
  return {
    student_id: 1,
    term_id: 1,
    course_id: 1,
    status: "planned",
    plan_id: 1,
    course: makeCourse(),
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("RequirementProgress", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when blocks is empty", () => {
    const { container } = renderWithChakra(
      <RequirementProgress
        blocks={[]}
        plannedCourses={[]}
        completedCourseIds={new Set()}
      />
    );

    // The component returns null, so "Degree Progress" should not appear
    expect(screen.queryAllByText("Degree Progress").length).toBe(0);
    // And there should be no progress bars
    expect(container.querySelectorAll('[role="progressbar"]').length).toBe(0);
  });

  it('renders "Degree Progress" heading', () => {
    renderWithChakra(
      <RequirementProgress
        blocks={[makeBlock()]}
        plannedCourses={[]}
        completedCourseIds={new Set()}
      />
    );

    expect(
      screen.getAllByText("Degree Progress").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders a progress row for each block with block name", () => {
    const blocks = [
      makeBlock({ id: 1, name: "Required Courses" }),
      makeBlock({ id: 2, name: "Electives", credits_required: 9 }),
      makeBlock({ id: 3, name: "Math Courses", credits_required: 6 }),
    ];

    renderWithChakra(
      <RequirementProgress
        blocks={blocks}
        plannedCourses={[]}
        completedCourseIds={new Set()}
      />
    );

    expect(screen.getAllByText("Required Courses").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Electives").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Math Courses").length).toBeGreaterThanOrEqual(1);
  });

  it("shows correct credit fractions (e.g., 6/12 cr)", () => {
    const course1 = makeCourse({ id: 10, credits: 3 });
    const course2 = makeCourse({ id: 11, credits: 3 });
    const course3 = makeCourse({ id: 12, credits: 3 });
    const course4 = makeCourse({ id: 13, credits: 3 });

    const block = makeBlock({
      id: 1,
      credits_required: 12,
      courses: [course1, course2, course3, course4],
    });

    // course1 completed, course2 planned => 6 out of 12
    renderWithChakra(
      <RequirementProgress
        blocks={[block]}
        plannedCourses={[
          makePlannedCourse({ course_id: 11, course: course2 }),
        ]}
        completedCourseIds={new Set([10])}
      />
    );

    // Block row should show "6/12 cr"
    expect(screen.getAllByText("6/12 cr").length).toBeGreaterThanOrEqual(1);
  });

  it("calculates correct percentage for mixed completed/planned courses", () => {
    const course1 = makeCourse({ id: 10, credits: 3 });
    const course2 = makeCourse({ id: 11, credits: 3 });
    const course3 = makeCourse({ id: 12, credits: 3 });

    const block = makeBlock({
      id: 1,
      credits_required: 12,
      courses: [course1, course2, course3],
    });

    // 3 completed + 3 planned = 6 / 12 = 50%
    const { container } = renderWithChakra(
      <RequirementProgress
        blocks={[block]}
        plannedCourses={[
          makePlannedCourse({ course_id: 11, course: course2 }),
        ]}
        completedCourseIds={new Set([10])}
      />
    );

    // The ProgressRoot renders with aria-valuenow reflecting 50%
    const progressEls = container.querySelectorAll('[role="progressbar"]');
    // There should be at least one progress bar in the block row
    expect(progressEls.length).toBeGreaterThanOrEqual(1);
    // Find the one with aria-valuenow="50" (the block-level bar)
    const has50 = Array.from(progressEls).some(
      (el) => el.getAttribute("aria-valuenow") === "50"
    );
    expect(has50).toBe(true);
  });

  it("handles breadth block without package selected (shows 0 credits, displays special name)", () => {
    const breadthBlock = makeBlock({
      id: 5,
      name: "Breadth Requirements",
      credits_required: 9,
      courses: [makeCourse({ id: 20 }), makeCourse({ id: 21 })],
    });

    renderWithChakra(
      <RequirementProgress
        blocks={[breadthBlock]}
        plannedCourses={[]}
        completedCourseIds={new Set()}
        hasBreadthPackageSelected={false}
      />
    );

    // When no package is selected, the display name changes to "Breadth (select package)"
    expect(
      screen.getAllByText("Breadth (select package)").length
    ).toBeGreaterThanOrEqual(1);

    // Credits should be 0/9 since breadthNoSelection zeroes out completed+planned
    expect(screen.getAllByText("0/9 cr").length).toBeGreaterThanOrEqual(1);
  });

  it("uses graduate total credits (30) when isGraduatePlan=true", () => {
    const block1 = makeBlock({
      id: 1,
      name: "Core Courses",
      credits_required: 18,
      courses: [makeCourse({ id: 10, credits: 3 })],
    });
    const block2 = makeBlock({
      id: 2,
      name: "Electives",
      credits_required: 12,
      courses: [makeCourse({ id: 20, credits: 3 })],
    });

    // 1 completed course (3 cr) out of 30 total graduate credits
    renderWithChakra(
      <RequirementProgress
        blocks={[block1, block2]}
        plannedCourses={[]}
        completedCourseIds={new Set([10])}
        isGraduatePlan={true}
      />
    );

    // The overall badge should show "3/30 cr" (graduate total = 30)
    expect(screen.getAllByText("3/30 cr").length).toBeGreaterThanOrEqual(1);
  });

  it('shows "done" and "planned" breakdown under progress bars', () => {
    const course1 = makeCourse({ id: 10, credits: 3 });
    const course2 = makeCourse({ id: 11, credits: 3 });

    const block = makeBlock({
      id: 1,
      credits_required: 12,
      courses: [course1, course2],
    });

    renderWithChakra(
      <RequirementProgress
        blocks={[block]}
        plannedCourses={[
          makePlannedCourse({ course_id: 11, course: course2 }),
        ]}
        completedCourseIds={new Set([10])}
      />
    );

    // "3 done" for completed credits
    expect(screen.getAllByText("3 done").length).toBeGreaterThanOrEqual(1);
    // "3 planned" for planned credits
    expect(screen.getAllByText("3 planned").length).toBeGreaterThanOrEqual(1);
  });
});
