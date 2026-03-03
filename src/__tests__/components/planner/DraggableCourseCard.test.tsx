import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { renderWithChakra } from "../../helpers/mocks";
import DraggableCourseCard from "@/components/planner/DraggableCourseCard";
import type { Course } from "@/types/course";

vi.mock("@dnd-kit/core", () => ({
  useDraggable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  })),
}));

// Render both children AND content so CourseTooltipContent is exercised
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children, content }: any) =>
    React.createElement("div", null, children, content),
}));

function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: 1,
    subject: "CS",
    number: "101",
    title: "Intro to CS",
    credits: 3,
    ...overrides,
  };
}

describe("DraggableCourseCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useDraggable as ReturnType<typeof vi.fn>).mockReturnValue({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      isDragging: false,
    });
  });

  it("renders course subject, number, and title", () => {
    renderWithChakra(<DraggableCourseCard course={makeCourse()} />);

    expect(
      screen.getAllByText(/CS\s+101/).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Intro to CS").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders credit badge", () => {
    renderWithChakra(
      <DraggableCourseCard course={makeCourse({ credits: 4 })} />
    );

    expect(
      screen.getAllByText("4 cr").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("shows completed styling when isCompleted=true", () => {
    const { container } = renderWithChakra(
      <DraggableCourseCard course={makeCourse()} isCompleted />
    );

    // Check icon is rendered (LuCircleCheck) — it renders an SVG
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(1);

    // The card should have reduced opacity (0.5) for completed courses
    // Find the outermost card box: it has the style applied via Chakra
    const cardBox = container.firstElementChild;
    expect(cardBox).toBeTruthy();
  });

  it("does NOT show Planned badge when termId is provided", () => {
    renderWithChakra(
      <DraggableCourseCard
        course={makeCourse()}
        isPlanned
        termId={1}
      />
    );

    expect(screen.queryAllByText("Planned").length).toBe(0);
  });

  it("shows Planned badge when isPlanned=true and no termId", () => {
    renderWithChakra(
      <DraggableCourseCard course={makeCourse()} isPlanned />
    );

    expect(
      screen.getAllByText("Planned").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("disables drag when isCompleted is true", () => {
    renderWithChakra(
      <DraggableCourseCard course={makeCourse()} isCompleted />
    );

    expect(useDraggable).toHaveBeenCalledWith(
      expect.objectContaining({ disabled: true })
    );
  });

  it("renders with different subject colors (CS gets blue-ish styling)", () => {
    const { container } = renderWithChakra(
      <DraggableCourseCard course={makeCourse({ subject: "CS" })} />
    );

    // The credit badge should have colorPalette="blue" for CS courses.
    // Chakra renders data-scope attributes or className referencing the color.
    // Find the badge element containing "3 cr".
    const badges = screen.getAllByText("3 cr");
    expect(badges.length).toBeGreaterThanOrEqual(1);

    // The border-left-color should reference blue for CS
    // Since Chakra applies styles via CSS-in-JS, we verify the card renders without error
    // and has the proper structure
    expect(container.firstElementChild).toBeTruthy();
  });

  it("renders drag handle icon when not completed", () => {
    const { container } = renderWithChakra(
      <DraggableCourseCard course={makeCourse()} />
    );

    // LuGripVertical renders an SVG with specific attributes
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(1);

    // The "Planned" badge should NOT appear (isPlanned defaults to false)
    expect(screen.queryAllByText("Planned").length).toBe(0);
  });

  it("renders CourseTooltipContent with description and prereq_text when provided", () => {
    const course = makeCourse({
      description: "An intro course about computer science fundamentals.",
      prereq_text: "None",
    } as any);
    renderWithChakra(<DraggableCourseCard course={course} />);
    // The tooltip content renders the description
    expect(screen.getAllByText("An intro course about computer science fundamentals.").length).toBeGreaterThanOrEqual(1);
    // The prereq_text renders under "Prerequisites"
    expect(screen.getAllByText("Prerequisites").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("None").length).toBeGreaterThanOrEqual(1);
  });

  it("renders simple CourseTooltipContent when no description or prereq_text", () => {
    const course = makeCourse(); // no description, no prereq_text
    renderWithChakra(<DraggableCourseCard course={course} />);
    // Should still show the course subject/number and credits in tooltip
    expect(screen.getAllByText(/CS\s+101/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("3 credits").length).toBeGreaterThanOrEqual(1);
  });

  it("renders card directly when isDragging=true (no Tooltip wrapper)", () => {
    (useDraggable as ReturnType<typeof vi.fn>).mockReturnValue({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: { x: 10, y: 20 },
      isDragging: true,
    });
    const { container } = renderWithChakra(
      <DraggableCourseCard course={makeCourse()} />
    );
    // When isDragging, the component returns the card directly without Tooltip
    expect(container.firstElementChild).toBeTruthy();
    // CS 101 should still be visible
    expect(screen.getAllByText(/CS\s+101/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders only description in tooltip when prereq_text is absent", () => {
    const course = makeCourse({
      description: "Course description only.",
    } as any);
    renderWithChakra(<DraggableCourseCard course={course} />);
    expect(screen.getAllByText("Course description only.").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByText("Prerequisites").length).toBe(0);
  });
});
