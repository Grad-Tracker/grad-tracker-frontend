import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { renderWithChakra } from "../../helpers/mocks";
import { CourseSearchDialog } from "@/components/settings/CourseSearchDialog";

vi.mock("@/lib/supabase/queries/classHistory", () => ({
  searchCourses: vi.fn(),
  insertManualCourse: vi.fn(),
}));

vi.mock("@/components/ui/toaster", () => ({
  toaster: { create: vi.fn() },
}));

import { searchCourses, insertManualCourse } from "@/lib/supabase/queries/classHistory";

describe("CourseSearchDialog", () => {
  const onClose = vi.fn();
  const onCourseSelected = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render content when closed", () => {
    const { queryByText } = renderWithChakra(
      <CourseSearchDialog open={false} onClose={onClose} onCourseSelected={onCourseSelected} />
    );

    expect(queryByText("Search Courses")).toBeNull();
  });

  it("renders search input when open", () => {
    const { getAllByText } = renderWithChakra(
      <CourseSearchDialog open={true} onClose={onClose} onCourseSelected={onCourseSelected} />
    );

    expect(getAllByText("Search Courses").length).toBeGreaterThanOrEqual(1);
  });

  it("searches after debounce and shows results", async () => {
    const mockResults = [
      { id: 1, subject: "MATH", number: "101", title: "Calculus I", credits: 4 },
    ];
    vi.mocked(searchCourses).mockResolvedValue(mockResults);

    const { getAllByText } = renderWithChakra(
      <CourseSearchDialog open={true} onClose={onClose} onCourseSelected={onCourseSelected} />
    );

    const input = document.querySelector("input[placeholder*='Search']");
    expect(input).not.toBeNull();
    fireEvent.change(input!, { target: { value: "MATH" } });

    await waitFor(
      () => {
        expect(searchCourses).toHaveBeenCalledWith("MATH");
      },
      { timeout: 1000 }
    );

    await waitFor(() => {
      expect(getAllByText(/MATH 101/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("calls onCourseSelected and onClose when a result is clicked", async () => {
    const mockResults = [
      { id: 1, subject: "MATH", number: "101", title: "Calculus I", credits: 4 },
    ];
    vi.mocked(searchCourses).mockResolvedValue(mockResults);

    const { getAllByText } = renderWithChakra(
      <CourseSearchDialog open={true} onClose={onClose} onCourseSelected={onCourseSelected} />
    );

    const input = document.querySelector("input[placeholder*='Search']");
    fireEvent.change(input!, { target: { value: "MATH" } });

    await waitFor(
      () => {
        expect(searchCourses).toHaveBeenCalledWith("MATH");
      },
      { timeout: 1000 }
    );

    // Wait for results to render, then click the result containing "MATH 101"
    await waitFor(() => {
      expect(getAllByText(/MATH 101/).length).toBeGreaterThanOrEqual(1);
    });

    // The HStack result row has the onClick handler — find and click it
    const resultElements = getAllByText(/MATH 101/);
    // Click the parent HStack (which has the onClick)
    const clickTarget = resultElements[0].closest("[class*='stack']") ?? resultElements[0];
    fireEvent.click(clickTarget);

    expect(onCourseSelected).toHaveBeenCalledWith(mockResults[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("switches to manual form and back", () => {
    const { getAllByText } = renderWithChakra(
      <CourseSearchDialog open={true} onClose={onClose} onCourseSelected={onCourseSelected} />
    );

    // Switch to manual form
    const manualLinks = getAllByText(/Add it manually/);
    fireEvent.click(manualLinks[0]);
    expect(getAllByText("Add Course Manually").length).toBeGreaterThanOrEqual(1);

    // Switch back to search
    const backButtons = getAllByText("Back to search");
    fireEvent.click(backButtons[0]);
    expect(getAllByText("Search Courses").length).toBeGreaterThanOrEqual(1);
  });

  it("handles manual course creation and calls onCourseSelected", async () => {
    const newCourse = { id: 999, subject: "ART", number: "200", title: "Drawing", credits: 3 };
    vi.mocked(insertManualCourse).mockResolvedValue(newCourse);

    const { getAllByText } = renderWithChakra(
      <CourseSearchDialog open={true} onClose={onClose} onCourseSelected={onCourseSelected} />
    );

    // Switch to manual form
    const manualLinks = getAllByText(/Add it manually/);
    fireEvent.click(manualLinks[0]);

    // Fill and submit the form
    const inputs = document.querySelectorAll(".chakra-dialog__body input");
    fireEvent.change(inputs[0], { target: { value: "ART" } });
    fireEvent.change(inputs[1], { target: { value: "200" } });
    fireEvent.change(inputs[2], { target: { value: "Drawing" } });
    fireEvent.change(inputs[3], { target: { value: "3" } });

    const addButtons = getAllByText("Add Course");
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(onCourseSelected).toHaveBeenCalledWith(newCourse);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("does not search for queries shorter than 2 chars", async () => {
    renderWithChakra(
      <CourseSearchDialog open={true} onClose={onClose} onCourseSelected={onCourseSelected} />
    );

    const input = document.querySelector("input[placeholder*='Search']");
    fireEvent.change(input!, { target: { value: "a" } });

    // Wait a bit for debounce
    await new Promise((r) => setTimeout(r, 500));

    // searchCourses should NOT have been called (query too short)
    expect(searchCourses).not.toHaveBeenCalled();
  });

  it("shows no results message for query with no matches", async () => {
    vi.mocked(searchCourses).mockResolvedValue([]);

    const { getAllByText } = renderWithChakra(
      <CourseSearchDialog open={true} onClose={onClose} onCourseSelected={onCourseSelected} />
    );

    const input = document.querySelector("input[placeholder*='Search']");
    fireEvent.change(input!, { target: { value: "ZZZZZ" } });

    await waitFor(
      () => {
        expect(searchCourses).toHaveBeenCalledWith("ZZZZZ");
      },
      { timeout: 1000 }
    );

    await waitFor(() => {
      expect(getAllByText("No courses found.").length).toBeGreaterThanOrEqual(1);
    });
  });
});
