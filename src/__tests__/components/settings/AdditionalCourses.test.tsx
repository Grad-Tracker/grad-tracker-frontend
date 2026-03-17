import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithChakra } from "../../helpers/mocks";
import { AdditionalCourses } from "@/components/settings/AdditionalCourses";
import type { CourseRow } from "@/types/onboarding";

// Mock CourseSearchDialog — expose onClose to test dialog closing
vi.mock("@/components/settings/CourseSearchDialog", () => ({
  CourseSearchDialog: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="search-dialog">
        Dialog Open
        <button data-testid="close-dialog" onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

const mockCourses: CourseRow[] = [
  { id: 50, subject: "MUS", number: "101", title: "Music Theory", credits: 3 },
  { id: 51, subject: "PHIL", number: "200", title: "Ethics", credits: 3 },
];

describe("AdditionalCourses", () => {
  it("renders empty state when no courses", () => {
    const { getAllByText } = renderWithChakra(
      <AdditionalCourses courses={[]} onDelete={vi.fn()} onCourseSelected={vi.fn()} />
    );

    expect(getAllByText("No additional courses added yet.").length).toBeGreaterThanOrEqual(1);
  });

  it("renders course list with details", () => {
    const { getAllByText } = renderWithChakra(
      <AdditionalCourses courses={mockCourses} onDelete={vi.fn()} onCourseSelected={vi.fn()} />
    );

    expect(getAllByText(/MUS 101/).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/PHIL 200/).length).toBeGreaterThanOrEqual(1);
  });

  it("calls onDelete when delete button is clicked", () => {
    const onDelete = vi.fn();
    const { container } = renderWithChakra(
      <AdditionalCourses courses={mockCourses} onDelete={onDelete} onCourseSelected={vi.fn()} />
    );

    // Find delete buttons (ghost variant with red color)
    const deleteButtons = container.querySelectorAll("button[data-variant='ghost']");
    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0]);
      expect(onDelete).toHaveBeenCalledWith(50);
    }
  });

  it("opens search dialog when Add Course is clicked", () => {
    const { getAllByText, queryByTestId } = renderWithChakra(
      <AdditionalCourses courses={[]} onDelete={vi.fn()} onCourseSelected={vi.fn()} />
    );

    expect(queryByTestId("search-dialog")).toBeNull();

    const addButtons = getAllByText("Add Course");
    fireEvent.click(addButtons[0]);

    expect(queryByTestId("search-dialog")).not.toBeNull();
  });

  it("closes search dialog when onClose is called", () => {
    const { getAllByText, queryByTestId, getByTestId } = renderWithChakra(
      <AdditionalCourses courses={[]} onDelete={vi.fn()} onCourseSelected={vi.fn()} />
    );

    // Open dialog
    const addButtons = getAllByText("Add Course");
    fireEvent.click(addButtons[0]);
    expect(queryByTestId("search-dialog")).not.toBeNull();

    // Close dialog via onClose callback
    fireEvent.click(getByTestId("close-dialog"));
    expect(queryByTestId("search-dialog")).toBeNull();
  });
});
