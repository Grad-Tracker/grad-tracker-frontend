import { render, cleanup, fireEvent } from "@testing-library/react";
import { ChakraProvider, defaultSystem, Table } from "@chakra-ui/react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import DraggableCourseRow from "@/components/planner/DraggableCourseRow";
import { useDraggable } from "@dnd-kit/core";

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

beforeEach(() => {
  vi.mocked(useDraggable).mockReturnValue({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  } as never);
});

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

    expect(mockClick).toHaveBeenCalledWith(mockCourse, 1);
  });

  it("does not call onCourseClick while the row is being dragged", () => {
    vi.mocked(useDraggable).mockReturnValue({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: { x: 12, y: 24, scaleX: 1, scaleY: 1 },
      isDragging: true,
    } as never);

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

    expect(mockClick).not.toHaveBeenCalled();
  });

  it("stops row click propagation when the drag handle is clicked", () => {
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

    const cells = getAllByRole("cell");
    const dragHandle = cells[0].querySelector("div");
    expect(dragHandle).toBeTruthy();

    fireEvent.click(dragHandle!);

    expect(mockClick).not.toHaveBeenCalled();
  });
});
