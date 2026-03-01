import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, act } from "@testing-library/react";
import { renderWithChakra } from "../../../helpers/mocks";

const {
  mockPush,
  mockRouter,
  mockGetUser,
  mockFrom,
  mockToaster,
  mockFetchPlans,
  mockCreatePlan,
  mockFetchTerms,
  mockFetchPlannedCourses,
  mockFetchAvailableCourses,
  mockFetchCompletedCourseIds,
} = vi.hoisted(() => {
  const mockPush = vi.fn();
  return {
    mockPush,
    // Stable object reference — prevents useEffect([router]) from re-firing on every render
    mockRouter: { push: mockPush },
    mockGetUser: vi.fn(),
    mockFrom: vi.fn(),
    mockToaster: { create: vi.fn() },
    mockFetchPlans: vi.fn(),
    mockCreatePlan: vi.fn().mockResolvedValue({ id: 99, name: "My Plan", student_id: 1 }),
    mockFetchTerms: vi.fn().mockResolvedValue([]),
    mockFetchPlannedCourses: vi.fn().mockResolvedValue([]),
    mockFetchAvailableCourses: vi.fn().mockResolvedValue([]),
    mockFetchCompletedCourseIds: vi.fn().mockResolvedValue(new Set()),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

vi.mock("@/components/ui/toaster", () => ({ toaster: mockToaster }));
vi.mock("@/components/ui/color-mode", () => ({ ColorModeButton: () => null }));

vi.mock("@/lib/supabase/queries/planner", () => ({
  fetchPlans: mockFetchPlans,
  fetchStudentTerms: mockFetchTerms,
  fetchPlannedCourses: mockFetchPlannedCourses,
  fetchAvailableCourses: mockFetchAvailableCourses,
  fetchCompletedCourseIds: mockFetchCompletedCourseIds,
  createPlan: mockCreatePlan,
  updatePlan: vi.fn().mockResolvedValue(undefined),
  deletePlan: vi.fn().mockResolvedValue(undefined),
  getOrCreateTerm: vi.fn().mockResolvedValue({ id: 1, season: "Fall", year: 2024 }),
  addTermPlan: vi.fn().mockResolvedValue(undefined),
  removeTermPlan: vi.fn().mockResolvedValue(undefined),
  addPlannedCourse: vi.fn().mockResolvedValue(undefined),
  removePlannedCourse: vi.fn().mockResolvedValue(undefined),
  movePlannedCourse: vi.fn().mockResolvedValue(undefined),
}));

// Mock all child components to avoid DnD and complex setup
vi.mock("@/components/planner/PlansHub", () => ({
  default: ({ plans }: { plans: any[] }) => (
    <div data-testid="plans-hub">{plans.length} plans</div>
  ),
}));
vi.mock("@/components/planner/SemesterGrid", () => ({
  default: () => <div data-testid="semester-grid" />,
}));
vi.mock("@/components/planner/CoursePanel", () => ({
  default: () => <div data-testid="course-panel" />,
}));
vi.mock("@/components/planner/PlannerSummary", () => ({
  default: () => <div data-testid="planner-summary" />,
}));
vi.mock("@/components/planner/AddSemesterDialog", () => ({
  default: () => null,
}));
vi.mock("@/components/planner/RemoveSemesterDialog", () => ({
  default: () => null,
}));
vi.mock("@/components/planner/CreatePlanDialog", () => ({
  default: () => null,
}));
vi.mock("@/components/planner/DeletePlanDialog", () => ({
  default: () => null,
}));
vi.mock("@/components/planner/DraggableCourseCard", () => ({
  default: () => null,
}));
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  DragOverlay: ({ children }: any) => <div>{children}</div>,
  PointerSensor: class {},
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

import PlannerPage from "@/app/dashboard/planner/page";

// ── Helpers ─────────────────────────────────────────────────────────────────

function mockStudentRow(studentRow: { id: number } | null, error = null) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: studentRow, error });
  mockFrom.mockReturnValue(chain);
}

