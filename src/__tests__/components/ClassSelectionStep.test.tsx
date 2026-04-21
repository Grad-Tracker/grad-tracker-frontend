import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import ClassSelectionStep from "@/components/onboarding/ClassSelectionStep";
import { renderWithChakra } from "@/__tests__/helpers/mocks";
import type { RequirementBlock } from "@/types/onboarding";

const mockBlocks: RequirementBlock[] = [
  {
    id: 1,
    program_id: 534,
    name: "Required Computer Science Courses",
    rule: "ALL_OF",
    n_required: null,
    credits_required: null,
    courses: [
      { id: 100, subject: "CS", number: "101", title: "Intro to CS", credits: 3 },
      { id: 101, subject: "CS", number: "201", title: "Data Structures", credits: 3 },
    ],
  },
  {
    id: 2,
    program_id: 534,
    name: "Elective Courses",
    rule: "N_OF",
    n_required: 2,
    credits_required: null,
    courses: [
      { id: 200, subject: "CS", number: "350", title: "Algorithms", credits: 3 },
    ],
  },
];

describe("ClassSelectionStep", () => {
  it("renders requirement block headings", () => {
    renderWithChakra(
      <ClassSelectionStep
        requirementBlocks={mockBlocks}
        selectedClasses={[]}
        onClassesChange={vi.fn()}
      />
    );

    expect(screen.getAllByText("Required Computer Science Courses").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Elective Courses").length).toBeGreaterThan(0);
  });

  it("renders course cards with subject and number", () => {
    renderWithChakra(
      <ClassSelectionStep
        requirementBlocks={mockBlocks}
        selectedClasses={[]}
        onClassesChange={vi.fn()}
      />
    );

    expect(screen.getAllByText("CS 101").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CS 201").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CS 350").length).toBeGreaterThan(0);
  });

  it("renders course titles", () => {
    renderWithChakra(
      <ClassSelectionStep
        requirementBlocks={mockBlocks}
        selectedClasses={[]}
        onClassesChange={vi.fn()}
      />
    );

    expect(screen.getAllByText("Intro to CS").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Data Structures").length).toBeGreaterThan(0);
  });

  it("renders rule labels for blocks", () => {
    renderWithChakra(
      <ClassSelectionStep
        requirementBlocks={mockBlocks}
        selectedClasses={[]}
        onClassesChange={vi.fn()}
      />
    );

    expect(screen.getAllByText("Complete all").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Choose 2").length).toBeGreaterThan(0);
  });

  it("shows selected count and credits when courses are selected", () => {
    renderWithChakra(
      <ClassSelectionStep
        requirementBlocks={mockBlocks}
        selectedClasses={[100, 101]}
        onClassesChange={vi.fn()}
      />
    );

    expect(screen.getAllByText("2 courses selected (6 credits)").length).toBeGreaterThan(0);
  });

  it("hides selected count when no courses are selected", () => {
    renderWithChakra(
      <ClassSelectionStep
        requirementBlocks={mockBlocks}
        selectedClasses={[]}
        onClassesChange={vi.fn()}
      />
    );

    // The "X courses selected (Y credits)" banner should not render
    expect(screen.queryAllByText(/\d+ courses? selected \(\d+ credits\)/).length).toBe(0);
  });

  it("skips blocks with no courses", () => {
    const blocksWithEmpty: RequirementBlock[] = [
      {
        id: 99,
        program_id: 1,
        name: "Empty Block",
        rule: "ALL_OF",
        n_required: null,
        credits_required: null,
        courses: [],
      },
      ...mockBlocks,
    ];

    renderWithChakra(
      <ClassSelectionStep
        requirementBlocks={blocksWithEmpty}
        selectedClasses={[]}
        onClassesChange={vi.fn()}
      />
    );

    expect(screen.queryByText("Empty Block")).not.toBeInTheDocument();
  });
});
