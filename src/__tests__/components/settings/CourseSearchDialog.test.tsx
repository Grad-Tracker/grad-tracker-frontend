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

import { searchCourses } from "@/lib/supabase/queries/classHistory";

describe("CourseSearchDialog", () => {
  const onClose = vi.fn();
  const onCourseSelected = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
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
    vi.useRealTimers();
    const mockResults = [
      { id: 1, subject: "MATH", number: "101", title: "Calculus I", credits: 4 },
    ];
    vi.mocked(searchCourses).mockResolvedValue(mockResults);

    const { getAllByText } = renderWithChakra(
      <CourseSearchDialog open={true} onClose={onClose} onCourseSelected={onCourseSelected} />
    );

    // Dialog renders in a portal — query the whole document for the input
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

  it("switches to manual form when link is clicked", () => {
    const { getAllByText } = renderWithChakra(
      <CourseSearchDialog open={true} onClose={onClose} onCourseSelected={onCourseSelected} />
    );

    const manualLinks = getAllByText(/Add it manually/);
    fireEvent.click(manualLinks[0]);

    expect(getAllByText("Add Course Manually").length).toBeGreaterThanOrEqual(1);
  });
});
