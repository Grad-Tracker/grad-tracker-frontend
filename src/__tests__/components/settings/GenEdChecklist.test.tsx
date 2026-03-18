import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithChakra } from "../../helpers/mocks";
import { GenEdChecklist } from "@/components/settings/GenEdChecklist";
import type { GenEdBucketWithCourses } from "@/types/auto-generate";

const mockBuckets: GenEdBucketWithCourses[] = [
  {
    id: 1,
    code: "HUM_ART",
    name: "Humanities and the Arts",
    credits_required: 12,
    courses: [
      { id: 10, subject: "ENG", number: "101", title: "Composition I", credits: 3 },
      { id: 11, subject: "ENG", number: "102", title: "Composition II", credits: 3 },
      { id: 12, subject: "ART", number: "100", title: "Intro to Art", credits: 3 },
    ],
  },
  {
    id: 2,
    code: "NAT_SCI",
    name: "Natural Science",
    credits_required: 12,
    courses: [
      { id: 20, subject: "BIO", number: "101", title: "Intro to Biology", credits: 4 },
    ],
  },
];

describe("GenEdChecklist", () => {
  it("renders bucket names and credit progress", () => {
    const completed = new Set([10, 11]); // 6 credits of 12 for HUM_ART
    const { getAllByText } = renderWithChakra(
      <GenEdChecklist buckets={mockBuckets} completedCourseIds={completed} onToggle={vi.fn()} />
    );

    expect(getAllByText("Humanities and the Arts").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("Natural Science").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("6/12 credits").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("0/12 credits").length).toBeGreaterThanOrEqual(1);
  });

  it("renders course names", () => {
    const { getAllByText } = renderWithChakra(
      <GenEdChecklist buckets={mockBuckets} completedCourseIds={new Set()} onToggle={vi.fn()} />
    );

    expect(getAllByText(/ENG 101/).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/BIO 101/).length).toBeGreaterThanOrEqual(1);
  });

  it("checks completed courses", () => {
    const completed = new Set([10]);
    const { container } = renderWithChakra(
      <GenEdChecklist buckets={mockBuckets} completedCourseIds={completed} onToggle={vi.fn()} />
    );

    const checkboxes = container.querySelectorAll("[data-state]");
    const checkedBoxes = Array.from(checkboxes).filter(
      (el) => el.getAttribute("data-state") === "checked"
    );
    expect(checkedBoxes.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the correct number of checkboxes for all courses", () => {
    const { container } = renderWithChakra(
      <GenEdChecklist buckets={mockBuckets} completedCourseIds={new Set()} onToggle={vi.fn()} />
    );

    // 3 courses in bucket 1 + 1 course in bucket 2 = 4 checkboxes
    const allInputs = container.querySelectorAll("input[type='checkbox']");
    expect(allInputs.length).toBe(4);
  });
});
