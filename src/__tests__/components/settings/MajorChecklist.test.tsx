import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithChakra } from "../../helpers/mocks";
import { MajorChecklist } from "@/components/settings/MajorChecklist";
import type { MajorWithRequirements } from "@/lib/supabase/queries/classHistory";

const mockMajor: MajorWithRequirements = {
  majorName: "Computer Science",
  blocks: [
    {
      id: 100,
      name: "Core Courses",
      courses: [
        { id: 1, subject: "CS", number: "101", title: "Intro to CS", credits: 3 },
        { id: 2, subject: "CS", number: "201", title: "Data Structures", credits: 3 },
      ],
    },
    {
      id: 101,
      name: "Electives",
      courses: [
        { id: 3, subject: "CS", number: "310", title: "Algorithms", credits: 3 },
      ],
    },
  ],
};

describe("MajorChecklist", () => {
  it("renders major name and overall progress", () => {
    const completed = new Set([1]);
    const { getAllByText } = renderWithChakra(
      <MajorChecklist major={mockMajor} completedCourseIds={completed} onToggle={vi.fn()} />
    );

    expect(getAllByText("Computer Science").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("1/3 courses").length).toBeGreaterThanOrEqual(1);
  });

  it("renders block names with per-block progress", () => {
    const completed = new Set([1, 2]);
    const { getAllByText } = renderWithChakra(
      <MajorChecklist major={mockMajor} completedCourseIds={completed} onToggle={vi.fn()} />
    );

    expect(getAllByText("Core Courses").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("2/2").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("Electives").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("0/1").length).toBeGreaterThanOrEqual(1);
  });

  it("renders course names", () => {
    const { getAllByText } = renderWithChakra(
      <MajorChecklist major={mockMajor} completedCourseIds={new Set()} onToggle={vi.fn()} />
    );

    expect(getAllByText(/CS 101/).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/CS 310/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders correct number of checkboxes for all courses", () => {
    const { container } = renderWithChakra(
      <MajorChecklist major={mockMajor} completedCourseIds={new Set()} onToggle={vi.fn()} />
    );

    // Verify one checkbox per course across all blocks (2 Core + 1 Elective = 3)
    const allInputs = container.querySelectorAll("input[type='checkbox']");
    expect(allInputs.length).toBe(3);
  });
});
