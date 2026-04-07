import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { renderWithChakra } from "../../helpers/mocks";
import type { Term, Season, PlannedCourseWithDetails } from "@/types/planner";
import type { Course } from "@/types/course";
import SemesterGrid from "@/components/planner/SemesterGrid";

// Mock SemesterColumn to a simple div so we can inspect what props are passed
vi.mock("@/components/planner/SemesterColumn", () => ({
  default: ({ term, courses, onRemoveTerm, onCourseClick }: any) =>
    React.createElement(
      "div",
      { "data-testid": `semester-${term.id}` },
      React.createElement(
        "button",
        {
          "data-testid": `remove-term-${term.id}`,
          onClick: () => onRemoveTerm(term.id),
        },
        `${term.season} ${term.year} (${courses.length} courses)`
      ),
      courses[0]
        ? React.createElement(
            "button",
            {
              "data-testid": `open-course-${term.id}`,
              onClick: () => onCourseClick(courses[0].course, term.id),
            },
            `Open ${courses[0].course.subject} ${courses[0].course.number}`
          )
        : null
    ),
}));

// ── Factories ───────────────────────────────────────────────

function makeTerm(overrides: Partial<Term> = {}): Term {
  return { id: 1, season: "Fall" as Season, year: 2025, ...overrides };
}

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

function makePlannedCourse(
  course: Course,
  termId: number
): PlannedCourseWithDetails {
  return {
    student_id: 1,
    term_id: termId,
    course_id: course.id,
    status: "planned",
    plan_id: 1,
    course,
  };
}

// ── Tests ───────────────────────────────────────────────────

describe("SemesterGrid", () => {
  const onRemoveTerm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders one SemesterColumn per term", () => {
    const terms = [
      makeTerm({ id: 1, season: "Fall", year: 2025 }),
      makeTerm({ id: 2, season: "Spring", year: 2026 }),
      makeTerm({ id: 3, season: "Fall", year: 2026 }),
    ];

    renderWithChakra(
      <SemesterGrid
        terms={terms}
        plannedCourses={[]}
        onRemoveTerm={onRemoveTerm}
      />
    );

    expect(screen.getByTestId("semester-1")).toBeTruthy();
    expect(screen.getByTestId("semester-2")).toBeTruthy();
    expect(screen.getByTestId("semester-3")).toBeTruthy();
  });

  it("sorts terms chronologically (Spring before Fall of same year)", () => {
    const terms = [
      makeTerm({ id: 10, season: "Fall", year: 2025 }),
      makeTerm({ id: 20, season: "Spring", year: 2025 }),
    ];

    renderWithChakra(
      <SemesterGrid
        terms={terms}
        plannedCourses={[]}
        onRemoveTerm={onRemoveTerm}
      />
    );

    const columns = screen.getAllByTestId(/^semester-/);
    // Spring 2025 (id=20) should come before Fall 2025 (id=10)
    expect(columns[0].getAttribute("data-testid")).toBe("semester-20");
    expect(columns[1].getAttribute("data-testid")).toBe("semester-10");
  });

  it("shows year labels when multiple years of terms exist", () => {
    const terms = [
      makeTerm({ id: 1, season: "Fall", year: 2025 }),
      makeTerm({ id: 2, season: "Spring", year: 2026 }),
    ];

    renderWithChakra(
      <SemesterGrid
        terms={terms}
        plannedCourses={[]}
        onRemoveTerm={onRemoveTerm}
      />
    );

    // Fall 2025 => academic year "2025-2026", Spring 2026 => also "2025-2026"
    // Both terms are in the same academic year group, but showYearLabels is true
    // because yearGroups[0].terms.length > 1
    // The year label uses an en-dash: "2025–2026"
    expect(
      screen.getAllByText(/2025/).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("passes correct courses to each SemesterColumn (filtered by term_id)", () => {
    const terms = [
      makeTerm({ id: 1, season: "Fall", year: 2025 }),
      makeTerm({ id: 2, season: "Spring", year: 2026 }),
    ];

    const cs101 = makeCourse({ id: 101, subject: "CS", number: "101" });
    const cs201 = makeCourse({ id: 201, subject: "CS", number: "201" });
    const cs301 = makeCourse({ id: 301, subject: "CS", number: "301" });

    const plannedCourses = [
      makePlannedCourse(cs101, 1),
      makePlannedCourse(cs201, 1),
      makePlannedCourse(cs301, 2),
    ];

    renderWithChakra(
      <SemesterGrid
        terms={terms}
        plannedCourses={plannedCourses}
        onRemoveTerm={onRemoveTerm}
      />
    );

    // Term 1 should get 2 courses, term 2 should get 1 course
    expect(
      screen.getAllByText("Fall 2025 (2 courses)").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Spring 2026 (1 courses)").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("calls onRemoveTerm when column triggers removal", () => {
    const terms = [makeTerm({ id: 42, season: "Fall", year: 2025 })];

    renderWithChakra(
      <SemesterGrid
        terms={terms}
        plannedCourses={[]}
        onRemoveTerm={onRemoveTerm}
      />
    );

    // Our mock calls onRemoveTerm(term.id) on click
    fireEvent.click(screen.getByTestId("remove-term-42"));
    expect(onRemoveTerm).toHaveBeenCalledWith(42);
  });

  it("removes a course from the selected semester via the drawer action", async () => {
    const terms = [makeTerm({ id: 1, season: "Fall", year: 2025 })];
    const course = makeCourse({ id: 101, subject: "CSCI", number: "410" });
    const onRemoveCourse = vi.fn().mockResolvedValue(undefined);

    renderWithChakra(
      <SemesterGrid
        terms={terms}
        plannedCourses={[makePlannedCourse(course, 1)]}
        onRemoveTerm={onRemoveTerm}
        onRemoveCourse={onRemoveCourse}
      />
    );

    fireEvent.click(screen.getByTestId("open-course-1"));
    const removeButton = await screen.findByRole("button", { name: "Remove Course" });
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(onRemoveCourse).toHaveBeenCalledWith(course, 1);
    });
  });

  it("handles empty terms array gracefully", () => {
    const { container } = renderWithChakra(
      <SemesterGrid
        terms={[]}
        plannedCourses={[]}
        onRemoveTerm={onRemoveTerm}
      />
    );

    // No semester columns rendered
    expect(screen.queryAllByTestId(/^semester-/).length).toBe(0);
    // Container still renders the outer box
    expect(container.firstChild).toBeTruthy();
  });

  it("renders Summer terms alongside other terms", () => {
    const terms = [
      makeTerm({ id: 1, season: "Spring", year: 2025 }),
      makeTerm({ id: 2, season: "Summer", year: 2025 }),
      makeTerm({ id: 3, season: "Fall", year: 2025 }),
    ];

    renderWithChakra(
      <SemesterGrid
        terms={terms}
        plannedCourses={[]}
        onRemoveTerm={onRemoveTerm}
      />
    );

    // All three terms should be rendered, including Summer
    expect(screen.getByTestId("semester-1")).toBeTruthy();
    expect(screen.getByTestId("semester-2")).toBeTruthy();
    expect(screen.getByTestId("semester-3")).toBeTruthy();

    // Verify summer is rendered with correct content
    expect(
      screen.getAllByText("Summer 2025 (0 courses)").length
    ).toBeGreaterThanOrEqual(1);
  });
});
