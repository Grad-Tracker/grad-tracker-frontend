import { render, cleanup, fireEvent } from "@testing-library/react";
import { ChakraProvider, defaultSystem, Table } from "@chakra-ui/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import DraggableCourseRow from "@/components/planner/DraggableCourseRow";

vi.mock("@dnd-kit/core", () => ({
  useDraggable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  })),
}));

afterEach(() => cleanup());

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

const mockCourse = {
  id: 1,
  subject: "MATH",
  number: "221",
  title: "Calculus I",
  credits: 4,
};

describe("DraggableCourseRow", () => {
  it("renders course info", () => {
    const { getAllByText } = renderWithChakra(
      <Table.Root>
        <Table.Body>
          <DraggableCourseRow
            course={mockCourse}
            termId={1}
            onCourseClick={vi.fn()}
          />
        </Table.Body>
      </Table.Root>
    );

    expect(getAllByText("MATH 221").length).toBeGreaterThan(0);
    expect(getAllByText("Calculus I").length).toBeGreaterThan(0);
    expect(getAllByText("4").length).toBeGreaterThan(0);
  });

  it("calls onCourseClick on row click", () => {
    const mockClick = vi.fn();

    const { getAllByRole } = renderWithChakra(
      <Table.Root>
        <Table.Body>
          <DraggableCourseRow
            course={mockCourse}
            termId={1}
            onCourseClick={mockClick}
          />
        </Table.Body>
      </Table.Root>
    );

    const rows = getAllByRole("row");
    const courseRow = rows[rows.length - 1];
    fireEvent.click(courseRow);

    expect(mockClick).toHaveBeenCalledWith(mockCourse);
  });
});