function mockStudentAndPrograms(studentId: number, programIds: number[] = []) {
  // First call: students table
  const studentChain: Record<string, any> = {};
  studentChain.select = vi.fn().mockReturnValue(studentChain);
  studentChain.eq = vi.fn().mockReturnValue(studentChain);
  studentChain.maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: { id: studentId }, error: null });

  // Second call: student_programs table
  const programsChain: Record<string, any> = {};
  programsChain.select = vi.fn().mockReturnValue(programsChain);
  programsChain.eq = vi.fn().mockReturnValue(programsChain);
  programsChain.then = vi
    .fn()
    .mockImplementation((resolve: (v: unknown) => void) =>
      resolve({
        data: programIds.map((id) => ({ program_id: id })),
        error: null,
      })
    );

  mockFrom
    .mockReturnValueOnce(studentChain)
    .mockReturnValueOnce(programsChain);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("PlannerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the default resolved values after vi.clearAllMocks()
    mockFetchTerms.mockResolvedValue([]);
    mockFetchPlannedCourses.mockResolvedValue([]);
    mockFetchAvailableCourses.mockResolvedValue([]);
    mockFetchCompletedCourseIds.mockResolvedValue(new Set());
    mockCreatePlan.mockResolvedValue({ id: 99, name: "My Plan", student_id: 1 });
  });

  it("shows loading spinner initially", () => {
    // getUser never resolves — stay in loading state
    mockGetUser.mockReturnValue(new Promise(() => {}));
    renderWithChakra(<PlannerPage />);
    expect(screen.getAllByText(/loading/i).length).toBeGreaterThanOrEqual(1);
  });

  it("redirects to signin when no user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await act(async () => {
      renderWithChakra(<PlannerPage />);
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/signin");
    });
  });

  it("redirects to dashboard when student profile not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockStudentRow(null);
    await act(async () => {
      renderWithChakra(<PlannerPage />);
    });
    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error" })
      );
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("renders PlansHub with existing plans", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockStudentRow({ id: 1 });
    mockFetchPlans.mockResolvedValue([
      {
        id: 1,
        name: "Plan A",
        has_graduate_program: false,
        program_ids: [],
        term_count: 0,
        course_count: 0,
        total_credits: 0,
      },
    ]);

    await act(async () => {
      renderWithChakra(<PlannerPage />);
    });
    await waitFor(() => {
      expect(screen.getByTestId("plans-hub")).toBeInTheDocument();
    });
  });

  it("auto-creates a plan when student has no plans", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockStudentAndPrograms(1, [10]);
    mockFetchPlans
      .mockResolvedValueOnce([]) // First call: no plans
      .mockResolvedValueOnce([
        {
          id: 99,
          name: "My Plan",
          has_graduate_program: false,
          program_ids: [10],
          term_count: 0,
          course_count: 0,
          total_credits: 0,
        },
      ]);

    await act(async () => {
      renderWithChakra(<PlannerPage />);
    });
    await waitFor(() => {
      expect(mockCreatePlan).toHaveBeenCalledWith(1, "My Plan", null, [10]);
    });
  });

  it("shows error toaster when student query errors", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const chain: Record<string, any> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: new Error("DB error") });
    mockFrom.mockReturnValue(chain);

    await act(async () => {
      renderWithChakra(<PlannerPage />);
    });
    await waitFor(() => {
      expect(mockToaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error" })
      );
    });
  });

  it("shows plans count in PlansHub mock", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockStudentRow({ id: 1 });
    mockFetchPlans.mockResolvedValue([
      {
        id: 1,
        name: "Plan A",
        has_graduate_program: false,
        program_ids: [],
        term_count: 0,
        course_count: 0,
        total_credits: 0,
      },
      {
        id: 2,
        name: "Plan B",
        has_graduate_program: false,
        program_ids: [],
        term_count: 0,
        course_count: 0,
        total_credits: 0,
      },
    ]);

    await act(async () => {
      renderWithChakra(<PlannerPage />);
    });
    await waitFor(() => {
      // PlansHub mock renders "{plans.length} plans"
      expect(screen.getAllByText("2 plans").length).toBeGreaterThanOrEqual(1);
    });
  });
});
