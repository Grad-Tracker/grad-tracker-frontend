import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { renderWithChakra } from "../../helpers/mocks";
import { ManualCourseForm } from "@/components/settings/ManualCourseForm";

vi.mock("@/lib/supabase/queries/classHistory", () => ({
  insertManualCourse: vi.fn(),
}));

vi.mock("@/components/ui/toaster", () => ({
  toaster: { create: vi.fn() },
}));

import { insertManualCourse } from "@/lib/supabase/queries/classHistory";
import { toaster } from "@/components/ui/toaster";

describe("ManualCourseForm", () => {
  const onCourseCreated = vi.fn();
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all form fields", () => {
    const { getAllByText } = renderWithChakra(
      <ManualCourseForm onCourseCreated={onCourseCreated} onBack={onBack} />
    );

    expect(getAllByText("Subject").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("Course Number").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("Title").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("Credits").length).toBeGreaterThanOrEqual(1);
  });

  it("shows error for invalid subject", async () => {
    const { getAllByText } = renderWithChakra(
      <ManualCourseForm onCourseCreated={onCourseCreated} onBack={onBack} />
    );

    const addButtons = getAllByText("Add Course");
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(toaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error" })
      );
    });
  });

  it("shows error for invalid course number", async () => {
    const { container, getAllByText } = renderWithChakra(
      <ManualCourseForm onCourseCreated={onCourseCreated} onBack={onBack} />
    );

    const inputs = container.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "MATH" } });
    fireEvent.change(inputs[1], { target: { value: "AB" } }); // invalid number

    const addButtons = getAllByText("Add Course");
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(toaster.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining("3-4 digits"),
          type: "error",
        })
      );
    });
  });

  it("submits valid form and calls onCourseCreated", async () => {
    const newCourse = { id: 999, subject: "ART", number: "200", title: "Drawing", credits: 3 };
    vi.mocked(insertManualCourse).mockResolvedValue(newCourse);

    const { container, getAllByText } = renderWithChakra(
      <ManualCourseForm onCourseCreated={onCourseCreated} onBack={onBack} />
    );

    const inputs = container.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "ART" } });
    fireEvent.change(inputs[1], { target: { value: "200" } });
    fireEvent.change(inputs[2], { target: { value: "Drawing" } });
    fireEvent.change(inputs[3], { target: { value: "3" } });

    const addButtons = getAllByText("Add Course");
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(insertManualCourse).toHaveBeenCalledWith("ART", "200", "Drawing", 3);
      expect(onCourseCreated).toHaveBeenCalledWith(newCourse);
    });
  });

  it("calls onBack when back button is clicked", () => {
    const { getAllByText } = renderWithChakra(
      <ManualCourseForm onCourseCreated={onCourseCreated} onBack={onBack} />
    );

    const backButtons = getAllByText("Back to search");
    fireEvent.click(backButtons[0]);
    expect(onBack).toHaveBeenCalled();
  });
});
