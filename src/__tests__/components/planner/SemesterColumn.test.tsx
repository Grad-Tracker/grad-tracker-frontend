import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { renderWithChakra } from "../../helpers/mocks";
import SemesterColumn from "@/components/planner/SemesterColumn";
import type { Course } from "@/types/course";
import type { Term, Season, PlannedCourseWithDetails } from "@/types/planner";

vi.mock("@dnd-kit/core", () => ({
  useDroppable: vi.fn(() => ({ isOver: false, setNodeRef: vi.fn() })),
}));

vi.mock("@/components/planner/DraggableCourseCard", () => ({
  default: ({ course }: any) =>
    React.createElement(
      "div",
      { "data-testid": `course-${course.id}` },
      `${course.subject} ${course.number}`
    ),
}));

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

describe("SemesterColumn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useDroppable as ReturnType<typeof vi.fn>).mockReturnValue({
      isOver: false,
      setNodeRef: vi.fn(),
    });
  });

  it("renders term season and year in header", () => {
    const term = makeTerm({ season: "Fall", year: 2025 });
    renderWithChakra(
      <SemesterColumn term={term} courses={[]} onRemoveTerm={vi.fn()} />
    );

    expect(
      screen.getAllByText("Fall 2025").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("shows credit total badge", () => {
    const term = makeTerm();
    const c1 = makeCourse({ id: 1, credits: 3 });
    const c2 = makeCourse({ id: 2, subject: "MATH", number: "200", credits: 4 });
    const courses = [makePlannedCourse(c1, term.id), makePlannedCourse(c2, term.id)];

    renderWithChakra(
      <SemesterColumn term={term} courses={courses} onRemoveTerm={vi.fn()} />
    );

    // Header badge shows "7 cr"
    expect(
      screen.getAllByText("7 cr").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders placeholder text when no courses", () => {
    const term = makeTerm();
    renderWithChakra(
      <SemesterColumn term={term} courses={[]} onRemoveTerm={vi.fn()} />
    );

    expect(
      screen.getAllByText("Drag courses here").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders each course via DraggableCourseCard mock", () => {
    const term = makeTerm();
    const c1 = makeCourse({ id: 10, subject: "CS", number: "101" });
    const c2 = makeCourse({ id: 20, subject: "MATH", number: "200" });
    const c3 = makeCourse({ id: 30, subject: "ENG", number: "101" });
    const courses = [
      makePlannedCourse(c1, term.id),
      makePlannedCourse(c2, term.id),
      makePlannedCourse(c3, term.id),
    ];

    renderWithChakra(
      <SemesterColumn term={term} courses={courses} onRemoveTerm={vi.fn()} />
    );

    expect(screen.getByTestId("course-10")).toBeTruthy();
    expect(screen.getByTestId("course-20")).toBeTruthy();
    expect(screen.getByTestId("course-30")).toBeTruthy();
  });

  it('shows "Overloaded" badge when credits >= 18 for undergrad', () => {
    const term = makeTerm();
    // 6 courses x 3 credits = 18 credits
    const courses = Array.from({ length: 6 }, (_, i) =>
      makePlannedCourse(
        makeCourse({ id: i + 1, number: `${100 + i}`, credits: 3 }),
        term.id
      )
    );

    renderWithChakra(
      <SemesterColumn term={term} courses={courses} onRemoveTerm={vi.fn()} />
    );

    expect(
      screen.getAllByText("Overloaded").length
    ).toBeGreaterThanOrEqual(1);
  });

  it('shows "Heavy" badge when credits 16-17 for undergrad', () => {
    const term = makeTerm();
    // 4 courses x 4 credits = 16 credits
    const courses = Array.from({ length: 4 }, (_, i) =>
      makePlannedCourse(
        makeCourse({ id: i + 1, number: `${100 + i}`, credits: 4 }),
        term.id
      )
    );

    renderWithChakra(
      <SemesterColumn term={term} courses={courses} onRemoveTerm={vi.fn()} />
    );

    expect(
      screen.getAllByText("Heavy").length
    ).toBeGreaterThanOrEqual(1);
  });

  it('shows "Part-time" badge when credits < 12 for undergrad', () => {
    const term = makeTerm();
    // 1 course x 3 credits = 3 credits (well under 12)
    const c1 = makeCourse({ id: 1, credits: 3 });
    const courses = [makePlannedCourse(c1, term.id)];

    renderWithChakra(
      <SemesterColumn term={term} courses={courses} onRemoveTerm={vi.fn()} />
    );

    expect(
      screen.getAllByText("Part-time").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("calls onRemoveTerm when delete button is clicked", () => {
    const term = makeTerm({ id: 42 });
    const onRemoveTerm = vi.fn();

    renderWithChakra(
      <SemesterColumn term={term} courses={[]} onRemoveTerm={onRemoveTerm} />
    );

    const removeBtn = screen.getByLabelText("Remove semester");
    fireEvent.click(removeBtn);

    expect(onRemoveTerm).toHaveBeenCalledWith(42);
  });

  it("renders collapsed summer view when isCollapsed=true", () => {
    const term = makeTerm({ season: "Summer" as Season, year: 2025 });
    renderWithChakra(
      <SemesterColumn
        term={term}
        courses={[]}
        onRemoveTerm={vi.fn()}
        isCollapsed={true}
        onToggleCollapse={vi.fn()}
      />
    );
    expect(screen.getAllByText(/Summer 2025/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Click to expand").length).toBeGreaterThanOrEqual(1);
  });

  it("shows course count badge in collapsed summer view when courses exist", () => {
    const term = makeTerm({ season: "Summer" as Season, year: 2025 });
    const c1 = makeCourse({ id: 1, credits: 3 });
    const courses = [makePlannedCourse(c1, term.id)];
    renderWithChakra(
      <SemesterColumn
        term={term}
        courses={courses}
        onRemoveTerm={vi.fn()}
        isCollapsed={true}
        onToggleCollapse={vi.fn()}
      />
    );
    expect(screen.getAllByText(/1 courses · 3 cr/).length).toBeGreaterThanOrEqual(1);
  });

  it("calls onToggleCollapse when collapsed summer box is clicked", () => {
    const term = makeTerm({ season: "Summer" as Season, year: 2025 });
    const onToggleCollapse = vi.fn();
    renderWithChakra(
      <SemesterColumn
        term={term}
        courses={[]}
        onRemoveTerm={vi.fn()}
        isCollapsed={true}
        onToggleCollapse={onToggleCollapse}
      />
    );
    fireEvent.click(screen.getByText("Click to expand"));
    expect(onToggleCollapse).toHaveBeenCalled();
  });

  it("renders collapse button for Summer term when onToggleCollapse is provided", () => {
    const term = makeTerm({ season: "Summer" as Season, year: 2025 });
    const onToggleCollapse = vi.fn();
    renderWithChakra(
      <SemesterColumn
        term={term}
        courses={[]}
        onRemoveTerm={vi.fn()}
        isCollapsed={false}
        onToggleCollapse={onToggleCollapse}
      />
    );
    const collapseBtn = screen.getByLabelText("Collapse summer");
    fireEvent.click(collapseBtn);
    expect(onToggleCollapse).toHaveBeenCalled();
  });

  it("does NOT render collapse button for non-Summer term", () => {
    const term = makeTerm({ season: "Fall" as Season, year: 2025 });
    renderWithChakra(
      <SemesterColumn
        term={term}
        courses={[]}
        onRemoveTerm={vi.fn()}
        onToggleCollapse={vi.fn()}
      />
    );
    expect(screen.queryByLabelText("Collapse summer")).toBeNull();
  });

  it("renders course footer with plural 'courses' for multiple courses", () => {
    const term = makeTerm({ season: "Spring" as Season, year: 2025 });
    const c1 = makeCourse({ id: 1, credits: 3 });
    const c2 = makeCourse({ id: 2, subject: "MATH", number: "200", credits: 3 });
    const courses = [makePlannedCourse(c1, term.id), makePlannedCourse(c2, term.id)];
    renderWithChakra(
      <SemesterColumn term={term} courses={courses} onRemoveTerm={vi.fn()} />
    );
    expect(screen.getAllByText("2 courses").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("6 credits").length).toBeGreaterThanOrEqual(1);
  });

  it("renders singular 'course' in footer for exactly one course", () => {
    const term = makeTerm({ season: "Fall" as Season, year: 2025 });
    const c1 = makeCourse({ id: 1, credits: 3 });
    const courses = [makePlannedCourse(c1, term.id)];
    renderWithChakra(
      <SemesterColumn term={term} courses={courses} onRemoveTerm={vi.fn()} />
    );
    expect(screen.getAllByText("1 course").length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'Drop here!' text when isOver=true and no courses", () => {
    (useDroppable as ReturnType<typeof vi.fn>).mockReturnValue({
      isOver: true,
      setNodeRef: vi.fn(),
    });
    const term = makeTerm();
    renderWithChakra(
      <SemesterColumn term={term} courses={[]} onRemoveTerm={vi.fn()} />
    );
    expect(screen.getAllByText("Drop here!").length).toBeGreaterThanOrEqual(1);
  });
});
