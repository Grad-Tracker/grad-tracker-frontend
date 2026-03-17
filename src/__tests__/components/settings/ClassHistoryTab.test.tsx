import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor, act, fireEvent } from "@testing-library/react";
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

// Mock child components to capture and invoke their callbacks
let capturedGenEdToggle: ((courseId: number, checked: boolean) => void) | null = null;
let capturedMajorToggle: ((courseId: number, checked: boolean) => void) | null = null;
let capturedAddCourse: ((course: any) => void) | null = null;
let capturedDeleteAdditional: ((courseId: number) => void) | null = null;

vi.mock("@/components/settings/GenEdChecklist", () => ({
  GenEdChecklist: (props: any) => {
    capturedGenEdToggle = props.onToggle;
    return (
      <div data-testid="gen-ed-checklist">
        GenEd: {props.completedCourseIds.size} completed
        {props.buckets.map((b: any) => (
          <span key={b.id}>{b.name}</span>
        ))}
      </div>
    );
  },
}));

vi.mock("@/components/settings/MajorChecklist", () => ({
  MajorChecklist: (props: any) => {
    capturedMajorToggle = props.onToggle;
    return (
      <div data-testid="major-checklist">
        Major: {props.major.majorName} - {props.completedCourseIds.size} completed
      </div>
    );
  },
}));

vi.mock("@/components/settings/AdditionalCourses", () => ({
  AdditionalCourses: (props: any) => {
    capturedAddCourse = props.onCourseSelected;
    capturedDeleteAdditional = props.onDelete;
    return (
      <div data-testid="additional-courses">
        Additional: {props.courses.length} courses
        <button data-testid="add-btn" onClick={() => props.onCourseSelected({ id: 999, subject: "NEW", number: "100", title: "New Course", credits: 3 })}>
          Add
        </button>
        {props.courses.map((c: any) => (
          <button key={c.id} data-testid={`delete-${c.id}`} onClick={() => props.onDelete(c.id)}>
            Delete {c.subject}
          </button>
        ))}
      </div>
    );
  },
}));

