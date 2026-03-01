import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import React from "react";
import { renderWithChakra } from "../../helpers/mocks";
import CoursePanel from "@/components/planner/CoursePanel";
import type { RequirementBlockWithCourses, GraduateTrack } from "@/types/planner";
import type { Course } from "@/types/course";

// ── Mock child components & dnd-kit ─────────────────────────────────

vi.mock("@dnd-kit/core", () => ({
  useDroppable: vi.fn(() => ({ isOver: false, setNodeRef: vi.fn() })),
}));
vi.mock("@/components/planner/DraggableCourseCard", () => ({
  default: ({ course }: any) =>
    React.createElement("div", { "data-testid": `course-${course.id}` }, `${course.subject} ${course.number}`),
}));
vi.mock("@/components/planner/RequirementProgress", () => ({
  default: () => React.createElement("div", { "data-testid": "req-progress" }, "RequirementProgress"),
}));
vi.mock("@/components/planner/BreadthPackageSelector", () => ({
  default: () => React.createElement("div", { "data-testid": "breadth-selector" }, "BreadthPackageSelector"),
}));
vi.mock("@/components/planner/GraduateTrackSelector", () => ({
  default: () => React.createElement("div", { "data-testid": "grad-track" }, "GraduateTrackSelector"),
}));

// ── Factories ───────────────────────────────────────────────────────

function makeCourse(overrides: Partial<Course> = {}): Course {
  return { id: 1, subject: "CS", number: "101", title: "Intro to CS", credits: 3, ...overrides };
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

// ── Default props ───────────────────────────────────────────────────

function defaultProps(overrides: Partial<React.ComponentProps<typeof CoursePanel>> = {}) {
  const blocks = [makeBlock()];
  return {
    blocks,
    allDedupedBlocks: blocks,
    completedCourseIds: new Set<number>(),
    plannedCourseIds: new Set<number>(),
    plannedCourses: [],
    isDragActive: false,
    selectedBreadthPackageId: null,
    onBreadthPackageSelect: vi.fn(),
    isGraduatePlan: false,
    graduateTracks: [] as GraduateTrack[],
    selectedTrackId: null,
    onTrackSelect: vi.fn(),
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("CoursePanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders "Course Pool" heading', () => {
    renderWithChakra(<CoursePanel {...defaultProps()} />);

    expect(screen.getAllByText("Course Pool").length).toBeGreaterThanOrEqual(1);
  });

  it("shows available course count badge (total minus completed minus planned)", () => {
    const course1 = makeCourse({ id: 1 });
    const course2 = makeCourse({ id: 2, subject: "CS", number: "201", title: "Data Structures" });
    const course3 = makeCourse({ id: 3, subject: "CS", number: "301", title: "Algorithms" });
    const blocks = [makeBlock({ courses: [course1, course2, course3] })];

    renderWithChakra(
      <CoursePanel
        {...defaultProps({
          blocks,
          allDedupedBlocks: blocks,
          completedCourseIds: new Set([1]),
          plannedCourseIds: new Set([2]),
        })}
      />
    );

    // 3 total - 1 completed - 1 planned = 1 available
    expect(screen.getAllByText("1 available").length).toBeGreaterThanOrEqual(1);
  });

  it("search input filters courses by subject+number and title", () => {
    const courseA = makeCourse({ id: 1, subject: "CS", number: "101", title: "Intro to CS" });
    const courseB = makeCourse({ id: 2, subject: "MATH", number: "201", title: "Calculus I" });
    const blocks = [makeBlock({ courses: [courseA, courseB] })];

    renderWithChakra(
      <CoursePanel {...defaultProps({ blocks, allDedupedBlocks: blocks })} />
    );

    // Both courses should be visible initially
    expect(screen.getByTestId("course-1")).toBeDefined();
    expect(screen.getByTestId("course-2")).toBeDefined();

    // Type a search query that matches only the MATH course
    const input = screen.getByPlaceholderText("Search courses...");
    fireEvent.change(input, { target: { value: "Calculus" } });

    // MATH course should remain, CS course should be gone
    expect(screen.getByTestId("course-2")).toBeDefined();
    expect(screen.queryByTestId("course-1")).toBeNull();
  });

  it('shows "No courses match" when search returns no results', () => {
    const blocks = [makeBlock()];

    renderWithChakra(
      <CoursePanel {...defaultProps({ blocks, allDedupedBlocks: blocks })} />
    );

    const input = screen.getByPlaceholderText("Search courses...");
    fireEvent.change(input, { target: { value: "xyznonexistent" } });

    expect(
      screen.getAllByText("No courses match your search.").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders collapsible block names with course counts", () => {
    const course1 = makeCourse({ id: 1 });
    const course2 = makeCourse({ id: 2, subject: "CS", number: "201", title: "Data Structures" });
    const blocks = [
      makeBlock({ id: 1, name: "Required Courses", courses: [course1, course2] }),
      makeBlock({ id: 2, name: "Electives", courses: [makeCourse({ id: 3, subject: "ART", number: "100", title: "Art History" })] }),
    ];

    renderWithChakra(
      <CoursePanel {...defaultProps({ blocks, allDedupedBlocks: blocks })} />
    );

    // Block names are rendered
    expect(screen.getAllByText("Required Courses").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Electives").length).toBeGreaterThanOrEqual(1);

    // Course count badges: "2" for Required Courses, "1" for Electives
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1);
  });

  it("shows BreadthPackageSelector for breadth blocks when not graduate", () => {
    const breadthBlock = makeBlock({
      id: 10,
      name: "Breadth Requirements",
      courses: [makeCourse({ id: 5, subject: "MATH", number: "222", title: "Calculus II" })],
    });
    const blocks = [breadthBlock];

    renderWithChakra(
      <CoursePanel
        {...defaultProps({
          blocks,
          allDedupedBlocks: blocks,
          isGraduatePlan: false,
        })}
      />
    );

    expect(screen.getByTestId("breadth-selector")).toBeDefined();
  });

  it("shows GraduateTrackSelector when isGraduatePlan=true with 2+ graduate tracks", () => {
    const tracks: GraduateTrack[] = [
      { blockId: 1, name: "AI Track", courseCount: 5, totalCredits: 15 },
      { blockId: 2, name: "Systems Track", courseCount: 4, totalCredits: 12 },
    ];

    renderWithChakra(
      <CoursePanel
        {...defaultProps({
          isGraduatePlan: true,
          graduateTracks: tracks,
          selectedTrackId: null,
          onTrackSelect: vi.fn(),
        })}
      />
    );

    expect(screen.getByTestId("grad-track")).toBeDefined();
  });

  it("renders RequirementProgress component", () => {
    renderWithChakra(<CoursePanel {...defaultProps()} />);

    expect(screen.getByTestId("req-progress")).toBeDefined();
  });
});
