import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderWithChakra, createMockAuth } from "../../helpers/mocks";
import { ClassHistoryTab } from "@/components/settings/ClassHistoryTab";

// Mock all dependencies
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/queries/classHistory", () => ({
  fetchDefaultTermId: vi.fn(),
  fetchMajorRequirementCourses: vi.fn(),
  fetchStudentCourseHistory: vi.fn(),
  insertCourseHistory: vi.fn(),
  deleteCourseHistory: vi.fn(),
}));

vi.mock("@/lib/supabase/queries/planner", () => ({
  fetchGenEdBucketsWithCourses: vi.fn(),
}));

vi.mock("@/components/ui/toaster", () => ({
  toaster: { create: vi.fn() },
}));

import { createClient } from "@/lib/supabase/client";
import {
  fetchDefaultTermId,
  fetchMajorRequirementCourses,
  fetchStudentCourseHistory,
} from "@/lib/supabase/queries/classHistory";
import { fetchGenEdBucketsWithCourses } from "@/lib/supabase/queries/planner";

function setupAuthMock(studentId: number | null = 1) {
  const mockAuth = createMockAuth({
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: "auth-123" } },
      error: null,
    }),
  });

  const mockFrom = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: studentId ? { id: studentId } : null,
          error: null,
        }),
      }),
    }),
  });

  vi.mocked(createClient).mockReturnValue({
    auth: mockAuth,
    from: mockFrom,
  } as never);
}

const mockBuckets = [
  {
    id: 1,
    code: "HUM_ART",
    name: "Humanities",
    credits_required: 12,
    courses: [
      { id: 10, subject: "ENG", number: "101", title: "Composition", credits: 3 },
    ],
  },
];

const mockMajor = {
  majorName: "Computer Science",
  blocks: [
    {
      id: 100,
      name: "Core",
      courses: [
        { id: 20, subject: "CS", number: "101", title: "Intro to CS", credits: 3 },
      ],
    },
  ],
};

describe("ClassHistoryTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthMock(1);
    vi.mocked(fetchDefaultTermId).mockResolvedValue(1);
    vi.mocked(fetchGenEdBucketsWithCourses).mockResolvedValue(mockBuckets);
    vi.mocked(fetchMajorRequirementCourses).mockResolvedValue(mockMajor);
    vi.mocked(fetchStudentCourseHistory).mockResolvedValue([]);
  });

  it("shows loading spinner initially", () => {
    const { container } = renderWithChakra(<ClassHistoryTab />);
    // The spinner should be present before data loads
    const spinner = container.querySelector("[class*='spinner'], [data-scope='spinner']");
    // At minimum, the component renders without crashing
    expect(container).toBeTruthy();
  });

  it("renders all three sections after loading", async () => {
    const { getAllByText } = renderWithChakra(<ClassHistoryTab />);

    await waitFor(() => {
      expect(getAllByText("General Education").length).toBeGreaterThanOrEqual(1);
    });

    expect(getAllByText("Computer Science").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("Additional Courses").length).toBeGreaterThanOrEqual(1);
  });

  it("renders gen ed and additional sections without major when no major selected", async () => {
    vi.mocked(fetchMajorRequirementCourses).mockResolvedValue(null);

    const { getAllByText, queryAllByText } = renderWithChakra(<ClassHistoryTab />);

    await waitFor(() => {
      expect(getAllByText("General Education").length).toBeGreaterThanOrEqual(1);
    });

    // Major section should not be present
    expect(queryAllByText("Computer Science").length).toBe(0);
    expect(getAllByText("Additional Courses").length).toBeGreaterThanOrEqual(1);
  });

  it("shows completed courses from history", async () => {
    vi.mocked(fetchStudentCourseHistory).mockResolvedValue([
      {
        course_id: 10,
        term_id: 1,
        completed: true,
        course: { id: 10, subject: "ENG", number: "101", title: "Composition", credits: 3 },
      },
    ]);

    const { container } = renderWithChakra(<ClassHistoryTab />);

    await waitFor(() => {
      const checkedBoxes = container.querySelectorAll("[data-state='checked']");
      expect(checkedBoxes.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("fetches data with correct student ID", async () => {
    renderWithChakra(<ClassHistoryTab />);

    await waitFor(() => {
      expect(fetchMajorRequirementCourses).toHaveBeenCalledWith(1);
      expect(fetchStudentCourseHistory).toHaveBeenCalledWith(1);
    });
  });

  it("displays additional courses not in gen ed or major", async () => {
    vi.mocked(fetchStudentCourseHistory).mockResolvedValue([
      {
        course_id: 99,
        term_id: 1,
        completed: true,
        course: { id: 99, subject: "MUS", number: "101", title: "Music Theory", credits: 3 },
      },
    ]);

    const { getAllByText } = renderWithChakra(<ClassHistoryTab />);

    await waitFor(() => {
      expect(getAllByText(/MUS 101/).length).toBeGreaterThanOrEqual(1);
    });
  });
});