import { createClient } from "@/lib/supabase/client";
import {
  fetchDefaultTermId,
  fetchMajorRequirementCourses,
  fetchStudentCourseHistory,
  insertCourseHistory,
  deleteCourseHistory,
} from "@/lib/supabase/queries/classHistory";
import { fetchGenEdBucketsWithCourses } from "@/lib/supabase/queries/planner";
import { toaster } from "@/components/ui/toaster";

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
    capturedGenEdToggle = null;
    capturedMajorToggle = null;
    capturedAddCourse = null;
    capturedDeleteAdditional = null;
    setupAuthMock(1);
    vi.mocked(fetchDefaultTermId).mockResolvedValue(1);
    vi.mocked(fetchGenEdBucketsWithCourses).mockResolvedValue(mockBuckets);
    vi.mocked(fetchMajorRequirementCourses).mockResolvedValue(mockMajor);
    vi.mocked(fetchStudentCourseHistory).mockResolvedValue([]);
    vi.mocked(insertCourseHistory).mockResolvedValue(undefined);
    vi.mocked(deleteCourseHistory).mockResolvedValue(undefined);
  });

  it("shows loading spinner initially then loads data", async () => {
    const { getByTestId } = renderWithChakra(<ClassHistoryTab />);

    await waitFor(() => {
      expect(getByTestId("gen-ed-checklist")).toBeTruthy();
    });
  });

  it("renders all three sections after loading", async () => {
    const { getByTestId } = renderWithChakra(<ClassHistoryTab />);

    await waitFor(() => {
      expect(getByTestId("gen-ed-checklist")).toBeTruthy();
      expect(getByTestId("major-checklist")).toBeTruthy();
      expect(getByTestId("additional-courses")).toBeTruthy();
    });
  });

  it("hides major section when no major selected", async () => {
    vi.mocked(fetchMajorRequirementCourses).mockResolvedValue(null);

    const { getByTestId, queryByTestId } = renderWithChakra(<ClassHistoryTab />);

    await waitFor(() => {
      expect(getByTestId("gen-ed-checklist")).toBeTruthy();
    });

    expect(queryByTestId("major-checklist")).toBeNull();
    expect(getByTestId("additional-courses")).toBeTruthy();
  });

  it("fetches data with correct student ID", async () => {
    renderWithChakra(<ClassHistoryTab />);

    await waitFor(() => {
      expect(fetchMajorRequirementCourses).toHaveBeenCalledWith(1);
      expect(fetchStudentCourseHistory).toHaveBeenCalledWith(1);
    });
  });

  it("passes completed course IDs from history to children", async () => {
    vi.mocked(fetchStudentCourseHistory).mockResolvedValue([
      {
        course_id: 10,
        term_id: 1,
        completed: true,
        course: { id: 10, subject: "ENG", number: "101", title: "Composition", credits: 3 },
      },
    ]);

    const { getByTestId } = renderWithChakra(<ClassHistoryTab />);

    await waitFor(() => {
      expect(getByTestId("gen-ed-checklist").textContent).toContain("1 completed");
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

    const { getByTestId } = renderWithChakra(<ClassHistoryTab />);

    await waitFor(() => {
      expect(getByTestId("additional-courses").textContent).toContain("1 courses");
    });
  });

  // --- Mutation callback tests ---

  it("handleToggle (check ON) calls insertCourseHistory and updates state", async () => {
    const { getByTestId } = renderWithChakra(<ClassHistoryTab />);

    await waitFor(() => {
      expect(capturedGenEdToggle).not.toBeNull();
    });

    // Toggle course 10 ON
    await act(async () => {
      capturedGenEdToggle!(10, true);
    });

    expect(insertCourseHistory).toHaveBeenCalledWith(1, 10, 1);

    // Optimistic update should show 1 completed
    await waitFor(() => {
      expect(getByTestId("gen-ed-checklist").textContent).toContain("1 completed");
    });
  });

  it("handleToggle (check OFF) calls deleteCourseHistory with actual term_id", async () => {
    vi.mocked(fetchStudentCourseHistory).mockResolvedValue([
      {
        course_id: 10,
        term_id: 5, // Different from default (1)
        completed: true,
        course: { id: 10, subject: "ENG", number: "101", title: "Composition", credits: 3 },
      },
    ]);

    const { getByTestId } = renderWithChakra(<ClassHistoryTab />);

    await waitFor(() => {
      expect(capturedGenEdToggle).not.toBeNull();
      expect(getByTestId("gen-ed-checklist").textContent).toContain("1 completed");
    });

    // Toggle course 10 OFF
    await act(async () => {
      capturedGenEdToggle!(10, false);
    });

    // Should use the actual term_id (5), not defaultTermId (1)
    expect(deleteCourseHistory).toHaveBeenCalledWith(1, 10, 5);
  });

  it("handleToggle rolls back on insert failure", async () => {
    vi.mocked(insertCourseHistory).mockRejectedValue(new Error("insert failed"));
    vi.mocked(fetchStudentCourseHistory).mockResolvedValue([]);

    const { getByTestId } = renderWithChakra(<ClassHistoryTab />);

    await waitFor(() => {
      expect(capturedGenEdToggle).not.toBeNull();
    });

    await act(async () => {
      capturedGenEdToggle!(10, true);
    });

    // Should show error toast
    await waitFor(() => {
      expect(toaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Failed to update", type: "error" })
      );
    });

    // Rollback: re-fetched history (empty)
    expect(fetchStudentCourseHistory).toHaveBeenCalledTimes(2); // initial + rollback
  });

  it("handleAddCourse inserts and shows success toast", async () => {
    const { getByTestId } = renderWithChakra(<ClassHistoryTab />);

    await waitFor(() => {
      expect(getByTestId("additional-courses")).toBeTruthy();
    });

    // Click the Add button in the mocked AdditionalCourses
    await act(async () => {
      fireEvent.click(getByTestId("add-btn"));
    });

    expect(insertCourseHistory).toHaveBeenCalledWith(1, 999, 1);

    await waitFor(() => {
      expect(toaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Course added to history", type: "success" })
      );
    });
  });

  it("handleAddCourse rolls back on failure", async () => {
    vi.mocked(insertCourseHistory).mockRejectedValue(new Error("failed"));

    const { getByTestId } = renderWithChakra(<ClassHistoryTab />);

    await waitFor(() => {
      expect(getByTestId("additional-courses")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(getByTestId("add-btn"));
    });

    await waitFor(() => {
      expect(toaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Failed to add course", type: "error" })
      );
    });

    // Course should be rolled back — additional should show 0
    await waitFor(() => {
      expect(getByTestId("additional-courses").textContent).toContain("0 courses");
    });
  });

  it("handleDeleteAdditional deletes and shows success toast", async () => {
    vi.mocked(fetchStudentCourseHistory).mockResolvedValue([
      {
        course_id: 99,
        term_id: 3,
        completed: true,
        course: { id: 99, subject: "MUS", number: "101", title: "Music Theory", credits: 3 },
      },
    ]);

    const { getByTestId } = renderWithChakra(<ClassHistoryTab />);

    await waitFor(() => {
      expect(getByTestId("additional-courses").textContent).toContain("1 courses");
    });

    await act(async () => {
      fireEvent.click(getByTestId("delete-99"));
    });

    expect(deleteCourseHistory).toHaveBeenCalledWith(1, 99, 3);

    await waitFor(() => {
      expect(toaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Course removed", type: "success" })
      );
    });
  });

  it("handleDeleteAdditional rolls back on failure", async () => {
    vi.mocked(deleteCourseHistory).mockRejectedValue(new Error("delete failed"));
    vi.mocked(fetchStudentCourseHistory).mockResolvedValue([
      {
        course_id: 99,
        term_id: 3,
        completed: true,
        course: { id: 99, subject: "MUS", number: "101", title: "Music Theory", credits: 3 },
      },
    ]);

    const { getByTestId } = renderWithChakra(<ClassHistoryTab />);

    await waitFor(() => {
      expect(getByTestId("additional-courses").textContent).toContain("1 courses");
    });

    await act(async () => {
      fireEvent.click(getByTestId("delete-99"));
    });

    await waitFor(() => {
      expect(toaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Failed to remove course", type: "error" })
      );
    });

    // Rollback: course should reappear
    await waitFor(() => {
      expect(getByTestId("additional-courses").textContent).toContain("1 courses");
    });
  });
});
