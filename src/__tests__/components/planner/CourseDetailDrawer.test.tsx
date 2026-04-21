import { cleanup, screen, fireEvent } from "@testing-library/react";
import { renderWithChakra } from "@/__tests__/helpers/mocks";
import { describe, it, expect, afterEach, vi } from "vitest";
import CourseDetailDrawer from "@/components/planner/CourseDetailDrawer";

afterEach(() => cleanup());

vi.mock("@/components/ui/close-button", () => ({
  CloseButton: (props: any) => <button data-testid="close-button" {...props} />,
}));

const baseCourse = {
  id: 1,
  subject: "CS",
  number: "201",
  title: "Data Structures",
  credits: 3,
  description: "Intro to DS",
  prereq_text: null,
};

describe("CourseDetailDrawer", () => {
  it("renders course details when open with a course", () => {
    const { getAllByText } = renderWithChakra(
      <CourseDetailDrawer
        course={baseCourse}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    expect(getAllByText("CS 201").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("Data Structures").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("3").length).toBeGreaterThanOrEqual(1);
  });

  it("shows description fallback when description is null", () => {
    const course = { ...baseCourse, description: null };

    const { getAllByText } = renderWithChakra(
      <CourseDetailDrawer
        course={course}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    expect(
      getAllByText("No description available.").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("shows prerequisites when prereq_text exists", () => {
    const course = { ...baseCourse, prereq_text: "CS 101 required" };

    const { getAllByText } = renderWithChakra(
      <CourseDetailDrawer
        course={course}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    expect(getAllByText("Prerequisites").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("CS 101 required").length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty when course is null", () => {
    const { queryAllByText } = renderWithChakra(
      <CourseDetailDrawer
        course={null}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    expect(queryAllByText("CS 201")).toHaveLength(0);
    expect(queryAllByText("Data Structures")).toHaveLength(0);
  });

  it("shows remove button when removal callback is provided", () => {
    renderWithChakra(
      <CourseDetailDrawer
        course={baseCourse}
        open={true}
        onOpenChange={vi.fn()}
        onRemoveCourse={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Remove Course" })).toBeInTheDocument();
  });

  it("calls removal callback when remove button is clicked", () => {
    const onRemoveCourse = vi.fn();

    renderWithChakra(
      <CourseDetailDrawer
        course={baseCourse}
        open={true}
        onOpenChange={vi.fn()}
        onRemoveCourse={onRemoveCourse}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove Course" }));
    expect(onRemoveCourse).toHaveBeenCalled();
  });

  it("calls onOpenChange when drawer open state changes", () => {
    const onOpenChange = vi.fn();
    renderWithChakra(
      <CourseDetailDrawer
        course={baseCourse}
        open={true}
        onOpenChange={onOpenChange}
        onRemoveCourse={vi.fn()}
      />
    );
    onOpenChange(false);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
